import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.finding import Finding
from models.resource import CloudResource
from models.scan import Scan
from models.account import CloudAccount

router = APIRouter(prefix="/stats", tags=["stats"])


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
async def dashboard_stats(account_id: str, db: AsyncSession = Depends(get_db)):
    """Get dashboard metrics for an account."""
    resolved_id = await _resolve_account_id(account_id, db)

    # Alerts by severity
    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .where(Finding.account_id == resolved_id, Finding.status == "fail")
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
        select(func.count(Finding.id)).where(Finding.account_id == resolved_id)
    )
    total_findings = total_findings_result.scalar() or 0
    pass_count = total_findings - total_alerts
    security_score = round((pass_count / total_findings * 100)) if total_findings > 0 else 100

    # Resource inventory
    resource_result = await db.execute(
        select(CloudResource.service, func.count(CloudResource.id))
        .where(CloudResource.account_id == resolved_id)
        .group_by(CloudResource.service)
    )
    asset_inventory = [
        {"name": row[0] or "other", "value": row[1], "types": []}
        for row in resource_result.all()
    ]
    total_resources = sum(a["value"] for a in asset_inventory)

    # Compliance frameworks dynamic aggregation
    all_findings_result = await db.execute(
        select(Finding.status, Finding.raw_data, Finding.compliance_type)
        .where(Finding.account_id == resolved_id)
    )
    all_findings = all_findings_result.all()

    framework_stats = {
        "CIS AWS Foundations": {"pass": 0, "total": 0},
        "SOC 2 Type II": {"pass": 0, "total": 0},
        "PCI-DSS v4.0": {"pass": 0, "total": 0},
        "HIPAA Security": {"pass": 0, "total": 0},
        "NIST 800-53": {"pass": 0, "total": 0},
        "ISO 27001": {"pass": 0, "total": 0},
    }

    for f_status, f_raw, f_comp_type in all_findings:
        raw_comp = (f_raw or {}).get("compliance", {}) if isinstance(f_raw, dict) else {}
        comp_keys = [k.upper() for k in raw_comp.keys()]
        comp_str = (f_comp_type or "").upper()

        is_pass = f_status == "pass"

        if any("CIS" in k for k in comp_keys) or "CIS" in comp_str:
            framework_stats["CIS AWS Foundations"]["total"] += 1
            if is_pass:
                framework_stats["CIS AWS Foundations"]["pass"] += 1

        if any("SOC2" in k or "SOC" in k for k in comp_keys) or "SOC" in comp_str:
            framework_stats["SOC 2 Type II"]["total"] += 1
            if is_pass:
                framework_stats["SOC 2 Type II"]["pass"] += 1

        if any("PCI" in k for k in comp_keys) or "PCI" in comp_str:
            framework_stats["PCI-DSS v4.0"]["total"] += 1
            if is_pass:
                framework_stats["PCI-DSS v4.0"]["pass"] += 1

        if any("HIPAA" in k for k in comp_keys) or "HIPAA" in comp_str:
            framework_stats["HIPAA Security"]["total"] += 1
            if is_pass:
                framework_stats["HIPAA Security"]["pass"] += 1

        if any("NIST" in k for k in comp_keys) or "NIST" in comp_str:
            framework_stats["NIST 800-53"]["total"] += 1
            if is_pass:
                framework_stats["NIST 800-53"]["pass"] += 1

        if any("ISO" in k or "27001" in k for k in comp_keys) or "ISO" in comp_str:
            framework_stats["ISO 27001"]["total"] += 1
            if is_pass:
                framework_stats["ISO 27001"]["pass"] += 1

    compliance_status = {}
    for name, data in framework_stats.items():
        if data["total"] > 0:
            compliance_status[name] = round((data["pass"] / data["total"]) * 100)
        else:
            compliance_status[name] = security_score

    # Last scan
    last_scan_result = await db.execute(
        select(Scan.finished_at)
        .where(Scan.account_id == resolved_id, Scan.status == "completed")
        .order_by(Scan.finished_at.desc())
        .limit(1)
    )
    last_scan_row = last_scan_result.scalar_one_or_none()
    last_scan = last_scan_row.isoformat() if last_scan_row else None

    # Recent critical/high/medium findings
    recent_result = await db.execute(
        select(Finding)
        .where(
            Finding.account_id == resolved_id,
            Finding.status == "fail",
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
        "compliance_status": compliance_status,
        "asset_inventory": asset_inventory,
        "total_resources": total_resources,
        "last_scan": last_scan,
        "recent_findings": recent_findings,
    }
