import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.scan import Scan
from models.account import CloudAccount

router = APIRouter(prefix="/scan", tags=["scans"])


@router.post("/{account_id}")
async def trigger_scan(
    account_id: str,
    include_prowler: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a security scan for an account."""
    # Verify account exists
    result = await db.execute(select(CloudAccount).where(CloudAccount.account_id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Create scan record
    scan = Scan(
        account_id=account_id,
        scan_type="full" if include_prowler else "resources_only",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(scan)
    account.last_scan_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(scan)

    # In production, this would enqueue an ARQ job:
    # await arq_pool.enqueue_job("run_prowler_scan", str(scan.id), account_id)

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
