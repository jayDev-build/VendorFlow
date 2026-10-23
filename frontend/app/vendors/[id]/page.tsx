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
  ExternalLink
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentReviewModal } from '@/components/DocumentReviewModal';
import { api } from '@/lib/api';
import { VendorDetail, DocumentItem } from '@/lib/types';

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

  // Active document for review modal
  const [reviewDoc, setReviewDoc] = useState<DocumentItem | null>(null);

  const fetchVendor = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await api.getVendor(vendorId);
      setVendor(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load vendor details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendor();
  }, [vendorId]);

  const handleRequestMissing = async () => {
    try {
      setActionLoading(true);
      setErrorMsg('');
      await api.requestMissingDocuments(vendorId);
      setSuccessMsg('Notification dispatched to vendor requesting documentation.');
      fetchVendor();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch request');
    } finally {
      setActionLoading(false);
    }
  };

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
              onClick={handleRequestMissing}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request Documents</span>
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
            <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
              {vendor.documents.filter(d => d.status === 'APPROVED').length} / {vendor.documents.length} Verified
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {vendor.documents.length === 0 ? (
              <div className="py-12 text-center text-slate-700 text-xs font-semibold">
                <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <span className="font-bold text-slate-900">No documents received yet</span>
                <p className="text-[11px] text-slate-600 font-medium mt-1">Vendor has not uploaded files for this onboarding cycle.</p>
              </div>
            ) : (
              vendor.documents.map((doc) => {
                const downloadFullUrl = doc.download_url
                  ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${doc.download_url}`
                  : '#';

                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();

                return (
                  <div key={doc.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        PDF
                      </div>
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
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>Download</span>
                      </a>
                      <button
                        onClick={() => setReviewDoc(doc)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Onboarding Form Responses (If completed) */}
        {vendor.onboarding_data?.form_responses && Object.keys(vendor.onboarding_data.form_responses).length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Vendor Form Submission Answers</span>
              </h2>
              {vendor.onboarding_data.submitted_at && (
                <span className="text-xs text-slate-500 font-medium">
                  Submitted {new Date(vendor.onboarding_data.submitted_at).toLocaleString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(vendor.onboarding_data.form_responses).map(([key, value]) => {
                const schemaField = vendor.active_workflow?.schema_definition?.fields?.find(
                  (f: any) => f.id === key
                );
                const displayLabel = schemaField?.label || key.replace('field_', '').replace(/_/g, ' ');
                return (
                  <div key={key} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                      {displayLabel}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 mt-1 break-words">
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '—')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
