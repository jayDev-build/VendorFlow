from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.core.security import generate_secure_token, hash_token
from app.models.models import (
    WorkflowTemplate,
    WorkflowVersion,
    Vendor,
    VendorOnboarding,
    InvitationToken,
    ReminderRule,
    AuditLog,
    User,
    Organization,
    Document,
)
from app.schemas.workflow import (
    WorkflowGenerateRequest,
    WorkflowCreateRequest,
    WorkflowUpdateRequest,
    WorkflowResponse,
    WorkflowSchemaDefinition,
    CreateInvitationRequest,
    InvitationResponse,
    WorkflowResponsesPayload,
    WorkflowResponseSubmission,
    WorkflowResponseDocument,
    WorkflowResponsesStats,
)
from app.services.ai_workflow_generator import generate_workflow_from_requirements
from app.services.notification_service import notification_service
from app.services.storage_service import storage_service
from app.core.utils import ensure_utc
from app.api.deps import get_current_user, get_current_org, verify_tenant_ownership

router = APIRouter(prefix="/workflows", tags=["AI & Workflows"])

@router.post("/generate", response_model=WorkflowSchemaDefinition)
async def generate_workflow(
    request: WorkflowGenerateRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_org)
):
    """
    Core AI Differentiator:
    Converts plain-English compliance and onboarding requirements into a validated,
    editable workflow schema definition.
    """
    schema = await generate_workflow_from_requirements(
        prompt=request.prompt,
        workflow_name=request.workflow_name,
        vendor_category=request.vendor_category,
        description=request.description
    )
    return schema

