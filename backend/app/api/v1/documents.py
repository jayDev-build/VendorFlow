import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import (
    Document,
    DocumentReview,
    Vendor,
    VendorOnboarding,
    User,
    Organization,
    AuditLog,
)
from app.schemas.document import (
    DocumentDetailResponse,
    DocumentReviewAction,
    DocumentReviewHistoryItem,
)
from app.services.storage_service import storage_service
from app.services.notification_service import notification_service
from app.api.deps import get_current_user, get_current_org, verify_tenant_ownership

router = APIRouter(prefix="/documents", tags=["Documents & Reviews"])

@router.get("")
def list_documents(
    status: Optional[str] = Query(None, description="Filter by document status"),
    search: Optional[str] = Query(None, description="Search by document type or vendor name"),
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    query = (
        db.query(Document)
        .join(Vendor, Document.vendor_id == Vendor.id)
        .filter(Document.organization_id == current_org.id)
    )

    if status and status != "ALL":
        query = query.filter(Document.status == status)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            (Document.document_type.ilike(term)) | (Vendor.name.ilike(term))
        )

    docs = query.order_by(Document.submitted_at.desc()).all()

    results = []
    for d in docs:
        vendor = d.vendor
        signed_url = storage_service.generate_signed_download_url(d.id, current_org.id)
        results.append({
            "id": d.id,
            "vendor_id": d.vendor_id,
            "vendor_name": vendor.name if vendor else "Unknown",
            "vendor_email": vendor.contact_email if vendor else "",
            "field_id": d.field_id,
            "document_type": d.document_type,
            "original_filename": d.original_filename,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "expiry_date": d.expiry_date,
            "status": d.status,
            "submitted_at": d.submitted_at,
            "download_url": signed_url
        })
    return results

@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document_details(
    document_id: str,
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    verify_tenant_ownership(doc.organization_id, current_org.id, "document")

    vendor = doc.vendor
    signed_url = storage_service.generate_signed_download_url(doc.id, current_org.id)

    reviews_history = []
    for r in doc.reviews:
        reviewer_name = r.reviewer.full_name if r.reviewer else "System"
        reviews_history.append(
            DocumentReviewHistoryItem(
                id=r.id,
                reviewer_name=reviewer_name,
                previous_status=r.previous_status,
                new_status=r.new_status,
                reason=r.reason,
                created_at=r.created_at
            )
        )

    return DocumentDetailResponse(
        id=doc.id,
        vendor_id=doc.vendor_id,
        vendor_name=vendor.name if vendor else "Unknown",
        vendor_email=vendor.contact_email if vendor else "",
        field_id=doc.field_id,
        document_type=doc.document_type,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        expiry_date=doc.expiry_date,
        status=doc.status,
        submitted_at=doc.submitted_at,
        download_url=signed_url,
        reviews=reviews_history
    )

@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Secure authorized private document download endpoint.
    Verifies signed download token to prevent unauthenticated access.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Expired or invalid download token")

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found")

    file_path = storage_service.get_file_path(doc.storage_path)

    # Use inline or attachment based on mime
    media_type = doc.mime_type or "application/octet-stream"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=doc.original_filename
    )

@router.post("/{document_id}/approve")
def approve_document(
    document_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    verify_tenant_ownership(doc.organization_id, current_org.id, "document")

    prev_status = doc.status
    doc.status = "APPROVED"

    review = DocumentReview(
        document_id=doc.id,
        reviewer_user_id=current_user.id,
        previous_status=prev_status,
        new_status="APPROVED",
        reason="Document verified and approved by compliance administrator."
    )
    db.add(review)

    # Check if all required documents of this vendor are approved
    vendor = doc.vendor
    vendor_docs = vendor.documents
    all_approved = len(vendor_docs) > 0 and all(d.status == "APPROVED" for d in vendor_docs)
    if all_approved:
        vendor.status = "APPROVED"
        onboarding = (
            db.query(VendorOnboarding)
            .filter(VendorOnboarding.vendor_id == vendor.id)
            .order_by(VendorOnboarding.created_at.desc())
            .first()
        )
        if onboarding:
            onboarding.status = "APPROVED"
            onboarding.approved_at = datetime.now(timezone.utc)

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="DOCUMENT_APPROVED",
        entity_type="document",
        entity_id=doc.id,
        details={"vendor_id": doc.vendor_id, "document_type": doc.document_type}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "document_id": doc.id, "status": "APPROVED", "vendor_status": vendor.status}

@router.post("/{document_id}/reject")
def reject_document(
    document_id: str,
    action: DocumentReviewAction,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not action.reason or not action.reason.strip():
        raise HTTPException(status_code=400, detail="Rejection reason is required")

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    verify_tenant_ownership(doc.organization_id, current_org.id, "document")

    prev_status = doc.status
    doc.status = "REJECTED"

    review = DocumentReview(
        document_id=doc.id,
        reviewer_user_id=current_user.id,
        previous_status=prev_status,
        new_status="REJECTED",
        reason=action.reason.strip()
    )
    db.add(review)

    vendor = doc.vendor
    vendor.status = "REJECTED"

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="DOCUMENT_REJECTED",
        entity_type="document",
        entity_id=doc.id,
        details={"vendor_id": doc.vendor_id, "document_type": doc.document_type, "reason": action.reason}
    )
    db.add(audit)
    db.commit()

    # Notify vendor
    subject = f"Document Rejected: {doc.document_type}"
    body = (
        f"Hello {vendor.name},\n\n"
        f"Your submitted document '{doc.document_type}' has been rejected by compliance review.\n\n"
        f"Reason:\n{action.reason}\n\n"
        f"Please contact your administrator or submit a valid replacement file.\n\n"
        f"Thank you,\n{current_org.name} Compliance Team"
    )
    notification_service.record_and_send_notification(
        db=db,
        organization_id=current_org.id,
        vendor_id=vendor.id,
        document_id=doc.id,
        notification_type="DOCUMENT_REJECTED",
        recipient_email=vendor.contact_email,
        subject=subject,
        body_text=body,
        idempotency_key=f"reject_{doc.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )

    return {"success": True, "document_id": doc.id, "status": "REJECTED", "reason": action.reason}

@router.post("/{document_id}/request-resubmission")
def request_resubmission(
    document_id: str,
    action: DocumentReviewAction,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not action.reason or not action.reason.strip():
        raise HTTPException(status_code=400, detail="Resubmission reason is required")

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    verify_tenant_ownership(doc.organization_id, current_org.id, "document")

    prev_status = doc.status
    doc.status = "RESUBMISSION_REQUESTED"

    review = DocumentReview(
        document_id=doc.id,
        reviewer_user_id=current_user.id,
        previous_status=prev_status,
        new_status="RESUBMISSION_REQUESTED",
        reason=action.reason.strip()
    )
    db.add(review)

    vendor = doc.vendor
    vendor.status = "IN_PROGRESS"

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="DOCUMENT_RESUBMISSION_REQUESTED",
        entity_type="document",
        entity_id=doc.id,
        details={"vendor_id": doc.vendor_id, "document_type": doc.document_type, "reason": action.reason}
    )
    db.add(audit)
    db.commit()

    notification_service.send_resubmission_request(
        db=db,
        document=doc,
        vendor=vendor,
        reason=action.reason.strip()
    )

    return {"success": True, "document_id": doc.id, "status": "RESUBMISSION_REQUESTED"}
