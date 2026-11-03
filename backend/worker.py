"""ARQ worker for async security scans and compliance auditing."""

import logging
from urllib.parse import urlparse

from arq.connections import RedisSettings

from config import settings
from services.scan_service import run_security_scan

logger = logging.getLogger(__name__)


async def execute_scan(
    ctx: dict,
    scan_id: str,
    account_id: str,
    include_prowler: bool = True,
) -> dict:
    """Execute a complete scan job (resource inventory discovery and optional Prowler compliance scan)."""
    logger.info("ARQ Worker executing scan %s for account %s (prowler=%s)", scan_id, account_id, include_prowler)
    return await run_security_scan(scan_id=scan_id, account_id=account_id, include_prowler=include_prowler)


async def run_prowler_scan(ctx: dict, scan_id: str, account_id: str) -> dict:
    """Backwards-compatible ARQ function for full scan with Prowler enabled."""
    return await execute_scan(ctx, scan_id=scan_id, account_id=account_id, include_prowler=True)


def _parse_redis_url(url: str) -> RedisSettings:
    """Parse a redis:// URL into arq RedisSettings fields."""
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or 0),
        password=parsed.password or None,
        username=parsed.username or None,
    )


class WorkerSettings:
    """ARQ worker configuration."""

    functions = [execute_scan, run_prowler_scan]
    redis_settings = _parse_redis_url(settings.REDIS_URL)
    max_jobs = 2
    job_timeout = 3600  # 1 hour
