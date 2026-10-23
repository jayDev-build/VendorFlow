from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.models import (
    Vendor,
    Document,
    NotificationJob,
    AuditLog,
    User,
    Organization,
)
from app.schemas.document import (
    DashboardStatsResponse,
    ExpiryTrackerResponse,
    ExpiryDocumentItem,
)
from app.services.storage_service import storage_service
from app.services.notification_service import notification_service
from app.api.deps import get_current_user, get_current_org, verify_tenant_ownership

router = APIRouter(tags=["Dashboard & Expiry Tracking"])

@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    in_30_days = now + timedelta(days=30)

    # Vendor statistics
    vendors = db.query(Vendor).filter(Vendor.organization_id == current_org.id).all()
    total_vendors = len(vendors)
    approved_vendors = sum(1 for v in vendors if v.status == "APPROVED")
    pending_approvals = sum(1 for v in vendors if v.status == "SUBMITTED")
    incomplete_submissions = sum(1 for v in vendors if v.status in ("INVITED", "IN_PROGRESS"))

    # Document statistics
    docs = db.query(Document).filter(Document.organization_id == current_org.id).all()
    
    expired_documents = 0
    expiring_30_days = 0
    for d in docs:
        if d.expiry_date:
            d_exp = d.expiry_date if d.expiry_date.tzinfo else d.expiry_date.replace(tzinfo=timezone.utc)
            if d_exp < now:
                expired_documents += 1
            elif d_exp <= in_30_days:
                expiring_30_days += 1

    # Pending reviews queue
    pending_docs = (
        db.query(Document)
        .join(Vendor, Document.vendor_id == Vendor.id)
        .filter(
            Document.organization_id == current_org.id,
            Document.status.in_(["SUBMITTED", "UNDER_REVIEW"])
        )
        .order_by(Document.submitted_at.desc())
        .limit(6)
        .all()
    )
    pending_reviews = [
        {
            "id": d.id,
            "document_type": d.document_type,
            "vendor_name": d.vendor.name if d.vendor else "Unknown",
            "submitted_at": d.submitted_at,
            "status": d.status
        }
        for d in pending_docs
    ]

    from app.core.utils import ensure_utc

    # Upcoming expirations
    candidate_docs = (
        db.query(Document)
        .join(Vendor, Document.vendor_id == Vendor.id)
        .filter(
            Document.organization_id == current_org.id,
            Document.expiry_date != None,
            Document.status.in_(["APPROVED", "SUBMITTED", "UNDER_REVIEW"])
        )
        .all()
    )
    upcoming_expirations = []
    future_docs = [d for d in candidate_docs if ensure_utc(d.expiry_date) >= now]
    future_docs.sort(key=lambda d: ensure_utc(d.expiry_date))
    for d in future_docs[:6]:
        d_exp = ensure_utc(d.expiry_date)
        days_left = (d_exp - now).days
        upcoming_expirations.append({
            "id": d.id,
            "document_type": d.document_type,
            "vendor_name": d.vendor.name if d.vendor else "Unknown",
            "expiry_date": d.expiry_date,
            "days_remaining": max(0, days_left),
            "status": d.status
        })

    # Recent activity
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.organization_id == current_org.id)
        .order_by(AuditLog.created_at.desc())
        .limit(8)
        .all()
    )
    recent_activity = [
        {
            "id": l.id,
            "action": l.action,
            "details": l.details,
            "timestamp": l.created_at
        }
        for l in logs
    ]

    return DashboardStatsResponse(
        total_vendors=total_vendors,
        approved_vendors=approved_vendors,
        pending_approvals=pending_approvals,
        incomplete_submissions=incomplete_submissions,
        expiring_30_days=expiring_30_days,
        expired_documents=expired_documents,
        pending_reviews=pending_reviews,
        upcoming_expirations=upcoming_expirations,
        recent_activity=recent_activity
    )

@router.get("/expiry", response_model=ExpiryTrackerResponse)
def get_expiry_tracker(
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    docs = (
        db.query(Document)
        .join(Vendor, Document.vendor_id == Vendor.id)
        .filter(
            Document.organization_id == current_org.id,
            Document.expiry_date != None
        )
        .order_by(Document.expiry_date.asc())
        .all()
    )

    expired_list = []
    expiring_7d_list = []
    expiring_30d_list = []
    expiring_60d_list = []
    valid_longer_list = []

    from app.core.utils import ensure_utc
    for d in docs:
        vendor = d.vendor
        d_exp = ensure_utc(d.expiry_date)
        diff_days = (d_exp - now).days

        # Check last notification sent for this document
        last_job = (
            db.query(NotificationJob)
            .filter(
                NotificationJob.document_id == d.id,
                NotificationJob.status == "SENT"
            )
            .order_by(NotificationJob.sent_at.desc())
            .first()
        )
        rem_status = f"Sent on {last_job.sent_at.strftime('%b %d')}" if last_job and last_job.sent_at else "No reminder sent"

        signed_url = storage_service.generate_signed_download_url(d.id, current_org.id)

        item = ExpiryDocumentItem(
            id=d.id,
            document_type=d.document_type,
            vendor_id=d.vendor_id,
            vendor_name=vendor.name if vendor else "Unknown",
            vendor_email=vendor.contact_email if vendor else "",
            expiry_date=d.expiry_date,
            days_remaining=diff_days,
            status="EXPIRED" if diff_days < 0 else d.status,
            download_url=signed_url,
            reminder_status=rem_status,
            last_reminder_sent=last_job.sent_at if last_job else None
        )

        if diff_days < 0:
            expired_list.append(item)
        elif diff_days <= 7:
            expiring_7d_list.append(item)
        elif diff_days <= 30:
            expiring_30d_list.append(item)
        elif diff_days <= 60:
            expiring_60d_list.append(item)
        else:
            valid_longer_list.append(item)

    return ExpiryTrackerResponse(
        expired=expired_list,
        expiring_7d=expiring_7d_list,
        expiring_30d=expiring_30d_list,
        expiring_60d=expiring_60d_list,
        valid_longer=valid_longer_list
    )

@router.post("/documents/{document_id}/request-renewal")
def request_document_renewal(
    document_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    verify_tenant_ownership(doc.organization_id, current_org.id, "document")

    vendor = doc.vendor
    date_str = doc.expiry_date.strftime("%Y-%m-%d") if doc.expiry_date else "soon"
    subject = f"Urgent Renewal Request: {doc.document_type} renewal required by {current_org.name}"
    body = (
        f"Hello {vendor.name},\n\n"
        f"Your {doc.document_type} (expiring on {date_str}) requires renewal to maintain active vendor compliance with {current_org.name}.\n\n"
        f"Please provide an updated certificate at your earliest convenience.\n\n"
        f"Thank you,\n{current_org.name} Compliance Team"
    )

    job = notification_service.record_and_send_notification(
        db=db,
        organization_id=current_org.id,
        vendor_id=vendor.id,
        document_id=doc.id,
        notification_type="RENEWAL_REQUEST",
        recipient_email=vendor.contact_email,
        subject=subject,
        body_text=body,
        idempotency_key=f"renewal_req_{doc.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    )

    return {"success": True, "message": f"Renewal request dispatched to {vendor.contact_email}.", "job_id": job.id}
