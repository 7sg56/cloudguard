import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.scan import Scan
from models.account import CloudAccount
from models.resource import CloudResource
from models.finding import Finding
from services.aws_session import AWSSessionManager
from services.resource_discovery import ResourceDiscoveryService

import redis.asyncio as aioredis
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scan", tags=["scans"])


async def _run_scan_background(
    scan_id: str,
    account_id: str,
    role_arn: str,
    external_id: str,
    regions: list[str],
    include_prowler: bool,
):
    """Background task that runs resource discovery and optionally Prowler."""
    from database import async_session_factory

    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    session_mgr = AWSSessionManager(redis_client)

    async with async_session_factory() as db:
        # Get the scan record
        result = await db.execute(select(Scan).where(Scan.id == uuid.UUID(scan_id)))
        scan = result.scalar_one_or_none()
        if not scan:
            logger.error("Scan %s not found", scan_id)
            return

        resources_scanned = 0
        findings_count = 0

        try:
            # ── Phase 1: Resource Discovery via boto3 ──────────────────────
            logger.info("Scan %s: Starting resource discovery for account %s", scan_id, account_id)

            for region in regions:
                try:
                    boto_session = await session_mgr.get_session(role_arn, external_id, region)
                    discovered = ResourceDiscoveryService.discover_all(boto_session, [region])

                    for res_data in discovered:
                        # Upsert: update if resource_id exists, else create
                        existing_result = await db.execute(
                            select(CloudResource).where(
                                CloudResource.account_id == account_id,
                                CloudResource.resource_id == res_data["resource_id"],
                            )
                        )
                        existing = existing_result.scalar_one_or_none()

                        if existing:
                            existing.resource_type = res_data.get("resource_type", existing.resource_type)
                            existing.service = res_data.get("service", existing.service)
                            existing.region = res_data.get("region", existing.region)
                            existing.tags = res_data.get("tags", existing.tags)
                            existing.is_public = res_data.get("is_public", existing.is_public)
                            existing.encrypted = res_data.get("encrypted", existing.encrypted)
                            existing.raw_data = res_data.get("raw_data", existing.raw_data)
                            existing.last_seen = datetime.now(timezone.utc)
                        else:
                            resource = CloudResource(
                                account_id=account_id,
                                resource_id=res_data["resource_id"],
                                resource_type=res_data.get("resource_type", ""),
                                service=res_data.get("service", ""),
                                region=res_data.get("region", region),
                                tags=res_data.get("tags", {}),
                                is_public=res_data.get("is_public"),
                                encrypted=res_data.get("encrypted"),
                                raw_data=res_data.get("raw_data", {}),
                                last_seen=datetime.now(timezone.utc),
                            )
                            db.add(resource)

                        resources_scanned += 1

                    await db.commit()
                    logger.info("Scan %s: Discovered %d resources in %s", scan_id, len(discovered), region)

                except Exception as e:
                    logger.warning("Scan %s: Failed resource discovery in %s: %s", scan_id, region, e)
                    continue

            # ── Phase 2: Prowler (optional) ────────────────────────────────
            if include_prowler:
                try:
                    from services.prowler_runner import ProwlerRunner
                    prowler_findings = await ProwlerRunner.run_scan(
                        role_arn=role_arn,
                        external_id=external_id,
                        regions=regions,
                    )

                    for f_data in prowler_findings:
                        finding = Finding(
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
                        )
                        db.add(finding)
                        findings_count += 1

                    await db.commit()
                    logger.info("Scan %s: Prowler found %d findings", scan_id, findings_count)

                except FileNotFoundError:
                    logger.warning("Scan %s: Prowler CLI not installed, skipping compliance scan", scan_id)
                except Exception as e:
                    logger.warning("Scan %s: Prowler scan failed: %s", scan_id, e)

            # ── Finalize ──────────────────────────────────────────────────
            scan.status = "completed"
            scan.finished_at = datetime.now(timezone.utc)
            scan.resources_scanned = resources_scanned
            scan.findings_count = findings_count

            # Update account status
            acct_result = await db.execute(
                select(CloudAccount).where(CloudAccount.account_id == account_id)
            )
            account = acct_result.scalar_one_or_none()
            if account:
                account.status = "connected"

            await db.commit()
            logger.info("Scan %s: Completed. %d resources, %d findings", scan_id, resources_scanned, findings_count)

        except Exception as e:
            logger.error("Scan %s: Fatal error: %s", scan_id, e)
            scan.status = "failed"
            scan.error_message = str(e)
            scan.finished_at = datetime.now(timezone.utc)
            await db.commit()

        finally:
            await redis_client.aclose()


@router.post("/{account_id}")
async def trigger_scan(
    account_id: str,
    include_prowler: bool = Query(False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a security scan for an account."""
    # Resolve account by UUID or 12-digit ID
    account = None
    try:
        val = uuid.UUID(account_id)
        result = await db.execute(select(CloudAccount).where(CloudAccount.id == val))
        account = result.scalar_one_or_none()
    except ValueError:
        pass

    if not account:
        result = await db.execute(select(CloudAccount).where(CloudAccount.account_id == account_id))
        account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    target_aws_account_id = account.account_id

    # Create scan record
    scan = Scan(
        account_id=target_aws_account_id,
        scan_type="full" if include_prowler else "resources_only",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(scan)
    account.last_scan_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(scan)

    # Launch the scan in background
    background_tasks.add_task(
        _run_scan_background,
        str(scan.id),
        target_aws_account_id,
        account.role_arn,
        account.external_id or "",
        account.regions or ["us-east-1"],
        include_prowler,
    )

    return {
        "id": str(scan.id),
        "account_id": scan.account_id,
        "status": scan.status,
        "scan_type": scan.scan_type,
        "started_at": scan.started_at.isoformat(),
        "finished_at": None,
        "findings_count": 0,
        "resources_scanned": 0,
        "error_message": None,
    }


@router.get("/{scan_id}/status")
async def get_scan_status(scan_id: str, db: AsyncSession = Depends(get_db)):
    """Get the status of a scan."""
    result = await db.execute(select(Scan).where(Scan.id == uuid.UUID(scan_id)))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    return {
        "id": str(scan.id),
        "account_id": scan.account_id,
        "status": scan.status,
        "scan_type": scan.scan_type,
        "started_at": scan.started_at.isoformat() if scan.started_at else None,
        "finished_at": scan.finished_at.isoformat() if scan.finished_at else None,
        "findings_count": scan.findings_count,
        "resources_scanned": scan.resources_scanned,
        "error_message": scan.error_message,
    }


@router.get("/{account_id}/history")
async def get_scan_history(account_id: str, limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    """Get scan history for an account."""
    # Resolve account by UUID or 12-digit ID
    target_id = account_id
    try:
        val = uuid.UUID(account_id)
        result = await db.execute(select(CloudAccount.account_id).where(CloudAccount.id == val))
        found = result.scalar_one_or_none()
        if found:
            target_id = found
    except ValueError:
        pass

    result = await db.execute(
        select(Scan)
        .where(Scan.account_id == target_id)
        .order_by(Scan.started_at.desc())
        .limit(limit)
    )
    scans = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "account_id": s.account_id,
            "status": s.status,
            "scan_type": s.scan_type,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            "findings_count": s.findings_count,
            "resources_scanned": s.resources_scanned,
            "error_message": s.error_message,
        }
        for s in scans
    ]
