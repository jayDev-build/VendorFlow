import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.auth import router as auth_router
from app.api.v1.workflows import router as workflows_router
from app.api.v1.vendors import router as vendors_router
from app.api.v1.public_onboarding import router as public_router
from app.api.v1.documents import router as documents_router
from app.api.v1.dashboard import router as dashboard_router
from app.tasks.expiry_scheduler import start_expiry_scheduler_loop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("formgate.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist (for SQLite or fallback alongside Alembic)
    Base.metadata.create_all(bind=engine)
    logger.info("Database schemas verified.")

    # Start background persistent expiry scheduler
    scheduler_task = asyncio.create_task(
        start_expiry_scheduler_loop(interval_seconds=settings.EXPIRY_SCHEDULER_INTERVAL_SECONDS)
    )
    logger.info("FormGate background expiry scheduler task started.")

    yield

    # Shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    logger.info("FormGate background tasks stopped cleanly.")

app = FastAPI(
    title="FormGate API",
    description="AI-Powered Compliance Onboarding and Document Expiry Management SaaS API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.ENVIRONMENT == "development" else settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global safe error handling
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url}: {exc}", exc_info=True)
    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "path": str(request.url.path)}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact system support."}
    )

# Include API v1 Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(workflows_router, prefix="/api/v1")
app.include_router(vendors_router, prefix="/api/v1")
app.include_router(public_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "service": "VendorFlow API",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs",
        "mode": settings.ENVIRONMENT
    }

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "service": "vendorflow-backend"}
