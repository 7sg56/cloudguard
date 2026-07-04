import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, Text, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Finding(Base):
    """Represents a security finding from a Prowler scan."""

    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("account_id", "check_id", "resource_id", name="uq_account_check_resource"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[str] = mapped_column(String(12), ForeignKey("cloud_accounts.account_id"), nullable=False)
    scan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=True)
    check_id: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    resource_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    service: Mapped[str | None] = mapped_column(String(50), nullable=True)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    compliance_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    compliance: Mapped[dict] = mapped_column(JSON, default=dict)
    remediation: Mapped[dict] = mapped_column(JSON, default=dict)
    raw_data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
