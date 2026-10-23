import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey, Index, UniqueConstraint, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    business_profile = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    vendors = relationship("Vendor", back_populates="organization", cascade="all, delete-orphan")
    workflow_templates = relationship("WorkflowTemplate", back_populates="organization", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="admin", nullable=False) # admin, reviewer, member
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="users")
    reviews = relationship("DocumentReview", back_populates="reviewer")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), default="General", nullable=False, index=True)
    contact_email = Column(String(255), nullable=False, index=True)
    contact_phone = Column(String(50), nullable=True)
    status = Column(String(50), default="INVITED", nullable=False, index=True) 
    # Statuses: INVITED, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED, SUSPENDED, ARCHIVED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="vendors")
    onboardings = relationship("VendorOnboarding", back_populates="vendor", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="vendor", cascade="all, delete-orphan")
    invitations = relationship("InvitationToken", back_populates="vendor", cascade="all, delete-orphan")


class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    vendor_category = Column(String(100), default="General", nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="DRAFT", nullable=False, index=True) # DRAFT, PUBLISHED, ARCHIVED
    current_version_id = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="workflow_templates")
    versions = relationship("WorkflowVersion", back_populates="template", cascade="all, delete-orphan")


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workflow_template_id = Column(String(36), ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    # schema_definition stores JSON with fields, approval rules, reminder rules, etc.
    schema_definition = Column(JSON, nullable=False)
    approval_required = Column(Boolean, default=True, nullable=False)
    reminder_rules = Column(JSON, nullable=True, default=list) # e.g. [30, 7, 1]
    assumptions = Column(JSON, nullable=True, default=list)
    warnings = Column(JSON, nullable=True, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    template = relationship("WorkflowTemplate", back_populates="versions")
    onboardings = relationship("VendorOnboarding", back_populates="workflow_version")
    invitations = relationship("InvitationToken", back_populates="workflow_version")
    reminder_rule_records = relationship("ReminderRule", back_populates="workflow_version", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("workflow_template_id", "version_number", name="uq_template_version"),
    )


class VendorOnboarding(Base):
    __tablename__ = "vendor_onboardings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_version_id = Column(String(36), ForeignKey("workflow_versions.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(50), default="IN_PROGRESS", nullable=False, index=True)
    # Statuses: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, RESUBMISSION_REQUESTED
    form_responses = Column(JSON, nullable=True, default=dict) # responses for non-file fields
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    vendor = relationship("Vendor", back_populates="onboardings")
    workflow_version = relationship("WorkflowVersion", back_populates="onboardings")
    documents = relationship("Document", back_populates="onboarding", cascade="all, delete-orphan")


class InvitationToken(Base):
    __tablename__ = "invitation_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_version_id = Column(String(36), ForeignKey("workflow_versions.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    vendor = relationship("Vendor", back_populates="invitations")
    workflow_version = relationship("WorkflowVersion", back_populates="invitations")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    onboarding_id = Column(String(36), ForeignKey("vendor_onboardings.id", ondelete="CASCADE"), nullable=True, index=True)
    field_id = Column(String(100), nullable=False) # maps to field id in workflow schema
    document_type = Column(String(100), nullable=False, index=True) # e.g. "GST Certificate", "PAN Card"
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    storage_path = Column(String(500), nullable=False) # private storage object key
    expiry_date = Column(DateTime(timezone=True), nullable=True, index=True)
    status = Column(String(50), default="SUBMITTED", nullable=False, index=True)
    # Statuses: MISSING, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, RESUBMISSION_REQUESTED, EXPIRING, EXPIRED
    submitted_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="documents")
    vendor = relationship("Vendor", back_populates="documents")
    onboarding = relationship("VendorOnboarding", back_populates="documents")
    reviews = relationship("DocumentReview", back_populates="document", cascade="all, delete-orphan")


class DocumentReview(Base):
    __tablename__ = "document_reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    document = relationship("Document", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")


class ReminderRule(Base):
    __tablename__ = "reminder_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_version_id = Column(String(36), ForeignKey("workflow_versions.id", ondelete="CASCADE"), nullable=False)
    days_before_expiry = Column(Integer, nullable=False) # e.g. 30, 7, 1
    reminder_type = Column(String(50), default="EXPIRY_WARNING", nullable=False)
    notify_vendor = Column(Boolean, default=True, nullable=False)
    notify_manager = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    workflow_version = relationship("WorkflowVersion", back_populates="reminder_rule_records")


class NotificationJob(Base):
    __tablename__ = "notification_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(String(36), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    notification_type = Column(String(50), nullable=False) # EXPIRY_REMINDER, RESUBMISSION_REQUEST, INVITATION
    recipient_email = Column(String(255), nullable=False, index=True)
    status = Column(String(50), default="PENDING", nullable=False, index=True) # PENDING, SENT, FAILED
    idempotency_key = Column(String(255), unique=True, index=True, nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False, index=True)
    details = Column(JSON, nullable=True, default=dict)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="audit_logs")
