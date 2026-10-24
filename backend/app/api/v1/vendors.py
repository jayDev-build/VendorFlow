from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from app.core.database import get_db
from app.models.models import (
    Vendor,
    Document,
    DocumentReview,
    VendorOnboarding,
    WorkflowVersion,
    AuditLog,
    User,
    Organization,
)
from app.schemas.vendor import (
    VendorCreate,
    VendorUpdate,
    VendorListItem,
    VendorDetailResponse,
    DocumentItemResponse,
)
from app.services.storage_service import storage_service
from app.services.notification_service import notification_service
from app.api.deps import get_current_user, get_current_org, verify_tenant_ownership

router = APIRouter(prefix="/vendors", tags=["Vendor Management"])

@router.get("", response_model=List[VendorListItem])
def list_vendors(
    search: Optional[str] = Query(None, description="Search by name or email"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    query = db.query(Vendor).filter(Vendor.organization_id == current_org.id)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(Vendor.name.ilike(term), Vendor.contact_email.ilike(term)))

    if status and status != "ALL":
        query = query.filter(Vendor.status == status)

    if category and category != "ALL":
        query = query.filter(Vendor.category == category)

    vendors = query.order_by(Vendor.updated_at.desc()).all()

    results = []
    now = datetime.now(timezone.utc)
    for v in vendors:
        docs = v.documents
        doc_count = len(docs)
        approved_count = sum(1 for d in docs if d.status == "APPROVED")

        from app.core.utils import ensure_utc
        # Calculate next upcoming expiry
        expiring_docs = [
            ensure_utc(d.expiry_date) for d in docs
            if d.expiry_date and ensure_utc(d.expiry_date) > now and d.status in ("APPROVED", "SUBMITTED", "UNDER_REVIEW")
        ]
        next_exp = min(expiring_docs) if expiring_docs else None

        results.append(
            VendorListItem(
                id=v.id,
                name=v.name,
                category=v.category,
                contact_email=v.contact_email,
                contact_phone=v.contact_phone,
                status=v.status,
                documents_count=doc_count,
                documents_approved_count=approved_count,
                next_expiry=next_exp,
                last_updated=v.updated_at,
                created_at=v.created_at
            )
        )
    return results

@router.post("", response_model=VendorListItem, status_code=status.HTTP_201_CREATED)
def create_vendor(
    payload: VendorCreate,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = (
        db.query(Vendor)
        .filter(
            Vendor.organization_id == current_org.id,
            Vendor.contact_email == payload.contact_email.lower().strip()
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A vendor with this contact email already exists in your organization"
        )

    vendor = Vendor(
        organization_id=current_org.id,
        name=payload.name.strip(),
        category=payload.category,
        contact_email=payload.contact_email.lower().strip(),
        contact_phone=payload.contact_phone,
        notes=payload.notes,
        status="INVITED"
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="VENDOR_CREATED",
        entity_type="vendor",
        entity_id=vendor.id,
        details={"name": vendor.name, "email": vendor.contact_email}
    )
    db.add(audit)
    db.commit()

    return VendorListItem(
        id=vendor.id,
        name=vendor.name,
        category=vendor.category,
        contact_email=vendor.contact_email,
        contact_phone=vendor.contact_phone,
        status=vendor.status,
        documents_count=0,
        documents_approved_count=0,
        next_expiry=None,
        last_updated=vendor.updated_at,
        created_at=vendor.created_at
    )

@router.get("/{vendor_id}", response_model=VendorDetailResponse)
def get_vendor_details(
    vendor_id: str,
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    verify_tenant_ownership(vendor.organization_id, current_org.id, "vendor")

    docs_response = []
    for d in vendor.documents:
        signed_url = storage_service.generate_signed_download_url(
            document_id=d.id,
            organization_id=current_org.id
        )
        docs_response.append(
            DocumentItemResponse(
                id=d.id,
                field_id=d.field_id,
                document_type=d.document_type,
                original_filename=d.original_filename,
                file_size=d.file_size,
                mime_type=d.mime_type,
                expiry_date=d.expiry_date,
                status=d.status,
                submitted_at=d.submitted_at,
                download_url=signed_url
            )
        )

    # Active onboarding and workflow details
    latest_onboarding = (
        db.query(VendorOnboarding)
        .filter(VendorOnboarding.vendor_id == vendor.id)
        .order_by(VendorOnboarding.created_at.desc())
        .first()
    )

    active_workflow = None
    onboarding_data = None
    if latest_onboarding:
        onboarding_data = {
            "id": latest_onboarding.id,
            "status": latest_onboarding.status,
            "form_responses": latest_onboarding.form_responses,
            "submitted_at": latest_onboarding.submitted_at,
            "approved_at": latest_onboarding.approved_at
        }
        wf_version = db.query(WorkflowVersion).filter(WorkflowVersion.id == latest_onboarding.workflow_version_id).first()
        if wf_version:
            active_workflow = {
                "version_id": wf_version.id,
                "version_number": wf_version.version_number,
                "schema_definition": wf_version.schema_definition
            }

    # Recent activity logs for this vendor
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.organization_id == current_org.id,
            AuditLog.entity_id == vendor.id
        )
        .order_by(AuditLog.created_at.desc())
        .limit(15)
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

    return VendorDetailResponse(
        id=vendor.id,
        organization_id=vendor.organization_id,
        name=vendor.name,
        category=vendor.category,
        contact_email=vendor.contact_email,
        contact_phone=vendor.contact_phone,
        status=vendor.status,
        notes=vendor.notes,
        created_at=vendor.created_at,
        updated_at=vendor.updated_at,
        documents=docs_response,
        active_workflow=active_workflow,
        onboarding_data=onboarding_data,
        recent_activity=recent_activity
    )

@router.patch("/{vendor_id}", response_model=VendorDetailResponse)
def update_vendor(
    vendor_id: str,
    payload: VendorUpdate,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    verify_tenant_ownership(vendor.organization_id, current_org.id, "vendor")

    if payload.name:
        vendor.name = payload.name.strip()
    if payload.category:
        vendor.category = payload.category
    if payload.contact_email:
        vendor.contact_email = payload.contact_email.lower().strip()
    if payload.contact_phone is not None:
        vendor.contact_phone = payload.contact_phone
    if payload.status:
        vendor.status = payload.status
    if payload.notes is not None:
        vendor.notes = payload.notes

    db.commit()
    db.refresh(vendor)

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="VENDOR_PROFILE_UPDATED",
        entity_type="vendor",
        entity_id=vendor.id,
        details={"status": vendor.status, "name": vendor.name}
    )
    db.add(audit)
    db.commit()

    return get_vendor_details(vendor_id, current_org, db)

@router.post("/{vendor_id}/request-documents")
def request_missing_documents(
    vendor_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    verify_tenant_ownership(vendor.organization_id, current_org.id, "vendor")

    subject = f"Action Required: Compliance Documents Request from {current_org.name}"
    body = (
        f"Hello {vendor.name},\n\n"
        f"This is a compliance documentation request from {current_user.full_name} ({current_user.email}) at {current_org.name}.\n"
        f"Please check your submission portal or reach out directly to provide missing or updated documentation.\n\n"
        f"If you have questions, reply directly to this email to reach {current_user.full_name}.\n\n"
        f"Thank you,\n{current_user.full_name} ({current_user.email})\n{current_org.name} Compliance Team"
    )

    job = notification_service.record_and_send_notification(
        db=db,
        organization_id=current_org.id,
        vendor_id=vendor.id,
        document_id=None,
        notification_type="DOCUMENT_REQUEST",
        recipient_email=vendor.contact_email,
        subject=subject,
        body_text=body,
        idempotency_key=f"doc_req_{vendor.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}",
        reply_to=current_user.email,
        sender_name=f"{current_user.full_name} via {current_org.name}"
    )

    return {"success": True, "message": "Document request notification sent to vendor.", "job_id": job.id}

@router.delete("/{vendor_id}")
def delete_vendor(
    vendor_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    verify_tenant_ownership(vendor.organization_id, current_org.id, "vendor")

    vendor_name = vendor.name

    # Delete all associated physical files from storage
    for doc in vendor.documents:
        if doc.storage_path:
            storage_service.delete_file(doc.storage_path)

    # Delete vendor (cascades to documents, reviews, onboarding, notifications in db)
    db.delete(vendor)
    db.commit()

    # Record audit log
    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="VENDOR_DELETED",
        entity_type="vendor",
        entity_id=vendor_id,
        details={"name": vendor_name}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Vendor '{vendor_name}' deleted successfully", "vendor_id": vendor_id}
