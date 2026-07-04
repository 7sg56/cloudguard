"""ARQ worker for async Prowler scans."""

import logging
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from arq.connections import RedisSettings
from sqlalchemy import select

from config import settings
from database import async_session
from models.scan import Scan
from models.finding import Finding
from models.account import CloudAccount
from services.prowler_runner import ProwlerRunner

logger = logging.getLogger(__name__)


async def run_prowler_scan(ctx: dict, scan_id: str, account_id: str) -> dict:
    """Execute a Prowler scan and store findings in the database."""
    logger.info("Starting Prowler scan %s for account %s", scan_id, account_id)

    async with async_session() as db:
        # Get scan and account
        scan_result = await db.execute(select(Scan).where(Scan.id == uuid.UUID(scan_id)))
        scan = scan_result.scalar_one_or_none()
        if not scan:
            return {"error": "Scan not found"}

        account_result = await db.execute(select(CloudAccount).where(CloudAccount.account_id == account_id))
        account = account_result.scalar_one_or_none()
        if not account:
            scan.status = "failed"
            scan.error_message = "Account not found"
            await db.commit()
            return {"error": "Account not found"}

        try:
            scan.status = "running"
            await db.commit()

            # Run Prowler
            raw_findings = await ProwlerRunner.run_scan(
                role_arn=account.role_arn,
                external_id=account.external_id,
                regions=account.regions or ["us-east-1"],
            )

            # Store findings
            for raw in raw_findings:
                finding = Finding(
                    account_id=account_id,
                    scan_id=uuid.UUID(scan_id),
                    check_id=raw.get("check_id", ""),
                    resource_id=raw.get("resource_id"),
                    resource_type=raw.get("resource_type"),
                    service=raw.get("service"),
                    region=raw.get("region"),
                    title=raw.get("title", ""),
                    status=raw.get("status", "fail"),
                    severity=raw.get("severity", "info"),
                    compliance_type=raw.get("compliance_type"),
                    description=raw.get("description"),
                    recommendation=raw.get("recommendation"),
                    raw_data=raw.get("raw_data", {}),
                )
                db.add(finding)

            scan.status = "completed"
            scan.findings_count = len(raw_findings)
            scan.finished_at = datetime.now(timezone.utc)
            await db.commit()

            logger.info("Scan %s completed: %d findings", scan_id, len(raw_findings))
            return {"status": "completed", "findings_count": len(raw_findings)}

        except Exception as e:
            logger.error("Scan %s failed: %s", scan_id, e)
            scan.status = "failed"
            scan.error_message = str(e)
            scan.finished_at = datetime.now(timezone.utc)
            await db.commit()
            return {"error": str(e)}


def _parse_redis_url(url: str) -> RedisSettings:
    """Parse a redis:// URL into arq RedisSettings fields."""
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or 0),
        password=parsed.password or None,
        username=parsed.username or None,
    )


class WorkerSettings:
    """ARQ worker configuration."""

    functions = [run_prowler_scan]
    redis_settings = _parse_redis_url(settings.REDIS_URL)
    max_jobs = 2
    job_timeout = 3600  # 1 hour
