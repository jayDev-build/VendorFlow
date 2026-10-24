'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Table as TableIcon,
  Eye,
  FileText,
  Mail,
  Building2,
  Send,
  Calendar,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentReviewModal } from '@/components/DocumentReviewModal';
import { InvitationModal } from '@/components/InvitationModal';
import { api } from '@/lib/api';
import {
  WorkflowResponsesData,
  WorkflowResponseSubmission,
  DocumentItem
} from '@/lib/types';

function WorkflowResponsesContent() {
  const router = useRouter();
  const params = useParams();
  const workflowId = (params?.id as string) || '';

  const [data, setData] = useState<WorkflowResponsesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'table' | 'individual'>('table');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'RESUBMISSION_REQUESTED' | 'REJECTED'>('ALL');

  // Individual Inspector State
  const [currentResponseIndex, setCurrentResponseIndex] = useState(0);

  // Review & Invite Modals
  const [reviewingDoc, setReviewingDoc] = useState<DocumentItem | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const fetchResponses = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.getWorkflowResponses(workflowId);
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load workflow responses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workflowId) {
      fetchResponses();
    }
  }, [workflowId]);

  // Filtered responses for table & inspector
  const filteredResponses = useMemo(() => {
    if (!data?.responses) return [];
    return data.responses.filter((r) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'SUBMITTED') {
          if (r.status !== 'SUBMITTED' && r.status !== 'UNDER_REVIEW') return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const vendorMatch =
          r.vendor_name.toLowerCase().includes(q) ||
          r.vendor_email.toLowerCase().includes(q) ||
          r.vendor_category.toLowerCase().includes(q);
        const responseMatch = Object.values(r.form_responses || {}).some((val) =>
          String(val).toLowerCase().includes(q)
        );
        const docMatch = r.documents.some((d) =>
          d.original_filename.toLowerCase().includes(q) || d.document_type.toLowerCase().includes(q)
        );
        return vendorMatch || responseMatch || docMatch;
      }
      return true;
    });
  }, [data?.responses, statusFilter, search]);

  // Active individual response
  const currentResponse = filteredResponses[currentResponseIndex] || filteredResponses[0] || null;

  // Export to CSV
  const handleExportCSV = () => {
    if (!data?.workflow || filteredResponses.length === 0) return;

    const fields = data.workflow.schema_definition?.fields || [];
    const nonDocFields = fields.filter((f) => f.field_type !== 'file_upload');

    // Headers
    const headers = [
      'Submission ID',
      'Vendor Name',
      'Contact Email',
      'Vendor Category',
      'Status',
      'Submitted At',
      ...nonDocFields.map((f) => `"${f.label.replace(/"/g, '""')}"`),
      'Uploaded Documents'
    ];

    // Rows
    const rows = filteredResponses.map((r) => {
      const fieldAnswers = nonDocFields.map((f) => {
        const val = r.form_responses[f.id];
        if (val === undefined || val === null) return '""';
        if (Array.isArray(val)) return `"${val.join('; ').replace(/"/g, '""')}"`;
        if (typeof val === 'boolean') return val ? '"Yes"' : '"No"';
        return `"${String(val).replace(/"/g, '""')}"`;
      });

      const docsSummary = r.documents
        .map((d) => `${d.document_type} (${d.original_filename} - ${d.status})`)
        .join('; ');

      return [
        `"${r.id}"`,
        `"${r.vendor_name.replace(/"/g, '""')}"`,
        `"${r.vendor_email.replace(/"/g, '""')}"`,
        `"${r.vendor_category.replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ''}"`,
        ...fieldAnswers,
        `"${docsSummary.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const sanitizedName = data.workflow.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `${sanitizedName}_responses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const schemaFields = data?.workflow?.schema_definition?.fields || [];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title={data ? `${data.workflow.name} — Responses` : 'Form Responses'}
        subtitle={data ? `Inspect and review all vendor submissions for ${data.workflow.vendor_category} onboarding` : 'Workflow response registry'}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/workflows"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Workflows</span>
            </Link>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredResponses.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Download spreadsheet CSV of filtered responses"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Invite Vendor</span>
            </button>
          </div>
        }
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchResponses} className="underline font-semibold cursor-pointer">Retry</button>
          </div>
        )}

        {/* Workflow Summary Header & Stat Badges */}
        {data && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {data.workflow.vendor_category}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                    v{data.workflow.current_version_number}
                  </span>
                  <StatusBadge status={data.workflow.status} size="sm" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
                  {data.workflow.name}
                </h1>
                {data.workflow.description && (
                  <p className="text-xs text-slate-700 font-medium mt-0.5 max-w-2xl">
                    {data.workflow.description}
                  </p>
                )}
              </div>

              {/* View Switcher: Spreadsheet Table vs Individual Inspector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'table'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Spreadsheet Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('individual')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'individual'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Individual Inspector</span>
                  {data.stats.total_responses > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                      {data.stats.total_responses}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Metric Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div
                onClick={() => setStatusFilter('ALL')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300'
                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/70'
                }`}
              >
                <div className="text-[11px] font-semibold text-slate-700">Total Responses</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5">{data.stats.total_responses}</div>
              </div>

              <div
                onClick={() => setStatusFilter('SUBMITTED')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  statusFilter === 'SUBMITTED'
                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/70'
                }`}
              >
                <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Pending Review</span>
                </div>
                <div className="text-xl font-bold text-amber-900 mt-0.5">{data.stats.pending_review}</div>
              </div>

              <div
                onClick={() => setStatusFilter('APPROVED')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  statusFilter === 'APPROVED'
                    ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/70'
                }`}
              >
                <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Approved</span>
                </div>
                <div className="text-xl font-bold text-emerald-900 mt-0.5">{data.stats.approved}</div>
              </div>

              <div
                onClick={() => setStatusFilter('RESUBMISSION_REQUESTED')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  statusFilter === 'RESUBMISSION_REQUESTED'
                    ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/70'
                }`}
              >
                <div className="text-[11px] font-semibold text-rose-800 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-rose-600" />
                  <span>Resubmission / Flagged</span>
                </div>
                <div className="text-xl font-bold text-rose-900 mt-0.5">{data.stats.resubmission_requested}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Spreadsheet Table View */}
        {activeTab === 'table' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-4">
            {/* Search & Filter Bar */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by vendor, email, or form answer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-indigo-500"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>Status:</span>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-indigo-500"
                >
                  <option value="ALL">All Statuses ({data?.stats?.total_responses || 0})</option>
                  <option value="SUBMITTED">Pending Review ({data?.stats?.pending_review || 0})</option>
                  <option value="APPROVED">Approved ({data?.stats?.approved || 0})</option>
                  <option value="RESUBMISSION_REQUESTED">Resubmission Needed ({data?.stats?.resubmission_requested || 0})</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <div className="text-xs text-slate-700 font-semibold pl-2">
                  Showing <strong className="text-slate-900">{filteredResponses.length}</strong> responses
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto min-h-[300px]">
              {loading ? (
                <div className="py-20 text-center text-slate-700 font-semibold text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Loading responses...</span>
                </div>
              ) : filteredResponses.length === 0 ? (
                <div className="py-20 text-center text-slate-600 text-xs font-medium space-y-2">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-800 text-sm">No responses found</p>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    {search || statusFilter !== 'ALL'
                      ? 'No submissions match your active filter criteria. Try resetting your search.'
                      : 'No vendors have submitted responses for this workflow yet. Invite vendors to start collecting responses.'}
                  </p>
                  {(search || statusFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('ALL');
                      }}
                      className="mt-2 text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 sticky left-0 bg-slate-100 z-10 min-w-[200px]">
                        Vendor Information
                      </th>
                      <th className="py-3 px-3 min-w-[120px]">Status</th>
                      <th className="py-3 px-3 min-w-[140px]">Submitted At</th>

                      {/* Dynamic Columns from Workflow Schema */}
                      {schemaFields.map((field) => (
                        <th key={field.id} className="py-3 px-4 min-w-[170px] whitespace-nowrap">
                          {field.label}
                        </th>
                      ))}

                      <th className="py-3 px-3 min-w-[120px]">Documents</th>
                      <th className="py-3 px-4 text-right sticky right-0 bg-slate-100 z-10 min-w-[120px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {filteredResponses.map((resp, rIdx) => {
                      return (
                        <tr
                          key={resp.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => {
                            setCurrentResponseIndex(rIdx);
                            setActiveTab('individual');
                          }}
                        >
                          {/* Vendor info sticky */}
                          <td className="py-3 px-4 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 border-r border-slate-100">
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {resp.vendor_name}
                            </div>
                            <div className="text-[11px] text-slate-600 font-mono mt-0.5 truncate max-w-[180px]">
                              {resp.vendor_email}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            <StatusBadge status={resp.status} size="sm" />
                          </td>

                          {/* Submitted date */}
                          <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                            {resp.submitted_at
                              ? new Date(resp.submitted_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : '—'}
                          </td>

                          {/* Dynamic Schema Fields */}
                          {schemaFields.map((field) => {
                            const val = resp.form_responses?.[field.id];

                            if (field.field_type === 'file_upload') {
                              const doc = resp.documents?.find((d) => d.field_id === field.id);
                              return (
                                <td key={field.id} className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                  {doc ? (
                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-md text-[11px] max-w-[180px]">
                                      <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                      <span className="truncate font-medium text-slate-800" title={doc.original_filename}>
                                        {doc.original_filename}
                                      </span>
                                      {doc.download_url && (
                                        <a
                                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${doc.download_url}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-indigo-600 hover:text-indigo-800 shrink-0"
                                          title="View document"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">No file</span>
                                  )}
                                </td>
                              );
                            }

                            return (
                              <td key={field.id} className="py-3 px-4 max-w-[220px]">
                                <div className="truncate text-slate-800 font-medium" title={String(val || '')}>
                                  {val === undefined || val === null
                                    ? '—'
                                    : Array.isArray(val)
                                    ? val.join(', ')
                                    : typeof val === 'boolean'
                                    ? val ? 'Yes' : 'No'
                                    : String(val)}
                                </div>
                              </td>
                            );
                          })}

                          {/* Documents Count */}
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {resp.documents?.length || 0} files
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right sticky right-0 bg-white group-hover:bg-slate-50/80 z-10 border-l border-slate-100" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentResponseIndex(rIdx);
                                setActiveTab('individual');
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Individual Response Inspector (Google Forms style) */}
        {activeTab === 'individual' && (
          <div className="space-y-6">
            {filteredResponses.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                <UserCheck className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No responses to inspect</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  There are no responses matching your active filter criteria.
                </p>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                >
                  Reset filters
                </button>
              </div>
            ) : currentResponse ? (
              <div className="space-y-6">
                {/* Stepper Navigation Header */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentResponseIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentResponseIndex === 0}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Previous Response"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">Response</span>
                      <select
                        value={currentResponseIndex}
                        onChange={(e) => setCurrentResponseIndex(Number(e.target.value))}
                        className="text-xs font-bold px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-indigo-500 cursor-pointer"
                      >
                        {filteredResponses.map((r, idx) => (
                          <option key={r.id} value={idx}>
                            {idx + 1} of {filteredResponses.length} — {r.vendor_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentResponseIndex((prev) => Math.min(filteredResponses.length - 1, prev + 1))}
                      disabled={currentResponseIndex === filteredResponses.length - 1}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Next Response"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/vendors/${currentResponse.vendor_id}`}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 hover:underline"
                    >
                      <span>Open Full Vendor Profile</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Vendor Overview Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-lg flex items-center justify-center shrink-0">
                      {currentResponse.vendor_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{currentResponse.vendor_name}</h2>
                        <StatusBadge status={currentResponse.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 font-medium mt-1">
                        <span className="flex items-center gap-1 font-mono text-slate-800">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {currentResponse.vendor_email}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-800 text-[11px]">
                          {currentResponse.vendor_category}
                        </span>
                        {currentResponse.submitted_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              Submitted: {new Date(currentResponse.submitted_at).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Questions & Answers Card (Google Forms Style) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-200 bg-slate-50/70">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Form Questions & Submitted Answers</span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Vendor responses for each question configured in this onboarding template
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100 p-6 space-y-4">
                    {schemaFields
                      .filter((f) => f.field_type !== 'file_upload')
                      .map((field) => {
                        const answer = currentResponse.form_responses[field.id];
                        return (
                          <div key={field.id} className="pt-4 first:pt-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span>{field.label}</span>
                                {field.required && (
                                  <span className="text-rose-500 font-bold text-xs" title="Required field">*</span>
                                )}
                              </label>
                              <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {field.field_type}
                              </span>
                            </div>

                            {field.help_text && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{field.help_text}</p>
                            )}

                            <div className="mt-2 p-3 bg-slate-50/90 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-900 break-words">
                              {answer === undefined || answer === null || answer === '' ? (
                                <span className="text-slate-400 italic">No answer provided</span>
                              ) : Array.isArray(answer) ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {answer.map((item, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-md border border-indigo-200 text-xs font-medium"
                                    >
                                      {String(item)}
                                    </span>
                                  ))}
                                </div>
                              ) : typeof answer === 'boolean' ? (
                                <span>{answer ? 'Yes' : 'No'}</span>
                              ) : (
                                <span>{String(answer)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Uploaded Documents & Compliance Verification Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        <span>Uploaded Documents & Compliance Verification</span>
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Inspect submitted files, preview certificates, and execute verification approvals
                      </p>
                    </div>

                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                      {currentResponse.documents?.filter((d) => d.status === 'APPROVED').length || 0} /{' '}
                      {currentResponse.documents?.length || 0} Verified
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {(!currentResponse.documents || currentResponse.documents.length === 0) ? (
                      <div className="p-8 text-center text-xs text-slate-500 italic">
                        No files uploaded with this submission.
                      </div>
                    ) : (
                      currentResponse.documents.map((doc) => {
                        const downloadUrl = doc.download_url
                          ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${doc.download_url}`
                          : '#';
                        const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();

                        return (
                          <div
                            key={doc.id}
                            className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                {doc.mime_type?.includes('pdf') ? 'PDF' : 'DOC'}
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">{doc.document_type}</span>
                                  <StatusBadge status={doc.status} size="sm" />
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 font-medium">
                                  <span className="text-slate-800 truncate max-w-xs">{doc.original_filename}</span>
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

                                {doc.review_reason && (
                                  <div className="text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 mt-1 max-w-md">
                                    <strong>Flag reason:</strong> {doc.review_reason}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {downloadUrl !== '#' && (
                                <a
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 border border-slate-300 text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                                  <span>View</span>
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  // Convert to DocumentItem for review modal
                                  setReviewingDoc({
                                    id: doc.id,
                                    field_id: doc.field_id,
                                    document_type: doc.document_type,
                                    original_filename: doc.original_filename,
                                    file_size: doc.file_size,
                                    mime_type: doc.mime_type,
                                    expiry_date: doc.expiry_date,
                                    status: doc.status as any,
                                    submitted_at: doc.submitted_at || new Date().toISOString(),
                                    download_url: doc.download_url
                                  });
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Review Document</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {reviewingDoc && (
        <DocumentReviewModal
          document={reviewingDoc}
          onClose={() => setReviewingDoc(null)}
          onUpdated={() => {
            fetchResponses();
            setReviewingDoc(null);
          }}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && data && (
        <InvitationModal
          workflowId={data.workflow.id}
          workflowName={data.workflow.name}
          onClose={() => setShowInviteModal(false)}
          onSuccess={fetchResponses}
        />
      )}
    </div>
  );
}

export default function WorkflowResponsesPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-slate-700 font-semibold">Loading responses...</div>}>
      <WorkflowResponsesContent />
    </Suspense>
  );
}
