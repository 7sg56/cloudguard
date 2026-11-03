import uuid
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.finding import Finding
from routers.utils import resolve_account_id, finding_to_dict

router = APIRouter(prefix="/findings", tags=["findings"])


@router.get("")
@router.get("/")
async def list_findings(
    account_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    severity: str | None = None,
    service: str | None = None,
    statuses: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List findings with pagination and filters."""
    resolved_id = await resolve_account_id(account_id, db)
    query = select(Finding).where(Finding.account_id == resolved_id)

    if severity and severity != "all":
        query = query.where(Finding.severity == severity)
    if service and service != "all":
        query = query.where(Finding.service == service)
    if statuses:
        status_list = [s.strip() for s in statuses.split(",")]
        query = query.where(Finding.status.in_(status_list))
    elif status:
        query = query.where(Finding.status == status)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = max(1, ceil(total / page_size))

    # Paginate
    query = query.order_by(Finding.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    findings = result.scalars().all()

    return {
        "items": [finding_to_dict(f) for f in findings],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{finding_id}")
async def get_finding(finding_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single finding by ID."""
    try:
        fid = uuid.UUID(finding_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid finding ID format")

    result = await db.execute(select(Finding).where(Finding.id == fid))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding_to_dict(f)


@router.post("/{finding_id}/rescan")
async def rescan_finding(finding_id: str, db: AsyncSession = Depends(get_db)):
    """Mark a finding for rescanning."""
    try:
        fid = uuid.UUID(finding_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid finding ID format")

    result = await db.execute(select(Finding).where(Finding.id == fid))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    f.status = "rescanning"
    await db.commit()
    await db.refresh(f)
    return {
        "id": str(f.id),
        "status": f.status,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }
