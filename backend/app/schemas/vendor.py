from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.schemas.workflow import WorkflowSchemaDefinition

class VendorCreate(BaseModel):
    name: str = Field(..., min_length=2)
    category: str = "General"
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    notes: Optional[str] = None

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class VendorListItem(BaseModel):
    id: str
    name: str
    category: str
    contact_email: str
    contact_phone: Optional[str]
    status: str
    documents_count: int = 0
    documents_approved_count: int = 0
    next_expiry: Optional[datetime] = None
    last_updated: datetime
    created_at: datetime

class DocumentItemResponse(BaseModel):
    id: str
    field_id: str
    document_type: str
    original_filename: str
    file_size: int
    mime_type: str
    expiry_date: Optional[datetime] = None
    status: str
    submitted_at: datetime
    download_url: Optional[str] = None

class VendorDetailResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    category: str
    contact_email: str
    contact_phone: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    documents: List[DocumentItemResponse] = []
    active_workflow: Optional[Dict[str, Any]] = None
    onboarding_data: Optional[Dict[str, Any]] = None
    submissions: List[Dict[str, Any]] = []
    recent_activity: List[Dict[str, Any]] = []

class PublicInvitationView(BaseModel):
    valid: bool
    email: str
    organization_name: str
    workflow_name: str
    workflow_description: Optional[str]
    vendor_category: str
    schema_definition: WorkflowSchemaDefinition
    existing_responses: Optional[Dict[str, Any]] = None
    existing_documents: List[Dict[str, Any]] = []
    expires_at: datetime
    is_submitted: bool = False
    submission_status: Optional[str] = None

class PublicSubmissionPayload(BaseModel):
    form_responses: Dict[str, Any] = Field(default_factory=dict)
    # File metadata sent alongside uploaded documents
    document_expiries: Dict[str, Optional[str]] = Field(default_factory=dict, description="Map of field_id to ISO expiry date string")
