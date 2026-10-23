import logging
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.models.models import NotificationJob, Document, Vendor, User

logger = logging.getLogger("vendorflow.notifications")

class NotificationService:
    def __init__(self):
        self.resend_api_key = settings.RESEND_API_KEY
        self.sender_email = settings.SENDER_EMAIL

    def _send_email_resend(self, to_email: str, subject: str, html_content: str) -> bool:
        if not self.resend_api_key:
            return False
        try:
            import resend
            resend.api_key = self.resend_api_key
            params = {
                "from": self.sender_email,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            resend.Emails.send(params)
            return True
        except Exception as e:
            logger.error(f"Failed to send email via Resend: {e}")
            raise e

    def record_and_send_notification(
        self,
        db: Session,
        organization_id: str,
        vendor_id: Optional[str],
        document_id: Optional[str],
        notification_type: str,
        recipient_email: str,
        subject: str,
        body_text: str,
        idempotency_key: str
    ) -> NotificationJob:
        """
        Idempotently sends and records a notification.
        If an idempotency key already exists, returns existing job to prevent duplicates.
        """
        existing = db.query(NotificationJob).filter(
            NotificationJob.idempotency_key == idempotency_key
        ).first()
        if existing:
            logger.info(f"Notification with idempotency key '{idempotency_key}' already processed. Skipping duplicate.")
            return existing

        job = NotificationJob(
            organization_id=organization_id,
            vendor_id=vendor_id,
            document_id=document_id,
            notification_type=notification_type,
            recipient_email=recipient_email,
            status="PENDING",
            idempotency_key=idempotency_key
        )
        db.add(job)
        try:
            db.commit()
            db.refresh(job)
        except IntegrityError:
            db.rollback()
            return db.query(NotificationJob).filter(NotificationJob.idempotency_key == idempotency_key).first()

        # Send email or log in dev mode
        html_content = f"""
        <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="color: #0f172a; margin: 0;">VendorFlow Notification</h2>
            </div>
            <h3 style="color: #334155; margin-top: 0;">{subject}</h3>
            <p style="line-height: 1.6; font-size: 15px;">{body_text.replace('\n', '<br/>')}</p>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
                Sent securely by VendorFlow Document Lifecycle Platform.
            </div>
        </div>
        """

        try:
            if self.resend_api_key:
                self._send_email_resend(recipient_email, subject, html_content)
                job.status = "SENT"
                job.sent_at = datetime.now(timezone.utc)
            else:
                # Dev Logger mode
                logger.info(
                    f"\n[DEV NOTIFICATION ENGINE] (Resend API key not set - Simulated Email)\n"
                    f"To: {recipient_email}\n"
                    f"Subject: {subject}\n"
                    f"Idempotency Key: {idempotency_key}\n"
                    f"Body: {body_text}\n"
                    f"--------------------------------------------------"
                )
                job.status = "SENT"
                job.sent_at = datetime.now(timezone.utc)

            db.commit()
            db.refresh(job)
        except Exception as e:
            job.status = "FAILED"
            job.error_message = str(e)
            db.commit()
            db.refresh(job)

        return job

    def send_expiry_reminder(
        self,
        db: Session,
        document: Document,
        vendor: Vendor,
        days_remaining: int
    ) -> Optional[NotificationJob]:
        date_str = document.expiry_date.strftime("%Y-%m-%d") if document.expiry_date else "N/A"
        idempotency_key = f"expiry_{document.id}_{days_remaining}d_{date_str}"

        urgency = "URGENT: " if days_remaining <= 7 else ""
        subject = f"{urgency}Document Expiration Notice: {document.document_type} expires in {days_remaining} days"
        body = (
            f"Hello {vendor.name},\n\n"
            f"This is an automated reminder regarding your document '{document.document_type}' registered with VendorFlow.\n"
            f"Document: {document.document_type}\n"
            f"Expiration Date: {date_str}\n"
            f"Days Remaining: {days_remaining} days\n\n"
            f"Please coordinate with your compliance manager to submit an updated certificate before expiration to avoid onboarding or vendor status interruptions.\n\n"
            f"Thank you,\nVendorFlow Compliance Team"
        )

        return self.record_and_send_notification(
            db=db,
            organization_id=document.organization_id,
            vendor_id=vendor.id,
            document_id=document.id,
            notification_type="EXPIRY_REMINDER",
            recipient_email=vendor.contact_email,
            subject=subject,
            body_text=body,
            idempotency_key=idempotency_key
        )

    def send_resubmission_request(
        self,
        db: Session,
        document: Document,
        vendor: Vendor,
        reason: str
    ) -> NotificationJob:
        timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        idempotency_key = f"resubmit_{document.id}_{timestamp_slug}"

        subject = f"Document Resubmission Requested: {document.document_type}"
        body = (
            f"Hello {vendor.name},\n\n"
            f"Your submission for '{document.document_type}' requires attention and resubmission.\n\n"
            f"Reason provided by reviewer:\n{reason}\n\n"
            f"Please update and re-upload the requested document at your earliest convenience.\n\n"
            f"Thank you,\nVendorFlow Compliance Team"
        )

        return self.record_and_send_notification(
            db=db,
            organization_id=document.organization_id,
            vendor_id=vendor.id,
            document_id=document.id,
            notification_type="RESUBMISSION_REQUEST",
            recipient_email=vendor.contact_email,
            subject=subject,
            body_text=body,
            idempotency_key=idempotency_key
        )

notification_service = NotificationService()
