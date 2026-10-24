from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, model_validator

class FieldValidationRules(BaseModel):
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    options: Optional[List[str]] = Field(default_factory=list, description="Dropdown or checkbox choices")

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
    allowed_file_types: Optional[List[str]] = Field(
        default_factory=lambda: ["application/pdf", "image/png", "image/jpeg"]
    )
    max_file_size_mb: Optional[int] = Field(default=10)
    validation: Optional[FieldValidationRules] = None
    options: Optional[List[str]] = Field(
        default_factory=list,
        description="List of selectable choices/options for dropdown or checkbox fields"
    )

    @model_validator(mode="after")
    def sync_options(self):
        opts = [str(o).strip() for o in (self.options or []) if str(o).strip()]
        val_opts = [str(o).strip() for o in ((self.validation.options if self.validation else None) or []) if str(o).strip()]
        combined = opts if opts else val_opts

        # If options are empty for dropdown or checkbox fields, provide contextual defaults
        if not combined and self.field_type in ("dropdown", "checkbox"):
            lbl = (self.label or "").lower()
            if self.field_type == "dropdown":
                if any(w in lbl for w in ("structure", "type", "entity")):
                    combined = ["Private Limited / Corporation", "LLC / LLP", "Partnership", "Sole Proprietorship"]
                elif any(w in lbl for w in ("payment", "term", "invoice")):
                    combined = ["Net 30", "Net 60", "Net 15", "Immediate / Advance"]
                elif any(w in lbl for w in ("tax", "gst", "vat", "filing")):
                    combined = ["Regular Registered", "Composition Scheme", "Exempt / Non-Taxable", "Overseas Entity"]
                elif any(w in lbl for w in ("country", "nation")):
                    combined = ["United States", "India", "United Kingdom", "Canada", "Australia", "Other"]
                elif any(w in lbl for w in ("state", "province", "region")):
                    combined = ["Region North", "Region South", "Region East", "Region West"]
                else:
                    combined = ["Option 1", "Option 2", "Option 3"]
            elif self.field_type == "checkbox":
                if any(w in lbl for w in ("service", "product", "sector", "category", "scope", "offering")):
                    combined = ["Primary Consulting", "Technical Implementation", "Maintenance & Support", "Other Services"]
                elif any(w in lbl for w in ("certif", "compliance", "standard", "audit", "security")):
                    combined = ["ISO 9001 / Quality Management", "SOC 2 Type II Certified", "GDPR / Privacy Compliant", "Industry Safety Certified"]
                else:
                    combined = ["I certify that all provided details and documents are authentic and accurate"]

        if combined:
            self.options = combined
            if not self.validation:
                self.validation = FieldValidationRules(options=combined)
            else:
                self.validation.options = combined
        return self

class WorkflowSchemaDefinition(BaseModel):
    name: str = Field(..., description="Workflow title")
    vendor_category: str = Field(default="General", description="Target vendor category")
    description: Optional[str] = None
    fields: List[WorkflowFieldDefinition] = Field(default_factory=list)
    approval_required: bool = Field(True, description="Whether administrator approval is required for submissions")
    reminder_rules: Optional[List[int]] = Field(default_factory=lambda: [30, 7, 1], description="Days before expiry to dispatch reminders")
    generated_questions: Optional[List[str]] = Field(default_factory=list, description="Clarifications requested from manager")
    assumptions: Optional[List[str]] = Field(default_factory=list, description="Assumptions made by generator")
    warnings: Optional[List[str]] = Field(default_factory=list, description="Warnings or compliance alerts")

    @field_validator("reminder_rules", mode="before")
    @classmethod
    def normalize_reminder_rules(cls, v):
        if not v:
            return [30, 7, 1]
        return v

    @field_validator("generated_questions", "assumptions", "warnings", mode="before")
    @classmethod
    def normalize_optional_lists(cls, v):
        if v is None:
            return []
        return v

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
