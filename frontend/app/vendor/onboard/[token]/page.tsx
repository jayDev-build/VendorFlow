'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Lock,
  Building2,
  ShieldCheck,
  Send,
  RefreshCw,
  FileText,
  RotateCcw,
  Check,
  ChevronDown,
  Info,
  Trash2,
  Eye,
  X,
  Edit3,
  Download,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { api } from '@/lib/api';
import { PublicInvitationData, WorkflowField } from '@/lib/types';

interface UploadedFileRecord {
  id: string;
  filename: string;
  expiry?: string;
  mime_type?: string;
  file_size?: number;
  view_url?: string;
  download_url?: string;
  status?: string;
  review_reason?: string;
  has_replacement?: boolean;
}

interface PreviewModalState {
  url: string;
  downloadUrl?: string;
  filename: string;
  isPdf: boolean;
}

function VendorOnboardingPortalContent() {
  const routeParams = useParams();
  const token = (routeParams?.token as string) || '';

  const [data, setData] = useState<PublicInvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Form values
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [documentExpiries, setDocumentExpiries] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFileRecord>>({});
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active focused question card (Google Forms signature left border highlight)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // Media preview modal (for viewing PDFs or images)
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);

  useEffect(() => {
    document.body.classList.add('vendor-onboard-body');
    return () => {
      document.body.classList.remove('vendor-onboard-body');
    };
  }, []);

  useEffect(() => {
    async function loadInvitation() {
      try {
        setLoading(true);
        setErrorMsg('');

        // Handle Demo & Sample Resubmission Sandbox tokens
        if (token.startsWith('resubmit-sample-') || token.includes('sample') || token.includes('demo')) {
          const sampleData: PublicInvitationData = {
            valid: true,
            email: 'contact@zenithfacility.com',
            organization_name: 'FormGate Enterprise',
            workflow_name: 'Facility Management Statutory Verification',
            workflow_description: 'Statutory compliance verification and single-file document resubmission portal for facility management contractors.',
            vendor_category: 'Facility Management',
            expires_at: '2026-12-31T23:59:59Z',
            is_submitted: false,
            schema_definition: {
              name: 'Facility Management Statutory Verification',
              vendor_category: 'Facility Management',
              description: 'Statutory compliance verification for facility contractors.',
              approval_required: true,
              reminder_rules: [30, 7, 1],
              generated_questions: [],
              assumptions: [],
              warnings: [],
              fields: [
                {
                  id: 'field_legal_name',
                  label: 'Legal Entity Name',
                  field_type: 'short_text',
                  required: true,
                  track_expiry: false,
                  allowed_file_types: [],
                  max_file_size_mb: 5
                },
                {
                  id: 'field_gst_cert',
                  label: 'GST Tax Invoice & Registration Proof',
                  field_type: 'file_upload',
                  required: true,
                  track_expiry: false,
                  allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                  max_file_size_mb: 15
                },
                {
                  id: 'field_comm_reg',
                  label: 'Commercial Registration Proof (Blurry Scan)',
                  field_type: 'file_upload',
                  required: true,
                  track_expiry: false,
                  allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                  max_file_size_mb: 15
                },
                {
                  id: 'field_cgl_policy',
                  label: 'Certificate of Insurance (OCP Policy)',
                  field_type: 'file_upload',
                  required: true,
                  track_expiry: true,
                  allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                  max_file_size_mb: 15
                }
              ]
            },
            existing_responses: {
              field_legal_name: 'Zenith Facility Solutions Private Limited'
            },
            existing_documents: [
              {
                id: 'doc-approved-gst',
                field_id: 'field_gst_cert',
                document_type: 'GST Tax Invoice & Registration Proof',
                original_filename: 'A4-S1-GST-Invoice-Format_page-0001-scaled.jpg',
                status: 'APPROVED',
                file_size: 331876,
                mime_type: 'image/jpeg',
                view_url: '/A4-S1-GST-Invoice-Format_page-0001-scaled.jpg',
                download_url: '/A4-S1-GST-Invoice-Format_page-0001-scaled.jpg'
              },
              {
                id: 'doc-rejected-comm',
                field_id: 'field_comm_reg',
                document_type: 'Commercial Registration Proof (Blurry Scan)',
                original_filename: 'texture-blurry-text-open-textbook-260nw-1175839786.webp',
                status: 'REJECTED',
                review_reason: 'Illegible & blurry text scan. Document contents and registration number cannot be verified.',
                file_size: 8094,
                mime_type: 'image/webp',
                has_replacement: false,
                view_url: '/texture-blurry-text-open-textbook-260nw-1175839786.webp',
                download_url: '/texture-blurry-text-open-textbook-260nw-1175839786.webp'
              },
              {
                id: 'doc-approved-cgl',
                field_id: 'field_cgl_policy',
                document_type: 'Certificate of Insurance (OCP Policy)',
                original_filename: 'owner-and-protective-OCP-insurance-certificate-template.jpg',
                status: 'APPROVED',
                file_size: 51098,
                mime_type: 'image/jpeg',
                expiry_date: '2027-03-31',
                view_url: '/owner-and-protective-OCP-insurance-certificate-template.jpg',
                download_url: '/owner-and-protective-OCP-insurance-certificate-template.jpg'
              }
            ]
          };

          setData(sampleData);
          setSubmittedSuccess(false);
          setFormResponses(sampleData.existing_responses || {});
          const docsMap: Record<string, UploadedFileRecord> = {};
          const expMap: Record<string, string> = {};
          (sampleData.existing_documents || []).forEach((d) => {
            docsMap[d.field_id] = {
              id: d.id,
              filename: d.original_filename,
              expiry: d.expiry_date,
              mime_type: d.mime_type,
              file_size: d.file_size,
              view_url: d.view_url,
              download_url: d.download_url,
              status: d.status,
              review_reason: d.review_reason,
              has_replacement: Boolean(d.has_replacement)
            };
            if (d.expiry_date) {
              expMap[d.field_id] = d.expiry_date.split('T')[0];
            }
          });
          setUploadedFiles(docsMap);
          setDocumentExpiries(expMap);
          return;
        }

        const res = await api.getPublicInvitation(token);
        setData(res);

        setSubmittedSuccess(Boolean(res.is_submitted));
        setFormResponses(res.existing_responses || {});
        if (res.existing_documents && res.existing_documents.length > 0) {
          const docsMap: Record<string, UploadedFileRecord> = {};
          const expMap: Record<string, string> = {};
          res.existing_documents.forEach((d) => {
            docsMap[d.field_id] = {
              id: d.id,
              filename: d.original_filename,
              expiry: d.expiry_date,
              mime_type: d.mime_type,
              file_size: d.file_size,
              view_url: d.view_url,
              download_url: d.download_url,
              status: d.status,
              review_reason: d.review_reason,
              has_replacement: Boolean(d.has_replacement)
            };
            if (d.expiry_date) {
              expMap[d.field_id] = d.expiry_date.split('T')[0];
            }
          });
          setUploadedFiles(docsMap);
          setDocumentExpiries(expMap);
        } else {
          setUploadedFiles({});
          setDocumentExpiries({});
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Invalid or expired invitation link');
      } finally {
        setLoading(false);
      }
    }
    loadInvitation();
  }, [token]);

  const handleFileUpload = async (field: WorkflowField, file: File) => {
    try {
      setUploadingFieldId(field.id);
      setErrorMsg('');

      // Handle demo sample mode client-side upload simulation
      if (token.startsWith('resubmit-sample-') || token.includes('sample') || token.includes('demo')) {
        await new Promise((r) => setTimeout(r, 400));
        const objectUrl = URL.createObjectURL(file);
        setUploadedFiles((prev) => {
          const currentRecord = prev[field.id];
          const prevStatus = currentRecord?.status;
          const prevReason = currentRecord?.review_reason;
          const isResubmitDoc = prevStatus === 'RESUBMISSION_REQUESTED' || prevStatus === 'REJECTED';

          return {
            ...prev,
            [field.id]: {
              id: 'mock-doc-' + Date.now(),
              filename: file.name,
              expiry: documentExpiries[field.id],
              mime_type: file.type,
              file_size: file.size,
              view_url: objectUrl,
              download_url: objectUrl,
              status: isResubmitDoc ? prevStatus : 'SUBMITTED',
              review_reason: isResubmitDoc ? prevReason : undefined,
              has_replacement: true
            }
          };
        });
        return;
      }

      const expiry = documentExpiries[field.id];
      const res = await api.uploadPublicDocument(token, file, field.id, field.label, expiry);

      setUploadedFiles((prev) => {
        const currentRecord = prev[field.id];
        // Do not change the status on form for resubmitted document until submit is hit!
        const prevStatus = currentRecord?.status;
        const prevReason = currentRecord?.review_reason;
        const isResubmitDoc = prevStatus === 'RESUBMISSION_REQUESTED' || prevStatus === 'REJECTED';

        return {
          ...prev,
          [field.id]: {
            id: res.document_id,
            filename: res.original_filename,
            expiry: res.expiry_date,
            mime_type: res.mime_type || file.type,
            file_size: res.file_size || file.size,
            view_url: res.view_url,
            download_url: res.download_url,
            status: isResubmitDoc ? prevStatus : (res.status || 'SUBMITTED'),
            review_reason: isResubmitDoc ? prevReason : undefined,
            has_replacement: true
          }
        };
      });
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to upload ${field.label}`);
    } finally {
      setUploadingFieldId(null);
    }
  };

  const handleDeleteFile = async (fieldId: string) => {
    const doc = uploadedFiles[fieldId];
    if (!doc) return;
    if (!window.confirm(`Are you sure you want to delete ${doc.filename}?`)) return;

    try {
      setDeletingFieldId(fieldId);
      setErrorMsg('');

      if (token.startsWith('resubmit-sample-') || token.includes('sample') || token.includes('demo')) {
        setUploadedFiles((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
        return;
      }

      await api.deletePublicDocument(token, doc.id);

      setUploadedFiles((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });

      setDocumentExpiries((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete file');
    } finally {
      setDeletingFieldId(null);
    }
  };

  const handleClearForm = () => {
    if (window.confirm('Clear all entered answers and reset form?')) {
      setFormResponses({});
      setDocumentExpiries({});
      setErrorMsg('');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const fields = data.schema_definition?.fields || [];

    // Check required file uploads
    const missingDocs = fields.filter((f) => f.field_type === 'file_upload' && f.required && !uploadedFiles[f.id]);
    if (missingDocs.length > 0) {
      setErrorMsg(`Please upload the following required documents before submitting: ${missingDocs.map((d) => d.label).join(', ')}`);
      return;
    }

    // Check flagged documents that require replacement
    const unreplacedDocs = fields.filter((f) => {
      if (f.field_type !== 'file_upload') return false;
      const uploaded = uploadedFiles[f.id];
      if (!uploaded) return f.required;
      const isFlagged = uploaded.status === 'REJECTED' || uploaded.status === 'RESUBMISSION_REQUESTED';
      return isFlagged && !uploaded.has_replacement;
    });
    if (unreplacedDocs.length > 0) {
      setErrorMsg(`Please upload replacement files for the flagged documents before submitting: ${unreplacedDocs.map((d) => d.label).join(', ')}`);
      return;
    }

    // Check required certificate expiries
    const missingExpiries = fields.filter((f) => f.field_type === 'file_upload' && f.track_expiry && f.required && !documentExpiries[f.id]);
    if (missingExpiries.length > 0) {
      setErrorMsg(`Please specify certificate expiration dates for: ${missingExpiries.map((d) => d.label).join(', ')}`);
      return;
    }

    // Check required non-file questions (dropdowns, checkboxes, short/long text, etc.)
    const missingQuestions = fields.filter((f) => {
      if (f.field_type === 'file_upload' || !f.required) return false;
      const val = formResponses[f.id];
      if (f.field_type === 'checkbox') {
        const opts = (f.options && f.options.length > 0) ? f.options : (f.validation?.options || []);
        if (opts.length > 1) {
          return !Array.isArray(val) || val.length === 0;
        }
        return !val;
      }
      return val === undefined || val === null || String(val).trim() === '';
    });
    if (missingQuestions.length > 0) {
      setErrorMsg(`Please complete all required questions: ${missingQuestions.map((f) => f.label).join(', ')}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (token.startsWith('resubmit-sample-') || token.includes('sample') || token.includes('demo')) {
        await new Promise((r) => setTimeout(r, 600));
        setSubmittedSuccess(true);
        return;
      }

      await api.submitPublicOnboarding(token, formResponses, documentExpiries);
      setSubmittedSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFullUrl = (relativeUrl?: string) => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${base}${relativeUrl}`;
  };

  if (loading) {
    return (
      <div className="w-full min-h-full flex-1 shrink-0 bg-[#f0ebf8] flex flex-col items-center justify-center p-4 text-slate-700">
        <RefreshCw className="w-8 h-8 animate-spin text-[#673ab7] mb-3" />
        <p className="text-sm font-medium">Loading form...</p>
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className="w-full min-h-full flex-1 shrink-0 bg-[#f0ebf8] flex flex-col items-center justify-center p-4">
        <div className="max-w-[640px] w-full bg-white p-8 rounded-lg border border-slate-200 shadow-xs text-center space-y-4">
          <div className="h-2.5 bg-rose-600 -mt-8 -mx-8 rounded-t-lg mb-6" />
          <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
          <h1 className="text-2xl font-normal text-slate-900">Form Unavailable</h1>
          <p className="text-sm text-slate-600 leading-relaxed">{errorMsg}</p>
          <p className="text-xs text-slate-500">
            Please contact the organization administrator who sent you this invitation for a renewed link.
          </p>
        </div>
      </div>
    );
  }

  // Google Forms Signature Submission Success Screen
  if (submittedSuccess) {
    const fields = data?.schema_definition?.fields || [];
    return (
      <div className="w-full min-h-full flex-1 shrink-0 bg-[#f0ebf8] py-10 px-4 flex justify-center">
        <div className="max-w-[770px] w-full space-y-4">
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* Signature Top Colored Accent Bar */}
            <div className="h-2.5 bg-[#673ab7]" />

            <div className="p-8 space-y-4">
              <h1 className="text-2xl sm:text-3xl font-normal text-slate-900 tracking-tight">
                Your response has been recorded.
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                Thank you for completing the onboarding form for{' '}
                <strong className="text-slate-900">{data?.organization_name}</strong>. Your submitted credentials, business information, and compliance certificates have been securely recorded.
              </p>

              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-[#673ab7] rounded-md text-xs font-medium border border-purple-200">
                  <CheckCircle2 className="w-4 h-4 text-[#673ab7]" />
                  <span>Status: Under Compliance Review</span>
                </div>
              </div>

              {/* Action Buttons: Edit Your Response & View Response */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSubmittedSuccess(false)}
                  className="text-sm font-semibold text-[#673ab7] hover:underline flex items-center gap-1.5 cursor-pointer bg-purple-50 hover:bg-purple-100 px-3.5 py-2 rounded-md border border-purple-200 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit your response</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSummary(!showSummary)}
                  className="text-sm font-medium text-[#673ab7] hover:underline cursor-pointer"
                >
                  {showSummary ? 'Hide submitted responses' : 'View your submitted responses'}
                </button>
              </div>

              {/* Collapsible response summary */}
              {showSummary && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-5">
                  {Object.keys(formResponses).length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#673ab7]" />
                        <span>Submitted Form Answers</span>
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(formResponses).map(([key, value]) => {
                          const fieldDef = fields.find((f) => f.id === key);
                          const label = fieldDef?.label || key.replace('field_', '').replace(/_/g, ' ');
                          return (
                            <div key={key} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                                {label}
                              </div>
                              <div className="text-xs font-semibold text-slate-900 mt-0.5 break-words">
                                {Array.isArray(value)
                                  ? (value.length > 0 ? value.join(', ') : 'None')
                                  : typeof value === 'boolean'
                                  ? (value ? 'Confirmed' : 'No')
                                  : String(value || '—')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {Object.keys(uploadedFiles).length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-slate-200">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Uploaded Compliance Documents ({Object.keys(uploadedFiles).length})
                      </h2>
                      <div className="space-y-3">
                        {Object.entries(uploadedFiles).map(([fId, doc]) => {
                          const isImg = doc.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(doc.filename);
                          const isPdf = doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.filename);
                          const viewUrl = getFullUrl(doc.view_url);
                          const dlUrl = getFullUrl(doc.download_url);

                          return (
                            <div
                              key={fId}
                              className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                {isImg && viewUrl ? (
                                  <img
                                    src={viewUrl}
                                    alt={doc.filename}
                                    className="w-12 h-12 object-cover rounded border border-slate-300"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs">
                                    {isPdf ? 'PDF' : 'DOC'}
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold text-slate-900 block truncate max-w-xs">{doc.filename}</span>
                                  {doc.expiry && (
                                    <span className="text-[11px] text-amber-800 font-medium">
                                      Expiry: {new Date(doc.expiry).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                {viewUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModal({ url: viewUrl, downloadUrl: dlUrl, filename: doc.filename, isPdf })}
                                    className="px-2.5 py-1 text-xs font-semibold text-[#673ab7] hover:bg-purple-100/60 rounded border border-purple-200 flex items-center gap-1 transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{isPdf ? 'View PDF' : 'View Image'}</span>
                                  </button>
                                )}
                                {dlUrl && (
                                  <a
                                    href={dlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
                                    title="Download file"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                )}
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
          </div>

          {/* Google Forms Footer */}
          <div className="text-center pt-4 space-y-1 text-xs text-slate-500">
            <div className="flex items-center justify-center gap-1 font-medium text-slate-600">
              <ShieldCheck className="w-4 h-4 text-[#673ab7]" />
              <span>Secured by FormGate Enterprise Onboarding</span>
            </div>
          </div>
        </div>

        {/* Media Preview Modal */}
        {previewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <span className="font-semibold text-slate-900 text-sm truncate max-w-md">{previewModal.filename}</span>
                <div className="flex items-center gap-2">
                  {previewModal.downloadUrl && (
                    <a
                      href={previewModal.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-300"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewModal(null)}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-slate-100 flex-1 overflow-auto flex items-center justify-center min-h-[400px]">
                {previewModal.isPdf ? (
                  <iframe src={previewModal.url} className="w-full h-[75vh] rounded-lg border border-slate-300 bg-white" title={previewModal.filename} />
                ) : (
                  <img src={previewModal.url} alt={previewModal.filename} className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-sm" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const fields = data?.schema_definition?.fields || [];

  return (
    <div className="w-full min-h-full flex-1 shrink-0 bg-[#f0ebf8] py-8 px-4 text-slate-900">
      <div className="max-w-[770px] mx-auto space-y-4">
        {/* =========================================================================
            HEADER CARD: GOOGLE FORMS SIGNATURE BANNER
            ========================================================================= */}
        <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* Solid Top Colored Stripe (Deep Purple #673ab7) */}
          <div className="h-2.5 bg-[#673ab7]" />

          <div className="p-6 sm:p-7 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h1 className="text-2xl sm:text-3xl font-normal text-slate-900 tracking-tight">
                {data?.workflow_name || 'Vendor Onboarding & Compliance'}
              </h1>
              <span className="self-start sm:self-center text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-[#673ab7] border border-purple-200">
                {data?.schema_definition?.vendor_category || 'Vendor Portal'}
              </span>
            </div>

            <p className="text-sm text-slate-700 font-normal leading-relaxed">
              {data?.schema_definition?.description ||
                `Please complete the vendor onboarding requirements for ${data?.organization_name}. All submitted files and information are encrypted and verified.`}
            </p>

            <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5 text-[#673ab7]" />
                <span>
                  Submitting to: <strong className="text-slate-900">{data?.organization_name}</strong>
                </span>
                {data?.email && !data.email.endsWith('.local') && (
                  <span className="text-slate-500 font-normal">({data.email})</span>
                )}
              </div>
              <div className="text-rose-600 font-medium">
                * Indicates required question
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-white border-l-4 border-l-rose-600 border border-slate-200 rounded-lg p-4 shadow-2xs text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Resubmission / Correction Required Notice Banner */}
        {data?.submission_status === 'RESUBMISSION_REQUESTED' && (
          <div className="bg-amber-50/90 border-l-4 border-l-amber-500 border border-amber-200 rounded-lg p-5 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-950">
                    Action Required: Resubmission or Document Updates Requested
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/90 text-amber-900 uppercase tracking-wider border border-amber-300">
                    Needs Replacement
                  </span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed font-normal">
                  Your reviewer has requested updates or replacement documents for your onboarding submission. 
                  The flagged documents requiring replacement are highlighted with reviewer notes below. 
                  Please upload the required files and click <strong>Submit Onboarding Application</strong> to complete your update.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            QUESTION CARDS CONTAINER
            ========================================================================= */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {fields.map((field) => {
            const isUploaded = uploadedFiles[field.id];
            const isUploadingThis = uploadingFieldId === field.id;
            const isDeletingThis = deletingFieldId === field.id;
            const isActive = activeFieldId === field.id;
            const isFlagged = Boolean(
              isUploaded && (isUploaded.status === 'RESUBMISSION_REQUESTED' || isUploaded.status === 'REJECTED')
            );

            const isImg = isUploaded && (
              isUploaded.mime_type?.startsWith('image/') ||
              /\.(png|jpe?g|webp|gif)$/i.test(isUploaded.filename)
            );
            const isPdf = isUploaded && (
              isUploaded.mime_type === 'application/pdf' ||
              /\.pdf$/i.test(isUploaded.filename)
            );
            const viewUrl = isUploaded ? getFullUrl(isUploaded.view_url) : '';
            const downloadUrl = isUploaded ? getFullUrl(isUploaded.download_url) : '';

            return (
              <div
                key={field.id}
                onClick={() => setActiveFieldId(field.id)}
                className={`bg-white rounded-lg p-6 shadow-2xs border transition-all ${
                  isFlagged
                    ? 'border-amber-400 bg-amber-50/15 border-l-[6px] border-l-amber-500 ring-2 ring-amber-400/20'
                    : isActive
                    ? 'border-slate-300 border-l-[6px] border-l-[#673ab7]'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Question Title & Expiry Tag */}
                <div className="flex items-start justify-between gap-3 mb-1">
                  <label className="text-base font-normal text-slate-900 leading-snug cursor-pointer">
                    <span>{field.label}</span>
                    {field.required && <span className="text-rose-600 ml-1 font-bold">*</span>}
                  </label>
                  {field.track_expiry && (
                    <span className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded shrink-0 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      <span>Expiry Required</span>
                    </span>
                  )}
                </div>

                {/* Subtitle / Helper guidance */}
                {field.help_text && (
                  <p className="text-xs text-slate-500 font-normal mb-3 leading-relaxed">
                    {field.help_text}
                  </p>
                )}

                {/* =============================================================
                    FIELD INPUT RENDERING (Google Forms Style)
                    ============================================================= */}
                {field.field_type === 'file_upload' ? (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-slate-500 font-normal">
                      Upload supported file: {field.allowed_file_types?.map((t) => t.split('/')[1]?.toUpperCase()).join(', ') || 'PDF, JPG, PNG'} (Max {field.max_file_size_mb || 10} MB)
                    </p>

                    {isUploaded ? (
                      <div className="space-y-3">
                        {/* Reviewer Notice Box for Flagged Document */}
                        {isFlagged && (
                          <div className="p-3.5 rounded-lg bg-amber-50/90 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-amber-950">
                                  {isUploaded.status === 'REJECTED' ? 'Document Rejected' : 'Resubmission Requested'}
                                </span>
                                {isUploaded.has_replacement ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Replacement Attached (Pending Submit)</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">
                                    Reviewer Feedback
                                  </span>
                                )}
                              </div>
                              {isUploaded.review_reason ? (
                                <p className="text-amber-900 leading-relaxed font-normal">
                                  <span className="font-medium text-amber-950">Reason provided:</span> &ldquo;{isUploaded.review_reason}&rdquo;
                                </p>
                              ) : (
                                <p className="text-amber-800">
                                  Please upload an updated or corrected replacement file for review.
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Approved Badge notice */}
                        {isUploaded.status === 'APPROVED' && (
                          <div className="p-3 rounded-lg bg-emerald-50/90 border border-emerald-300 text-xs text-emerald-950 flex items-center gap-2.5 shadow-2xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-medium">
                              This document has already been verified and approved by your compliance reviewer. No changes are required.
                            </span>
                          </div>
                        )}

                        {/* Image Thumbnail Preview directly on question card */}
                        {isImg && viewUrl && (
                          <div className="relative group w-36 h-36 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shadow-2xs">
                            <img
                              src={viewUrl}
                              alt={isUploaded.filename}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewModal({ url: viewUrl, downloadUrl, filename: isUploaded.filename, isPdf: false })}
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewModal({ url: viewUrl, downloadUrl, filename: isUploaded.filename, isPdf: false })}
                              className="absolute bottom-1.5 right-1.5 p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-md text-xs flex items-center gap-1 transition-colors"
                              title="View full image"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Preview</span>
                            </button>
                          </div>
                        )}

                        {/* File Chip & Actions */}
                        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-800 max-w-full">
                          <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                          <span className="truncate max-w-[220px] font-medium text-slate-900">
                            {isUploaded.filename}
                          </span>
                          {isUploaded.status === 'REJECTED' ? (
                            <span className="text-[11px] text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-300">
                              {isUploaded.has_replacement ? 'Replacement Attached' : 'Rejected'}
                            </span>
                          ) : isUploaded.status === 'RESUBMISSION_REQUESTED' ? (
                            <span className="text-[11px] text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              {isUploaded.has_replacement ? 'Replacement Attached' : 'Needs Replacement'}
                            </span>
                          ) : isUploaded.status === 'APPROVED' ? (
                            <span className="text-[11px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>Approved</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                              Uploaded
                            </span>
                          )}

                          <div className="flex items-center gap-3 ml-auto">
                            {/* View / Preview button */}
                            {viewUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewModal({ url: viewUrl, downloadUrl, filename: isUploaded.filename, isPdf })}
                                className="text-xs font-semibold text-[#673ab7] hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isPdf ? 'View PDF' : 'View'}</span>
                              </button>
                            )}

                            {/* Replace Action */}
                            <label className={`text-xs font-semibold cursor-pointer flex items-center gap-1.5 ${
                              isFlagged
                                ? 'bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded shadow-2xs transition-colors'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>{isFlagged ? 'Upload Replacement' : 'Replace'}</span>
                              <input
                                type="file"
                                accept={field.allowed_file_types?.join(',') || 'application/pdf,image/png,image/jpeg'}
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleFileUpload(field, e.target.files[0]);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>

                            {/* Delete Multimedia Action */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFile(field.id)}
                              disabled={isDeletingThis}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Delete uploaded document"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>{isDeletingThis ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Certificate Expiration Date Picker */}
                        {field.track_expiry && (
                          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-amber-700" />
                              <span>Certificate Expiration Date <span className="text-rose-600">*</span>:</span>
                            </label>
                            <input
                              type="date"
                              required={field.required}
                              value={documentExpiries[field.id] || ''}
                              onChange={(e) =>
                                setDocumentExpiries({ ...documentExpiries, [field.id]: e.target.value })
                              }
                              className="border-0 border-b border-slate-300 focus:border-b-2 focus:border-[#673ab7] outline-hidden py-1 px-2 text-sm text-slate-900 bg-transparent transition-all"
                            />
                            {documentExpiries[field.id] && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = { ...documentExpiries };
                                  delete next[field.id];
                                  setDocumentExpiries(next);
                                }}
                                className="text-xs text-slate-400 hover:text-slate-600"
                                title="Clear date"
                              >
                                Clear date
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#f6f2fc] text-[#673ab7] border border-slate-300 hover:border-[#673ab7] rounded-md text-sm font-medium transition-colors shadow-2xs cursor-pointer">
                            <UploadCloud className="w-4 h-4 text-[#673ab7]" />
                            <span>{isUploadingThis ? 'Uploading...' : 'Add file'}</span>
                            <input
                              type="file"
                              accept={field.allowed_file_types?.join(',') || 'application/pdf,image/png,image/jpeg'}
                              disabled={isUploadingThis}
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileUpload(field, e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {isUploadingThis && (
                            <span className="text-xs text-slate-500 font-medium">Encrypting file...</span>
                          )}
                        </div>

                        {field.track_expiry && (
                          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-amber-700" />
                              <span>Certificate Expiration Date <span className="text-rose-600">*</span>:</span>
                            </label>
                            <input
                              type="date"
                              required={field.required}
                              value={documentExpiries[field.id] || ''}
                              onChange={(e) =>
                                setDocumentExpiries({ ...documentExpiries, [field.id]: e.target.value })
                              }
                              className="border-0 border-b border-slate-300 focus:border-b-2 focus:border-[#673ab7] outline-hidden py-1 px-2 text-sm text-slate-900 bg-transparent transition-all"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : field.field_type === 'dropdown' ? (() => {
                  const opts = (field.options && field.options.length > 0)
                    ? field.options
                    : (field.validation?.options && field.validation.options.length > 0)
                    ? field.validation.options
                    : [];
                  return (
                    <div className="pt-1 flex items-center gap-2">
                      <select
                        required={field.required}
                        value={formResponses[field.id] || ''}
                        onFocus={() => setActiveFieldId(field.id)}
                        onChange={(e) =>
                          setFormResponses({ ...formResponses, [field.id]: e.target.value })
                        }
                        className="min-w-[220px] max-w-full text-sm px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:border-2 focus:border-[#673ab7] font-normal"
                      >
                        <option value="">Choose</option>
                        {opts.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {formResponses[field.id] && (
                        <button
                          type="button"
                          onClick={() => setFormResponses({ ...formResponses, [field.id]: '' })}
                          className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                  );
                })() : field.field_type === 'long_text' ? (
                  <div className="pt-1 relative">
                    <textarea
                      required={field.required}
                      rows={2}
                      value={formResponses[field.id] || ''}
                      onFocus={() => setActiveFieldId(field.id)}
                      onChange={(e) =>
                        setFormResponses({ ...formResponses, [field.id]: e.target.value })
                      }
                      placeholder="Your answer"
                      className="w-full border-0 border-b border-slate-300 focus:border-b-2 focus:border-[#673ab7] outline-hidden py-2 pr-7 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent transition-all resize-y min-h-[44px]"
                    />
                    {formResponses[field.id] && (
                      <button
                        type="button"
                        onClick={() => setFormResponses({ ...formResponses, [field.id]: '' })}
                        className="absolute right-1 top-2.5 text-slate-400 hover:text-slate-600"
                        title="Clear answer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : field.field_type === 'checkbox' ? (() => {
                  const opts = (field.options && field.options.length > 0)
                    ? field.options
                    : (field.validation?.options && field.validation.options.length > 0)
                    ? field.validation.options
                    : [];

                  if (opts.length > 1) {
                    // Multi-select checklist
                    const selected: string[] = Array.isArray(formResponses[field.id])
                      ? formResponses[field.id]
                      : formResponses[field.id]
                      ? [String(formResponses[field.id])]
                      : [];

                    const toggleOption = (opt: string) => {
                      const next = selected.includes(opt)
                        ? selected.filter((s) => s !== opt)
                        : [...selected, opt];
                      setFormResponses({ ...formResponses, [field.id]: next });
                    };

                    return (
                      <div className="pt-2 space-y-2.5">
                        {opts.map((opt, i) => {
                          const isChecked = selected.includes(opt);
                          return (
                            <label
                              key={i}
                              className="flex items-start gap-3 cursor-pointer text-sm text-slate-800 font-normal hover:text-slate-950 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onFocus={() => setActiveFieldId(field.id)}
                                onChange={() => toggleOption(opt)}
                                className="w-4 h-4 mt-0.5 rounded text-[#673ab7] focus:ring-[#673ab7] border-slate-400 cursor-pointer"
                              />
                              <span className="leading-snug">{opt}</span>
                            </label>
                          );
                        })}
                        {selected.length > 0 && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setFormResponses({ ...formResponses, [field.id]: [] })}
                              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                            >
                              Clear selection
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Single agreement checkbox
                  const labelText = opts.length === 1 ? opts[0] : (field.help_text || 'I confirm and agree to this requirement');
                  const isChecked = Boolean(formResponses[field.id]);

                  return (
                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-800 font-normal hover:text-slate-950 transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onFocus={() => setActiveFieldId(field.id)}
                          onChange={(e) =>
                            setFormResponses({ ...formResponses, [field.id]: e.target.checked })
                          }
                          className="w-4 h-4 mt-0.5 rounded text-[#673ab7] focus:ring-[#673ab7] border-slate-400 cursor-pointer"
                        />
                        <span className="leading-snug">{labelText}</span>
                      </label>
                    </div>
                  );
                })() : field.field_type === 'date' ? (
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="date"
                      required={field.required}
                      value={formResponses[field.id] || ''}
                      onFocus={() => setActiveFieldId(field.id)}
                      onChange={(e) =>
                        setFormResponses({ ...formResponses, [field.id]: e.target.value })
                      }
                      className="border-0 border-b border-slate-300 focus:border-b-2 focus:border-[#673ab7] outline-hidden py-2 text-sm text-slate-900 bg-transparent transition-all"
                    />
                    {formResponses[field.id] && (
                      <button
                        type="button"
                        onClick={() => setFormResponses({ ...formResponses, [field.id]: '' })}
                        className="text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        Clear date
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="pt-1 relative w-full sm:w-3/5">
                    <input
                      type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
                      required={field.required}
                      value={formResponses[field.id] || ''}
                      onFocus={() => setActiveFieldId(field.id)}
                      onChange={(e) =>
                        setFormResponses({ ...formResponses, [field.id]: e.target.value })
                      }
                      placeholder="Your answer"
                      className="w-full border-0 border-b border-slate-300 focus:border-b-2 focus:border-[#673ab7] outline-hidden py-2 pr-7 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent transition-all"
                    />
                    {formResponses[field.id] && (
                      <button
                        type="button"
                        onClick={() => setFormResponses({ ...formResponses, [field.id]: '' })}
                        className="absolute right-1 top-2.5 text-slate-400 hover:text-slate-600"
                        title="Clear field"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {errorMsg && (
            <div className="bg-white border-l-4 border-l-rose-600 border border-slate-200 rounded-lg p-4 shadow-2xs text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* =============================================================
              SUBMIT & CLEAR FORM ACTION BAR
              ============================================================= */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isSubmitting || uploadingFieldId !== null}
                className="px-6 py-2.5 bg-[#673ab7] hover:bg-[#5a2ea6] text-white text-sm font-medium rounded shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Submitting...'
                    : uploadingFieldId !== null
                    ? 'Uploading File...'
                    : 'Submit'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleClearForm}
                className="text-sm font-medium text-[#673ab7] hover:bg-[#f6f2fc] px-3 py-2 rounded transition-colors cursor-pointer"
              >
                Clear form
              </button>
            </div>

            <span className="text-xs text-slate-500 font-normal hidden sm:inline">
              Never submit passwords through this form.
            </span>
          </div>
        </form>

        {/* =============================================================
            GOOGLE FORMS FOOTER & SECURITY WATERMARK
            ============================================================= */}
        <div className="text-center pt-8 pb-12 space-y-1 text-xs text-slate-500">
          <div className="flex items-center justify-center gap-1.5 font-medium text-slate-600">
            <ShieldCheck className="w-4 h-4 text-[#673ab7]" />
            <span>Secured by FormGate Enterprise Onboarding</span>
          </div>
          <p className="text-[11px] text-slate-400">
            This form is encrypted with 256-bit TLS security and compliant with enterprise vendor verification policies.
          </p>
        </div>
      </div>

      {/* Media Preview Lightbox Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="font-semibold text-slate-900 text-sm truncate max-w-md">{previewModal.filename}</span>
              <div className="flex items-center gap-2">
                {previewModal.downloadUrl && (
                  <a
                    href={previewModal.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold flex items-center gap-1 border border-slate-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
                <button
                  onClick={() => setPreviewModal(null)}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-100 flex-1 overflow-auto flex items-center justify-center min-h-[400px]">
              {previewModal.isPdf ? (
                <iframe src={previewModal.url} className="w-full h-[75vh] rounded-lg border border-slate-300 bg-white" title={previewModal.filename} />
              ) : (
                <img src={previewModal.url} alt={previewModal.filename} className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-sm" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendorOnboardingPortal() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-full flex-1 shrink-0 bg-[#f0ebf8] flex items-center justify-center text-slate-700">
          <RefreshCw className="w-8 h-8 animate-spin text-[#673ab7] mb-3" />
        </div>
      }
    >
      <VendorOnboardingPortalContent />
    </Suspense>
  );
}
