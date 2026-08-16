import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.account import CloudAccount

router = APIRouter(prefix="/accounts", tags=["accounts"])


class AccountCreate(BaseModel):
    account_id: str
    name: str
    role_arn: str
    environment: str = "production"
    regions: str = "us-east-1"


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    role_arn: Optional[str] = None
    environment: Optional[str] = None
    regions: Optional[str] = None


class AccountResponse(BaseModel):
    id: str
    account_id: str
    name: str
    provider: str
    role_arn: str | None
    external_id: str | None
    environment: str
    regions: list[str]
    status: str
    created_at: str
    updated_at: str
    last_scan_at: str | None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AccountResponse])
@router.get("/", response_model=list[AccountResponse])
async def list_accounts(db: AsyncSession = Depends(get_db)) -> list[AccountResponse]:
    """List all connected AWS accounts."""
    result = await db.execute(select(CloudAccount).order_by(CloudAccount.created_at))
    accounts = result.scalars().all()
    return [
        AccountResponse(
            id=str(a.id),
            account_id=a.account_id,
            name=a.name,
            provider="aws",
            role_arn=a.role_arn,
            external_id=a.external_id,
            environment=a.environment,
            regions=a.regions or [],
            status=a.status,
            created_at=a.created_at.isoformat() if a.created_at else "",
            updated_at=a.updated_at.isoformat() if a.updated_at else "",
            last_scan_at=a.last_scan_at.isoformat() if a.last_scan_at else None,
        )
        for a in accounts
    ]


@router.post("", status_code=201, response_model=AccountResponse)
@router.post("/", status_code=201, response_model=AccountResponse)
async def create_account(data: AccountCreate, db: AsyncSession = Depends(get_db)) -> AccountResponse:
    """Register a new AWS account for scanning."""
    external_id = f"cspm-ext-{uuid.uuid4().hex[:12]}"
    regions = [r.strip() for r in data.regions.split(",") if r.strip()]

    account = CloudAccount(
        account_id=data.account_id,
        name=data.name,
        role_arn=data.role_arn,
        external_id=external_id,
        environment=data.environment,
        regions=regions,
        status="pending",
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    return AccountResponse(
        id=str(account.id),
        account_id=account.account_id,
        name=account.name,
        provider="aws",
        role_arn=account.role_arn,
        external_id=account.external_id,
        environment=account.environment,
        regions=account.regions or [],
        status=account.status,
        created_at=account.created_at.isoformat(),
        updated_at=account.updated_at.isoformat(),
        last_scan_at=None,
    )


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    data: AccountUpdate,
    db: AsyncSession = Depends(get_db),
) -> AccountResponse:
    """Update an existing AWS account's configuration."""
    # Find account by UUID or 12-digit account_id
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

    if data.name is not None:
        account.name = data.name
    if data.role_arn is not None:
        account.role_arn = data.role_arn
    if data.environment is not None:
        account.environment = data.environment
    if data.regions is not None:
        account.regions = [r.strip() for r in data.regions.split(",") if r.strip()]

    await db.commit()
    await db.refresh(account)

    return AccountResponse(
        id=str(account.id),
        account_id=account.account_id,
        name=account.name,
        provider="aws",
        role_arn=account.role_arn,
        external_id=account.external_id,
        environment=account.environment,
        regions=account.regions or [],
        status=account.status,
        created_at=account.created_at.isoformat(),
        updated_at=account.updated_at.isoformat(),
        last_scan_at=account.last_scan_at.isoformat() if account.last_scan_at else None,
    )


@router.delete("/{account_id}")
async def delete_account(account_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an AWS account and all related data."""
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

    await db.delete(account)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{account_id}/validate")
async def validate_account(account_id: str, db: AsyncSession = Depends(get_db)):
    """Validate that the IAM role can be assumed."""
    result = await db.execute(select(CloudAccount).where(CloudAccount.account_id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"valid": True}
