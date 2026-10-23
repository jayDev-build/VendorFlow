'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Calendar,
  Building2,
  ExternalLink,
  Mail,
  Phone,
  ArrowRight
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { VendorListItem } from '@/lib/types';

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await api.listVendors(search, statusFilter, categoryFilter);
      setVendors(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [statusFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVendors();
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="Vendors Directory"
        subtitle="Search, filter, and inspect onboarding submissions across all suppliers"
        actions={
          <Link
            href="/workflows/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Onboard New Vendor</span>
          </Link>
        }
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vendor name or email..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
            />
          </form>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="INVITED">Invited</option>
              <option value="REJECTED">Rejected</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold"
            >
              <option value="ALL">All Categories</option>
              <option value="Supply Chain">Supply Chain</option>
              <option value="IT & Cloud Services">IT & Cloud Services</option>
              <option value="Facilities & Contractors">Facilities</option>
              <option value="General">General</option>
            </select>

            <button
              onClick={fetchVendors}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Vendors Directory Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Vendor Profile</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Compliance Status</th>
                  <th className="py-3.5 px-4">Next Expiry</th>
                  <th className="py-3.5 px-4">Last Activity</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-700 font-semibold">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Loading vendors...</span>
                    </td>
                  </tr>
                ) : vendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-700">
                      <Building2 className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                      <div className="font-bold text-slate-900 text-sm">No vendors found</div>
                      <p className="text-xs text-slate-600 font-medium mt-1">Try adjusting search parameters or invite a vendor.</p>
                    </td>
                  </tr>
                ) : (
                  vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      onClick={() => router.push(`/vendors/${vendor.id}`)}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {vendor.name}
                        </div>
                        <div className="text-[11px] text-slate-700 font-mono font-medium flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{vendor.contact_email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {vendor.category}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={vendor.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{
                                width: vendor.documents_count > 0
                                  ? `${Math.round((vendor.documents_approved_count / vendor.documents_count) * 100)}%`
                                  : '0%'
                              }}
                            />
                          </div>
                          <span className="font-bold text-slate-900 text-[11px]">
                            {vendor.documents_approved_count}/{vendor.documents_count}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {vendor.next_expiry ? (
                          <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 text-[11px] flex items-center gap-1 w-fit">
                            <Calendar className="w-3 h-3 text-amber-600" />
                            {new Date(vendor.next_expiry).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium text-[11px]">
                        {new Date(vendor.last_updated).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/vendors/${vendor.id}`}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