@router.get("", response_model=List[WorkflowResponse])
def list_workflows(
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    templates = (
        db.query(WorkflowTemplate)
        .filter(WorkflowTemplate.organization_id == current_org.id)
        .order_by(WorkflowTemplate.created_at.desc())
        .all()
    )

    results = []
    for t in templates:
        latest_version = None
        if t.current_version_id:
            latest_version = db.query(WorkflowVersion).filter(WorkflowVersion.id == t.current_version_id).first()
        elif t.versions:
            latest_version = sorted(t.versions, key=lambda v: v.version_number, reverse=True)[0]

        schema_dict = latest_version.schema_definition if latest_version else {}
        version_ids = [v.id for v in t.versions]
        resp_count = (
            db.query(VendorOnboarding)
            .filter(
                VendorOnboarding.organization_id == current_org.id,
                VendorOnboarding.workflow_version_id.in_(version_ids),
                VendorOnboarding.status.in_(["SUBMITTED", "APPROVED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED", "REJECTED"])
            )
            .count()
            if version_ids else 0
        )

        results.append(
            WorkflowResponse(
                id=t.id,
                organization_id=t.organization_id,
                name=t.name,
                vendor_category=t.vendor_category,
                description=t.description,
                status=t.status,
                current_version_id=latest_version.id if latest_version else None,
                current_version_number=latest_version.version_number if latest_version else 1,
                schema_definition=schema_dict,
                approval_required=latest_version.approval_required if latest_version else True,
                reminder_rules=latest_version.reminder_rules or [30, 7, 1] if latest_version else [30, 7, 1],
                assumptions=latest_version.assumptions or [] if latest_version else [],
                warnings=latest_version.warnings or [] if latest_version else [],
                responses_count=resp_count,
                created_at=t.created_at,
                updated_at=t.updated_at
            )
        )
    return results

@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(
    payload: WorkflowCreateRequest,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = WorkflowTemplate(
        organization_id=current_org.id,
        name=payload.name,
        vendor_category=payload.vendor_category,
        description=payload.description,
        status="DRAFT"
    )
    db.add(template)
    db.flush()

    schema_json = payload.schema_definition.model_dump()

    version = WorkflowVersion(
        workflow_template_id=template.id,
        organization_id=current_org.id,
        version_number=1,
        schema_definition=schema_json,
        approval_required=payload.approval_required,
        reminder_rules=payload.reminder_rules,
        assumptions=payload.schema_definition.assumptions,
        warnings=payload.schema_definition.warnings
    )
    db.add(version)
    db.flush()

    template.current_version_id = version.id

    # Create reminder rules
    for days in payload.reminder_rules:
        r_rule = ReminderRule(
            organization_id=current_org.id,
            workflow_version_id=version.id,
            days_before_expiry=days,
            reminder_type="EXPIRY_WARNING",
            notify_vendor=True,
            notify_manager=True
        )
        db.add(r_rule)

    # Audit log
    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="WORKFLOW_CREATED",
        entity_type="workflow_template",
        entity_id=template.id,
        details={"name": template.name, "category": template.vendor_category}
    )
    db.add(audit)
    db.commit()
    db.refresh(template)
    db.refresh(version)

    return WorkflowResponse(
        id=template.id,
        organization_id=template.organization_id,
        name=template.name,
        vendor_category=template.vendor_category,
        description=template.description,
        status=template.status,
        current_version_id=version.id,
        current_version_number=version.version_number,
        schema_definition=version.schema_definition,
        approval_required=version.approval_required,
        reminder_rules=version.reminder_rules,
        assumptions=version.assumptions,
        warnings=version.warnings,
        created_at=template.created_at,
        updated_at=template.updated_at
    )

@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: str,
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    latest_version = None
    if template.current_version_id:
        latest_version = db.query(WorkflowVersion).filter(WorkflowVersion.id == template.current_version_id).first()
    elif template.versions:
        latest_version = sorted(template.versions, key=lambda v: v.version_number, reverse=True)[0]

    return WorkflowResponse(
        id=template.id,
        organization_id=template.organization_id,
        name=template.name,
        vendor_category=template.vendor_category,
        description=template.description,
        status=template.status,
        current_version_id=latest_version.id if latest_version else None,
        current_version_number=latest_version.version_number if latest_version else 1,
        schema_definition=latest_version.schema_definition if latest_version else {},
        approval_required=latest_version.approval_required if latest_version else True,
        reminder_rules=latest_version.reminder_rules if latest_version else [30, 7, 1],
        assumptions=latest_version.assumptions if latest_version else [],
        warnings=latest_version.warnings if latest_version else [],
        created_at=template.created_at,
        updated_at=template.updated_at
    )

@router.patch("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: str,
    payload: WorkflowUpdateRequest,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    if payload.name:
        template.name = payload.name
    if payload.vendor_category:
        template.vendor_category = payload.vendor_category
    if payload.description is not None:
        template.description = payload.description

    # Get current version
    current_version = None
    if template.current_version_id:
        current_version = db.query(WorkflowVersion).filter(WorkflowVersion.id == template.current_version_id).first()

    # If the workflow is already PUBLISHED and schema changes are made, create a new version to prevent mutating in-flight vendor onboardings!
    if template.status == "PUBLISHED" and payload.schema_definition is not None:
        next_ver_num = (current_version.version_number + 1) if current_version else 2
        new_version = WorkflowVersion(
            workflow_template_id=template.id,
            organization_id=current_org.id,
            version_number=next_ver_num,
            schema_definition=payload.schema_definition.model_dump(),
            approval_required=payload.approval_required if payload.approval_required is not None else current_version.approval_required,
            reminder_rules=payload.reminder_rules if payload.reminder_rules is not None else current_version.reminder_rules,
            assumptions=payload.schema_definition.assumptions,
            warnings=payload.schema_definition.warnings
        )
        db.add(new_version)
        db.flush()
        template.current_version_id = new_version.id
        current_version = new_version
    elif current_version and payload.schema_definition is not None:
        # If in draft, update existing version
        current_version.schema_definition = payload.schema_definition.model_dump()
        if payload.approval_required is not None:
            current_version.approval_required = payload.approval_required
        if payload.reminder_rules is not None:
            current_version.reminder_rules = payload.reminder_rules
        current_version.assumptions = payload.schema_definition.assumptions
        current_version.warnings = payload.schema_definition.warnings

    db.commit()
    db.refresh(template)
    if current_version:
        db.refresh(current_version)

    # Record audit log
    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="WORKFLOW_UPDATED",
        entity_type="workflow_template",
        entity_id=template.id,
        details={
            "name": template.name,
            "status": template.status,
            "version_number": current_version.version_number if current_version else 1
        }
    )
    db.add(audit)
    db.commit()

    return WorkflowResponse(
        id=template.id,
        organization_id=template.organization_id,
        name=template.name,
        vendor_category=template.vendor_category,
        description=template.description,
        status=template.status,
        current_version_id=current_version.id if current_version else None,
        current_version_number=current_version.version_number if current_version else 1,
        schema_definition=current_version.schema_definition if current_version else {},
        approval_required=current_version.approval_required if current_version else True,
        reminder_rules=current_version.reminder_rules if current_version else [30, 7, 1],
        assumptions=current_version.assumptions if current_version else [],
        warnings=current_version.warnings if current_version else [],
        created_at=template.created_at,
        updated_at=template.updated_at
    )

@router.post("/{workflow_id}/publish", response_model=WorkflowResponse)
def publish_workflow(
    workflow_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    template.status = "PUBLISHED"
    db.commit()
    db.refresh(template)

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="WORKFLOW_PUBLISHED",
        entity_type="workflow_template",
        entity_id=template.id,
        details={"name": template.name}
    )
    db.add(audit)
    db.commit()

    return get_workflow(workflow_id, current_org, db)

@router.post("/{workflow_id}/archive", response_model=WorkflowResponse)
def archive_workflow(
    workflow_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    template.status = "ARCHIVED"
    db.commit()
    db.refresh(template)

    return get_workflow(workflow_id, current_org, db)

@router.delete("/{workflow_id}")
def delete_workflow(
    workflow_id: str,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    wf_name = template.name
    wf_category = template.vendor_category

    # Get all version IDs for this workflow template
    version_ids = [v.id for v in template.versions]

    if version_ids:
        # Delete or detach any linked vendor onboardings to prevent foreign key restrict violations
        onboardings = db.query(VendorOnboarding).filter(VendorOnboarding.workflow_version_id.in_(version_ids)).all()
        for ob in onboardings:
            db.delete(ob)

        # Delete any associated invitation tokens
        invitations = db.query(InvitationToken).filter(InvitationToken.workflow_version_id.in_(version_ids)).all()
        for inv in invitations:
            db.delete(inv)

    # Delete template (cascades to workflow_versions and reminder_rules)
    db.delete(template)
    db.commit()

    # Record audit log
    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="WORKFLOW_DELETED",
        entity_type="workflow_template",
        entity_id=workflow_id,
        details={"name": wf_name, "category": wf_category}
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Workflow '{wf_name}' deleted successfully", "workflow_id": workflow_id}

@router.post("/{workflow_id}/invitations", response_model=InvitationResponse)
def create_vendor_invitation(
    workflow_id: str,
    payload: CreateInvitationRequest,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    if template.status != "PUBLISHED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate invitations for an unpublished workflow. Please publish the workflow first."
        )

    # Find or create vendor
    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.organization_id == current_org.id,
            Vendor.contact_email == payload.email.lower().strip()
        )
        .first()
    )

    if not vendor:
        vendor_name = payload.vendor_name or payload.email.split("@")[0].capitalize() + " Vendor"
        vendor = Vendor(
            organization_id=current_org.id,
            name=vendor_name,
            category=payload.vendor_category or template.vendor_category,
            contact_email=payload.email.lower().strip(),
            status="INVITED",
            notes=payload.notes
        )
        db.add(vendor)
        db.flush()

    raw_token = generate_secure_token(32)
    t_hash = hash_token(raw_token)
    expires = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    invitation = InvitationToken(
        organization_id=current_org.id,
        workflow_version_id=template.current_version_id,
        vendor_id=vendor.id,
        email=payload.email.lower().strip(),
        token_hash=t_hash,
        expires_at=expires,
        is_revoked=False
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    invitation_url = f"{settings.APP_BASE_URL}/vendor/onboard/{raw_token}"

    # Notify vendor via email
    subject = f"Vendor Onboarding Invitation from {current_org.name}"
    body = (
        f"Hello,\n\n"
        f"{current_user.full_name} ({current_user.email}) from {current_org.name} has invited you to complete your vendor onboarding and document submission.\n\n"
        f"Workflow: {template.name}\n\n"
        f"Please click the secure link below to upload required certificates and business details:\n"
        f"{invitation_url}\n\n"
        f"This secure link will expire in {payload.expires_in_days} days.\n\n"
        f"If you have any questions, reply directly to this email to reach {current_user.full_name}.\n\n"
        f"Best regards,\n{current_user.full_name} ({current_user.email})\n{current_org.name} Compliance Team"
    )
    notification_service.record_and_send_notification(
        db=db,
        organization_id=current_org.id,
        vendor_id=vendor.id,
        document_id=None,
        notification_type="INVITATION",
        recipient_email=vendor.contact_email,
        subject=subject,
        body_text=body,
        idempotency_key=f"invite_{invitation.id}",
        reply_to=current_user.email,
        sender_name=f"{current_user.full_name} via {current_org.name}"
    )

    return InvitationResponse(
        id=invitation.id,
        email=invitation.email,
        vendor_id=vendor.id,
        workflow_version_id=invitation.workflow_version_id,
        invitation_url=invitation_url,
        expires_at=invitation.expires_at,
        is_revoked=invitation.is_revoked,
        used_at=invitation.used_at,
        created_at=invitation.created_at
    )

@router.get("/{workflow_id}/invitations")
def list_workflow_invitations(
    workflow_id: str,
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    invitations = (
        db.query(InvitationToken)
        .filter(InvitationToken.organization_id == current_org.id)
        .order_by(InvitationToken.created_at.desc())
        .all()
    )

    return [
        {
            "id": inv.id,
            "email": inv.email,
            "vendor_id": inv.vendor_id,
            "expires_at": inv.expires_at,
            "is_revoked": inv.is_revoked,
            "used_at": inv.used_at,
            "created_at": inv.created_at
        }
        for inv in invitations
    ]

@router.get("/{workflow_id}/responses", response_model=WorkflowResponsesPayload)
def get_workflow_responses(
    workflow_id: str,
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Workflow not found")
    verify_tenant_ownership(template.organization_id, current_org.id, "workflow")

    latest_version = None
    if template.current_version_id:
        latest_version = db.query(WorkflowVersion).filter(WorkflowVersion.id == template.current_version_id).first()
    elif template.versions:
        latest_version = sorted(template.versions, key=lambda v: v.version_number, reverse=True)[0]

    version_ids = [v.id for v in template.versions]
    onboardings = (
        db.query(VendorOnboarding)
        .filter(
            VendorOnboarding.organization_id == current_org.id,
            VendorOnboarding.workflow_version_id.in_(version_ids),
            VendorOnboarding.status.in_(["SUBMITTED", "APPROVED", "UNDER_REVIEW", "RESUBMISSION_REQUESTED", "REJECTED"])
        )
        .order_by(VendorOnboarding.submitted_at.desc(), VendorOnboarding.created_at.desc())
        .all()
    )

    submissions_list = []
    for ob in onboardings:
        vendor = ob.vendor
        # Fetch documents tied to this onboarding
        docs = (
            db.query(Document)
            .filter(
                Document.vendor_id == ob.vendor_id,
                Document.onboarding_id == ob.id
            )
            .all()
        )
        doc_items = []
        for d in docs:
            signed_url = storage_service.generate_signed_download_url(
                document_id=d.id,
                organization_id=current_org.id
            )
            latest_review_reason = None
            has_replacement = False
            if d.reviews:
                latest_review = d.reviews[-1]
                latest_review_reason = latest_review.reason
                if ensure_utc(d.submitted_at) > ensure_utc(latest_review.created_at):
                    has_replacement = True

            doc_items.append(
                WorkflowResponseDocument(
                    id=d.id,
                    field_id=d.field_id,
                    document_type=d.document_type,
                    original_filename=d.original_filename,
                    file_size=d.file_size,
                    mime_type=d.mime_type,
                    expiry_date=d.expiry_date,
                    status=d.status,
                    download_url=signed_url,
                    review_reason=latest_review_reason,
                    has_replacement=has_replacement,
                    submitted_at=d.submitted_at
                )
            )

        v_num = ob.workflow_version.version_number if ob.workflow_version else 1
        submissions_list.append(
            WorkflowResponseSubmission(
                id=ob.id,
                vendor_id=vendor.id if vendor else "",
                vendor_name=vendor.name if vendor else "Unknown Vendor",
                vendor_email=vendor.contact_email if vendor else "",
                vendor_category=vendor.category if vendor else template.vendor_category,
                status=ob.status,
                submitted_at=ob.submitted_at,
                approved_at=ob.approved_at,
                created_at=ob.created_at,
                form_responses=ob.form_responses or {},
                documents=doc_items,
                version_number=v_num
            )
        )

    total_count = len(submissions_list)
    pending_count = sum(1 for s in submissions_list if s.status in ("SUBMITTED", "UNDER_REVIEW"))
    approved_count = sum(1 for s in submissions_list if s.status == "APPROVED")
    resubmit_count = sum(1 for s in submissions_list if s.status in ("RESUBMISSION_REQUESTED", "REJECTED"))

    return WorkflowResponsesPayload(
        workflow={
            "id": template.id,
            "name": template.name,
            "vendor_category": template.vendor_category,
            "description": template.description,
            "status": template.status,
            "current_version_number": latest_version.version_number if latest_version else 1,
            "schema_definition": latest_version.schema_definition if latest_version else {}
        },
        stats=WorkflowResponsesStats(
            total_responses=total_count,
            pending_review=pending_count,
            approved=approved_count,
            resubmission_requested=resubmit_count
        ),
        responses=submissions_list
    )
