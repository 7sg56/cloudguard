import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Scan(Base):
    """Represents a security scan execution."""

    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[str] = mapped_column(String(12), ForeignKey("cloud_accounts.account_id"), nullable=False)
    scan_type: Mapped[str] = mapped_column(String(20), default="full")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    resources_scanned: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    worker_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
