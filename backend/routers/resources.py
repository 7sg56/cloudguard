from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.resource import CloudResource

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("/{account_id}")
async def list_resources(account_id: str, db: AsyncSession = Depends(get_db)):
    """List all discovered resources for an account."""
    result = await db.execute(
        select(CloudResource)
        .where(CloudResource.account_id == account_id)
        .order_by(CloudResource.service, CloudResource.resource_type)
    )
    resources = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "resource_id": r.resource_id,
            "resource_type": r.resource_type,
            "service": r.service,
            "region": r.region,
            "tags": r.tags or {},
            "is_public": r.is_public,
            "encrypted": r.encrypted,
            "raw_data": r.raw_data or {},
            "last_seen": r.last_seen.isoformat() if r.last_seen else None,
        }
        for r in resources
    ]


@router.get("/{account_id}/summary")
async def resource_summary(account_id: str, db: AsyncSession = Depends(get_db)):
    """Get service-level resource summary for an account."""
    result = await db.execute(
        select(
            CloudResource.service,
            func.count(CloudResource.id).label("count"),
            func.count(CloudResource.id).filter(CloudResource.is_public == True).label("public_count"),  # noqa: E712
            func.count(CloudResource.id).filter(CloudResource.encrypted == False).label("unencrypted_count"),  # noqa: E712
        )
        .where(CloudResource.account_id == account_id)
        .group_by(CloudResource.service)
    )
    rows = result.all()
    return [
        {
            "service": row.service or "other",
            "count": row.count,
            "public_count": row.public_count,
            "unencrypted_count": row.unencrypted_count,
        }
        for row in rows
    ]
