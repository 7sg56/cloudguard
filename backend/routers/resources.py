import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.resource import CloudResource
from models.account import CloudAccount

router = APIRouter(prefix="/resources", tags=["resources"])


async def _resolve_account_id(account_id: str, db: AsyncSession) -> str:
    """Resolve an account ID string (which may be a UUID or a 12-digit AWS account ID) to the 12-digit AWS account ID."""
    try:
        val = uuid.UUID(account_id)
        result = await db.execute(select(CloudAccount.account_id).where(CloudAccount.id == val))
        aws_id = result.scalar_one_or_none()
        if aws_id:
            return aws_id
    except ValueError:
        pass
    return account_id


@router.get("/{account_id}")
async def list_resources(account_id: str, db: AsyncSession = Depends(get_db)):
    """List all discovered resources for an account."""
    resolved_id = await _resolve_account_id(account_id, db)
    result = await db.execute(
        select(CloudResource)
        .where(CloudResource.account_id == resolved_id)
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
    resolved_id = await _resolve_account_id(account_id, db)
    result = await db.execute(
        select(
            CloudResource.service,
            func.count(CloudResource.id).label("count"),
            func.count(CloudResource.id).filter(CloudResource.is_public == True).label("public_count"),  # noqa: E712
            func.count(CloudResource.id).filter(CloudResource.encrypted == False).label("unencrypted_count"),  # noqa: E712
        )
        .where(CloudResource.account_id == resolved_id)
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
