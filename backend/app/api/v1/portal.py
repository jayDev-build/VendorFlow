from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.models import (
    Organization,
    Vendor,
    WorkflowTemplate,
    WorkflowVersion,
    WorkflowAssignment,
    VendorOnboarding,
    Document,
    DocumentReview,
    AuditLog,
)
from app.services.storage_service import storage_service
from app.core.utils import ensure_utc
from pydantic import BaseModel
from dateutil import parser as date_parser

router = APIRouter(prefix="/portal", tags=["Unified Client Portal"])


class PortalSubmissionPayload(BaseModel):
    form_responses: Dict[str, Any] = {}
    document_expiries: Dict[str, str] = {}


def get_client_by_portal_token(portal_token: str, db: Session) -> Vendor:
    client = db.query(Vendor).filter(Vendor.portal_token == portal_token).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client portal link not found or invalid"
        )
    return client


@router.get("/{portal_token}")
def get_unified_portal_data(portal_token: str, db: Session = Depends(get_db)):
    client = get_client_by_portal_token(portal_token, db)
    org = db.query(Organization).filter(Organization.id == client.organization_id).first()

    # Fetch all workflow assignments for this client
    assignments = (
        db.query(WorkflowAssignment)
        .filter(WorkflowAssignment.client_id == client.id)
        .order_by(WorkflowAssignment.created_at.asc())
        .all()
    )

    # If no assignments exist yet, migrate/sync from any existing vendor onboardings
    if not assignments:
        onboardings = (
            db.query(VendorOnboarding)
            .filter(VendorOnboarding.vendor_id == client.id)
            .order_by(VendorOnboarding.created_at.asc())
            .all()
        )
        for ob in onboardings:
            if ob.workflow_version:
                tmpl_id = ob.workflow_version.workflow_template_id
                assign = WorkflowAssignment(
                    organization_id=ob.organization_id,
                    client_id=client.id,
                    workflow_id=tmpl_id,
                    workflow_version_id=ob.workflow_version_id,
                    status=ob.status,
                    form_responses=ob.form_responses or {},
                    submitted_at=ob.submitted_at,
                    approved_at=ob.approved_at,
                    created_at=ob.created_at
                )
                db.add(assign)
                db.flush()
                # Attach existing documents
                for d in ob.documents:
                    d.assignment_id = assign.id
                assignments.append(assign)
        if assignments:
            db.commit()

    # 1. Gather all documents across all forms for this client
    all_client_docs = db.query(Document).filter(Document.vendor_id == client.id).all()

    # 2. Build 'Action Required' list for all rejected / resubmission-requested documents
    action_required = []
    for d in all_client_docs:
        if d.status in ("REJECTED", "RESUBMISSION_REQUESTED"):
            # Find which workflow this document belongs to
            wf_name = "Assigned Workflow"
            wf_id = None
            assignment_id = d.assignment_id

            if d.assignment and d.assignment.workflow:
                wf_name = d.assignment.workflow.name
                wf_id = d.assignment.workflow.id
            elif d.onboarding and d.onboarding.workflow_version and d.onboarding.workflow_version.template:
                wf_name = d.onboarding.workflow_version.template.name
                wf_id = d.onboarding.workflow_version.template.id

            latest_review_reason = None
            if d.reviews:
                latest_review_reason = d.reviews[-1].reason

            has_replacement = False
            if d.reviews and ensure_utc(d.submitted_at) > ensure_utc(d.reviews[-1].created_at):
                has_replacement = True

            action_required.append({
                "document_id": d.id,
                "assignment_id": assignment_id,
                "workflow_id": wf_id,
                "workflow_name": wf_name,
                "field_id": d.field_id,
                "document_type": d.document_type,
                "original_filename": d.original_filename,
                "file_size": d.file_size,
                "mime_type": d.mime_type,
                "status": d.status,
                "review_reason": latest_review_reason,
                "has_replacement": has_replacement,
                "view_url": f"/api/v1/portal/{portal_token}/documents/{d.id}/view",
                "download_url": f"/api/v1/portal/{portal_token}/documents/{d.id}/view?download=true"
            })

    # 3. Build assignments array for tabs / collapsible sections
    assignments_data = []
    for assign in assignments:
        tmpl = assign.workflow
        if not tmpl:
            continue

        version = assign.workflow_version
        if not version:
            version = (
                db.query(WorkflowVersion)
                .filter(WorkflowVersion.id == tmpl.current_version_id)
                .first()
            )
        schema_def = version.schema_definition if version and version.schema_definition else {
            "name": tmpl.name,
            "description": tmpl.description,
            "fields": []
        }

        # Filter schema field ids
        schema_fields = schema_def.get("fields", [])
        schema_field_ids = {f.get("id") for f in schema_fields if isinstance(f, dict)}

        # Load documents for this specific assignment
        docs = [d for d in all_client_docs if (d.assignment_id == assign.id or (not d.assignment_id and d.field_id in schema_field_ids))]
        
        # Format existing documents
        formatted_docs = []
        has_flagged_in_assignment = False
        for d in docs:
            # Ensure assignment_id is saved
            if not d.assignment_id:
                d.assignment_id = assign.id
            latest_review_reason = None
            has_replacement = False
            if d.reviews:
                latest_review = d.reviews[-1]
                latest_review_reason = latest_review.reason
                if ensure_utc(d.submitted_at) > ensure_utc(latest_review.created_at):
                    has_replacement = True
            if d.status in ("RESUBMISSION_REQUESTED", "REJECTED"):
                has_flagged_in_assignment = True

            formatted_docs.append({
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
                "view_url": f"/api/v1/portal/{portal_token}/documents/{d.id}/view",
                "download_url": f"/api/v1/portal/{portal_token}/documents/{d.id}/view?download=true"
            })

        is_submitted = (assign.status in ("SUBMITTED", "APPROVED")) and not has_flagged_in_assignment

        assignments_data.append({
            "id": assign.id,
            "workflow_id": tmpl.id,
            "workflow_name": tmpl.name,
            "workflow_description": tmpl.description or schema_def.get("description", ""),
            "vendor_category": tmpl.vendor_category,
            "status": assign.status,
            "is_submitted": is_submitted,
            "submitted_at": assign.submitted_at.isoformat() if assign.submitted_at else None,
            "approved_at": assign.approved_at.isoformat() if assign.approved_at else None,
            "schema_definition": schema_def,
            "existing_responses": assign.form_responses or {},
            "existing_documents": formatted_docs
        })

    db.commit()

    return {
        "valid": True,
        "portal_token": portal_token,
        "client_id": client.id,
        "client_name": client.name,
        "client_email": client.contact_email,
        "client_status": client.status,
        "organization_name": org.name if org else "FormGate Client Portal",
        "action_required": action_required,
        "assignments": assignments_data
    }


