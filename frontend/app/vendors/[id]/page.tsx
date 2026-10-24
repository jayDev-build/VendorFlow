'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileCheck2,
  Clock,
  RotateCcw,
  Send,
  ShieldCheck,
  FileText,
  UserCheck,
  ExternalLink,
  Trash2,
  Upload,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentReviewModal } from '@/components/DocumentReviewModal';
import { UploadDocumentModal } from '@/components/UploadDocumentModal';
import { api } from '@/lib/api';
import { VendorDetail, DocumentItem, VendorSubmissionItem } from '@/lib/types';

import { Suspense } from 'react';

function VendorDetailContent() {
  const router = useRouter();
  const routeParams = useParams();
  const vendorId = (routeParams?.id as string) || '';

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Expanded submissions accordion state
  const [expandedSubmissions, setExpandedSubmissions] = useState<Record<string, boolean>>({});

  const toggleSubmission = (subId: string) => {
    setExpandedSubmissions(prev => ({
      ...prev,
      [subId]: !prev[subId]
    }));
  };

  // Active document for review modal
  const [reviewDoc, setReviewDoc] = useState<DocumentItem | null>(null);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);

  const fetchVendor = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await api.getVendor(vendorId);
      setVendor(data);
      if (data.submissions && data.submissions.length > 0) {
        setExpandedSubmissions(prev => {
          if (Object.keys(prev).length === 0) {
            return { [data.submissions![0].id]: true };
          }
          return prev;
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load vendor details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendor();
  }, [vendorId]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setActionLoading(true);
      await api.updateVendor(vendorId, { status: newStatus });
      fetchVendor();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!vendor) return;
    if (!window.confirm(`Are you sure you want to permanently delete vendor "${vendor.name}" and all associated compliance records?`)) {
      return;
    }
    try {
      setActionLoading(true);
      setErrorMsg('');
      await api.deleteVendor(vendorId);
      router.push('/vendors');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete vendor');
      setActionLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete document "${docName}"?`)) {
      return;
    }
    try {
      setDeletingDocId(docId);
      setErrorMsg('');
      await api.deleteDocument(docId);
      fetchVendor();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Vendor Profile" />
        <div className="p-16 text-center text-slate-400">Loading vendor records...</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Vendor Not Found" />
        <div className="p-16 text-center space-y-3">
          <p className="text-slate-600">The requested vendor profile was not found or access is denied.</p>
          <Link href="/vendors" className="text-indigo-600 font-semibold underline text-xs">Return to Vendors Directory</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title={vendor.name}
        subtitle={`Vendor Category: ${vendor.category} • Registered on ${new Date(vendor.created_at).toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowUploadDocModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer active:scale-[0.98]"
              title="Upload document directly for this vendor"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Document</span>
            </button>
            <Link
              href="/workflows/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors border border-slate-300"
              title="Request documents by creating a new workflow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request Documents</span>
            </Link>
            <button
              type="button"
              onClick={handleDeleteVendor}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-lg text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              title={`Delete ${vendor.name}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Vendor</span>
            </button>
          </div>
        }
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {/* Top Info Banner */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl shrink-0">
              {vendor.name.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{vendor.name}</h1>
                <StatusBadge status={vendor.status} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 font-medium pt-0.5">
                <span className="flex items-center gap-1 text-slate-800 font-mono">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {vendor.contact_email}
                </span>
                {vendor.contact_phone && (
                  <span className="flex items-center gap-1 text-slate-800 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {vendor.contact_phone}
                  </span>
                )}
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold text-[11px] border border-slate-200">
                  {vendor.category}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <select
              value={vendor.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={actionLoading}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="INVITED">Status: Invited</option>
              <option value="IN_PROGRESS">Status: In Progress</option>
              <option value="SUBMITTED">Status: Submitted</option>
              <option value="APPROVED">Status: Approved</option>
              <option value="REJECTED">Status: Rejected</option>
              <option value="SUSPENDED">Status: Suspended</option>
            </select>
          </div>
        </div>

        {/* Documents Checklist & Review Section */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Required Documents & Verification Status</h2>
              <p className="text-xs text-slate-700 font-medium">Inspect uploaded vendor files, preview certificates, and execute verification approvals</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowUploadDocModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
              <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                {vendor.documents.filter(d => d.status === 'APPROVED').length} / {vendor.documents.length} Verified
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {vendor.documents.length === 0 ? (
              <div className="py-12 text-center text-slate-700 text-xs font-semibold">
                <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <span className="font-bold text-slate-900">No documents received yet</span>
                <p className="text-[11px] text-slate-600 font-medium mt-1">Vendor has not uploaded files for this onboarding cycle.</p>
                <div className="mt-4">
                  <Link
                    href="/workflows/new"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Request Documents</span>
                  </Link>
                </div>
              </div>
            ) : (
              vendor.documents.map((doc) => {
                const downloadFullUrl = doc.download_url
                  ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${doc.download_url}`
                  : '#';

                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                const isImage = doc.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.original_filename);
                const isPdf = doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.original_filename);

                return (
                  <div key={doc.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-3.5">
                      {isImage && downloadFullUrl !== '#' ? (
                        <img
                          src={downloadFullUrl}
                          alt={doc.original_filename}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-300 shadow-2xs shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setReviewDoc(doc)}
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${isPdf ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-indigo-50 border border-indigo-200 text-indigo-700'}`}>
                          {isPdf ? 'PDF' : 'DOC'}
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{doc.document_type}</span>
                          <StatusBadge status={doc.status} size="sm" />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 font-medium">
                          <span className="text-slate-800 font-medium truncate max-w-xs">{doc.original_filename}</span>
                          <span>•</span>
                          <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                          {doc.expiry_date && (
                            <>
                              <span>•</span>
                              <span className={`flex items-center gap-1 font-semibold ${isExpired ? 'text-rose-600 font-bold' : 'text-amber-800'}`}>
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Expires: {new Date(doc.expiry_date).toLocaleDateString()}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={downloadFullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 border border-slate-300 text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                        <span>{isPdf ? 'View PDF' : isImage ? 'View Image' : 'Download'}</span>
                      </a>
                      <button
                        onClick={() => setReviewDoc(doc)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id, doc.original_filename)}
                        disabled={deletingDocId === doc.id}
                        className="px-2.5 py-1.5 border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Multi-Form Submissions & Questionnaire Responses Accordion */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                Form Responses & Submissions
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {vendor.submissions?.length || (vendor.onboarding_data ? 1 : 0)} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Click any workflow header below to expand answers and attached documents.
            </p>
          </div>

          {(!vendor.submissions || vendor.submissions.length === 0) && !vendor.onboarding_data?.form_responses ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200/90 text-center text-slate-500 text-xs">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span className="font-semibold text-slate-700">No form submissions recorded yet.</span>
              <p className="text-slate-500 mt-1">This vendor has not submitted any workflow questionnaires yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(vendor.submissions && vendor.submissions.length > 0
                ? vendor.submissions
                : [
                    {
                      id: vendor.onboarding_data?.id || 'legacy-sub',
                      workflow_id: vendor.active_workflow?.version_id,
                      workflow_name: vendor.active_workflow?.schema_definition?.name || 'Onboarding Form',
                      workflow_category: vendor.category || 'General',
                      version_number: vendor.active_workflow?.version_number || 1,
                      status: vendor.onboarding_data?.status || vendor.status,
                      submitted_at: vendor.onboarding_data?.submitted_at,
                      form_responses: vendor.onboarding_data?.form_responses || {},
                      schema_definition: vendor.active_workflow?.schema_definition || ({} as any),
                      documents: vendor.documents || []
                    } as VendorSubmissionItem
                  ]
              ).map((sub, index) => {
                const isExpanded = !!expandedSubmissions[sub.id];
                const responseCount = Object.keys(sub.form_responses || {}).length;
                const docCount = sub.documents?.length || 0;

                return (
                  <div
                    key={sub.id || index}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
                  >
                    {/* Clickable Header Accordion Bar */}
                    <div
                      onClick={() => toggleSubmission(sub.id)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubmission(sub.id);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-indigo-600 transition-transform" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400 transition-transform" />
                          )}
                        </button>

                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-indigo-600" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                              {sub.workflow_name || 'Workflow Form'}
                            </h3>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              v{sub.version_number}
                            </span>
                            {sub.workflow_category && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                                {sub.workflow_category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                            {sub.submitted_at ? (
                              <span>Submitted {new Date(sub.submitted_at).toLocaleDateString()}</span>
                            ) : (
                              <span>In Progress / Not Submitted</span>
                            )}
                            <span>•</span>
                            <span>{responseCount} answer{responseCount === 1 ? '' : 's'}</span>
                            <span>•</span>
                            <span>{docCount} document{docCount === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 sm:self-center pl-12 sm:pl-0">
                        <StatusBadge status={sub.status} size="sm" />
                        {sub.workflow_id && (
                          <Link
                            href={`/workflows/${sub.workflow_id}/responses`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                            title="Open full responses spreadsheet for this workflow"
                          >
                            <span>Workflow Sheet</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 p-5 sm:p-6 bg-slate-50/40 space-y-6 animate-fadeIn">
                        {/* Questions & Answers Grid */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span>Questionnaire Answers</span>
                            <span className="text-[10px] font-medium text-slate-500 normal-case">
                              ({responseCount} fields answered)
                            </span>
                          </h4>

                          {responseCount === 0 ? (
                            <p className="text-xs text-slate-500 italic bg-white p-3.5 rounded-xl border border-slate-200">
                              No form fields submitted for this response.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                              {Object.entries(sub.form_responses).map(([key, value]) => {
                                const schemaField = sub.schema_definition?.fields?.find(
                                  (f: any) => f.id === key
                                );
                                const displayLabel = schemaField?.label || key.replace('field_', '').replace(/_/g, ' ');
                                return (
                                  <div
                                    key={key}
                                    className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between"
                                  >
                                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                      {displayLabel}
                                    </div>
                                    <div className="text-xs font-semibold text-slate-900 mt-1.5 break-words">
                                      {typeof value === 'boolean'
                                        ? value
                                          ? 'Yes'
                                          : 'No'
                                        : Array.isArray(value)
                                        ? value.join(', ')
                                        : String(value || '—')}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Documents attached to this submission */}
                        {sub.documents && sub.documents.length > 0 && (
                          <div className="space-y-3 border-t border-slate-200/60 pt-5">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                              <span>Attached Documents</span>
                              <span className="text-[10px] font-medium text-slate-500 normal-case">
                                ({sub.documents.length} files uploaded)
                              </span>
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {sub.documents.map((doc: any) => {
                                const downloadFullUrl = doc.download_url
                                  ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${doc.download_url}`
                                  : '#';
                                const isPdf = doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.original_filename);
                                const isImage = doc.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.original_filename);

                                return (
                                  <div
                                    key={doc.id}
                                    className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                          isPdf
                                            ? 'bg-rose-50 border border-rose-200 text-rose-700'
                                            : isImage
                                            ? 'bg-purple-50 border border-purple-200 text-purple-700'
                                            : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                                        }`}
                                      >
                                        {isPdf ? 'PDF' : isImage ? 'IMG' : 'DOC'}
                                      </div>
                                      <div className="min-w-0 space-y-0.5">
                                        <div className="text-xs font-bold text-slate-900 truncate">
                                          {doc.document_type || doc.original_filename}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate">
                                          {doc.original_filename} • {(doc.file_size / 1024).toFixed(0)} KB
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <StatusBadge status={doc.status} size="sm" />
                                      {doc.download_url && (
                                        <a
                                          href={downloadFullUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                          title="View / Download"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setReviewDoc(doc as DocumentItem)}
                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                                      >
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>Review</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit Timeline */}
        {vendor.recent_activity?.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>Vendor Activity Timeline</span>
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              {vendor.recent_activity.map((act) => (
                <div key={act.id} className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{act.action.replace(/_/g, ' ')}</span>
                  <span className="text-slate-700 font-medium text-[11px]">{new Date(act.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Document Review Modal */}
      {reviewDoc && (
        <DocumentReviewModal
          document={reviewDoc}
          onClose={() => setReviewDoc(null)}
          onUpdated={fetchVendor}
        />
      )}

      {/* Upload Document Modal */}
      {showUploadDocModal && (
        <UploadDocumentModal
          initialVendorId={vendorId}
          onClose={() => setShowUploadDocModal(false)}
          onSuccess={() => {
            fetchVendor();
            setSuccessMsg('Document successfully uploaded and saved to vendor vault.');
          }}
        />
      )}
    </div>
  );
}

export default function VendorDetailPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-slate-700 font-semibold">Loading vendor records...</div>}>
      <VendorDetailContent />
    </Suspense>
  );
}
