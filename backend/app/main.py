import sys
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, Base, get_db
from app.services.storage_service import storage_service
from app.api.v1.auth import router as auth_router
from app.api.v1.workflows import router as workflows_router
from app.api.v1.vendors import router as vendors_router
from app.api.v1.public_onboarding import router as public_router
from app.api.v1.documents import router as documents_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.portal import router as portal_router
from app.tasks.expiry_scheduler import start_expiry_scheduler_loop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("formgate.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schemas exist (auto-creates tables in Supabase PostgreSQL or local SQLite)
    if settings.ENVIRONMENT != "test" and "pytest" not in sys.modules:
        try:
            Base.metadata.create_all(bind=engine)
            # Safe column migrations for existing SQLite / PostgreSQL databases
            from sqlalchemy import text
            with engine.connect() as conn:
                try:
                    conn.execute(text("ALTER TABLE vendors ADD COLUMN portal_token VARCHAR(64)"))
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN assignment_id VARCHAR(36)"))
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE notification_jobs ADD COLUMN cc_email VARCHAR(255)"))
                    conn.commit()
                except Exception:
                    pass

            # Populate portal_token for any existing vendors lacking one
            from app.core.database import SessionLocal
            from app.models.models import Vendor, VendorOnboarding, WorkflowAssignment
            from app.core.security import generate_secure_token
            m_db = SessionLocal()
            try:
                vendors_missing_token = m_db.query(Vendor).filter(Vendor.portal_token.is_(None)).all()
                for v in vendors_missing_token:
                    v.portal_token = generate_secure_token(32)

                # Sync any existing onboardings to workflow_assignments
                obs = m_db.query(VendorOnboarding).all()
                for ob in obs:
                    if ob.workflow_version:
                        tmpl_id = ob.workflow_version.workflow_template_id
                        assign = m_db.query(WorkflowAssignment).filter(
                            WorkflowAssignment.client_id == ob.vendor_id,
                            WorkflowAssignment.workflow_id == tmpl_id
                        ).first()
                        if not assign:
                            assign = WorkflowAssignment(
                                organization_id=ob.organization_id,
                                client_id=ob.vendor_id,
                                workflow_id=tmpl_id,
                                workflow_version_id=ob.workflow_version_id,
                                status=ob.status,
                                form_responses=ob.form_responses or {},
                                submitted_at=ob.submitted_at,
                                approved_at=ob.approved_at,
                                created_at=ob.created_at
                            )
                            m_db.add(assign)
                            m_db.flush()
                            for d in ob.documents:
                                d.assignment_id = assign.id
                m_db.commit()
            except Exception as e:
                m_db.rollback()
                logger.warning(f"Note on initial migration sync: {e}")
            finally:
                m_db.close()

            logger.info(f"Database schemas verified. Storage Provider: {storage_service.provider}")
        except Exception as e:
            logger.error(f"Error during database table verification: {e}")

    # Start background persistent expiry scheduler
    scheduler_task = None
    if settings.ENVIRONMENT != "test" and "pytest" not in sys.modules:
        scheduler_task = asyncio.create_task(
            start_expiry_scheduler_loop(interval_seconds=settings.EXPIRY_SCHEDULER_INTERVAL_SECONDS)
        )
        logger.info("FormGate background expiry scheduler task started.")

    yield

    # Shutdown
    if scheduler_task:
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

# CORS Middleware allowing origins from FRONTEND_URL environment variable (defaulting to http://localhost:3000)
cors_origins = [str(o).rstrip("/") for o in settings.BACKEND_CORS_ORIGINS if str(o).strip()]

frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
if frontend_url:
    for f_url in str(frontend_url).split(","):
        clean_url = f_url.strip().rstrip("/")
        if clean_url and clean_url not in cors_origins:
            cors_origins.append(clean_url)

if "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r"https://.*\.vercel\.app" if settings.ALLOW_VERCEL_PREVIEWS else None,
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
app.include_router(portal_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")

@app.get("/")
def root():
    db_type = "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql"
    return {
        "service": "FormGate API",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs",
        "storage_provider": storage_service.provider,
        "database": db_type,
        "mode": settings.ENVIRONMENT
    }

@app.get("/health")
def health(db: Session = Depends(get_db)):
    """
    Lightweight health check endpoint executing 'SELECT 1' against the database.
    """
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise HTTPException(status_code=503, detail="Database connection failed")

@app.get("/api/v1/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_type = "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql"
        return {
            "status": "ok",
            "service": "formgate-backend",
            "storage_provider": storage_service.provider,
            "database": db_type,
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise HTTPException(status_code=503, detail="Database connection failed")
