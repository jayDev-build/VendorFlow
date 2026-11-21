from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.security import hash_token
from app.models.models import (
    InvitationToken,
    WorkflowVersion,
    WorkflowAssignment,
    Organization,
    Vendor,
    VendorOnboarding,
    Document,
    AuditLog,
    User,
)
from app.schemas.vendor import PublicInvitationView, PublicSubmissionPayload
from app.services.storage_service import storage_service
from app.services.notification_service import notification_service
from app.core.utils import ensure_utc
from dateutil import parser as date_parser

router = APIRouter(prefix="/public/invitations", tags=["Public Vendor Portal"])

def get_valid_invitation(token: str, db: Session) -> InvitationToken:
    t_hash = hash_token(token)
    invitation = db.query(InvitationToken).filter(InvitationToken.token_hash == t_hash).first()
    if not invitation:
        # Check if token is a client's unified portal_token
        vendor = db.query(Vendor).filter(Vendor.portal_token == token).first()
        if vendor:
            # If the client has a flagged (rejected / resubmission requested) document, route to that workflow version first
            flagged_doc = (
                db.query(Document)
                .filter(
                    Document.vendor_id == vendor.id,
                    Document.status.in_(["REJECTED", "RESUBMISSION_REQUESTED"])
                )
                .order_by(Document.updated_at.desc())
                .first()
            )
            target_wv_id = None
            if flagged_doc:
                if flagged_doc.onboarding and flagged_doc.onboarding.workflow_version_id:
                    target_wv_id = flagged_doc.onboarding.workflow_version_id
                elif flagged_doc.assignment and flagged_doc.assignment.workflow_version_id:
                    target_wv_id = flagged_doc.assignment.workflow_version_id

            if target_wv_id:
                invitation = (
                    db.query(InvitationToken)
                    .filter(
                        InvitationToken.vendor_id == vendor.id,
                        InvitationToken.workflow_version_id == target_wv_id
                    )
                    .order_by(InvitationToken.created_at.desc())
                    .first()
                )

            if not invitation:
                invitation = (
                    db.query(InvitationToken)
                    .filter(InvitationToken.vendor_id == vendor.id)
                    .order_by(InvitationToken.created_at.desc())
                    .first()
                )
            if not invitation and vendor.workflow_assignments:
                assign = vendor.workflow_assignments[0]
                invitation = InvitationToken(
                    organization_id=vendor.organization_id,
                    workflow_version_id=assign.workflow_version_id,
                    vendor_id=vendor.id,
                    email=vendor.contact_email,
                    token_hash=t_hash,
                    expires_at=datetime.now(timezone.utc) + timedelta(days=14),
                    is_revoked=False
                )
                db.add(invitation)
                db.commit()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token or link not found"
        )
    if invitation.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation link has been revoked by the administrator"
        )
    from app.core.utils import ensure_utc
    if ensure_utc(invitation.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This onboarding link has expired. Please contact the administrator for a renewed invitation."
        )
    return invitation

