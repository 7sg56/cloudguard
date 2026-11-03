import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.scan import Scan
from routers.utils import resolve_account, resolve_account_id
from services.scan_service import run_security_scan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scan", tags=["scans"])


async def _run_scan_background(
    scan_id: str,
    account_id: str,
    include_prowler: bool,
):
    """Fallback in-process background task running resource discovery and optional Prowler compliance scan."""
    await run_security_scan(scan_id=scan_id, account_id=account_id, include_prowler=include_prowler)


def _scan_to_dict(scan: Scan) -> dict:
    """Serialize a Scan ORM object to a response dictionary."""
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


@router.post("/{account_id}")
async def trigger_scan(
    account_id: str,
    include_prowler: bool = Query(False),
    background_tasks: BackgroundTasks = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a security scan for an account."""
    account = await resolve_account(account_id, db)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    target_aws_account_id = account.account_id

    # Create scan record in 'pending' state per spec
    scan = Scan(
        account_id=target_aws_account_id,
        scan_type="full" if include_prowler else "resources_only",
        status="pending",
        started_at=datetime.now(timezone.utc),
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    # Dispatch scan to ARQ worker if available, otherwise fall back to background task
    dispatched_to_worker = False
    try:
        from arq import create_pool
        from worker import _parse_redis_url

        redis_pool = await create_pool(_parse_redis_url(settings.REDIS_URL))
        await redis_pool.enqueue_job(
            "execute_scan",
            str(scan.id),
            target_aws_account_id,
            include_prowler,
        )
        await redis_pool.close()
        dispatched_to_worker = True
        logger.info("Scan %s successfully dispatched to ARQ worker", scan.id)
    except Exception as e:
        logger.warning("Could not dispatch scan %s to ARQ worker (%s), using local background task", scan.id, e)

    if not dispatched_to_worker:
        background_tasks.add_task(
            _run_scan_background,
            str(scan.id),
            target_aws_account_id,
            include_prowler,
        )

    return _scan_to_dict(scan)


@router.get("/{scan_id}/status")
async def get_scan_status(scan_id: str, db: AsyncSession = Depends(get_db)):
    """Get the status of a scan."""
    try:
        sid = uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scan ID format")

    result = await db.execute(select(Scan).where(Scan.id == sid))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    return _scan_to_dict(scan)


@router.get("/{account_id}/history")
async def get_scan_history(account_id: str, limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    """Get scan history for an account."""
    target_id = await resolve_account_id(account_id, db)

    result = await db.execute(
        select(Scan)
        .where(Scan.account_id == target_id)
        .order_by(Scan.started_at.desc())
        .limit(limit)
    )
    scans = result.scalars().all()
    return [_scan_to_dict(s) for s in scans]
