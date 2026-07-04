import uuid
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.finding import Finding

router = APIRouter(prefix="/findings", tags=["findings"])


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
    query = select(Finding).where(Finding.account_id == account_id)

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
        "items": [
            {
                "id": str(f.id),
                "account_id": f.account_id,
                "check_id": f.check_id,
                "resource_id": f.resource_id,
                "resource_type": f.resource_type,
                "service": f.service,
                "region": f.region,
                "title": f.title,
                "status": f.status,
                "severity": f.severity,
                "compliance_type": f.compliance_type,
                "description": f.description,
                "recommendation": f.recommendation,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
                "raw_data": f.raw_data or {},
            }
            for f in findings
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{finding_id}")
async def get_finding(finding_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single finding by ID."""
    result = await db.execute(select(Finding).where(Finding.id == uuid.UUID(finding_id)))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    return {
        "id": str(f.id),
        "account_id": f.account_id,
        "check_id": f.check_id,
        "resource_id": f.resource_id,
        "resource_type": f.resource_type,
        "service": f.service,
        "region": f.region,
        "title": f.title,
        "status": f.status,
        "severity": f.severity,
        "compliance_type": f.compliance_type,
        "description": f.description,
        "recommendation": f.recommendation,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        "raw_data": f.raw_data or {},
    }


@router.post("/{finding_id}/rescan")
async def rescan_finding(finding_id: str, db: AsyncSession = Depends(get_db)):
    """Mark a finding for rescanning."""
    result = await db.execute(select(Finding).where(Finding.id == uuid.UUID(finding_id)))
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