@router.post("/{portal_token}/assignments/{assignment_id}/documents")
async def upload_portal_assignment_document(
    portal_token: str,
    assignment_id: str,
    file: UploadFile = File(...),
    field_id: str = Form(...),
    document_type: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    client = get_client_by_portal_token(portal_token, db)
    assignment = (
        db.query(WorkflowAssignment)
        .filter(
            WorkflowAssignment.id == assignment_id,
            WorkflowAssignment.client_id == client.id
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Workflow assignment not found")

    # Save to storage
    storage_path, file_size, mime_type = await storage_service.save_file(
        file=file,
        organization_id=client.organization_id,
        vendor_id=client.id
    )

    parsed_expiry = None
    if expiry_date:
        try:
            parsed_expiry = date_parser.parse(expiry_date)
            if parsed_expiry.tzinfo is None:
                parsed_expiry = parsed_expiry.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid expiry date format. Use YYYY-MM-DD.")

    # Locate existing document for this field in this assignment
    existing_doc = (
        db.query(Document)
        .filter(
            Document.vendor_id == client.id,
            Document.field_id == field_id,
            or_(
                Document.assignment_id == assignment.id,
                Document.assignment_id.is_(None)
            )
        )
        .first()
    )

    if existing_doc:
        existing_doc.assignment_id = assignment.id
        existing_doc.original_filename = file.filename or "uploaded_document"
        existing_doc.file_size = file_size
        existing_doc.mime_type = mime_type
        existing_doc.storage_path = storage_path
        existing_doc.expiry_date = parsed_expiry
        existing_doc.submitted_at = datetime.now(timezone.utc)
        # Keep status as SUBMITTED or mark ready for review
        if existing_doc.status not in ("RESUBMISSION_REQUESTED", "REJECTED"):
            existing_doc.status = "SUBMITTED"
        doc = existing_doc
    else:
        doc = Document(
            organization_id=client.organization_id,
            vendor_id=client.id,
            assignment_id=assignment.id,
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

    client.status = "IN_PROGRESS"
    db.commit()
    db.refresh(doc)

    return {
        "success": True,
        "document_id": doc.id,
        "assignment_id": assignment.id,
        "field_id": doc.field_id,
        "document_type": doc.document_type,
        "original_filename": doc.original_filename,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
        "status": doc.status,
        "has_replacement": True,
        "view_url": f"/api/v1/portal/{portal_token}/documents/{doc.id}/view",
        "download_url": f"/api/v1/portal/{portal_token}/documents/{doc.id}/view?download=true"
    }


@router.post("/{portal_token}/assignments/{assignment_id}/submit")
def submit_portal_assignment(
    portal_token: str,
    assignment_id: str,
    payload: PortalSubmissionPayload,
    db: Session = Depends(get_db)
):
    client = get_client_by_portal_token(portal_token, db)
    assignment = (
        db.query(WorkflowAssignment)
        .filter(
            WorkflowAssignment.id == assignment_id,
            WorkflowAssignment.client_id == client.id
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Workflow assignment not found")

    tmpl = assignment.workflow
    version = assignment.workflow_version
    if not version and tmpl:
        version = db.query(WorkflowVersion).filter(WorkflowVersion.id == tmpl.current_version_id).first()

    schema_fields = version.schema_definition.get("fields", []) if version else []

    # Get documents for this assignment
    docs_map = {
        d.field_id: d for d in db.query(Document).filter(
            Document.vendor_id == client.id,
            or_(
                Document.assignment_id == assignment.id,
                Document.assignment_id.is_(None)
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
            if is_req and fid not in docs_map:
                missing_docs.append(f.get("label", fid))
            elif is_req and fid in docs_map and docs_map[fid].status in ("REJECTED", "RESUBMISSION_REQUESTED"):
                doc = docs_map[fid]
                latest_review = doc.reviews[-1] if doc.reviews else None
                if not latest_review or ensure_utc(doc.submitted_at) <= ensure_utc(latest_review.created_at):
                    missing_docs.append(f"{f.get('label', fid)} (replacement file required)")
            elif fid in docs_map and track_exp:
                doc = docs_map[fid]
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
        raise HTTPException(status_code=400, detail="; ".join(errors))

    assignment.form_responses = payload.form_responses
    assignment.submitted_at = datetime.now(timezone.utc)

    # Transition docs to UNDER_REVIEW
    has_pending = False
    for doc in docs_map.values():
        doc.assignment_id = assignment.id
        if doc.status != "APPROVED":
            doc.status = "UNDER_REVIEW"
            has_pending = True

    if has_pending:
        assignment.status = "SUBMITTED"
        client.status = "SUBMITTED"
    else:
        assignment.status = "APPROVED"
        assignment.approved_at = datetime.now(timezone.utc)
        client.status = "APPROVED"

    db.commit()

    return {
        "success": True,
        "assignment_id": assignment.id,
        "status": assignment.status,
        "message": f"Responses for '{tmpl.name if tmpl else 'Workflow'}' submitted successfully"
    }


@router.get("/{portal_token}/documents/{document_id}/view")
def view_portal_document(
    portal_token: str,
    document_id: str,
    download: bool = Query(False),
    db: Session = Depends(get_db)
):
    client = get_client_by_portal_token(portal_token, db)
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.vendor_id == client.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return storage_service.get_download_response(
        storage_path=doc.storage_path,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        inline=not download
    )


@router.delete("/{portal_token}/documents/{document_id}")
def delete_portal_document(
    portal_token: str,
    document_id: str,
    db: Session = Depends(get_db)
):
    client = get_client_by_portal_token(portal_token, db)
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.vendor_id == client.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    field_id = doc.field_id
    if doc.storage_path:
        storage_service.delete_file(doc.storage_path)

    db.delete(doc)
    db.commit()

    return {"success": True, "document_id": document_id, "field_id": field_id}
