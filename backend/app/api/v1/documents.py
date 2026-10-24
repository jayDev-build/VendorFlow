import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from dateutil import parser as date_parser
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token, generate_secure_token, hash_token
from app.models.models import (
    Document,
    DocumentReview,
    Vendor,
    VendorOnboarding,
    User,
    Organization,
    AuditLog,
    InvitationToken,
    WorkflowVersion,
    WorkflowTemplate,
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

@router.post("/upload")
async def upload_document(
    vendor_id: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    expiry_date: Optional[str] = Form(None),
    status: Optional[str] = Form("UNDER_REVIEW"),
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Direct document upload endpoint for compliance administrators.
    Allows admins to upload and verify certificates/agreements on behalf of vendors.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    verify_tenant_ownership(vendor.organization_id, current_org.id, "vendor")

    # Validate status choice
    doc_status = (status or "UNDER_REVIEW").upper().strip()
    if doc_status not in ["APPROVED", "UNDER_REVIEW", "SUBMITTED"]:
        doc_status = "UNDER_REVIEW"

    # Save to secure private storage
    storage_path, file_size, mime_type = await storage_service.save_file(
        file=file,
        organization_id=current_org.id,
        vendor_id=vendor.id
    )

    parsed_expiry = None
    if expiry_date and expiry_date.strip():
        try:
            parsed_expiry = date_parser.parse(expiry_date.strip())
            if parsed_expiry.tzinfo is None:
                parsed_expiry = parsed_expiry.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid expiry date format. Use YYYY-MM-DD.")

    # Find active onboarding if any
    onboarding = (
        db.query(VendorOnboarding)
        .filter(VendorOnboarding.vendor_id == vendor.id)
        .order_by(VendorOnboarding.created_at.desc())
        .first()
    )
    onboarding_id = onboarding.id if onboarding else None

    # Generate unique field ID
    clean_type = "".join(c if c.isalnum() else "_" for c in document_type.lower()).strip("_")
    field_id = f"doc_{clean_type}_{uuid.uuid4().hex[:6]}"

    doc = Document(
        organization_id=current_org.id,
        vendor_id=vendor.id,
        onboarding_id=onboarding_id,
        field_id=field_id,
        document_type=document_type.strip(),
        original_filename=file.filename or "uploaded_document",
        file_size=file_size,
        mime_type=mime_type,
        storage_path=storage_path,
        expiry_date=parsed_expiry,
        status=doc_status,
        submitted_at=datetime.now(timezone.utc)
    )
    db.add(doc)
    db.flush()

    # If status is APPROVED, record approval review
    if doc_status == "APPROVED":
        review = DocumentReview(
            document_id=doc.id,
            reviewer_user_id=current_user.id,
            previous_status="SUBMITTED",
            new_status="APPROVED",
            reason=f"Uploaded and approved directly by {current_user.full_name}."
        )
        db.add(review)

        # Check if all required docs for this vendor are approved
        vendor_docs = vendor.documents
        if len(vendor_docs) > 0 and all(d.status == "APPROVED" for d in vendor_docs):
            vendor.status = "APPROVED"
            if onboarding:
                onboarding.status = "APPROVED"
                onboarding.approved_at = datetime.now(timezone.utc)

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="DOCUMENT_UPLOADED",
        entity_type="document",
        entity_id=doc.id,
        details={
            "vendor_id": vendor.id,
            "vendor_name": vendor.name,
            "document_type": doc.document_type,
            "status": doc.status,
            "uploaded_by": current_user.email
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)

    signed_url = storage_service.generate_signed_download_url(doc.id, current_org.id)

    return {
        "success": True,
        "document": {
            "id": doc.id,
            "vendor_id": doc.vendor_id,
            "vendor_name": vendor.name,
            "document_type": doc.document_type,
            "original_filename": doc.original_filename,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
            "status": doc.status,
            "submitted_at": doc.submitted_at.isoformat() if doc.submitted_at else None,
            "download_url": signed_url
        }
    }

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
    inline: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Secure authorized private document download & preview endpoint.
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

    # Use inline or attachment based on parameter
    media_type = doc.mime_type or "application/octet-stream"
    disposition = "inline" if inline else "attachment"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=doc.original_filename if not inline else None,
        content_disposition_type=disposition
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

def _generate_vendor_resubmission_link(vendor: Vendor, org_id: str, db: Session) -> Optional[str]:
    onboarding = (
        db.query(VendorOnboarding)
        .filter(VendorOnboarding.vendor_id == vendor.id)
        .order_by(VendorOnboarding.created_at.desc())
        .first()
    )
    wv_id = None
    if onboarding and onboarding.workflow_version_id:
        wv_id = onboarding.workflow_version_id
    elif vendor.invitations:
        wv_id = vendor.invitations[0].workflow_version_id
    else:
        first_version = (
            db.query(WorkflowVersion)
            .join(WorkflowTemplate, WorkflowVersion.template_id == WorkflowTemplate.id)
            .filter(WorkflowTemplate.organization_id == org_id)
            .first()
        )
        wv_id = first_version.id if first_version else None

    if not wv_id:
        return None

    raw_token = generate_secure_token(32)
    t_hash = hash_token(raw_token)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.INVITATION_TOKEN_EXPIRE_DAYS)

    new_invitation = InvitationToken(
        organization_id=org_id,
        workflow_version_id=wv_id,
        vendor_id=vendor.id,
        email=vendor.contact_email,
        token_hash=t_hash,
        expires_at=expires,
        is_revoked=False
    )
    db.add(new_invitation)
    db.commit()

    return f"{settings.APP_BASE_URL}/vendor/onboard/{raw_token}"

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

    # Update vendor onboarding status
    onboarding = (
        db.query(VendorOnboarding)
        .filter(VendorOnboarding.vendor_id == vendor.id)
        .order_by(VendorOnboarding.created_at.desc())
        .first()
    )
    if onboarding:
        onboarding.status = "REJECTED"

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

    # Generate fresh secure resubmission link
    resubmission_url = _generate_vendor_resubmission_link(vendor, current_org.id, db)

    # Notify vendor
    subject = f"Action Required: Document Rejected ({doc.document_type})"
    url_notice = f"\n\nPlease click the secure link below to review feedback and upload an updated document:\n{resubmission_url}\n" if resubmission_url else ""
    body = (
        f"Hello {vendor.name},\n\n"
        f"Your submitted document '{doc.document_type}' has been rejected by compliance review.\n\n"
        f"Reason provided by reviewer:\n{action.reason}"
        f"{url_notice}\n"
        f"If you have questions, reply directly to this email to reach {current_user.full_name}.\n\n"
        f"Thank you,\n{current_user.full_name} ({current_user.email})\n{current_org.name} Compliance Team"
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
        idempotency_key=f"reject_{doc.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        reply_to=current_user.email,
        sender_name=f"{current_user.full_name} via {current_org.name}",
        cta_url=resubmission_url,
        cta_text="Review & Replace Document"
    )

    return {
        "success": True,
        "document_id": doc.id,
        "status": "REJECTED",
        "reason": action.reason,
        "resubmission_url": resubmission_url
    }

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

    # Update vendor onboarding status to allow resubmission
    onboarding = (
        db.query(VendorOnboarding)
        .filter(VendorOnboarding.vendor_id == vendor.id)
        .order_by(VendorOnboarding.created_at.desc())
        .first()
    )
    if onboarding:
        onboarding.status = "RESUBMISSION_REQUESTED"

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

    # Generate fresh secure resubmission link
    resubmission_url = _generate_vendor_resubmission_link(vendor, current_org.id, db)

    notification_service.send_resubmission_request(
        db=db,
        document=doc,
        vendor=vendor,
        reason=action.reason.strip(),
        resubmission_url=resubmission_url,
        reply_to=current_user.email,
        sender_name=f"{current_user.full_name} via {current_org.name}"
    )

    return {
        "success": True,
        "document_id": doc.id,
        "status": "RESUBMISSION_REQUESTED",
        "reason": action.reason,
        "resubmission_url": resubmission_url
    }

@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    verify_tenant_ownership(doc.organization_id, current_org.id, "document")

    doc_type = doc.document_type
    vendor_id = doc.vendor_id

    # Delete storage file
    if doc.storage_path:
        storage_service.delete_file(doc.storage_path)

    # Delete db record
    db.delete(doc)
    db.commit()

    # Audit log
    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="DOCUMENT_DELETED",
        entity_type="document",
        entity_id=document_id,
        details={"vendor_id": vendor_id, "document_type": doc_type}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Document '{doc_type}' deleted successfully", "document_id": document_id}
