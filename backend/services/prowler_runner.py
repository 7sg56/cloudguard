import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


class ProwlerRunner:
    """Executes Prowler CLI scans and parses results."""

    @staticmethod
    async def run_scan(
        role_arn: str,
        external_id: str,
        regions: list[str],
        output_dir: str | None = None,
    ) -> list[dict[str, Any]]:
        """Run a Prowler scan and return parsed findings."""
        output_dir = output_dir or settings.PROWLER_OUTPUT_DIR
        os.makedirs(output_dir, exist_ok=True)

        regions_str = " ".join(regions)
        cmd = (
            f"prowler aws "
            f"-R {role_arn} "
            f"-T {external_id} "
            f"--filter-region {regions_str} "
            f"-M json-ocsf "
            f"-o {output_dir} "
            f"--no-banner"
        )

        logger.info("Running Prowler scan: %s", cmd)

        process = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=3600,  # 1 hour max
        )

        if process.returncode != 0:
            error_msg = stderr.decode().strip() if stderr else "Unknown error"
            logger.error("Prowler scan failed: %s", error_msg)
            raise RuntimeError(f"Prowler scan failed: {error_msg}")

        # Parse JSON-OCSF output files
        findings = ProwlerRunner._parse_output(output_dir)
        logger.info("Prowler scan completed: %d findings", len(findings))
        return findings

    @staticmethod
    def _parse_output(output_dir: str) -> list[dict[str, Any]]:
        """Parse Prowler JSON-OCSF output files into normalized findings."""
        findings: list[dict[str, Any]] = []

        for json_file in Path(output_dir).glob("*.ocsf.json"):
            try:
                with open(json_file) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            event = json.loads(line)
                            finding = ProwlerRunner._normalize_finding(event)
                            if finding:
                                findings.append(finding)
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                logger.warning("Failed to parse %s: %s", json_file, e)

        return findings

    @staticmethod
    def _normalize_finding(event: dict) -> dict[str, Any] | None:
        """Normalize a Prowler OCSF event into our Finding format."""
        try:
            # Map OCSF severity to our severity levels
            severity_map = {
                "Critical": "critical",
                "High": "high",
                "Medium": "medium",
                "Low": "low",
                "Informational": "info",
            }

            status_map = {
                "PASS": "pass",
                "FAIL": "fail",
                "MANUAL": "manual",
            }

            finding_info = event.get("finding_info", {})
            resources = event.get("resources", [{}])
            resource = resources[0] if resources else {}

            severity_label = event.get("severity", "Informational")
            if isinstance(severity_label, dict):
                severity_label = severity_label.get("text", "Informational")

            prowler_status = event.get("status", "FAIL")
            if isinstance(prowler_status, dict):
                prowler_status = prowler_status.get("text", "FAIL")

            return {
                "check_id": finding_info.get("uid", event.get("metadata", {}).get("uid", "")),
                "title": finding_info.get("title", ""),
                "description": finding_info.get("desc", ""),
                "recommendation": event.get("remediation", {}).get("desc", ""),
                "severity": severity_map.get(severity_label, "info"),
                "status": status_map.get(prowler_status, "fail"),
                "resource_id": resource.get("uid", ""),
                "resource_type": resource.get("type", ""),
                "service": resource.get("cloud_partition", event.get("class_name", "")),
                "region": resource.get("region", ""),
                "compliance_type": None,
                "raw_data": {"prowler_status": prowler_status},
            }
        except Exception as e:
            logger.warning("Failed to normalize finding: %s", e)
            return None
