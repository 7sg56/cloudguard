"""Core scan execution service coordinating AWS resource discovery and Prowler compliance auditing."""

import logging
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from config import settings
from database import async_session_factory
from models.account import CloudAccount
from models.finding import Finding
from models.resource import CloudResource
from models.scan import Scan
from services.aws_session import AWSSessionManager
from services.prowler_runner import ProwlerRunner
from services.resource_discovery import ResourceDiscoveryService

logger = logging.getLogger(__name__)


async def run_security_scan(
    scan_id: str,
    account_id: str,
    include_prowler: bool = False,
) -> dict:
    """Execute resource discovery and optional Prowler compliance scan with atomic upserts and strict error handling."""
    logger.info("Starting security scan %s for account %s (include_prowler=%s)", scan_id, account_id, include_prowler)

    redis_client = None
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception as e:
        logger.warning("Could not connect to Redis for scan %s: %s", scan_id, e)

    session_mgr = AWSSessionManager(redis_client)

    async with async_session_factory() as db:
        result = await db.execute(select(Scan).where(Scan.id == uuid.UUID(scan_id)))
        scan = result.scalar_one_or_none()
        if not scan:
            logger.error("Scan %s not found in database", scan_id)
            return {"error": f"Scan {scan_id} not found"}

        acct_result = await db.execute(select(CloudAccount).where(CloudAccount.account_id == account_id))
        account = acct_result.scalar_one_or_none()
        if not account:
            scan.status = "failed"
            scan.error_message = f"Account {account_id} not found"
            scan.finished_at = datetime.now(timezone.utc)
            await db.commit()
            return {"error": f"Account {account_id} not found"}

        scan.status = "running"
        scan.error_message = None
        await db.commit()

        resources_scanned = 0
        findings_count = 0
        regions = account.regions or ["ap-south-1"]

        try:
            # ── Credentials Validation ───────────────────────────────────
            primary_region = regions[0] if regions else "ap-south-1"
            primary_session = await session_mgr.get_session(account.role_arn, account.external_id, primary_region)
            creds = primary_session.get_credentials()
            if not creds:
                raise RuntimeError(
                    "Unable to locate AWS credentials. Please configure AWS credentials (~/.aws or environment variables) or ensure the IAM role is accessible."
                )

            # Test AWS STS authentication
            sts_client = primary_session.client("sts", region_name=primary_region)
            caller = sts_client.get_caller_identity()
            logger.info("Scan %s: Authenticated as %s (Account: %s)", scan_id, caller.get("Arn"), caller.get("Account"))

            # ── Phase 1: Resource Discovery via boto3 ───────────────────
            logger.info("Scan %s: Enumerating AWS resources across %s", scan_id, regions)
            discovered = ResourceDiscoveryService.discover_all(primary_session, regions)

            for res_data in discovered:
                stmt = insert(CloudResource).values(
                    account_id=account_id,
                    resource_id=res_data["resource_id"],
                    resource_type=res_data.get("resource_type", ""),
                    service=res_data.get("service", ""),
                    region=res_data.get("region", primary_region),
                    tags=res_data.get("tags", {}),
                    is_public=res_data.get("is_public"),
                    encrypted=res_data.get("encrypted"),
                    raw_data=res_data.get("raw_data", {}),
                    last_seen=datetime.now(timezone.utc),
                )
                stmt = stmt.on_conflict_do_update(
                    constraint="uq_account_resource",
                    set_={
                        "resource_type": stmt.excluded.resource_type,
                        "service": stmt.excluded.service,
                        "region": stmt.excluded.region,
                        "tags": stmt.excluded.tags,
                        "is_public": stmt.excluded.is_public,
                        "encrypted": stmt.excluded.encrypted,
                        "raw_data": stmt.excluded.raw_data,
                        "last_seen": stmt.excluded.last_seen,
                    },
                )
                await db.execute(stmt)
                resources_scanned += 1

            await db.commit()
            logger.info("Scan %s: Successfully discovered %d resources", scan_id, resources_scanned)

            # ── Phase 2: Prowler Compliance Scan ─────────────────────────
            if include_prowler:
                logger.info("Scan %s: Executing Prowler compliance scan", scan_id)
                prowler_findings = await ProwlerRunner.run_scan(
                    role_arn=account.role_arn,
                    external_id=account.external_id,
                    regions=regions,
                )

                for f_data in prowler_findings:
                    stmt = insert(Finding).values(
                        account_id=account_id,
                        scan_id=uuid.UUID(scan_id),
                        check_id=f_data.get("check_id", ""),
                        resource_id=f_data.get("resource_id", ""),
                        resource_type=f_data.get("resource_type", ""),
                        service=f_data.get("service", ""),
                        region=f_data.get("region", ""),
                        title=f_data.get("title", ""),
                        status=f_data.get("status", "fail"),
                        severity=f_data.get("severity", "info"),
                        compliance_type=f_data.get("compliance_type"),
                        description=f_data.get("description", ""),
                        recommendation=f_data.get("recommendation", ""),
                        raw_data=f_data.get("raw_data", {}),
                        updated_at=datetime.now(timezone.utc),
                    )
                    stmt = stmt.on_conflict_do_update(
                        constraint="uq_account_check_resource",
                        set_={
                            "scan_id": stmt.excluded.scan_id,
                            "title": stmt.excluded.title,
                            "status": stmt.excluded.status,
                            "severity": stmt.excluded.severity,
                            "compliance_type": stmt.excluded.compliance_type,
                            "description": stmt.excluded.description,
                            "recommendation": stmt.excluded.recommendation,
                            "raw_data": stmt.excluded.raw_data,
                            "updated_at": stmt.excluded.updated_at,
                        },
                    )
                    await db.execute(stmt)
                    findings_count += 1

                await db.commit()
                logger.info("Scan %s: Prowler finished with %d findings", scan_id, findings_count)

            # ── Phase 3: Finalize ────────────────────────────────────────
            scan.status = "completed"
            scan.finished_at = datetime.now(timezone.utc)
            scan.resources_scanned = resources_scanned
            scan.findings_count = findings_count
            scan.error_message = None

            account.status = "connected"
            account.last_scan_at = datetime.now(timezone.utc)
            await db.commit()

            logger.info("Scan %s completed: %d resources, %d findings", scan_id, resources_scanned, findings_count)
            return {
                "status": "completed",
                "resources_scanned": resources_scanned,
                "findings_count": findings_count,
            }

        except Exception as e:
            logger.error("Scan %s failed with error: %s", scan_id, e, exc_info=True)
            scan.status = "failed"
            scan.error_message = str(e)
            scan.finished_at = datetime.now(timezone.utc)
            scan.resources_scanned = resources_scanned
            scan.findings_count = findings_count
            await db.commit()
            return {"status": "failed", "error": str(e)}

        finally:
            if redis_client:
                await redis_client.aclose()
