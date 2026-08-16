from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
async_session_factory = async_session


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency yielding an async database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables defined by ORM models."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
