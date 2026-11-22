'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  AlertCircle,
  AlertOctagon,
  FileText,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  FileCheck,
  Clock,
  ExternalLink,
  ChevronRight,
  FolderOpen,
  Calendar,
  X,
  Eye,
  Download
} from 'lucide-react';
import {
  api,
  UnifiedPortalData,
  PortalActionRequiredItem,
  PortalAssignment,
  WorkflowField
} from '@/lib/api';

function UnifiedClientPortalContent() {
  const params = useParams();
  const token = (params?.token as string) || '';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [portalData, setPortalData] = useState<UnifiedPortalData | null>(null);

  // Active workflow tab
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Per-assignment form state: { [assignmentId]: { [fieldId]: value } }
  const [responsesMap, setResponsesMap] = useState<Record<string, Record<string, any>>>({});
  // Per-assignment document expiries: { [assignmentId]: { [fieldId]: expiryDate } }
  const [expiriesMap, setExpiriesMap] = useState<Record<string, Record<string, string>>>({});

  // Upload state
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [submitSuccessMap, setSubmitSuccessMap] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchPortalData = async (isBackground: boolean = false) => {
    if (!token) return;
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setErrorMsg('');
      const data = await api.getPortalData(token);
      setPortalData(data);

      // Preserve any form field values the user has already typed before/during upload
      setResponsesMap((prev) => {
        const merged: Record<string, Record<string, any>> = {};
        data.assignments.forEach((assign) => {
          merged[assign.id] = {
            ...(assign.existing_responses || {}),
            ...(prev[assign.id] || {})
          };
        });
        return merged;
      });

      // Preserve document expiries entered by user
      setExpiriesMap((prev) => {
        const merged: Record<string, Record<string, string>> = {};
        data.assignments.forEach((assign) => {
          const aExp: Record<string, string> = {};
          assign.existing_documents.forEach((d) => {
            if (d.expiry_date) {
              aExp[d.field_id] = d.expiry_date.split('T')[0];
            }
          });
          merged[assign.id] = {
            ...aExp,
            ...(prev[assign.id] || {})
          };
        });
        return merged;
      });

      if (data.assignments.length > 0 && !activeTabId) {
        setActiveTabId(data.assignments[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Client portal link not found or expired');
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  // Handle direct file upload for action required item or normal field
  const handleUploadFile = async (
    assignmentId: string,
    fieldId: string,
    documentType: string,
    file: File,
    trackingKey: string
  ) => {
    try {
      setUploadingDocId(trackingKey);
      setUploadSuccessMsg(null);
      setErrorMsg('');

      const expiry = expiriesMap[assignmentId]?.[fieldId];
      await api.uploadPortalDocument(token, assignmentId, file, fieldId, documentType, expiry);

      setUploadSuccessMsg(`Document '${file.name}' uploaded successfully.`);
      // Refresh portal state in background to update documents without unmounting or resetting form inputs
      await fetchPortalData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload document');
    } finally {
      setUploadingDocId(null);
    }
  };

  // Submit an individual workflow assignment
  const handleSubmitAssignment = async (assignment: PortalAssignment) => {
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const formResponses = responsesMap[assignment.id] || {};
      const documentExpiries = expiriesMap[assignment.id] || {};

      const res = await api.submitPortalAssignment(token, assignment.id, formResponses, documentExpiries);
      setSubmitSuccessMap((prev) => ({
        ...prev,
        [assignment.id]: res.message || 'Workflow submitted successfully.'
      }));
      await fetchPortalData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed. Please check required fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFullUrl = (relativeUrl?: string) => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const path = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    return `${base}${path}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-700">
        <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <h2 className="text-lg font-semibold text-slate-800">Loading Client Portal...</h2>
        <p className="text-sm text-slate-500 mt-1">Retrieving your assigned forms and document requests</p>
      </div>
    );
  }

  if (errorMsg && !portalData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Portal Link Unavailable</h1>
          <p className="text-sm text-slate-600">{errorMsg}</p>
          <p className="text-xs text-slate-400">
            Please contact your accountant or organization administrator for an updated portal link.
          </p>
        </div>
      </div>
    );
  }

  const activeAssignment = portalData?.assignments.find((a) => a.id === activeTabId) || portalData?.assignments[0];
  const activeFields: WorkflowField[] = activeAssignment?.schema_definition?.fields || [];
  const activeDocs = activeAssignment?.existing_documents || [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs font-bold text-lg">
              FG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  {portalData?.organization_name || 'Client Portal'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" /> Secure Client Portal
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Client: <strong className="text-slate-800">{portalData?.client_name}</strong> ({portalData?.client_email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-500">Active Forms Assigned:</span>
              <span className="ml-1.5 text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {portalData?.assignments.length || 0}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Global Notifications */}
        {uploadSuccessMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{uploadSuccessMsg}</span>
            </div>
            <button
              onClick={() => setUploadSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. ACTION REQUIRED SECTION (Top of Page) */}
        {portalData?.action_required && portalData.action_required.length > 0 && (
          <section className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rose-50 via-rose-50/70 to-amber-50 px-6 py-4 border-b border-rose-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-rose-950 flex items-center gap-2">
                    Action Required: {portalData.action_required.length} Document(s) Rejected
                  </h2>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Your reviewer requested revisions. Please review the feedback and upload replacements directly below.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md text-xs font-bold uppercase tracking-wider">
                Needs Immediate Attention
              </span>
            </div>

            <div className="p-6 divide-y divide-slate-100 space-y-6">
              {portalData.action_required.map((item, idx) => {
                const trackingKey = `action_req_${item.document_id}`;
                const isUploading = uploadingDocId === trackingKey;

                return (
                  <div key={item.document_id} className={`pt-6 first:pt-0 flex flex-col md:flex-row md:items-start justify-between gap-6`}>
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <FolderOpen className="w-3 h-3" />
                          Form: {item.workflow_name}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                          Status: {item.status}
                        </span>
                        {item.has_replacement && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Replacement Uploaded
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900">{item.document_type}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Original file submitted: <span className="font-medium text-slate-700">{item.original_filename}</span>
                        </p>
                      </div>

                      {/* Reviewer Note Callout */}
                      {item.review_reason && (
                        <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-lg text-rose-900 text-xs leading-relaxed flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-rose-800">Reviewer Feedback:</span>
                            <span className="mt-0.5 block font-medium">{item.review_reason}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Direct Re-upload Action */}
                    <div className="shrink-0 w-full md:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
                      <input
                        type="file"
                        id={`file_input_${item.document_id}`}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && item.assignment_id) {
                            handleUploadFile(item.assignment_id, item.field_id, item.document_type, file, trackingKey);
                          }
                          e.target.value = '';
                        }}
                      />
                      <label
                        htmlFor={`file_input_${item.document_id}`}
                        className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xs ${isUploading
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Uploading File...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4" />
                            <span>Choose Replacement File</span>
                          </>
                        )}
                      </label>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {item.view_url && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewUrl(getFullUrl(item.view_url));
                              setPreviewTitle(item.document_type);
                            }}
                            className="hover:text-indigo-600 flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Rejected File
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. ASSIGNED WORKFLOWS TABS & COLLAPSIBLE SECTIONS */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Assigned Forms & Onboardings</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete each form below to finish your client onboarding and compliance review.
                </p>
              </div>
              <span className="text-xs text-slate-400 self-start sm:self-auto">
                {portalData?.assignments.length || 0} Form(s)
              </span>
            </div>

            {/* Workflow Switcher Tabs */}
            {portalData?.assignments && portalData.assignments.length > 1 && (
              <div className="flex items-center gap-2 mt-5 overflow-x-auto pb-1 border-b border-slate-100">
                {portalData.assignments.map((assign, i) => {
                  const isActive = assign.id === activeTabId;
                  const hasFlagged = assign.existing_documents.some((d) =>
                    ['REJECTED', 'RESUBMISSION_REQUESTED'].includes(d.status)
                  );
                  return (
                    <button
                      key={assign.id}
                      onClick={() => setActiveTabId(assign.id)}
                      className={`px-4 py-2 rounded-t-lg text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 cursor-pointer ${isActive
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                      <span>
                        Form {i + 1}: {assign.workflow_name}
                      </span>
                      {hasFlagged ? (
                        <span className="w-2 h-2 rounded-full bg-rose-600" title="Action required" />
                      ) : assign.status === 'APPROVED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                          {assign.status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Workflow Container */}
          {activeAssignment ? (
            <div className="p-6 space-y-8">
              {/* Active Workflow Meta Header */}
              <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{activeAssignment.workflow_name}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {activeAssignment.vendor_category}
                    </span>
                  </div>
                  {activeAssignment.workflow_description && (
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl">{activeAssignment.workflow_description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${activeAssignment.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : activeAssignment.status === 'SUBMITTED'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : activeAssignment.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                  >
                    Workflow Status: {activeAssignment.status}
                  </span>
                </div>
              </div>

              {submitSuccessMap[activeAssignment.id] && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{submitSuccessMap[activeAssignment.id]}</span>
                </div>
              )}

              {/* Form Questions & Inputs */}
              <div className="space-y-6">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  1. Form Information
                </h4>

                {activeFields.filter((f) => f.field_type !== 'file_upload').length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No text questions for this workflow.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {activeFields
                      .filter((f) => f.field_type !== 'file_upload')
                      .map((field) => {
                        const val = responsesMap[activeAssignment.id]?.[field.id] || '';
                        return (
                          <div key={field.id} className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-800">
                              {field.label}
                              {field.required && <span className="text-rose-500 ml-1">*</span>}
                            </label>
                            {field.field_type === 'dropdown' ? (
                              <select
                                value={val}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setResponsesMap((prev) => ({
                                    ...prev,
                                    [activeAssignment.id]: {
                                      ...(prev[activeAssignment.id] || {}),
                                      [field.id]: newVal
                                    }
                                  }));
                                }}
                                className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              >
                                <option value="">Select option...</option>
                                {(field.options || []).map((opt: string) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : field.field_type === 'long_text' ? (
                              <textarea
                                rows={3}
                                value={val}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setResponsesMap((prev) => ({
                                    ...prev,
                                    [activeAssignment.id]: {
                                      ...(prev[activeAssignment.id] || {}),
                                      [field.id]: newVal
                                    }
                                  }));
                                }}
                                className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            ) : (
                              <input
                                type={field.field_type === 'email' ? 'email' : 'text'}
                                value={val}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setResponsesMap((prev) => ({
                                    ...prev,
                                    [activeAssignment.id]: {
                                      ...(prev[activeAssignment.id] || {}),
                                      [field.id]: newVal
                                    }
                                  }));
                                }}
                                className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Document Uploads for this workflow */}
              <div className="space-y-6 pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  2. Required Compliance Documents
                </h4>

                <div className="space-y-4">
                  {activeFields
                    .filter((f) => f.field_type === 'file_upload')
                    .map((field) => {
                      const existingDoc = activeDocs.find((d) => d.field_id === field.id);
                      const trackingKey = `assign_${activeAssignment.id}_${field.id}`;
                      const isUploading = uploadingDocId === trackingKey;
                      const expiryVal = expiriesMap[activeAssignment.id]?.[field.id] || '';

                      return (
                        <div
                          key={field.id}
                          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-bold text-slate-900">{field.label}</h5>
                              {field.required && <span className="text-xs text-rose-500 font-bold">*Required</span>}
                              {existingDoc && (
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded ${existingDoc.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : existingDoc.status === 'REJECTED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-purple-100 text-purple-800'
                                    }`}
                                >
                                  {existingDoc.status}
                                </span>
                              )}
                            </div>

                            {/* Existing File info */}
                            {existingDoc ? (
                              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                                <span className="flex items-center gap-1 font-medium text-slate-800">
                                  <FileCheck className="w-4 h-4 text-emerald-600" />
                                  {existingDoc.original_filename}
                                </span>
                                {existingDoc.review_reason && (
                                  <span className="text-rose-600 font-medium block w-full mt-1">
                                    Reason: {existingDoc.review_reason}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">No document uploaded yet</p>
                            )}

                            {/* Optional Expiry date input */}
                            {field.track_expiry && (
                              <div className="flex items-center gap-2 pt-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <label className="text-xs font-semibold text-slate-600">Document Expiry Date:</label>
                                <input
                                  type="date"
                                  value={expiryVal}
                                  onChange={(e) => {
                                    const dVal = e.target.value;
                                    setExpiriesMap((prev) => ({
                                      ...prev,
                                      [activeAssignment.id]: {
                                        ...(prev[activeAssignment.id] || {}),
                                        [field.id]: dVal
                                      }
                                    }));
                                  }}
                                  className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-300 rounded"
                                />
                              </div>
                            )}
                          </div>

                          {/* Upload action */}
                          <div className="flex items-center gap-3 shrink-0">
                            <input
                              type="file"
                              id={`upload_${activeAssignment.id}_${field.id}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUploadFile(activeAssignment.id, field.id, field.label, file, trackingKey);
                                }
                                e.target.value = '';
                              }}
                            />
                            <label
                              htmlFor={`upload_${activeAssignment.id}_${field.id}`}
                              className={`py-2 px-3.5 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 border ${isUploading
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : existingDoc
                                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                                }`}
                            >
                              {isUploading ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <UploadCloud className="w-3.5 h-3.5" />
                                  <span>{existingDoc ? 'Replace File' : 'Upload File'}</span>
                                </>
                              )}
                            </label>

                            {existingDoc?.view_url && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewUrl(getFullUrl(existingDoc.view_url));
                                  setPreviewTitle(field.label);
                                }}
                                className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer"
                                title="View document"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Submit Form Button */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-end">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmitAssignment(activeAssignment)}
                  className={`px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer ${isSubmitting
                    ? 'bg-indigo-400 text-white cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting Responses...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Submit {activeAssignment.workflow_name}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              No active workflow selected.
            </div>
          )}
        </section>
      </main>

      {/* Document View Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{previewTitle}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={`${previewUrl}?download=true`}
                  download
                  className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-2 overflow-auto flex items-center justify-center">
              <iframe src={previewUrl} className="w-full h-full rounded border-0" title={previewTitle} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnifiedClientPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-700">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-sm font-semibold">Loading client portal...</span>
          </div>
        </div>
      }
    >
      <UnifiedClientPortalContent />
    </Suspense>
  );
}
