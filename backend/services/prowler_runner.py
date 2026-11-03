import asyncio
import json
import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


class ProwlerRunner:
    """Executes Prowler CLI scans and parses results."""

    @staticmethod
    async def run_scan(
        role_arn: str | None,
        external_id: str | None,
        regions: list[str],
        output_dir: str | None = None,
        checks: list[str] | None = None,
        services: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Run a Prowler scan and return parsed findings."""
        if not checks and not services:
            services = ["s3", "iam", "ec2", "vpc", "accessanalyzer", "rds"]
        base_dir = output_dir or settings.PROWLER_OUTPUT_DIR
        scan_dir = os.path.join(base_dir, f"scan_{uuid.uuid4().hex[:8]}")
        os.makedirs(scan_dir, exist_ok=True)

        candidates = [
            shutil.which("prowler"),
            "/venv/bin/prowler",
            "/usr/local/bin/prowler",
            "/opt/homebrew/bin/prowler",
        ]
        prowler_bin = next((c for c in candidates if c and os.path.exists(c)), None)
        if not prowler_bin:
            raise FileNotFoundError("Prowler binary not found in PATH or standard directories.")

        regions_str = " ".join(regions) if regions else settings.AWS_DEFAULT_REGION

        # Check if role_arn is a real IAM role (not an IAM user ARN or empty)
        is_role_arn = bool(role_arn and ":role/" in role_arn)

        def _build_args(use_role: bool) -> list[str]:
            """Build Prowler command arguments as a list (safe from shell injection)."""
            args = [
                prowler_bin,
                "aws",
                "--filter-region", regions_str,
                "-M", "json-ocsf",
                "-o", scan_dir,
                "--no-banner",
                "--no-color",
                "--ignore-exit-code-3",
            ]

            if checks:
                args.extend(["--check", *checks])
            elif services:
                args.extend(["--service", *services])

            if use_role and is_role_arn:
                args.extend(["-R", role_arn])
                if external_id and len(external_id) >= 2:
                    args.extend(["-I", external_id])

            return args

        async def _exec_prowler(use_role: bool):
            args = _build_args(use_role)
            logger.info("Running Prowler scan: %s", " ".join(args))

            proc = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=3600)
            return proc.returncode, stderr_bytes.decode() if stderr_bytes else ""

        is_role_arn = bool(role_arn and ":role/" in role_arn)
        returncode = -1
        stderr_text = ""

        if is_role_arn:
            returncode, stderr_text = await _exec_prowler(use_role=True)
            if returncode not in (0, 3) and (
                "AssumeRole" in stderr_text
                or "AccessDenied" in stderr_text
                or "credentials" in stderr_text
                or "ValidationError" in stderr_text
            ):
                logger.warning(
                    "Prowler with role %s failed (%s). Retrying with direct AWS credentials.",
                    role_arn,
                    stderr_text,
                )
                returncode, stderr_text = await _exec_prowler(use_role=False)
        else:
            logger.info("Account role_arn is not an IAM role (%s). Running Prowler with direct credentials.", role_arn)
            returncode, stderr_text = await _exec_prowler(use_role=False)

        # Parse JSON-OCSF output files
        findings = ProwlerRunner._parse_output(scan_dir)

        if returncode not in (0, 3) and not findings:
            clean_err = stderr_text.strip() or f"Prowler exited with status code {returncode}"
            logger.error("Prowler scan failed with exit code %d: %s", returncode, clean_err)
            raise RuntimeError(f"Prowler scan failed: {clean_err}")

        logger.info("Prowler scan completed: %d findings parsed", len(findings))
        return findings

    @staticmethod
    def _parse_output(output_dir: str) -> list[dict[str, Any]]:
        """Parse Prowler JSON-OCSF output files into normalized findings."""
        findings: list[dict[str, Any]] = []

        for json_file in Path(output_dir).rglob("*.ocsf.json"):
            try:
                with open(json_file) as f:
                    content = f.read().strip()
                    if not content:
                        continue

                    # Try parsing as JSON array first (Prowler 5.x default)
                    try:
                        events = json.loads(content)
                        if isinstance(events, list):
                            for event in events:
                                item = ProwlerRunner._normalize_finding(event)
                                if item:
                                    findings.append(item)
                            continue
                        elif isinstance(events, dict):
                            item = ProwlerRunner._normalize_finding(events)
                            if item:
                                findings.append(item)
                            continue
                    except json.JSONDecodeError:
                        pass

                    # Fallback to JSON lines
                    for line in content.splitlines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            event = json.loads(line)
                            item = ProwlerRunner._normalize_finding(event)
                            if item:
                                findings.append(item)
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                logger.warning("Failed to parse %s: %s", json_file, e)

        return findings

    @staticmethod
    def _normalize_finding(event: dict) -> dict[str, Any] | None:
        """Normalize a Prowler OCSF event into our Finding format."""
        try:
            severity_map = {
                "critical": "critical",
                "high": "high",
                "medium": "medium",
                "low": "low",
                "informational": "info",
                "info": "info",
            }

            status_map = {
                "PASS": "pass",
                "FAIL": "fail",
                "MANUAL": "manual",
                "MUTED": "muted",
            }

            finding_info = event.get("finding_info", {})
            metadata = event.get("metadata", {})
            resources = event.get("resources", [{}])
            resource = resources[0] if resources else {}
            group = resource.get("group", {})
            remediation = event.get("remediation", {})
            unmapped = event.get("unmapped", {})

            # Severity
            raw_severity = event.get("severity", "informational")
            if isinstance(raw_severity, dict):
                raw_severity = raw_severity.get("text", "informational")
            severity = severity_map.get(str(raw_severity).lower(), "info")

            # Status
            raw_status = event.get("status_code") or event.get("status", "FAIL")
            if isinstance(raw_status, dict):
                raw_status = raw_status.get("text", "FAIL")
            status = status_map.get(str(raw_status).upper(), "fail")

            # Service name
            service_name = group.get("name") or resource.get("cloud_partition") or event.get("class_name", "aws")

            # Check ID
            check_id = metadata.get("event_code") or finding_info.get("uid") or metadata.get("uid", "")

            # Compliance frameworks summary
            compliance_dict = unmapped.get("compliance", {})
            compliance_summary = ", ".join(list(compliance_dict.keys())[:3]) if compliance_dict else None

            return {
                "check_id": check_id,
                "title": finding_info.get("title") or event.get("message", ""),
                "description": finding_info.get("desc") or event.get("status_detail", ""),
                "recommendation": remediation.get("desc", ""),
                "severity": severity,
                "status": status,
                "resource_id": resource.get("uid") or resource.get("name", ""),
                "resource_type": resource.get("type", "AWS Resource"),
                "service": service_name,
                "region": resource.get("region") or event.get("cloud", {}).get("region", "global"),
                "compliance_type": compliance_summary,
                "compliance": compliance_dict,
                "remediation": remediation,
                "raw_data": {
                    "prowler_status": raw_status,
                    "risk_details": event.get("risk_details", ""),
                    "compliance": compliance_dict,
                    "references": remediation.get("references", []),
                },
            }
        except Exception as e:
            logger.warning("Failed to normalize finding: %s", e)
            return None
