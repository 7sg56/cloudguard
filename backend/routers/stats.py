from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.finding import Finding
from models.resource import CloudResource
from models.scan import Scan

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/{account_id}")
async def dashboard_stats(account_id: str, db: AsyncSession = Depends(get_db)):
    """Get dashboard metrics for an account."""
    # Alerts by severity
    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .where(Finding.account_id == account_id, Finding.status == "fail")
        .group_by(Finding.severity)
    )
    severity_counts = {row[0]: row[1] for row in severity_result.all()}

    total_alerts = sum(severity_counts.values())
    alerts_by_severity = {
        "critical": severity_counts.get("critical", 0),
        "high": severity_counts.get("high", 0),
        "medium": severity_counts.get("medium", 0),
        "low": severity_counts.get("low", 0),
        "info": severity_counts.get("info", 0),
    }

    # Security score
    total_findings_result = await db.execute(
        select(func.count(Finding.id)).where(Finding.account_id == account_id)
    )
    total_findings = total_findings_result.scalar() or 0
    pass_count = total_findings - total_alerts
    security_score = round((pass_count / total_findings * 100)) if total_findings > 0 else 100

    # Resource inventory
    resource_result = await db.execute(
        select(CloudResource.service, func.count(CloudResource.id))
        .where(CloudResource.account_id == account_id)
        .group_by(CloudResource.service)
    )
    asset_inventory = [
        {"name": row[0] or "other", "value": row[1], "types": []}
        for row in resource_result.all()
    ]
    total_resources = sum(a["value"] for a in asset_inventory)

    # Last scan
    last_scan_result = await db.execute(
        select(Scan.finished_at)
        .where(Scan.account_id == account_id, Scan.status == "completed")
        .order_by(Scan.finished_at.desc())
        .limit(1)
    )
    last_scan_row = last_scan_result.scalar_one_or_none()
    last_scan = last_scan_row.isoformat() if last_scan_row else None

    # Recent critical/high findings
    recent_result = await db.execute(
        select(Finding)
        .where(
            Finding.account_id == account_id,
            Finding.status == "fail",
            Finding.severity.in_(["critical", "high"]),
        )
        .order_by(Finding.updated_at.desc())
        .limit(10)
    )
    recent_findings = [
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
        for f in recent_result.scalars().all()
    ]

    return {
        "security_score": security_score,
        "total_alerts": total_alerts,
        "alerts_by_severity": alerts_by_severity,
        "compliance_status": {},  # Populated after Prowler scan
        "asset_inventory": asset_inventory,
        "total_resources": total_resources,
        "last_scan": last_scan,
        "recent_findings": recent_findings,
    }
