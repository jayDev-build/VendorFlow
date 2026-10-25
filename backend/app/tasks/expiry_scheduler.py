import asyncio
import logging
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal
from app.models.models import Document, Vendor, WorkflowVersion, ReminderRule
from app.services.notification_service import notification_service

logger = logging.getLogger("formgate.scheduler")

def run_expiry_check_sync():
    """
    Scans all documents with expiry dates across all tenants and triggers
    idempotent reminders based on configured workflow reminder rules (default: 30, 7, 1 days).
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        docs = (
            db.query(Document)
            .filter(
                Document.expiry_date != None,
                Document.status.in_(["APPROVED", "SUBMITTED", "UNDER_REVIEW"])
            )
            .all()
        )

        logger.info(f"Running automated expiry check across {len(docs)} active documents...")
        count_reminders = 0

        from app.core.utils import ensure_utc
        for doc in docs:
            d_exp = ensure_utc(doc.expiry_date)
            days_remaining = (d_exp.date() - now.date()).days

            # Determine reminder milestones (check workflow version rules or fallback [30, 7, 1])
            milestones = [30, 7, 1]
            if doc.onboarding and doc.onboarding.workflow_version:
                version_rules = doc.onboarding.workflow_version.reminder_rules
                if version_rules and isinstance(version_rules, list):
                    milestones = [int(m) for m in version_rules]

            # Check if today's remaining days matches a milestone or if already expired
            for m in milestones:
                # Trigger reminder when days remaining is at or below milestone but above the next milestone
                if days_remaining == m or (days_remaining < m and days_remaining >= 0 and m == min(milestones)):
                    vendor = doc.vendor
                    if vendor and vendor.contact_email:
                        job = notification_service.send_expiry_reminder(
                            db=db,
                            document=doc,
                            vendor=vendor,
                            days_remaining=days_remaining
                        )
                        if job and job.status == "SENT":
                            count_reminders += 1
                    break

            # If already past expiration date, update document status to EXPIRED
            if days_remaining < 0 and doc.status != "EXPIRED":
                doc.status = "EXPIRED"
                db.commit()

        logger.info(f"Expiry check completed. Sent {count_reminders} reminders.")
    except Exception as e:
        logger.error(f"Error during expiry check job: {e}")
    finally:
        db.close()

async def start_expiry_scheduler_loop(interval_seconds: int = 3600):
    """
    Persistent background loop running inside the FastAPI application lifetime.
    """
    logger.info(f"Starting FormGate Expiry Reminder Scheduler (interval: {interval_seconds}s)")
    while True:
        try:
            run_expiry_check_sync()
        except Exception as e:
            logger.error(f"Exception in scheduler iteration: {e}")
        await asyncio.sleep(interval_seconds)
