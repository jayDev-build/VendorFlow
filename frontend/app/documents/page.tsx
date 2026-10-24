'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  Calendar,
  Building2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Upload
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentReviewModal } from '@/components/DocumentReviewModal';
import { UploadDocumentModal } from '@/components/UploadDocumentModal';
import { api } from '@/lib/api';
import { DocumentItem } from '@/lib/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const handleDeleteDocument = async (docId: string, docName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete document "${docName}"?`)) {
      return;
    }
    try {
      setDeletingDocId(docId);
      await api.deleteDocument(docId);
      fetchDocs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  const fetchDocs = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await api.listDocuments(statusFilter, search);
      setDocuments(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocs();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="Document Review Queue"
        subtitle="Manage compliance verifications, examine attachments, and execute server-side approvals"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDocs}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowUploadDocModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer active:scale-[0.98]"
              title="Upload document directly on behalf of a vendor"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Document</span>
            </button>
          </div>
        }
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Filters & Status Tabs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {['ALL', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
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
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search type or vendor..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
            />
          </form>
        </div>

        {/* Documents Table */}
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
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-700 font-semibold">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Loading compliance documents...</span>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-700">
                      <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <div className="font-bold text-slate-900 text-sm">No documents found</div>
                      <p className="text-xs text-slate-600 font-medium mt-1">No uploaded documents match the current filter.</p>
                      <button
                        type="button"
                        onClick={() => setShowUploadDocModal(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Document</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc: any) => {
                    const downloadFullUrl = doc.download_url
                      ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${doc.download_url}`
                      : '#';

                    const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();

                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {doc.document_type}
                          </div>
                          <div className="text-[11px] text-slate-700 font-medium truncate max-w-xs">{doc.original_filename}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/vendors/${doc.vendor_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                          >
                            {doc.vendor_name || 'Vendor'}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={doc.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 text-[11px] font-mono font-medium">
                          {(doc.file_size / 1024).toFixed(0)} KB • {doc.mime_type?.split('/')[1]?.toUpperCase()}
                        </td>
                        <td className="py-3.5 px-4">
                          {doc.expiry_date ? (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                              isExpired ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-slate-100 text-slate-900 border-slate-300'
                            }`}>
                              {new Date(doc.expiry_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-bold text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium text-[11px]">
                          {doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={downloadFullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Download document"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => setSelectedDoc(doc)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteDocument(doc.id, doc.original_filename, e)}
                              disabled={deletingDocId === doc.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                              title={`Delete ${doc.original_filename}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Review Modal */}
      {selectedDoc && (
        <DocumentReviewModal
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onUpdated={fetchDocs}
        />
      )}

      {/* Upload Document Modal */}
      {showUploadDocModal && (
        <UploadDocumentModal
          onClose={() => setShowUploadDocModal(false)}
          onSuccess={() => fetchDocs()}
        />
      )}
    </div>
  );
}
