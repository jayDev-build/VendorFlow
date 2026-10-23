from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class FieldValidationRules(BaseModel):
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    options: Optional[List[str]] = Field(default_factory=list, description="Dropdown choices if field_type is dropdown")

class WorkflowFieldDefinition(BaseModel):
    id: str = Field(..., description="Stable unique identifier e.g. field_gst_certificate")
    label: str = Field(..., description="Human-readable label")
    field_type: str = Field(
        ...,
        description="One of: short_text, long_text, email, phone, date, dropdown, checkbox, file_upload"
    )
    required: bool = True
    help_text: Optional[str] = None
    document_category: Optional[str] = Field(None, description="Category group e.g. Tax, Compliance, Banking")
    track_expiry: bool = Field(False, description="Whether this document has an expiration date requiring tracking")
    allowed_file_types: List[str] = Field(
        default_factory=lambda: ["application/pdf", "image/png", "image/jpeg"]
    )
    max_file_size_mb: int = Field(default=10)
    validation: Optional[FieldValidationRules] = None

class WorkflowSchemaDefinition(BaseModel):
    name: str = Field(..., description="Workflow title")
    vendor_category: str = Field(default="General", description="Target vendor category")
    description: Optional[str] = None
    fields: List[WorkflowFieldDefinition] = Field(default_factory=list)
    approval_required: bool = Field(True, description="Whether administrator approval is required for submissions")
    reminder_rules: List[int] = Field(default_factory=lambda: [30, 7, 1], description="Days before expiry to dispatch reminders")
    generated_questions: List[str] = Field(default_factory=list, description="Clarifications requested from manager")
    assumptions: List[str] = Field(default_factory=list, description="Assumptions made by generator")
    warnings: List[str] = Field(default_factory=list, description="Warnings or compliance alerts")

class WorkflowGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=5, description="Plain-English vendor onboarding requirements")
    workflow_name: Optional[str] = None
    vendor_category: Optional[str] = "General"
    description: Optional[str] = None

class WorkflowCreateRequest(BaseModel):
    name: str
    vendor_category: str = "General"
    description: Optional[str] = None
    schema_definition: WorkflowSchemaDefinition
    approval_required: bool = True
    reminder_rules: List[int] = [30, 7, 1]

class WorkflowUpdateRequest(BaseModel):
    name: Optional[str] = None
    vendor_category: Optional[str] = None
    description: Optional[str] = None
    schema_definition: Optional[WorkflowSchemaDefinition] = None
    approval_required: Optional[bool] = None
    reminder_rules: Optional[List[int]] = None

class WorkflowResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    vendor_category: str
    description: Optional[str]
    status: str
    current_version_id: Optional[str]
    current_version_number: Optional[int] = 1
    schema_definition: Optional[WorkflowSchemaDefinition] = None
    approval_required: bool = True
    reminder_rules: List[int] = [30, 7, 1]
    assumptions: List[str] = []
    warnings: List[str] = []
    created_at: Any
    updated_at: Any

class CreateInvitationRequest(BaseModel):
    email: str
    vendor_name: Optional[str] = None
    vendor_category: Optional[str] = None
    notes: Optional[str] = None
    expires_in_days: int = 14

class InvitationResponse(BaseModel):
    id: str
    email: str
    vendor_id: Optional[str]
    workflow_version_id: str
    invitation_url: str
    expires_at: Any
    is_revoked: bool
    used_at: Optional[Any]
    created_at: Any
