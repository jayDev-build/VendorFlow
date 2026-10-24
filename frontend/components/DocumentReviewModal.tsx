'use client';

import React, { useState } from 'react';
import {
  X,
  FileCheck2,
  FileX2,
  RotateCcw,
  Download,
  AlertTriangle,
  Clock,
  User,
  ExternalLink,
  ShieldAlert,
  FileText,
  Trash2
} from 'lucide-react';
import { DocumentDetail, DocumentItem } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { api } from '@/lib/api';

interface DocumentReviewModalProps {
  document: DocumentDetail | DocumentItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const DocumentReviewModal: React.FC<DocumentReviewModalProps> = ({
  document,
  onClose,
  onUpdated
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [resubmitReason, setResubmitReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showResubmitBox, setShowResubmitBox] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!document) return null;

  const handleApprove = async () => {
    try {
      setLoadingAction('approve');
      setErrorMsg('');
      await api.approveDocument(document.id);
      onUpdated();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Approval failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setErrorMsg('Rejection reason is required.');
      return;
    }
    try {
      setLoadingAction('reject');
      setErrorMsg('');
      await api.rejectDocument(document.id, rejectReason.trim());
      onUpdated();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Rejection failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRequestResubmission = async () => {
    if (!resubmitReason.trim()) {
      setErrorMsg('Resubmission explanation is required.');
      return;
    }
    try {
      setLoadingAction('resubmit');
      setErrorMsg('');
      await api.requestResubmission(document.id, resubmitReason.trim());
      onUpdated();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Resubmission request failed');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete document "${document.original_filename}"?`)) {
      return;
    }
    try {
      setLoadingAction('delete');
      setErrorMsg('');
      await api.deleteDocument(document.id);
      onUpdated();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to delete document');
    } finally {
      setLoadingAction(null);
    }
  };

  const downloadFullUrl = document.download_url
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${document.download_url}`
    : '#';

  const reviews = (document as DocumentDetail).reviews || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{document.document_type}</h2>
              <StatusBadge status={document.status} size="sm" />
            </div>
            <p className="text-xs text-slate-700 font-medium mt-0.5 truncate max-w-md">
              File: {document.original_filename} ({(document.file_size / 1024).toFixed(1)} KB)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <div className="text-[11px] font-semibold text-slate-700 uppercase">MIME Type</div>
              <div className="text-xs font-bold text-slate-900 truncate">{document.mime_type}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-700 uppercase">Submitted At</div>
              <div className="text-xs font-bold text-slate-900">
                {document.submitted_at ? new Date(document.submitted_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-700 uppercase">Expiry Date</div>
              <div className="text-xs font-bold text-slate-900">
                {document.expiry_date ? (
                  <span className={new Date(document.expiry_date) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-900'}>
                    {new Date(document.expiry_date).toLocaleDateString()}
                  </span>
                ) : (
                  'No expiry set'
                )}
              </div>
            </div>
          </div>

          {/* Document Preview Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5 font-bold text-slate-900">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Document Content Preview</span>
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={downloadFullUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </a>
                <a
                  href={`${downloadFullUrl}&inline=false`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 hover:underline font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>

            {/* Embedded Viewer: Image or PDF */}
            {document.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(document.original_filename) ? (
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
                <img
                  src={downloadFullUrl}
                  alt={document.original_filename}
                  className="max-h-80 w-auto object-contain rounded-lg shadow-2xs"
                />
              </div>
            ) : document.mime_type === 'application/pdf' || /\.pdf$/i.test(document.original_filename) ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                <iframe
                  src={downloadFullUrl}
                  className="w-full h-80 rounded-xl border-0 bg-white"
                  title={document.original_filename}
                />
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    DOC
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-xs truncate max-w-xs">{document.original_filename}</div>
                    <div className="text-[11px] text-slate-700 font-medium">Private encrypted file</div>
                  </div>
                </div>
                <a
                  href={downloadFullUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </a>
              </div>
            )}
          </div>

          {/* Rejection input box */}
          {showRejectBox && (
            <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-900">
                <span>Reason for Rejection (Required)</span>
                <button
                  type="button"
                  onClick={() => setShowRejectBox(false)}
                  className="text-slate-600 hover:text-slate-900 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this document was rejected (e.g. illegible signature, invalid tax number)..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white text-slate-900 placeholder-slate-500 font-medium"
              />
              <button
                onClick={handleReject}
                disabled={loadingAction === 'reject'}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                {loadingAction === 'reject' ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          )}

          {/* Resubmission input box */}
          {showResubmitBox && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                <span>Instructions for Resubmission (Required)</span>
                <button
                  type="button"
                  onClick={() => setShowResubmitBox(false)}
                  className="text-slate-600 hover:text-slate-900 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={resubmitReason}
                onChange={(e) => setResubmitReason(e.target.value)}
                placeholder="Specify what needs to be corrected by the vendor (e.g. please upload full 2-page certificate)..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-amber-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white text-slate-900 placeholder-slate-500 font-medium"
              />
              <button
                onClick={handleRequestResubmission}
                disabled={loadingAction === 'resubmit'}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                {loadingAction === 'resubmit' ? 'Sending Request...' : 'Send Resubmission Request'}
              </button>
            </div>
          )}

          {/* Audit & Review History */}
          {reviews.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Review History</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {reviews.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-600" />
                        {r.reviewer_name || 'Administrator'}
                      </span>
                      <span className="text-[10px] text-slate-600 font-medium">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                      <span>Changed status from</span>
                      <span className="font-mono">{r.previous_status}</span>
                      <span>→</span>
                      <span className="font-mono font-bold text-slate-900">{r.new_status}</span>
                    </div>
                    {r.reason && (
                      <p className="text-[11px] text-slate-900 italic mt-0.5 bg-white p-1.5 rounded border border-slate-200 font-medium">
                        &quot;{r.reason}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!showRejectBox && (
              <button
                type="button"
                onClick={() => {
                  setShowRejectBox(true);
                  setShowResubmitBox(false);
                }}
                className="px-3 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Reject
              </button>
            )}
            {!showResubmitBox && (
              <button
                type="button"
                onClick={() => {
                  setShowResubmitBox(true);
                  setShowRejectBox(false);
                }}
                className="px-3 py-2 text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Request Resubmission
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={loadingAction === 'delete'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Delete document"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>{loadingAction === 'delete' ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={loadingAction === 'approve' || document.status === 'APPROVED'}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shadow-xs"
            >
              {loadingAction === 'approve' ? 'Approving...' : document.status === 'APPROVED' ? 'Approved' : 'Approve Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
