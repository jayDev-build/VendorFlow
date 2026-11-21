import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Optional, List, Union
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.models.models import NotificationJob, Document, Vendor, User

logger = logging.getLogger("formgate.notifications")

class NotificationService:
    def __init__(self):
        self.resend_api_key = settings.RESEND_API_KEY
        self.sender_email = settings.SENDER_EMAIL
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_use_tls = settings.SMTP_USE_TLS

    def _send_email_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        reply_to: Optional[str] = None,
        from_name: Optional[str] = None,
        cc: Optional[List[str]] = None
    ) -> bool:
        if not self.smtp_host or not self.smtp_user:
            return False
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            sender_addr = self.sender_email or self.smtp_user
            msg["From"] = f"{from_name} <{sender_addr}>" if from_name else sender_addr
            msg["To"] = to_email
            recipients = [to_email]
            if cc:
                msg["Cc"] = ", ".join(cc)
                recipients.extend(cc)
            if reply_to:
                msg["Reply-To"] = reply_to
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                if self.smtp_use_tls:
                    server.starttls()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.sendmail(sender_addr, recipients, msg.as_string())
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {e}")
            raise e

    def _send_email_resend(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        reply_to: Optional[str] = None,
        from_name: Optional[str] = None,
        cc: Optional[List[str]] = None
    ) -> bool:
        if not self.resend_api_key:
            return False
        try:
            import resend
            resend.api_key = self.resend_api_key
            sender = f"{from_name} <{self.sender_email}>" if from_name else self.sender_email
            params = {
                "from": sender,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            if cc:
                params["cc"] = cc
            if reply_to:
                params["reply_to"] = reply_to
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
        idempotency_key: str,
        reply_to: Optional[str] = None,
        sender_name: Optional[str] = None,
        cta_url: Optional[str] = None,
        cta_text: Optional[str] = None,
        cc: Optional[Union[str, List[str]]] = None
    ) -> NotificationJob:
        """
        Idempotently sends and records a notification.
        If an idempotency key already exists, returns existing job to prevent duplicates.
        Incorporates dashboard user identity into From header, Reply-To header, CC header, and email footer.
        CCs user email so the sending email also appears in the user's email account.
        """
        existing = db.query(NotificationJob).filter(
            NotificationJob.idempotency_key == idempotency_key
        ).first()
        if existing:
            logger.info(f"Notification with idempotency key '{idempotency_key}' already processed. Skipping duplicate.")
            return existing

        # Process and normalize CC recipients
        cc_list: List[str] = []
        if cc:
            if isinstance(cc, str):
                cc_list = [c.strip() for c in cc.split(",") if c.strip()]
            elif isinstance(cc, list):
                cc_list = [c.strip() for c in cc if c and c.strip()]
        elif reply_to and "@" in reply_to and not reply_to.endswith(".local"):
            # Automatically CC the sending user so it appears in their mail account
            cc_list = [reply_to.strip()]

        # Filter out recipient email to prevent sending duplicate to same address
        cc_list = [c for c in cc_list if c.lower() != recipient_email.lower()]
        cc_str = ", ".join(cc_list) if cc_list else None

        job = NotificationJob(
            organization_id=organization_id,
            vendor_id=vendor_id,
            document_id=document_id,
            notification_type=notification_type,
            recipient_email=recipient_email,
            cc_email=cc_str,
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

        # Call-to-action button block
        cta_block = ""
        if cta_url:
            button_label = cta_text or "Access Onboarding Portal"
            cta_block = f"""
            <div style="margin: 28px 0; text-align: center;">
                <a href="{cta_url}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);">
                    {button_label} &rarr;
                </a>
                <div style="margin-top: 12px; font-size: 12px; color: #64748b; line-height: 1.4;">
                    Or copy and paste this secure link into your browser:<br/>
                    <a href="{cta_url}" style="color: #4f46e5; word-break: break-all;">{cta_url}</a>
                </div>
            </div>
            """

        # Sender identity box
        sender_card = ""
        if reply_to or sender_name:
            display_sender = sender_name or "Compliance Manager"
            contact_line = f'Direct replies to this email will be delivered to: <a href="mailto:{reply_to}" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">{reply_to}</a>' if reply_to else ''
            cc_line = f'<div style="font-size: 12px; color: #64748b; margin-top: 4px;">CC: {cc_str}</div>' if cc_str else ''
            sender_card = f"""
            <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 14px 18px; margin: 24px 0 16px 0; border-radius: 6px;">
                <div style="font-size: 13px; font-weight: 700; color: #1e293b;">
                    Sent by: {display_sender}
                </div>
                {f'<div style="font-size: 12px; color: #475569; margin-top: 4px;">{contact_line}</div>' if contact_line else ''}
                {cc_line}
            </div>
            """

        # Send email or log in dev mode
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 28px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="border-bottom: 2px solid #6366f1; padding-bottom: 14px; margin-bottom: 18px;">
                <h2 style="color: #0f172a; margin: 0; font-size: 20px;">FormGate Compliance Notification</h2>
            </div>
            <h3 style="color: #334155; margin-top: 0; font-size: 16px;">{subject}</h3>
            <p style="line-height: 1.6; font-size: 14px; color: #334155;">{body_text.replace(chr(10), '<br/>')}</p>
            {cta_block}
            {sender_card}
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
                Sent securely by FormGate Enterprise Document Lifecycle Platform.
            </div>
        </div>
        """

        try:
            if self.smtp_host and self.smtp_user:
                self._send_email_smtp(
                    to_email=recipient_email,
                    subject=subject,
                    html_content=html_content,
                    reply_to=reply_to,
                    from_name=sender_name,
                    cc=cc_list if cc_list else None
                )
                job.status = "SENT"
                job.sent_at = datetime.now(timezone.utc)
            elif self.resend_api_key:
                self._send_email_resend(
                    to_email=recipient_email,
                    subject=subject,
                    html_content=html_content,
                    reply_to=reply_to,
                    from_name=sender_name,
                    cc=cc_list if cc_list else None
                )
                job.status = "SENT"
                job.sent_at = datetime.now(timezone.utc)
            else:
                # Dev Logger mode
                logger.info(
                    f"\n[DEV NOTIFICATION ENGINE] (Simulated Email)\n"
                    f"From: {sender_name or 'System'} <{self.sender_email}>\n"
                    f"Reply-To: {reply_to or 'None'}\n"
                    f"To: {recipient_email}\n"
                    f"Cc: {cc_str or 'None'}\n"
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

        # Look up admin user to CC so notices appear in dashboard user's mailbox
        admin_user = (
            db.query(User)
            .filter(User.organization_id == document.organization_id)
            .order_by(User.created_at.asc())
            .first()
        )
        cc_email = admin_user.email if admin_user and not admin_user.email.endswith(".local") else None

        urgency = "URGENT: " if days_remaining <= 7 else ""
        subject = f"{urgency}Document Expiration Notice: {document.document_type} expires in {days_remaining} days"
        body = (
            f"Hello {vendor.name},\n\n"
            f"This is an automated reminder regarding your document '{document.document_type}' registered with FormGate.\n"
            f"Document: {document.document_type}\n"
            f"Expiration Date: {date_str}\n"
            f"Days Remaining: {days_remaining} days\n\n"
            f"Please coordinate with your compliance manager to submit an updated certificate before expiration to avoid onboarding or vendor status interruptions.\n\n"
            f"Thank you,\nFormGate Compliance Team"
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
            idempotency_key=idempotency_key,
            cc=cc_email
        )

    def send_resubmission_request(
        self,
        db: Session,
        document: Document,
        vendor: Vendor,
        reason: str,
        resubmission_url: Optional[str] = None,
        reply_to: Optional[str] = None,
        sender_name: Optional[str] = None,
        cc: Optional[Union[str, List[str]]] = None
    ) -> NotificationJob:
        timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        idempotency_key = f"resubmit_{document.id}_{timestamp_slug}"

        subject = f"Action Required: Document Resubmission Requested ({document.document_type})"
        signer = f"{sender_name}\n({reply_to})" if reply_to and sender_name else "FormGate Compliance Team"
        
        url_text = f"\n\nPlease click the secure link below to review feedback and re-upload your document:\n{resubmission_url}\n" if resubmission_url else ""
        body = (
            f"Hello {vendor.name},\n\n"
            f"Your submission for '{document.document_type}' requires attention and resubmission.\n\n"
            f"Reason provided by reviewer:\n{reason}"
            f"{url_text}\n"
            f"Please update and re-upload the requested document at your earliest convenience.\n\n"
            f"Thank you,\n{signer}"
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
            idempotency_key=idempotency_key,
            reply_to=reply_to,
            sender_name=sender_name,
            cta_url=resubmission_url,
            cta_text="Review & Re-upload Document",
            cc=cc or reply_to
        )

notification_service = NotificationService()
