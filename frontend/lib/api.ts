import {
  AuthSession,
  DashboardStats,
  Workflow,
  WorkflowSchemaDefinition,
  VendorListItem,
  VendorDetail,
  DocumentItem,
  DocumentDetail,
  ExpiryTrackerData,
  PublicInvitationData,
  WorkflowResponsesData
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private getHeaders(isFormData: boolean = false): HeadersInit {
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('formgate_token') || localStorage.getItem('vendorflow_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isFormData = options.body instanceof FormData;
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      ...this.getHeaders(isFormData),
      ...(options.headers || {})
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (e) {
        // fallback to status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // --- Auth & Org ---
  async signup(data: any): Promise<AuthSession> {
    const res = await this.request<AuthSession>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.saveSession(res);
    return res;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const res = await this.request<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.saveSession(res);
    return res;
  }

  saveSession(session: AuthSession) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('formgate_token', session.access_token);
      localStorage.setItem('formgate_user', JSON.stringify(session.user));
      localStorage.setItem('formgate_org', JSON.stringify(session.organization));
      // Backward compatibility keys
      localStorage.setItem('vendorflow_token', session.access_token);
      localStorage.setItem('vendorflow_user', JSON.stringify(session.user));
      localStorage.setItem('vendorflow_org', JSON.stringify(session.organization));
    }
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('formgate_token');
      localStorage.removeItem('formgate_user');
      localStorage.removeItem('formgate_org');
      localStorage.removeItem('vendorflow_token');
      localStorage.removeItem('vendorflow_user');
      localStorage.removeItem('vendorflow_org');
      window.location.href = '/auth/login';
    }
  }

  getCurrentSession(): { user: any | null; org: any | null; token: string | null } {
    if (typeof window === 'undefined') return { user: null, org: null, token: null };
    const token = localStorage.getItem('formgate_token') || localStorage.getItem('vendorflow_token');
    const userStr = localStorage.getItem('formgate_user') || localStorage.getItem('vendorflow_user');
    const orgStr = localStorage.getItem('formgate_org') || localStorage.getItem('vendorflow_org');
    return {
      token,
      user: userStr ? JSON.parse(userStr) : null,
      org: orgStr ? JSON.parse(orgStr) : null
    };
  }

  async getMe(): Promise<{ user: any; organization: any }> {
    return this.request('/api/v1/auth/me');
  }

  async updateOrganization(data: { name?: string; slug?: string; business_profile?: any }): Promise<any> {
    const updatedOrg = await this.request('/api/v1/auth/organization', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('formgate_org', JSON.stringify(updatedOrg));
      localStorage.setItem('vendorflow_org', JSON.stringify(updatedOrg));
    }
    return updatedOrg;
  }

  async updateCurrentUser(data: {
    full_name?: string;
    email?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<any> {
    const updatedUser = await this.request('/api/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('formgate_user', JSON.stringify(updatedUser));
      localStorage.setItem('vendorflow_user', JSON.stringify(updatedUser));
    }
    return updatedUser;
  }

  // --- Dashboard ---
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/v1/dashboard/stats');
  }

  // --- Workflows ---
  async generateWorkflowAI(prompt: string, workflow_name?: string, vendor_category?: string, description?: string): Promise<WorkflowSchemaDefinition> {
    return this.request<WorkflowSchemaDefinition>('/api/v1/workflows/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        workflow_name,
        vendor_category,
        description
      })
    });
  }

  async listWorkflows(): Promise<Workflow[]> {
    return this.request<Workflow[]>('/api/v1/workflows');
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/api/v1/workflows/${id}`);
  }

  async createWorkflow(payload: {
    name: string;
    vendor_category: string;
    description?: string;
    schema_definition: WorkflowSchemaDefinition;
    approval_required: boolean;
    reminder_rules: number[];
  }): Promise<Workflow> {
    return this.request<Workflow>('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateWorkflow(id: string, payload: {
    name?: string;
    vendor_category?: string;
    description?: string;
    schema_definition?: WorkflowSchemaDefinition;
    approval_required?: boolean;
    reminder_rules?: number[];
  }): Promise<Workflow> {
    return this.request<Workflow>(`/api/v1/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async publishWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/api/v1/workflows/${id}/publish`, {
      method: 'POST'
    });
  }

  async archiveWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/api/v1/workflows/${id}/archive`, {
      method: 'POST'
    });
  }

  async deleteWorkflow(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/v1/workflows/${id}`, {
      method: 'DELETE'
    });
  }

  async createInvitation(workflowId: string, email?: string, vendorName?: string, vendorCategory?: string, notes?: string): Promise<any> {
    return this.request(`/api/v1/workflows/${workflowId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({
        email: email || undefined,
        vendor_name: vendorName,
        vendor_category: vendorCategory,
        notes,
        expires_in_days: 14
      })
    });
  }

  async listInvitations(workflowId: string): Promise<any[]> {
    return this.request(`/api/v1/workflows/${workflowId}/invitations`);
  }

  async getWorkflowResponses(workflowId: string): Promise<WorkflowResponsesData> {
    return this.request<WorkflowResponsesData>(`/api/v1/workflows/${workflowId}/responses`);
  }

  // --- Vendors ---
  async listVendors(search?: string, status?: string, category?: string): Promise<VendorListItem[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    return this.request<VendorListItem[]>(`/api/v1/vendors?${params.toString()}`);
  }

  async createVendor(data: { name: string; category?: string; contact_email: string; contact_phone?: string; notes?: string }): Promise<VendorListItem> {
    return this.request<VendorListItem>('/api/v1/vendors', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getVendor(id: string): Promise<VendorDetail> {
    return this.request<VendorDetail>(`/api/v1/vendors/${id}`);
  }

  async updateVendor(id: string, data: any): Promise<VendorDetail> {
    return this.request<VendorDetail>(`/api/v1/vendors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async requestMissingDocuments(vendorId: string): Promise<any> {
    return this.request(`/api/v1/vendors/${vendorId}/request-documents`, {
      method: 'POST'
    });
  }

  async deleteVendor(vendorId: string): Promise<any> {
    return this.request(`/api/v1/vendors/${vendorId}`, {
      method: 'DELETE'
    });
  }

  // --- Documents & Reviews ---
  async listDocuments(status?: string, search?: string): Promise<DocumentItem[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    return this.request<DocumentItem[]>(`/api/v1/documents?${params.toString()}`);
  }

  async getDocument(id: string): Promise<DocumentDetail> {
    return this.request<DocumentDetail>(`/api/v1/documents/${id}`);
  }

  async approveDocument(id: string): Promise<any> {
    return this.request(`/api/v1/documents/${id}/approve`, {
      method: 'POST'
    });
  }

  async rejectDocument(id: string, reason: string): Promise<any> {
    return this.request(`/api/v1/documents/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ action: 'REJECT', reason })
    });
  }

  async requestResubmission(id: string, reason: string): Promise<any> {
    return this.request(`/api/v1/documents/${id}/request-resubmission`, {
      method: 'POST',
      body: JSON.stringify({ action: 'REQUEST_RESUBMISSION', reason })
    });
  }

  async deleteDocument(id: string): Promise<any> {
    return this.request(`/api/v1/documents/${id}`, {
      method: 'DELETE'
    });
  }

  async uploadDocument(data: {
    vendorId: string;
    documentType: string;
    file: File;
    expiryDate?: string;
    status?: string;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('vendor_id', data.vendorId);
    formData.append('document_type', data.documentType);
    formData.append('file', data.file);
    if (data.expiryDate) {
      formData.append('expiry_date', data.expiryDate);
    }
    if (data.status) {
      formData.append('status', data.status);
    }
    return this.request('/api/v1/documents/upload', {
      method: 'POST',
      body: formData
    });
  }

  // --- Expiry Tracker ---
  async getExpiryTracker(): Promise<ExpiryTrackerData> {
    return this.request<ExpiryTrackerData>('/api/v1/expiry');
  }

  async requestRenewal(documentId: string): Promise<any> {
    return this.request(`/api/v1/documents/${documentId}/request-renewal`, {
      method: 'POST'
    });
  }

  // --- Public Portal ---
  async getPublicInvitation(token: string): Promise<PublicInvitationData> {
    return this.request<PublicInvitationData>(`/api/v1/public/invitations/${token}`);
  }

  async uploadPublicDocument(
    token: string,
    file: File,
    fieldId: string,
    documentType: string,
    expiryDate?: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('field_id', fieldId);
    formData.append('document_type', documentType);
    if (expiryDate) {
      formData.append('expiry_date', expiryDate);
    }
    return this.request(`/api/v1/public/invitations/${token}/documents`, {
      method: 'POST',
      body: formData
    });
  }

  async deletePublicDocument(token: string, documentId: string): Promise<any> {
    return this.request(`/api/v1/public/invitations/${token}/documents/${documentId}`, {
      method: 'DELETE'
    });
  }

  async submitPublicOnboarding(
    token: string,
    formResponses: Record<string, any>,
    documentExpiries: Record<string, string>
  ): Promise<any> {
    return this.request(`/api/v1/public/invitations/${token}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        form_responses: formResponses,
        document_expiries: documentExpiries
      })
    });
  }
}

export const api = new ApiClient();
