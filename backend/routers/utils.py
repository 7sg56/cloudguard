"""Shared utilities for CSPM API routers."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.account import CloudAccount
from models.finding import Finding


async def resolve_account_id(account_id: str, db: AsyncSession) -> str:
    """Resolve an account ID string (UUID or 12-digit AWS account ID) to the 12-digit AWS account ID."""
    try:
        val = uuid.UUID(account_id)
        result = await db.execute(select(CloudAccount.account_id).where(CloudAccount.id == val))
        aws_id = result.scalar_one_or_none()
        if aws_id:
            return aws_id
    except ValueError:
        pass
    return account_id


async def resolve_account(account_id: str, db: AsyncSession) -> CloudAccount | None:
    """Resolve an account ID string (UUID or 12-digit AWS account ID) to the full CloudAccount object."""
    try:
        val = uuid.UUID(account_id)
        result = await db.execute(select(CloudAccount).where(CloudAccount.id == val))
        account = result.scalar_one_or_none()
        if account:
            return account
    except ValueError:
        pass

    result = await db.execute(select(CloudAccount).where(CloudAccount.account_id == account_id))
    return result.scalar_one_or_none()


def finding_to_dict(f: Finding) -> dict:
    """Serialize a Finding ORM object to a response dictionary."""
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


async def upsert_findings(
    db: AsyncSession,
    findings_data: list[dict],
    account_id: str,
    scan_id: str,
) -> int:
    """Deduplicate and upsert findings into the database. Returns the count of upserted findings."""
    seen_keys: set[tuple] = set()
    deduped: list[dict] = []
    for raw in findings_data:
        key = (account_id, raw.get("check_id", ""), raw.get("resource_id", ""))
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(raw)

    for raw in deduped:
        stmt = (
            pg_insert(Finding)
            .values(
                id=uuid.uuid4(),
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
                compliance=raw.get("compliance", {}),
                remediation=raw.get("remediation", {}),
                raw_data=raw.get("raw_data", {}),
            )
            .on_conflict_do_update(
                constraint="uq_account_check_resource",
                set_={
                    "scan_id": uuid.UUID(scan_id),
                    "status": raw.get("status", "fail"),
                    "severity": raw.get("severity", "info"),
                    "compliance_type": raw.get("compliance_type"),
                    "description": raw.get("description"),
                    "recommendation": raw.get("recommendation"),
                    "compliance": raw.get("compliance", {}),
                    "remediation": raw.get("remediation", {}),
                    "raw_data": raw.get("raw_data", {}),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        )
        await db.execute(stmt)

    return len(deduped)
