'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  FileX,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Sparkles,
  FileCheck,
  RefreshCw,
  Building2,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadDocumentModal } from '@/components/UploadDocumentModal';
import { InvitationModal } from '@/components/InvitationModal';
import { api } from '@/lib/api';
import { DashboardStats, VendorListItem, Workflow } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals & Actions
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [selectedVendorForUpload, setSelectedVendorForUpload] = useState<string | undefined>(undefined);
  const [activeWorkflowForInvite, setActiveWorkflowForInvite] = useState<{ id: string; name: string } | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const handleInviteClick = async () => {
    try {
      const wfList = await api.listWorkflows();
      const published = wfList.filter((w) => w.status === 'PUBLISHED');
      if (published.length === 0) {
        router.push('/workflows/new');
      } else if (published.length === 1) {
        setActiveWorkflowForInvite({ id: published[0].id, name: published[0].name });
      } else {
        setWorkflows(published);
        setShowWorkflowPicker(true);
      }
    } catch (err: any) {
      router.push('/workflows');
    }
  };

  const handleDeleteVendor = async (vendorId: string, vendorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete vendor "${vendorName}" and all associated compliance records?`)) {
      return;
    }

    try {
      setDeletingVendorId(vendorId);
      await api.deleteVendor(vendorId);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete vendor');
    } finally {
      setDeletingVendorId(null);
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete document "${docName}"?`)) {
      return;
    }

    try {
      setDeletingDocId(docId);
      await api.deleteDocument(docId);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [statsData, vendorsData] = await Promise.all([
        api.getDashboardStats(),
        api.listVendors(search, statusFilter, categoryFilter)
      ]);
      setStats(statsData);
      setVendors(vendorsData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load dashboard data');
      // If unauthorized, redirect to login
      if (err.message?.includes('401') || err.message?.includes('token') || err.message?.includes('Authentication')) {
        router.push('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const session = api.getCurrentSession();
    if (!session.token) {
      router.push('/auth/login');
      return;
    }
    fetchData();
  }, [statusFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="Compliance & Onboarding Overview"
        subtitle="Real-time vendor onboarding pipeline, document verifications, and expiry alerts"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh dashboard metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleInviteClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-lg transition-all border border-slate-300 shadow-2xs hover:shadow-xs cursor-pointer"
              title="Invite vendor to complete digital onboarding workflow"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-600" />
              <span>Invite Vendor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedVendorForUpload(undefined);
                setShowUploadDocModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-xs hover:shadow cursor-pointer active:scale-[0.98]"
              title="Upload document directly on behalf of a vendor"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Document</span>
            </button>
          </div>
        }
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={fetchData} className="font-semibold underline">Retry</button>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Total Vendors */}
          <div
            onClick={() => { setStatusFilter('ALL'); router.push('/vendors'); }}
            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 mb-2">
              <span className="text-xs font-semibold">Total Vendors</span>
              <Users className="w-4 h-4 text-slate-600 group-hover:text-slate-900" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats?.total_vendors ?? 0}
            </div>
            <div className="text-[11px] text-slate-600 font-medium mt-1">Registered suppliers</div>
          </div>

          {/* Approved Vendors */}
          <div
            onClick={() => { setStatusFilter('APPROVED'); router.push('/vendors?status=APPROVED'); }}
            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-emerald-800 mb-2">
              <span className="text-xs font-semibold">Approved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-950 tracking-tight">
              {stats?.approved_vendors ?? 0}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">Fully verified</div>
          </div>

          {/* Pending Approvals */}
          <div
            onClick={() => router.push('/documents?status=UNDER_REVIEW')}
            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-blue-800 mb-2">
              <span className="text-xs font-semibold">Pending Review</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-950 tracking-tight">
              {stats?.pending_approvals ?? 0}
            </div>
            <div className="text-[11px] text-blue-700 font-medium mt-1">Needs admin review</div>
          </div>

          {/* Incomplete Submissions */}
          <div
            onClick={() => { setStatusFilter('IN_PROGRESS'); router.push('/vendors?status=IN_PROGRESS'); }}
            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-sky-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-sky-800 mb-2">
              <span className="text-xs font-semibold">Incomplete</span>
              <AlertTriangle className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-sky-950 tracking-tight">
              {stats?.incomplete_submissions ?? 0}
            </div>
            <div className="text-[11px] text-sky-700 font-medium mt-1">Awaiting vendor files</div>
          </div>

          {/* Expiring in 30 Days */}
          <div
            onClick={() => router.push('/expiry')}
            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-amber-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-amber-800 mb-2">
              <span className="text-xs font-semibold">Expiring &lt;30d</span>
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-950 tracking-tight">
              {stats?.expiring_30_days ?? 0}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">Upcoming renewals</div>
          </div>

          {/* Expired Documents */}
          <div
            onClick={() => router.push('/expiry')}
            className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-rose-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-rose-800 mb-2">
              <span className="text-xs font-semibold">Expired</span>
              <FileX className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-950 tracking-tight">
              {stats?.expired_documents ?? 0}
            </div>
            <div className="text-[11px] text-rose-700 font-medium mt-1">Overdue certificates</div>
          </div>
        </div>

        {/* Main Grid: Pending Review Queue + Upcoming Expirations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Review Queue (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pending Document Review Queue</h2>
                <p className="text-xs text-slate-700 font-medium">Submissions requiring administrator verification</p>
              </div>
              <Link
                href="/documents"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 divide-y divide-slate-100 flex-1">
              {!stats?.pending_reviews?.length ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">All submissions are reviewed</p>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">No pending documents waiting in queue.</p>
                </div>
              ) : (
                stats.pending_reviews.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        DOC
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{item.document_type}</div>
                        <div className="text-[11px] text-slate-700 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-800">{item.vendor_name}</span>
                          <span>•</span>
                          <span className="font-medium">{new Date(item.submitted_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status} size="sm" />
                      <Link
                        href={`/documents?doc=${item.id}`}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                      >
                        Review
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteDocument(item.id, item.document_type, e)}
                        disabled={deletingDocId === item.id}
                        className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                        title={`Delete ${item.document_type}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Expirations Widget (1 Col) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Upcoming Expirations</h2>
                <p className="text-xs text-slate-700 font-medium">Perishable certificates</p>
              </div>
              <Link
                href="/expiry"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 divide-y divide-slate-100 flex-1">
              {!stats?.upcoming_expirations?.length ? (
                <div className="py-10 text-center">
                  <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">No imminent expirations</p>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">All monitored documents are valid.</p>
                </div>
              ) : (
                stats.upcoming_expirations.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div>
                      <div className="text-xs font-bold text-slate-900 truncate max-w-[160px]">{item.document_type}</div>
                      <div className="text-[11px] text-slate-700 font-medium truncate max-w-[160px]">{item.vendor_name}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold ${item.days_remaining <= 7 ? 'text-rose-600' : 'text-amber-600'}`}>
                        {item.days_remaining}d remaining
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium">
                        {new Date(item.expiry_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Vendor Activity Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* Header & Controls */}
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Vendor Activity & Compliance Directory</h2>
              <p className="text-xs text-slate-700 font-medium">Live database records of registered suppliers and submission progress</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendors..."
                  className="text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium w-48 sm:w-60 placeholder-slate-500"
                />
              </form>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="INVITED">Invited</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <Link
                href="/workflows/new"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Onboard Vendor</span>
              </Link>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Vendor Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Contact Email</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Documents</th>
                  <th className="py-3 px-4">Next Expiry</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-700 font-semibold">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Loading vendors from database...</span>
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-700">
                      <Building2 className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                      <div className="font-bold text-slate-900 text-sm">No vendors found</div>
                      <p className="text-xs text-slate-600 font-medium mt-1">Try clearing filters or create a new onboarding invitation.</p>
                    </td>
                  </tr>
                ) : (
                  vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/vendors/${vendor.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {vendor.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-semibold">{vendor.category}</td>
                      <td className="py-3 px-4 text-slate-800 font-mono text-[11px]">{vendor.contact_email}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={vendor.status} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">
                          {vendor.documents_approved_count} / {vendor.documents_count}
                        </span>
                        <span className="text-[11px] text-slate-700 font-medium ml-1">approved</span>
                      </td>
                      <td className="py-3 px-4">
                        {vendor.next_expiry ? (
                          <span className="font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            {new Date(vendor.next_expiry).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium text-[11px]">
                        {new Date(vendor.last_updated).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVendorForUpload(vendor.id);
                              setShowUploadDocModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                            title={`Upload compliance document for ${vendor.name}`}
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>Upload</span>
                          </button>
                          <Link
                            href={`/vendors/${vendor.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors shadow-2xs"
                          >
                            Details →
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteVendor(vendor.id, vendor.name, e)}
                            disabled={deletingVendorId === vendor.id}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title={`Delete ${vendor.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Upload Document Modal */}
      {showUploadDocModal && (
        <UploadDocumentModal
          initialVendorId={selectedVendorForUpload}
          onClose={() => {
            setShowUploadDocModal(false);
            setSelectedVendorForUpload(undefined);
          }}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Workflow Selection Modal (when multiple published workflows exist) */}
      {showWorkflowPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Select Onboarding Workflow</h3>
                <p className="text-[11px] text-slate-500 font-medium">Choose a published template to send to the vendor</p>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkflowPicker(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkflowForInvite({ id: wf.id, name: wf.name });
                    setShowWorkflowPicker(false);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-900">{wf.name}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                    <span>{wf.vendor_category}</span>
                    <span>•</span>
                    <span>v{wf.current_version_number}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vendor Invitation Modal */}
      {activeWorkflowForInvite && (
        <InvitationModal
          workflowId={activeWorkflowForInvite.id}
          workflowName={activeWorkflowForInvite.name}
          onClose={() => setActiveWorkflowForInvite(null)}
          onSuccess={() => fetchData()}
        />
      )}
    </div>
  );
}
