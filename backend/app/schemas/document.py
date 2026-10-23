from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class DocumentReviewAction(BaseModel):
    action: str = Field(..., description="One of: APPROVE, REJECT, REQUEST_RESUBMISSION")
    reason: Optional[str] = Field(None, description="Required explanation when rejecting or requesting resubmission")

class DocumentReviewHistoryItem(BaseModel):
    id: str
    reviewer_name: Optional[str]
    previous_status: str
    new_status: str
    reason: Optional[str]
    created_at: datetime

class DocumentDetailResponse(BaseModel):
    id: str
    vendor_id: str
    vendor_name: str
    vendor_email: str
    field_id: str
    document_type: str
    original_filename: str
    file_size: int
    mime_type: str
    expiry_date: Optional[datetime] = None
    status: str
    submitted_at: datetime
    download_url: Optional[str] = None
    reviews: List[DocumentReviewHistoryItem] = []

class ExpiryDocumentItem(BaseModel):
    id: str
    document_type: str
    vendor_id: str
    vendor_name: str
    vendor_email: str
    expiry_date: datetime
    days_remaining: int
    status: str
    download_url: Optional[str] = None
    reminder_status: str = "No reminders queued"
    last_reminder_sent: Optional[datetime] = None

class ExpiryTrackerResponse(BaseModel):
    expired: List[ExpiryDocumentItem] = []
    expiring_7d: List[ExpiryDocumentItem] = []
    expiring_30d: List[ExpiryDocumentItem] = []
    expiring_60d: List[ExpiryDocumentItem] = []
    valid_longer: List[ExpiryDocumentItem] = []

class DashboardStatsResponse(BaseModel):
    total_vendors: int
    approved_vendors: int
    pending_approvals: int
    incomplete_submissions: int
    expiring_30_days: int
    expired_documents: int
    pending_reviews: List[Dict[str, Any]] = []
    upcoming_expirations: List[Dict[str, Any]] = []
    recent_activity: List[Dict[str, Any]] = []
