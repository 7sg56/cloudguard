"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-07-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cloud Accounts
    op.create_table(
        "cloud_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", sa.String(12), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role_arn", sa.String(255), nullable=False),
        sa.Column("external_id", sa.String(64), nullable=False),
        sa.Column("environment", sa.String(50), server_default="production"),
        sa.Column("regions", postgresql.ARRAY(sa.String)),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_scan_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Cloud Resources
    op.create_table(
        "cloud_resources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", sa.String(12), sa.ForeignKey("cloud_accounts.account_id"), nullable=False),
        sa.Column("resource_id", sa.String(512), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("service", sa.String(50), nullable=True),
        sa.Column("region", sa.String(50), nullable=True),
        sa.Column("tags", postgresql.JSON, server_default="{}"),
        sa.Column("is_public", sa.Boolean, nullable=True),
        sa.Column("encrypted", sa.Boolean, nullable=True),
        sa.Column("raw_data", postgresql.JSON, server_default="{}"),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("account_id", "resource_id", name="uq_account_resource"),
    )

    # Scans
    op.create_table(
        "scans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", sa.String(12), sa.ForeignKey("cloud_accounts.account_id"), nullable=False),
        sa.Column("scan_type", sa.String(20), server_default="full"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("findings_count", sa.Integer, server_default="0"),
        sa.Column("resources_scanned", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("worker_id", sa.String(100), nullable=True),
    )

    # Findings
    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", sa.String(12), sa.ForeignKey("cloud_accounts.account_id"), nullable=False),
        sa.Column("scan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scans.id"), nullable=True),
        sa.Column("check_id", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(512), nullable=True),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("service", sa.String(50), nullable=True),
        sa.Column("region", sa.String(50), nullable=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("compliance_type", sa.String(100), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("recommendation", sa.Text, nullable=True),
        sa.Column("compliance", postgresql.JSON, server_default="{}"),
        sa.Column("remediation", postgresql.JSON, server_default="{}"),
        sa.Column("raw_data", postgresql.JSON, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("account_id", "check_id", "resource_id", name="uq_account_check_resource"),
    )

    # Remediation Cache
    op.create_table(
        "remediation_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("check_id", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("service", sa.String(50), nullable=True),
        sa.Column("ai_response", sa.Text, nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("tokens_used", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("check_id", "severity", "service", name="uq_check_severity_service"),
    )

    # Indexes
    op.create_index("ix_findings_account_severity", "findings", ["account_id", "severity"])
    op.create_index("ix_findings_account_status", "findings", ["account_id", "status"])
    op.create_index("ix_resources_account_service", "cloud_resources", ["account_id", "service"])


def downgrade() -> None:
    op.drop_index("ix_resources_account_service")
    op.drop_index("ix_findings_account_status")
    op.drop_index("ix_findings_account_severity")
    op.drop_table("remediation_cache")
    op.drop_table("findings")
    op.drop_table("scans")
    op.drop_table("cloud_resources")
    op.drop_table("cloud_accounts")
