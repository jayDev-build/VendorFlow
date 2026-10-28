export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'file_upload';

export interface FieldValidationRules {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  options?: string[];
}

export interface WorkflowField {
  id: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  help_text?: string;
  document_category?: string;
  track_expiry: boolean;
  allowed_file_types: string[];
  max_file_size_mb: number;
  validation?: FieldValidationRules;
  options?: string[];
}

export interface WorkflowSchemaDefinition {
  name: string;
  vendor_category: string;
  description?: string;
  fields: WorkflowField[];
  approval_required: boolean;
  reminder_rules: number[];
  generated_questions: string[];
  assumptions: string[];
  warnings: string[];
}

export interface Workflow {
  id: string;
  organization_id: string;
  name: string;
  vendor_category: string;
  description?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  current_version_id?: string;
  current_version_number: number;
  schema_definition: WorkflowSchemaDefinition;
  approval_required: boolean;
  reminder_rules: number[];
  assumptions: string[];
  warnings: string[];
  responses_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  business_profile?: Record<string, any>;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  organization_id: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: User;
  organization: Organization;
}

export interface VendorListItem {
  id: string;
  name: string;
  category: string;
  contact_email: string;
  contact_phone?: string;
  status: 'INVITED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  documents_count: number;
  documents_approved_count: number;
  next_expiry?: string;
  last_updated: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  field_id: string;
  document_type: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  expiry_date?: string;
  status: 'MISSING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUESTED' | 'EXPIRING' | 'EXPIRED';
  submitted_at: string;
  download_url?: string;
}

export interface DocumentReviewHistoryItem {
  id: string;
  reviewer_name?: string;
  previous_status: string;
  new_status: string;
  reason?: string;
  created_at: string;
}

export interface DocumentDetail extends DocumentItem {
  vendor_id: string;
  vendor_name: string;
  vendor_email: string;
  reviews: DocumentReviewHistoryItem[];
}

export interface VendorSubmissionItem {
  id: string;
  workflow_id?: string;
  workflow_name: string;
  workflow_category: string;
  version_number: number;
  status: string;
  submitted_at?: string;
  approved_at?: string;
  created_at?: string;
  form_responses: Record<string, any>;
  schema_definition?: WorkflowSchemaDefinition;
  documents: DocumentItem[];
}

export interface VendorDetail {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  contact_email: string;
  contact_phone?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  documents: DocumentItem[];
  active_workflow?: {
    version_id: string;
    version_number: number;
    schema_definition: WorkflowSchemaDefinition;
  };
  onboarding_data?: {
    id: string;
    status: string;
    form_responses?: Record<string, any>;
    submitted_at?: string;
    approved_at?: string;
  };
  submissions?: VendorSubmissionItem[];
  recent_activity: Array<{
    id: string;
    action: string;
    details?: Record<string, any>;
    timestamp: string;
  }>;
}

export interface WorkflowResponseDocument {
  id: string;
  field_id: string;
  document_type: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  expiry_date?: string;
  status: string;
  download_url?: string;
  review_reason?: string;
  has_replacement?: boolean;
  submitted_at?: string;
}

export interface WorkflowResponseSubmission {
  id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_email: string;
  vendor_category: string;
  status: string;
  submitted_at?: string;
  approved_at?: string;
  created_at: string;
  form_responses: Record<string, any>;
  documents: WorkflowResponseDocument[];
  version_number: number;
}

export interface WorkflowResponsesData {
  workflow: {
    id: string;
    name: string;
    vendor_category: string;
    description?: string;
    status: string;
    current_version_number: number;
    schema_definition: WorkflowSchemaDefinition;
  };
  stats: {
    total_responses: number;
    pending_review: number;
    approved: number;
    resubmission_requested: number;
  };
  responses: WorkflowResponseSubmission[];
}

export interface DashboardStats {
  total_vendors: number;
  approved_vendors: number;
  pending_approvals: number;
  incomplete_submissions: number;
  expiring_30_days: number;
  expired_documents: number;
  pending_reviews: Array<{
    id: string;
    document_type: string;
    vendor_name: string;
    submitted_at: string;
    status: string;
  }>;
  upcoming_expirations: Array<{
    id: string;
    document_type: string;
    vendor_name: string;
    expiry_date: string;
    days_remaining: number;
    status: string;
  }>;
  recent_activity: Array<{
    id: string;
    action: string;
    details?: Record<string, any>;
    timestamp: string;
  }>;
}

export interface ExpiryDocumentItem {
  id: string;
  document_type: string;
  vendor_id: string;
  vendor_name: string;
  vendor_email: string;
  expiry_date: string;
  days_remaining: number;
  status: string;
  download_url?: string;
  reminder_status: string;
  last_reminder_sent?: string;
}

export interface ExpiryTrackerData {
  expired: ExpiryDocumentItem[];
  expiring_7d: ExpiryDocumentItem[];
  expiring_30d: ExpiryDocumentItem[];
  expiring_60d: ExpiryDocumentItem[];
  valid_longer: ExpiryDocumentItem[];
}

export interface PublicInvitationData {
  valid: boolean;
  email: string;
  organization_name: string;
  workflow_name: string;
  workflow_description?: string;
  vendor_category: string;
  schema_definition: WorkflowSchemaDefinition;
  existing_responses?: Record<string, any>;
  existing_documents?: Array<{
    id: string;
    field_id: string;
    document_type: string;
    original_filename: string;
    file_size?: number;
    mime_type?: string;
    expiry_date?: string;
    status: string;
    review_reason?: string;
    has_replacement?: boolean;
    view_url?: string;
    download_url?: string;
  }>;
  expires_at: string;
  is_submitted?: boolean;
  submission_status?: string;
}