@router.get("/{token}", response_model=PublicInvitationView)
def view_invitation(token: str, db: Session = Depends(get_db)):
    invitation = get_valid_invitation(token, db)
    version = db.query(WorkflowVersion).filter(WorkflowVersion.id == invitation.workflow_version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Associated workflow template not found")

    org = db.query(Organization).filter(Organization.id == invitation.organization_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == invitation.vendor_id).first() if invitation.vendor_id else None

    # Check existing onboarding draft or submission for THIS specific workflow version
    existing_responses = {}
    existing_documents = []
    is_submitted = False
    submission_status = None
    if vendor:
        if invitation.used_at is not None:
            onboarding = (
                db.query(VendorOnboarding)
                .filter(
                    VendorOnboarding.vendor_id == vendor.id,
                    VendorOnboarding.workflow_version_id == version.id
                )
                .order_by(VendorOnboarding.created_at.desc())
                .first()
            )
        else:
            onboarding = (
                db.query(VendorOnboarding)
                .filter(
                    VendorOnboarding.vendor_id == vendor.id,
                    VendorOnboarding.workflow_version_id == version.id,
                    VendorOnboarding.status.in_(["IN_PROGRESS", "RESUBMISSION_REQUESTED", "REJECTED"])
                )
                .order_by(VendorOnboarding.created_at.desc())
                .first()
            )
        if onboarding:
            if invitation.used_at is not None and onboarding.status in ("SUBMITTED", "APPROVED"):
                is_submitted = True
                submission_status = onboarding.status
                if onboarding.form_responses:
                    existing_responses = onboarding.form_responses
            elif onboarding.status in ("RESUBMISSION_REQUESTED", "REJECTED"):
                is_submitted = False
                submission_status = onboarding.status
                if onboarding.form_responses:
                    existing_responses = onboarding.form_responses
            elif onboarding.status == "IN_PROGRESS":
                is_submitted = False
                submission_status = "IN_PROGRESS"
                if onboarding.form_responses:
                    existing_responses = onboarding.form_responses
            else:
                is_submitted = (invitation.used_at is not None)
                submission_status = onboarding.status
                if onboarding.form_responses:
                    existing_responses = onboarding.form_responses

            docs = (
                db.query(Document)
                .filter(
                    Document.vendor_id == vendor.id,
                    or_(
                        Document.onboarding_id == onboarding.id,
                        Document.onboarding_id.is_(None)
                    )
                )
                .all()
            )
            schema_field_ids = {f.get("id") for f in version.schema_definition.get("fields", []) if isinstance(f, dict)}
            docs = [d for d in docs if d.field_id in schema_field_ids]

            has_flagged_doc = False
            for d in docs:
                latest_review_reason = None
                has_replacement = False
                if d.reviews:
                    latest_review = d.reviews[-1]
                    latest_review_reason = latest_review.reason
                    if ensure_utc(d.submitted_at) > ensure_utc(latest_review.created_at):
                        has_replacement = True
                if d.status in ("RESUBMISSION_REQUESTED", "REJECTED"):
                    has_flagged_doc = True
                existing_documents.append({
                    "id": d.id,
                    "field_id": d.field_id,
                    "document_type": d.document_type,
                    "original_filename": d.original_filename,
                    "file_size": d.file_size,
                    "mime_type": d.mime_type,
                    "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                    "status": d.status,
                    "review_reason": latest_review_reason,
                    "has_replacement": has_replacement,
                    "view_url": f"/api/v1/public/invitations/{token}/documents/{d.id}/view",
                    "download_url": f"/api/v1/public/invitations/{token}/documents/{d.id}/view?download=true"
                })

            # If any document is rejected or requested for resubmission, allow immediate re-upload
            if has_flagged_doc:
                is_submitted = False
                submission_status = "RESUBMISSION_REQUESTED"

    schema_def = version.schema_definition
    return PublicInvitationView(
        valid=True,
        email=invitation.email,
        organization_name=org.name if org else "FormGate Organization",
        workflow_name=schema_def.get("name", "Vendor Onboarding"),
        workflow_description=schema_def.get("description"),
        vendor_category=schema_def.get("vendor_category", "General"),
        schema_definition=schema_def,
        existing_responses=existing_responses,
        existing_documents=existing_documents,
        expires_at=invitation.expires_at,
        is_submitted=is_submitted,
        submission_status=submission_status
    )

@router.post("/{token}/documents")
async def upload_document(
    token: str,
    file: UploadFile = File(...),
    field_id: str = Form(...),
    document_type: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    invitation = get_valid_invitation(token, db)
    version = db.query(WorkflowVersion).filter(WorkflowVersion.id == invitation.workflow_version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Workflow version not found")

    # Ensure vendor exists
    vendor = db.query(Vendor).filter(Vendor.id == invitation.vendor_id).first()
    if not vendor:
        vendor = Vendor(
            organization_id=invitation.organization_id,
            name=invitation.email.split("@")[0].capitalize(),
            category=version.schema_definition.get("vendor_category", "General"),
            contact_email=invitation.email,
            status="IN_PROGRESS"
        )
        db.add(vendor)
        db.flush()
        invitation.vendor_id = vendor.id

    # Find or create Onboarding instance for THIS specific workflow version
    if invitation.used_at is not None:
        onboarding = (
            db.query(VendorOnboarding)
            .filter(
                VendorOnboarding.vendor_id == vendor.id,
                VendorOnboarding.workflow_version_id == version.id
            )
            .order_by(VendorOnboarding.created_at.desc())
            .first()
        )
    else:
        onboarding = (
            db.query(VendorOnboarding)
            .filter(
                VendorOnboarding.vendor_id == vendor.id,
                VendorOnboarding.workflow_version_id == version.id,
                VendorOnboarding.status.in_(["IN_PROGRESS", "RESUBMISSION_REQUESTED", "REJECTED"])
            )
            .order_by(VendorOnboarding.created_at.desc())
            .first()
        )
    if not onboarding:
        onboarding = VendorOnboarding(
            organization_id=invitation.organization_id,
            vendor_id=vendor.id,
            workflow_version_id=version.id,
            status="IN_PROGRESS"
        )
        db.add(onboarding)
        db.flush()

    # Save to secure private storage
    storage_path, file_size, mime_type = await storage_service.save_file(
        file=file,
        organization_id=invitation.organization_id,
        vendor_id=vendor.id
    )

    parsed_expiry = None
    if expiry_date:
        try:
            parsed_expiry = date_parser.parse(expiry_date)
            if parsed_expiry.tzinfo is None:
                parsed_expiry = parsed_expiry.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid expiry date format. Use YYYY-MM-DD.")

    # Link to workflow assignment if exists
    assignment = (
        db.query(WorkflowAssignment)
        .filter(
            WorkflowAssignment.client_id == vendor.id,
            WorkflowAssignment.workflow_version_id == version.id
        )
        .first()
    )
    if not assignment:
        assignment = (
            db.query(WorkflowAssignment)
            .filter(
                WorkflowAssignment.client_id == vendor.id,
                WorkflowAssignment.workflow_id == version.workflow_template_id
            )
            .first()
        )

    # Remove previous document for same field in this onboarding if any (resubmission)
    existing_doc = (
        db.query(Document)
        .filter(
            Document.vendor_id == vendor.id,
            Document.field_id == field_id,
            or_(
                Document.onboarding_id == onboarding.id,
                Document.onboarding_id.is_(None)
            )
        )
        .first()
    )
    if existing_doc:
        existing_doc.onboarding_id = onboarding.id
        if assignment and not existing_doc.assignment_id:
            existing_doc.assignment_id = assignment.id
        existing_doc.original_filename = file.filename or "uploaded_document"
        existing_doc.file_size = file_size
        existing_doc.mime_type = mime_type
        existing_doc.storage_path = storage_path
        existing_doc.expiry_date = parsed_expiry
        existing_doc.submitted_at = datetime.now(timezone.utc)
        # Do not change the status on form/backend for resubmitted document until submit is hit!
        if existing_doc.status not in ("RESUBMISSION_REQUESTED", "REJECTED"):
            existing_doc.status = "SUBMITTED"
        doc = existing_doc
    else:
        doc = Document(
            organization_id=invitation.organization_id,
            vendor_id=vendor.id,
            onboarding_id=onboarding.id,
            assignment_id=assignment.id if assignment else None,
            field_id=field_id,
            document_type=document_type,
            original_filename=file.filename or "uploaded_document",
            file_size=file_size,
            mime_type=mime_type,
            storage_path=storage_path,
            expiry_date=parsed_expiry,
            status="SUBMITTED"
        )
        db.add(doc)

    vendor.status = "IN_PROGRESS"
    db.commit()
    db.refresh(doc)

    return {
        "success": True,
        "document_id": doc.id,
        "field_id": doc.field_id,
        "document_type": doc.document_type,
        "original_filename": doc.original_filename,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
        "status": doc.status,
        "has_replacement": True,
        "view_url": f"/api/v1/public/invitations/{token}/documents/{doc.id}/view",
        "download_url": f"/api/v1/public/invitations/{token}/documents/{doc.id}/view?download=true"
    }

@router.get("/{token}/documents/{document_id}/view")
def view_public_document(
    token: str,
    document_id: str,
    download: bool = Query(False),
    db: Session = Depends(get_db)
):
    invitation = get_valid_invitation(token, db)
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == invitation.organization_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return storage_service.get_download_response(
        storage_path=doc.storage_path,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        inline=not download
    )

@router.delete("/{token}/documents/{document_id}")
def delete_public_document(
    token: str,
    document_id: str,
    db: Session = Depends(get_db)
):
    invitation = get_valid_invitation(token, db)
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == invitation.organization_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    field_id = doc.field_id
    if doc.storage_path:
        storage_service.delete_file(doc.storage_path)

    db.delete(doc)
    db.commit()

    return {
        "success": True,
        "message": "Document deleted successfully",
        "field_id": field_id,
        "document_id": document_id
    }

@router.post("/{token}/submit")
def submit_onboarding(
    token: str,
    payload: PublicSubmissionPayload,
    db: Session = Depends(get_db)
):
    invitation = get_valid_invitation(token, db)
    version = db.query(WorkflowVersion).filter(WorkflowVersion.id == invitation.workflow_version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Workflow version not found")

    vendor = db.query(Vendor).filter(Vendor.id == invitation.vendor_id).first() if invitation.vendor_id else None
    if not vendor:
        vendor = Vendor(
            organization_id=invitation.organization_id,
            name=invitation.email.split("@")[0].capitalize(),
            category=version.schema_definition.get("vendor_category", "General"),
            contact_email=invitation.email,
            status="IN_PROGRESS"
        )
        db.add(vendor)
        db.flush()
        invitation.vendor_id = vendor.id

    # Update or create onboarding instance for THIS specific workflow version
    if invitation.used_at is not None:
        onboarding = (
            db.query(VendorOnboarding)
            .filter(
                VendorOnboarding.vendor_id == vendor.id,
                VendorOnboarding.workflow_version_id == version.id
            )
            .order_by(VendorOnboarding.created_at.desc())
            .first()
        )
    else:
        onboarding = (
            db.query(VendorOnboarding)
            .filter(
                VendorOnboarding.vendor_id == vendor.id,
                VendorOnboarding.workflow_version_id == version.id,
                VendorOnboarding.status.in_(["IN_PROGRESS", "RESUBMISSION_REQUESTED", "REJECTED"])
            )
            .order_by(VendorOnboarding.created_at.desc())
            .first()
        )
    if not onboarding:
        onboarding = VendorOnboarding(
            organization_id=invitation.organization_id,
            vendor_id=vendor.id,
            workflow_version_id=version.id,
            status="IN_PROGRESS"
        )
        db.add(onboarding)
        db.flush()

    schema_fields = version.schema_definition.get("fields", [])
    
    # Validate required form fields and document uploads for THIS specific onboarding
    existing_docs = {
        d.field_id: d for d in db.query(Document).filter(
            Document.vendor_id == vendor.id,
            or_(
                Document.onboarding_id == onboarding.id,
                Document.onboarding_id.is_(None)
            )
        ).all()
    }

    missing_fields = []
    missing_docs = []
    missing_expiries = []

    for f in schema_fields:
        fid = f.get("id")
        ftype = f.get("field_type")
        is_req = f.get("required", False)
        track_exp = f.get("track_expiry", False)

        if ftype == "file_upload":
            if is_req and fid not in existing_docs:
                missing_docs.append(f.get("label", fid))
            elif is_req and fid in existing_docs and existing_docs[fid].status in ("REJECTED", "RESUBMISSION_REQUESTED"):
                doc = existing_docs[fid]
                latest_review = doc.reviews[-1] if doc.reviews else None
                if not latest_review or ensure_utc(doc.submitted_at) <= ensure_utc(latest_review.created_at):
                    missing_docs.append(f"{f.get('label', fid)} (replacement file required)")
            elif fid in existing_docs and track_exp:
                # Check if expiry was saved or provided in payload
                doc = existing_docs[fid]
                payload_expiry = payload.document_expiries.get(fid)
                if not doc.expiry_date and not payload_expiry:
                    missing_expiries.append(f.get("label", fid))
                elif payload_expiry:
                    try:
                        p_date = date_parser.parse(payload_expiry)
                        if p_date.tzinfo is None:
                            p_date = p_date.replace(tzinfo=timezone.utc)
                        doc.expiry_date = p_date
                    except Exception:
                        pass
        else:
            if is_req and (fid not in payload.form_responses or not payload.form_responses[fid]):
                missing_fields.append(f.get("label", fid))

    if missing_fields or missing_docs or missing_expiries:
        errors = []
        if missing_fields:
            errors.append(f"Missing required fields: {', '.join(missing_fields)}")
        if missing_docs:
            errors.append(f"Missing required document uploads: {', '.join(missing_docs)}")
        if missing_expiries:
            errors.append(f"Expiry date required for: {', '.join(missing_expiries)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors)
        )

    onboarding.form_responses = payload.form_responses
    onboarding.submitted_at = datetime.now(timezone.utc)

    # Update vendor contact details from responses if provided
    for key, val in payload.form_responses.items():
        if not val or not isinstance(val, str):
            continue
        k = key.lower()
        if not vendor.name or vendor.name.endswith(" Vendor") or vendor.name == "Direct Link Applicant":
            if any(term in k for term in ["company_legal_name", "legal_name", "company_name", "business_name", "vendor_name", "trade_name"]):
                vendor.name = val.strip()
        if not vendor.contact_email or vendor.contact_email.endswith(".local"):
            if any(term in k for term in ["email", "contact_email", "company_email", "rep_email", "work_email"]):
                vendor.contact_email = val.strip()
                invitation.email = val.strip()
        if not vendor.contact_phone:
            if any(term in k for term in ["phone", "mobile", "contact_number", "telephone"]):
                vendor.contact_phone = val.strip()

    # Only transition documents that were newly submitted or replaced to UNDER_REVIEW.
    # Prior APPROVED documents that the vendor did not change remain APPROVED,
    # ensuring the compliance dashboard user does not have to re-review them.
    has_pending_reviews = False
    for doc in existing_docs.values():
        if not doc.onboarding_id:
            doc.onboarding_id = onboarding.id
        if doc.status != "APPROVED":
            doc.status = "UNDER_REVIEW"
            has_pending_reviews = True

    if has_pending_reviews:
        onboarding.status = "SUBMITTED"
        vendor.status = "SUBMITTED"
    else:
        # All required documents were already approved and untouched
        onboarding.status = "APPROVED"
        onboarding.approved_at = onboarding.approved_at or datetime.now(timezone.utc)
        vendor.status = "APPROVED"

    # Also keep workflow assignment in sync
    assignment = (
        db.query(WorkflowAssignment)
        .filter(
            WorkflowAssignment.client_id == vendor.id,
            WorkflowAssignment.workflow_version_id == version.id
        )
        .first()
    )
    if not assignment:
        assignment = (
            db.query(WorkflowAssignment)
            .filter(
                WorkflowAssignment.client_id == vendor.id,
                WorkflowAssignment.workflow_id == version.workflow_template_id
            )
            .first()
        )
    if assignment:
        assignment.status = "SUBMITTED" if has_pending_reviews else "APPROVED"
        assignment.submitted_at = onboarding.submitted_at
        assignment.form_responses = onboarding.form_responses
        for doc in existing_docs.values():
            if not doc.assignment_id:
                doc.assignment_id = assignment.id

    # Mark invitation as used
    invitation.used_at = datetime.now(timezone.utc)

    # Audit log
    audit = AuditLog(
        organization_id=invitation.organization_id,
        user_id=None,
        action="VENDOR_ONBOARDING_SUBMITTED",
        entity_type="vendor",
        entity_id=vendor.id,
        details={"vendor_name": vendor.name, "email": vendor.contact_email}
    )
    db.add(audit)
    db.commit()

    # Confirmation email to vendor and CC organization admin
    if vendor.contact_email and not vendor.contact_email.endswith(".local"):
        admin_user = (
            db.query(User)
            .filter(User.organization_id == invitation.organization_id)
            .order_by(User.created_at.asc())
            .first()
        )
        admin_email = admin_user.email if admin_user and not admin_user.email.endswith(".local") else None

        notification_service.record_and_send_notification(
            db=db,
            organization_id=invitation.organization_id,
            vendor_id=vendor.id,
            document_id=None,
            notification_type="SUBMISSION_CONFIRMATION",
            recipient_email=vendor.contact_email,
            subject="FormGate: Onboarding Submission Received",
            body_text=(
                f"Dear {vendor.name},\n\n"
                f"We have successfully received your completed onboarding submission and compliance documents.\n"
                f"Our compliance and verification team will review your files shortly. You will receive an email update once your submission is reviewed.\n\n"
                f"Thank you,\nFormGate Compliance"
            ),
            idempotency_key=f"submit_conf_{vendor.id}_{onboarding.id}",
            cc=admin_email
        )

    return {
        "success": True,
        "message": "Your onboarding submission and documents have been received successfully.",
        "vendor_id": vendor.id,
        "status": "SUBMITTED"
    }
