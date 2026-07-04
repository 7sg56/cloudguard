import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers import accounts, resources, findings, scans, stats, remediation

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Initializing database tables...")
    await init_db()
    logger.info("CSPM backend started")
    yield
    logger.info("CSPM backend shutting down")


app = FastAPI(
    title="CSPM API",
    description="Cloud Security Posture Management API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/cloud-security"
app.include_router(accounts.router, prefix=PREFIX)
app.include_router(resources.router, prefix=PREFIX)
app.include_router(findings.router, prefix=PREFIX)
app.include_router(scans.router, prefix=PREFIX)
app.include_router(stats.router, prefix=PREFIX)
app.include_router(remediation.router, prefix=PREFIX)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "cspm-api"}
