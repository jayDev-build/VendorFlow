'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileCheck2,
  FileText,
  X,
  RefreshCw,
  Building2,
  ExternalLink,
  Check,
  RotateCcw,
  AlertCircle,
  Download,
  Calendar,
  Users,
  LayoutDashboard,
  GitBranch,
  ClockAlert,
  Settings,
  Upload,
  UserPlus,
  Search,
  Copy,
  Link2,
  User,
  LogOut,
  Edit3,
  Trash2,
  Mail
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

interface MockDocument {
  id: string;
  document_type: string;
  original_filename: string;
  file_url: string;
  vendor_id: string;
  vendor_name: string;
  vendor_email: string;
  category: string;
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUESTED';
  file_size: number;
  mime_type: string;
  expiry_date: string | null;
  submitted_at: string;
  rejection_reason?: string;
  flagged_note?: string;
}

interface MockVendor {
  id: string;
  name: string;
  category: string;
  email: string;
  phone: string;
  status: 'APPROVED' | 'UNDER_REVIEW' | 'IN_PROGRESS';
  documentsCount: number;
  approvedCount: number;
  complianceScore: number;
  lastActive: string;
}

const INITIAL_DOCUMENTS: MockDocument[] = [
  {
    id: 'doc-1',
    document_type: 'GST Tax Invoice & Registration Proof',
    original_filename: 'A4-S1-GST-Invoice-Format_page-0001-scaled.jpg',
    file_url: '/A4-S1-GST-Invoice-Format_page-0001-scaled.jpg',
    vendor_id: 'v-1',
    vendor_name: 'Gujarat Freight Tools',
    vendor_email: 'compliance@gft.com',
    category: 'Manufacturing & Tools',
    status: 'APPROVED',
    file_size: 331876,
    mime_type: 'image/jpeg',
    expiry_date: null,
    submitted_at: '2026-10-25T09:14:00Z'
  },
  {
    id: 'doc-2',
    document_type: 'Commercial Registration Proof (Blurry Scan)',
    original_filename: 'texture-blurry-text-open-textbook-260nw-1175839786.webp',
    file_url: '/texture-blurry-text-open-textbook-260nw-1175839786.webp',
    vendor_id: 'v-2',
    vendor_name: 'Zenith Facility Solutions',
    vendor_email: 'contact@zenithfacility.com',
    category: 'Facility Management',
    status: 'UNDER_REVIEW',
    file_size: 8094,
    mime_type: 'image/webp',
    expiry_date: null,
    submitted_at: '2026-10-25T10:45:00Z',
    flagged_note: 'Illegible & blurry text scan. Document contents and registration number cannot be verified.'
  },
  {
    id: 'doc-3',
    document_type: 'Certificate of Insurance (OCP Policy)',
    original_filename: 'owner-and-protective-OCP-insurance-certificate-template.jpg',
    file_url: '/owner-and-protective-OCP-insurance-certificate-template.jpg',
    vendor_id: 'v-3',
    vendor_name: 'Vertex Infra Projects',
    vendor_email: 'accounts@vertexinfra.com',
    category: 'Civil Infrastructure',
    status: 'UNDER_REVIEW',
    file_size: 51098,
    mime_type: 'image/jpeg',
    expiry_date: '2027-03-31',
    submitted_at: '2026-10-24T16:30:00Z'
  }
];

const INITIAL_VENDORS: MockVendor[] = [
  {
    id: 'v-1',
    name: 'Gujarat Freight Tools',
    category: 'Manufacturing & Tools',
    email: 'compliance@gft.com',
    phone: '+91 22 2582 0309',
    status: 'APPROVED',
    documentsCount: 4,
    approvedCount: 4,
    complianceScore: 100,
    lastActive: 'Today at 09:14 AM'
  },
  {
    id: 'v-2',
    name: 'Zenith Facility Solutions',
    category: 'Facility Management',
    email: 'contact@zenithfacility.com',
    phone: '+91 91672 99881',
    status: 'UNDER_REVIEW',
    documentsCount: 4,
    approvedCount: 3,
    complianceScore: 75,
    lastActive: 'Today at 10:45 AM'
  },
  {
    id: 'v-3',
    name: 'Vertex Infra Projects',
    category: 'Civil Infrastructure',
    email: 'accounts@vertexinfra.com',
    phone: '+91 98450 77612',
    status: 'UNDER_REVIEW',
    documentsCount: 3,
    approvedCount: 2,
    complianceScore: 66,
    lastActive: 'Yesterday at 04:30 PM'
  },
  {
    id: 'v-4',
    name: 'Falcon Freight Lines',
    category: 'Fleet & Logistics',
    email: 'ops@falconlines.com',
    phone: '+91 99880 33412',
    status: 'APPROVED',
    documentsCount: 5,
    approvedCount: 5,
    complianceScore: 100,
    lastActive: '2 days ago'
  },
  {
    id: 'v-5',
    name: 'Beacon Clinical Staffing',
    category: 'Healthcare & Staffing',
    email: 'credentials@beaconclinical.com',
    phone: '+91 98110 55432',
    status: 'IN_PROGRESS',
    documentsCount: 3,
    approvedCount: 1,
    complianceScore: 33,
    lastActive: '3 days ago'
  }
];

function SalesDemoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Prospect company query param
  const rawCompanyParam = searchParams.get('company');
  const [companyName, setCompanyName] = useState('Sample Prospect Corp');
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyInput, setCompanyInput] = useState('');

  // Active navigation tab inside the full application shell
  const [activeTab, setActiveTab] = useState<'documents' | 'overview' | 'vendors' | 'expiry' | 'workflows'>('documents');

  // Documents state & filters (identical to app/documents)
  const [documents, setDocuments] = useState<MockDocument[]>(INITIAL_DOCUMENTS);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Review modal state (identical to DocumentReviewModal)
  const [selectedDoc, setSelectedDoc] = useState<MockDocument | null>(null);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [dispatchedLinkResult, setDispatchedLinkResult] = useState<{
    url: string;
    vendorName: string;
    vendorEmail: string;
    reason: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Other modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAiWorkflowModal, setShowAiWorkflowModal] = useState(false);
  const [workflowPrompt, setWorkflowPrompt] = useState('');
  const [isGeneratingWf, setIsGeneratingWf] = useState(false);

  // Top-Right Pop-up Notification State
  const [toastNotification, setToastNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    recipientEmail?: string;
    targetDocName?: string;
    linkUrl?: string;
  } | null>(null);
  const [copiedToastLink, setCopiedToastLink] = useState(false);

  useEffect(() => {
    if (rawCompanyParam) {
      const formatted = rawCompanyParam.replace(/[_-]/g, ' ').trim();
      if (formatted) {
        setCompanyName(formatted);
        setCompanyInput(formatted);
      }
    } else {
      setCompanyInput('Sample Prospect Corp');
    }
  }, [rawCompanyParam]);

  const handleUpdateCompanyName = (e: React.FormEvent) => {
    e.preventDefault();
    if (companyInput.trim()) {
      setCompanyName(companyInput.trim());
      setIsEditingCompany(false);
      const slug = encodeURIComponent(companyInput.trim().replace(/\s+/g, '_'));
      router.replace(`/demo?company=${slug}`);
    }
  };

  const handleResetSandbox = () => {
    setDocuments(INITIAL_DOCUMENTS);
    setSelectedDoc(null);
    setDispatchedLinkResult(null);
    setShowRejectBox(false);
    setRejectReason('');
    setToastNotification({
      visible: true,
      title: 'Sandbox Reset',
      message: 'All sample documents, verification statuses, and records restored to default.'
    });
    setTimeout(() => setToastNotification(null), 3500);
  };

  // Rejection & Resubmission Handler (Matches DocumentReviewModal behavior)
  const handleConfirmRejection = (docToReject: MockDocument, reason: string) => {
    if (!reason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setLoadingAction('reject');
    setTimeout(() => {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const generatedUrl = `${origin}/vendor/onboard/resubmit-sample-tok-2300`;

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docToReject.id
            ? { ...d, status: 'REJECTED', rejection_reason: reason.trim() }
            : d
        )
      );

      setLoadingAction(null);
      setShowRejectBox(false);
      setSelectedDoc(null);
      setDispatchedLinkResult(null);

      // Trigger high-converting top-right pop-up banner
      setToastNotification({
        visible: true,
        title: 'Vendor Magic Link Dispatched!',
        message: `Notification sent to ${docToReject.vendor_email}. The vendor resubmits only "${docToReject.document_type}" without losing prior approved files.`,
        recipientEmail: docToReject.vendor_email,
        targetDocName: docToReject.document_type,
        linkUrl: generatedUrl
      });
    }, 300);
  };

  const handleApproveDocument = (docId: string) => {
    setLoadingAction('approve');
    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'APPROVED' } : d))
      );
      setLoadingAction(null);
      if (selectedDoc?.id === docId) {
        setSelectedDoc((prev) => (prev ? { ...prev, status: 'APPROVED' } : null));
      }
      setToastNotification({
        visible: true,
        title: 'Document Approved',
        message: 'Status updated to Approved. Saved to compliance audit log.'
      });
      setTimeout(() => setToastNotification(null), 3000);
    }, 400);
  };

  // Filtered documents matching actual app/documents filter logic
  const filteredDocs = documents.filter((doc) => {
    const matchesFilter =
      statusFilter === 'ALL' ||
      doc.status === statusFilter ||
      (statusFilter === 'UNDER_REVIEW' && doc.status === 'UNDER_REVIEW') ||
      (statusFilter === 'RESUBMISSION_REQUESTED' && doc.status === 'REJECTED');

    const matchesSearch =
      doc.document_type.toLowerCase().includes(search.toLowerCase()) ||
      doc.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      doc.original_filename.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const pendingReviewCount = documents.filter((d) => d.status === 'UNDER_REVIEW').length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* ========================================================= */}
      {/* 1. ACTUAL SAAS SIDEBAR (Identical to components/Sidebar)  */}
      {/* ========================================================= */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-white tracking-tight flex items-center gap-1.5 text-base">
                  FormGate
                  <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">AI</span>
                </div>
                <div className="text-xs text-slate-400 font-medium truncate max-w-[140px]" title={companyName}>
                  {companyName}
                </div>
              </div>
            </Link>
          </div>

          {/* Quick Action Button */}
          <div className="p-3">
            <button
              onClick={() => setShowAiWorkflowModal(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-sm font-semibold shadow-sm transition-all shadow-indigo-600/20 hover:shadow-indigo-600/30 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-100" />
              <span>New AI Workflow</span>
            </button>
          </div>

          {/* Navigation Items (Exact layout from Sidebar.tsx) */}
          <nav className="px-3 py-2 space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'overview' ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                Live
              </span>
            </button>

            <button
              onClick={() => setActiveTab('vendors')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'vendors'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                <span>Vendors</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'vendors' ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                5
              </span>
            </button>

            <button
              onClick={() => setActiveTab('workflows')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'workflows'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <GitBranch className="w-4 h-4" />
                <span>Workflows</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'documents'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileCheck2 className="w-4 h-4" />
                <span>Documents</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'documents' ? 'bg-indigo-700 text-white' : 'bg-amber-500/20 text-amber-300'}`}>
                {pendingReviewCount > 0 ? `${pendingReviewCount}` : '3'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('expiry')}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'expiry'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClockAlert className="w-4 h-4" />
                <span>Expiry Tracker</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'expiry' ? 'bg-indigo-700 text-white' : 'bg-rose-500/20 text-rose-300'}`}>
                1
              </span>
            </button>

            <button
              onClick={() => {
                setToastNotification({
                  visible: true,
                  title: 'Settings',
                  message: `Custom branding, tenant isolation domain, and webhook configurations for ${companyName} are fully customizable.`
                });
                setTimeout(() => setToastNotification(null), 3500);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                {companyName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  Compliance Officer
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  compliance@{companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com
                </div>
              </div>
            </div>
            <Link
              href="/auth"
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
              title="Exit demo & Sign up"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>

          <Link
            href="/auth"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-center text-[11px] font-semibold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/60 rounded-md transition-colors"
          >
            <span>Activate Account</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN APPLICATION WORKSPACE                            */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP DEMO SANDBOX BANNER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-900/60 px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 text-white text-xs shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>Interactive Sales Demo Sandbox</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="text-indigo-300 font-bold">Tailored for {companyName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditingCompany ? (
              <form onSubmit={handleUpdateCompanyName} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  placeholder="Enter prospect name..."
                  className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded border border-indigo-500 focus:outline-none w-44"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[11px] font-semibold cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingCompany(false)}
                  className="text-slate-400 hover:text-white px-1 text-[11px]"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsEditingCompany(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition-colors cursor-pointer"
                title="Change the demo prospect company name"
              >
                <Edit3 className="w-3 h-3 text-indigo-400" />
                <span>Switch Company</span>
              </button>
            )}

            <button
              onClick={handleResetSandbox}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition-colors cursor-pointer"
              title="Reset all mock documents to initial states"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset Sandbox</span>
            </button>

            <Link
              href="/auth"
              className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold rounded text-[11px] shadow-sm transition-all shadow-indigo-500/20"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* TOPNAV (Exact Match to components/TopNav.tsx) */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              {activeTab === 'documents' && 'Document Review Queue'}
              {activeTab === 'overview' && 'Compliance & Onboarding Overview'}
              {activeTab === 'vendors' && 'Vendors Directory'}
              {activeTab === 'workflows' && 'Onboarding Workflows'}
              {activeTab === 'expiry' && 'Document Expiry Tracker'}
            </h1>
            <p className="text-xs text-slate-700 font-medium mt-0.5">
              {activeTab === 'documents' && 'Manage compliance verifications, examine attachments, and execute server-side approvals'}
              {activeTab === 'overview' && 'Real-time vendor onboarding pipeline, document verifications, and expiry alerts'}
              {activeTab === 'vendors' && `Full registry of active and onboarding suppliers for ${companyName}`}
              {activeTab === 'workflows' && 'Automated compliance blueprints generated with natural language AI'}
              {activeTab === 'expiry' && 'Track document expirations and manage proactive compliance notifications'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setToastNotification({
                  visible: true,
                  title: 'Queue Refreshed',
                  message: 'Synchronized latest verification records.'
                });
                setTimeout(() => setToastNotification(null), 2500);
              }}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-lg transition-all border border-slate-300 shadow-2xs hover:shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-600" />
              <span>Invite Vendor</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer active:scale-[0.98]"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Document</span>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* VIEW 1: DOCUMENTS (Exact Match to app/documents/page.tsx)  */}
        {/* ========================================================= */}
        {activeTab === 'documents' && (
          <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
            {/* Filters & Status Tabs (Exact Match to app/documents/page.tsx:114-149) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {['ALL', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 bg-white border-slate-200'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'All Documents'
                      : st === 'UNDER_REVIEW'
                      ? 'Pending Review'
                      : st === 'RESUBMISSION_REQUESTED'
                      ? 'Resubmission'
                      : st.charAt(0) + st.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Search bar */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search type or vendor..."
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                />
              </div>
            </div>

            {/* Documents Table (Exact Match to app/documents/page.tsx:152-265) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Document Type</th>
                      <th className="py-3.5 px-4">Vendor</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">File Details</th>
                      <th className="py-3.5 px-4">Expiry Date</th>
                      <th className="py-3.5 px-4">Submitted</th>
                      <th className="py-3.5 px-4 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocs.map((doc) => {
                      const isFlagged = doc.id === 'doc-2';

                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowRejectBox(false);
                            setRejectReason(doc.flagged_note || '');
                          }}
                        >
                          {/* Document Type */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {doc.document_type}
                            </div>
                            <div className="text-[11px] text-slate-700 font-medium truncate max-w-xs">
                              {doc.original_filename}
                            </div>
                            {doc.rejection_reason && (
                              <div className="mt-1 text-[11px] text-rose-700 font-medium">
                                Rejection: {doc.rejection_reason}
                              </div>
                            )}
                          </td>

                          {/* Vendor */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {doc.vendor_name}
                            </div>
                            <div className="text-[11px] text-slate-500">{doc.category}</div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <StatusBadge status={doc.status} size="sm" />
                          </td>

                          {/* File Details */}
                          <td className="py-3.5 px-4 text-slate-700 text-[11px] font-mono font-medium">
                            {(doc.file_size / 1024).toFixed(0)} KB • {doc.mime_type.split('/')[1]?.toUpperCase()}
                          </td>

                          {/* Expiry Date */}
                          <td className="py-3.5 px-4">
                            {doc.expiry_date ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-slate-100 text-slate-900 border-slate-300">
                                {doc.expiry_date}
                              </span>
                            ) : (
                              <span className="text-slate-600 font-bold text-[11px]">—</span>
                            )}
                          </td>

                          {/* Submitted */}
                          <td className="py-3.5 px-4 text-slate-700 font-medium text-[11px]">
                            {doc.submitted_at.split('T')[0]}
                          </td>

                          {/* Verification Actions */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Standard Review Button from app/documents */}
                              <button
                                onClick={() => {
                                  setSelectedDoc(doc);
                                  setShowRejectBox(false);
                                  setRejectReason(doc.flagged_note || '');
                                }}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              >
                                Review
                              </button>

                              {/* Direct Reject Button on Flagged File for 1-Click Testing */}
                              {isFlagged && doc.status === 'UNDER_REVIEW' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleConfirmRejection(doc, doc.flagged_note || 'Illegible & blurry text scan. Please re-upload a clear copy.');
                                  }}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 flex items-center gap-1"
                                  title="1-Click Reject & Request Resubmission"
                                >
                                  <span>❌ Reject & Resubmit</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete document "${doc.original_filename}"?`)) {
                                    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title={`Delete ${doc.original_filename}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: OVERVIEW (Exact Match to app/dashboard/page.tsx)   */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Metric Cards Grid (Exact 6 cards from app/dashboard) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div
                onClick={() => setActiveTab('vendors')}
                className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-700 mb-2">
                  <span className="text-xs font-semibold">Total Vendors</span>
                  <Users className="w-4 h-4 text-slate-600 group-hover:text-slate-900" />
                </div>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">18</div>
                <div className="text-[11px] text-slate-600 font-medium mt-1">Registered suppliers</div>
              </div>

              <div
                onClick={() => setActiveTab('vendors')}
                className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-emerald-800 mb-2">
                  <span className="text-xs font-semibold">Approved</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-950 tracking-tight">12</div>
                <div className="text-[11px] text-emerald-700 font-medium mt-1">Fully verified</div>
              </div>

              <div
                onClick={() => setActiveTab('documents')}
                className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-blue-800 mb-2">
                  <span className="text-xs font-semibold">Pending Review</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-950 tracking-tight">{pendingReviewCount}</div>
                <div className="text-[11px] text-blue-700 font-medium mt-1">Needs admin review</div>
              </div>

              <div
                onClick={() => setActiveTab('vendors')}
                className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-sky-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-sky-800 mb-2">
                  <span className="text-xs font-semibold">Incomplete</span>
                  <AlertTriangle className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-2xl font-bold text-sky-950 tracking-tight">2</div>
                <div className="text-[11px] text-sky-700 font-medium mt-1">Awaiting vendor upload</div>
              </div>

              <div
                onClick={() => setActiveTab('expiry')}
                className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-amber-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-amber-900 mb-2">
                  <span className="text-xs font-semibold">Expiring in 30d</span>
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-950 tracking-tight">1</div>
                <div className="text-[11px] text-amber-800 font-medium mt-1">Autonomous alert active</div>
              </div>

              <div
                onClick={() => setActiveTab('expiry')}
                className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-rose-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-rose-800 mb-2">
                  <span className="text-xs font-semibold">Expired</span>
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-bold text-rose-950 tracking-tight">0</div>
                <div className="text-[11px] text-rose-700 font-medium mt-1">Zero non-compliance</div>
              </div>
            </div>

            {/* Recent Vendors Overview Table */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recent Vendor Compliance Records</h3>
                  <p className="text-xs text-slate-500">Live compliance status across active enterprise suppliers</p>
                </div>
                <button
                  onClick={() => setActiveTab('vendors')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>View All Vendors</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Vendor Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Compliance Health</th>
                      <th className="px-4 py-3">Documents</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {INITIAL_VENDORS.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {v.name}
                          <div className="text-[11px] text-slate-400 font-normal">{v.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{v.category}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  v.complianceScore === 100
                                    ? 'bg-emerald-500'
                                    : v.complianceScore >= 60
                                    ? 'bg-indigo-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${v.complianceScore}%` }}
                              ></div>
                            </div>
                            <span className="font-semibold text-slate-700">{v.complianceScore}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {v.approvedCount} / {v.documentsCount} Approved
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setActiveTab('documents')}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs cursor-pointer"
                          >
                            Review Docs &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: VENDORS (Exact Match to app/vendors/page.tsx)      */}
        {/* ========================================================= */}
        {activeTab === 'vendors' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div className="relative w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search suppliers by name, category, or email..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Invite New Vendor</span>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Vendor Name</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Contact Details</th>
                    <th className="px-5 py-3.5">Compliance Score</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {INITIAL_VENDORS.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {v.name}
                        <div className="text-[11px] text-slate-400 font-normal">Last active {v.lastActive}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{v.category}</td>
                      <td className="px-5 py-4 text-slate-600">
                        <div>{v.email}</div>
                        <div className="text-[11px] text-slate-400">{v.phone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${v.complianceScore}%` }}
                            ></div>
                          </div>
                          <span className="font-semibold text-slate-700">{v.complianceScore}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setActiveTab('documents')}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded border border-indigo-100 cursor-pointer"
                        >
                          View Documents &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: EXPIRY TRACKER (Exact Match to app/expiry)         */}
        {/* ========================================================= */}
        {activeTab === 'expiry' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ClockAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">Autonomous Reminder Pipeline Active:</span> Automated notifications configured for 30, 7, and 1 days prior to certificate expiry.
                </div>
              </div>
              <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px]">
                1 Document In Grace Period
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Expiring Documents Timeline</h3>
              <div className="divide-y divide-slate-100">
                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>Beacon Clinical Staffing &bull; Practitioner License</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                        Expires in 26 Days
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Expiry Date: 2026-11-20 &bull; Automated 30-day reminder dispatched on 2026-10-21
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      ✓ Reminder Sent
                    </span>
                    <button
                      onClick={() => {
                        setToastNotification({
                          visible: true,
                          title: 'Reminder Re-dispatched',
                          message: 'Immediate email & notification triggered for Beacon Clinical Staffing.'
                        });
                        setTimeout(() => setToastNotification(null), 3000);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded border border-indigo-200 cursor-pointer"
                    >
                      Ping Now
                    </button>
                  </div>
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Zenith Facility Solutions &bull; Commercial General Liability Insurance
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Expiry Date: 2027-03-31 &bull; 320 Days Remaining (Healthy Status)
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    Scheduled for Feb 2027
                  </span>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* VIEW 5: WORKFLOWS (Exact Match to app/workflows)           */}
        {/* ========================================================= */}
        {activeTab === 'workflows' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Active Compliance Blueprints</h3>
                <p className="text-xs text-slate-500">Structured document onboarding requirements enforced across suppliers</p>
              </div>
              <button
                onClick={() => setShowAiWorkflowModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ Generate AI Workflow</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    PUBLISHED
                  </span>
                  <span className="text-xs text-slate-400">14 Suppliers Active</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Logistics & Fleet Contractor Onboarding</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Collects GSTIN certificate, Commercial General Liability Insurance (&gt; ₹2 Crore), Driver Licenses, and Fleet RC Books with verification workflows.
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">4 Required Documents</span>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    View Responses &rarr;
                  </button>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    PUBLISHED
                  </span>
                  <span className="text-xs text-slate-400">4 Suppliers Active</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Facility Management Statutory Verification</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Requires EPFO monthly return challans, ESIC registration certificates, PAN cards, and third-party indemnity bonds.
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">3 Required Documents</span>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    View Responses &rarr;
                  </button>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. DOCUMENT REVIEW MODAL (Exact DocumentReviewModal UI)   */}
      {/* ========================================================= */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          {dispatchedLinkResult ? (
            /* EXACT Dispatched screen from DocumentReviewModal.tsx:117-197 */
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Rejection Notice Dispatched
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Email notification with secure upload button sent to{' '}
                    <strong className="text-slate-900">{dispatchedLinkResult.vendorName}</strong> ({dispatchedLinkResult.vendorEmail}).
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Direct Resubmission URL</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={dispatchedLinkResult.url}
                    className="flex-1 text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(dispatchedLinkResult.url);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Share directly via WhatsApp, Slack, or SMS</span>
                  <span className="text-indigo-600 font-semibold">Resubmission Active</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setDispatchedLinkResult(null);
                    setSelectedDoc(null);
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* EXACT Review Modal Body from DocumentReviewModal.tsx:199-436 */
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{selectedDoc.document_type}</h2>
                    <StatusBadge status={selectedDoc.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-700 font-medium mt-0.5 truncate max-w-md">
                    File: {selectedDoc.original_filename} ({(selectedDoc.file_size / 1024).toFixed(1)} KB)
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDoc(null);
                    setShowRejectBox(false);
                  }}
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-sm">
                {/* Metadata Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-700 uppercase">MIME Type</div>
                    <div className="text-xs font-bold text-slate-900 truncate">{selectedDoc.mime_type}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-700 uppercase">Submitted At</div>
                    <div className="text-xs font-bold text-slate-900">
                      {selectedDoc.submitted_at.split('T')[0]}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-700 uppercase">Expiry Date</div>
                    <div className="text-xs font-bold text-slate-900">
                      {selectedDoc.expiry_date || 'No expiry set'}
                    </div>
                  </div>
                </div>

                {/* Document Content Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5 font-bold text-slate-900">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Document Content Preview</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <a
                        href={selectedDoc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-semibold cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in New Tab</span>
                      </a>
                      <a
                        href={selectedDoc.file_url}
                        download={selectedDoc.original_filename}
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline font-semibold cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>

                  {/* Real Document Image Preview from frontend/public */}
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center overflow-hidden">
                    <img
                      src={selectedDoc.file_url}
                      alt={selectedDoc.original_filename}
                      className="max-h-80 w-auto object-contain rounded-lg shadow-sm border border-slate-200/80 bg-white"
                    />
                  </div>

                  {/* Inspection Note for Flagged Blurry Document */}
                  {selectedDoc.id === 'doc-2' && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-amber-950">Document Flagged: Illegible / Blurry Text</div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          The uploaded scan above is out of focus and illegible. You can click <strong>&quot;Reject&quot;</strong> below to test FormGate&apos;s 1-click partial rejection and dispatch a single-file resubmission magic link to Zenith Facility Solutions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rejection Input Box (Exact Match to DocumentReviewModal.tsx:326-354) */}
                {showRejectBox && (
                  <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-rose-900">
                      <span>Reason for Rejection / Replacement Required</span>
                      <button
                        type="button"
                        onClick={() => setShowRejectBox(false)}
                        className="text-slate-600 hover:text-slate-900 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this document was rejected (e.g. illegible signature, invalid tax number, expired)..."
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-lg border border-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white text-slate-900 placeholder-slate-500 font-medium"
                    />

                    <div className="flex flex-wrap gap-1 pt-1">
                      {[
                        'Blurry or unreadable document scan',
                        'Missing official stamp or signature',
                        'Document does not match legal vendor name',
                        'Expired policy period'
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRejectReason(preset)}
                          className="text-[10px] bg-white hover:bg-rose-100 text-slate-700 px-2 py-0.5 rounded border border-rose-200 transition-colors cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handleConfirmRejection(selectedDoc, rejectReason)}
                      disabled={loadingAction === 'reject'}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 mt-1"
                    >
                      {loadingAction === 'reject' ? 'Rejecting...' : 'Confirm Rejection & Send Magic Link'}
                    </button>
                  </div>
                )}
              </div>

              {/* Actions Footer (Exact Match to DocumentReviewModal.tsx:394-434) */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {!showRejectBox && selectedDoc.status !== 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => setShowRejectBox(true)}
                      className="px-3 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete document "${selectedDoc.original_filename}"?`)) {
                        setDocuments((prev) => prev.filter((d) => d.id !== selectedDoc.id));
                        setSelectedDoc(null);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoc(null);
                      setShowRejectBox(false);
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveDocument(selectedDoc.id)}
                    disabled={loadingAction === 'approve' || selectedDoc.status === 'APPROVED'}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {loadingAction === 'approve'
                      ? 'Approving...'
                      : selectedDoc.status === 'APPROVED'
                      ? 'Approved'
                      : 'Approve Document'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SUCCESS POP-UP / TOP-RIGHT BANNER                      */}
      {/* ========================================================= */}
      {toastNotification?.visible && (
        <div className="fixed top-5 right-5 z-50 max-w-lg w-full animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-slate-900/95 text-white backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/80 ring-1 ring-white/10 overflow-hidden">
            {/* Sleek Gradient Accent Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500"></div>

            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        Vendor Resubmission Magic Link Dispatched
                      </h4>
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                        Delivered
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Automated email &amp; SMS notification delivered</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setToastNotification(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Highlight Box (Exact phrasing required) */}
              <div className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Recipient:</span>
                  <span className="font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 text-xs">
                    {toastNotification.recipientEmail || 'contact@zenithfacility.com'}
                  </span>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t border-slate-800/80 text-slate-200 text-xs leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    Notification sent to{' '}
                    <strong className="text-emerald-300 font-mono">
                      {toastNotification.recipientEmail || 'contact@zenithfacility.com'}
                    </strong>
                    . The vendor resubmits only{' '}
                    <strong className="text-white underline decoration-amber-400 decoration-2 underline-offset-2">
                      &quot;{toastNotification.targetDocName || 'Commercial Registration Proof (Blurry Scan)'}&quot;
                    </strong>{' '}
                    without losing prior approved files.
                  </div>
                </div>
              </div>

              {/* Direct Magic Link Box */}
              {toastNotification.linkUrl && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Targeted Resubmission URL</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Working Live Portal
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={toastNotification.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 hover:border-indigo-500/50 text-xs font-mono text-indigo-300 transition-colors group overflow-hidden"
                      title="Click to open vendor resubmission screen in new tab"
                    >
                      <Link2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0" />
                      <span className="truncate underline decoration-indigo-500/40">{toastNotification.linkUrl}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-auto" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(toastNotification.linkUrl || '');
                        setCopiedToastLink(true);
                        setTimeout(() => setCopiedToastLink(false), 2500);
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 ${
                        copiedToastLink
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                      }`}
                    >
                      {copiedToastLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToastLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <a
                      href={toastNotification.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      <span>Open Vendor Portal &rarr;</span>
                    </a>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Only the blurry file needs replacement
                    </span>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-1 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  Audit log updated &bull; No vendor login required
                </span>
                <button
                  type="button"
                  onClick={() => setToastNotification(null)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SIMULATED "+ INVITE VENDOR" MODAL                      */}
      {/* ========================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Invite Supplier to Onboard</span>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Company Legal Name</label>
                <input
                  type="text"
                  placeholder="e.g. Reliance Logistics Ltd"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Recipient Business Email</label>
                <input
                  type="email"
                  placeholder="compliance@supplier.com"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Compliance Workflow</label>
                <select className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Logistics & Fleet Contractor Onboarding (4 Docs)</option>
                  <option>Facility Management Statutory Verification (3 Docs)</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                ✓ <strong>Direct link generated:</strong> Vendors can also be shared the onboarding URL via WhatsApp directly.
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setToastNotification({
                    visible: true,
                    title: 'Vendor Invitation Dispatched',
                    message: 'Magic onboarding invite delivered. Link ready for direct sharing.'
                  });
                  setTimeout(() => setToastNotification(null), 3500);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Send Onboarding Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. SIMULATED "+ UPLOAD DOCUMENT" MODAL                     */}
      {/* ========================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Upload className="w-5 h-5 text-indigo-600" />
                <span>Upload Document on Behalf of Vendor</span>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Target Vendor</label>
                <select className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Zenith Facility Solutions</option>
                  <option>Apex Logistics Pvt Ltd</option>
                  <option>Vertex Infra Projects</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Document Category</label>
                <select className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Commercial General Liability Insurance</option>
                  <option>GST Registration Certificate</option>
                  <option>PAN Card</option>
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors bg-slate-50/60 cursor-pointer">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-slate-700">Drag & drop document PDF/JPG here</div>
                <div className="text-[11px] text-slate-400 mt-1">Attachment will be linked directly to vendor record</div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setToastNotification({
                    visible: true,
                    title: 'Document Uploaded',
                    message: 'Attachment ingested into review queue.'
                  });
                  setTimeout(() => setToastNotification(null), 3500);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Upload File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. SIMULATED "NEW AI WORKFLOW" MODAL                       */}
      {/* ========================================================= */}
      {showAiWorkflowModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <span>AI Compliance Workflow Generator</span>
              </div>
              <button onClick={() => setShowAiWorkflowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Describe your compliance onboarding requirements in plain English. FormGate generates the entire digital form with document rules, required fields, and validation criteria.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Describe What You Need</label>
                <textarea
                  rows={4}
                  value={workflowPrompt}
                  onChange={(e) => setWorkflowPrompt(e.target.value)}
                  placeholder="e.g. Onboarding workflow for chemical logistics contractors requiring Hazchem transit license, PESO approvals, driver hazmat endorsements, and ₹5 Crore liability insurance."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Food & Dairy supplier onboarding (FSSAI, ISO 22000)',
                  'Civil contractor statutory compliance (EPFO, ESIC, CGL)',
                  'IT Security vendors (SOC 2, ISO 27001, Cyber Insurance)'
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setWorkflowPrompt(example)}
                    className="text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2 py-1 rounded border border-slate-200 transition-colors"
                  >
                    + {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAiWorkflowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGeneratingWf}
                onClick={() => {
                  setIsGeneratingWf(true);
                  setTimeout(() => {
                    setIsGeneratingWf(false);
                    setShowAiWorkflowModal(false);
                    setActiveTab('workflows');
                    setToastNotification({
                      visible: true,
                      title: 'Workflow Generated!',
                      message: 'Compliance blueprint created with required document verifications and automated expiry tracking.'
                    });
                    setTimeout(() => setToastNotification(null), 3500);
                  }, 700);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isGeneratingWf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Blueprint...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Workflow</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesDemoSandboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading FormGate Interactive Sandbox...</span>
          </div>
        </div>
      }
    >
      <SalesDemoContent />
    </Suspense>
  );
}
