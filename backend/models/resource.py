import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class CloudResource(Base):
    """Represents a discovered AWS resource."""

    __tablename__ = "cloud_resources"
    __table_args__ = (UniqueConstraint("account_id", "resource_id", name="uq_account_resource"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[str] = mapped_column(String(12), ForeignKey("cloud_accounts.account_id"), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(512), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    service: Mapped[str | None] = mapped_column(String(50), nullable=True)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[dict] = mapped_column(JSON, default=dict)
    is_public: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    encrypted: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    raw_data: Mapped[dict] = mapped_column(JSON, default=dict)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
