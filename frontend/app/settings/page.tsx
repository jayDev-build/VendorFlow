'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  ShieldCheck,
  Cpu,
  Database,
  HardDrive,
  BellRing,
  Save,
  CheckCircle2,
  AlertTriangle,
  User,
  Key
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [org, setOrg] = useState<{ id: string; name: string; slug: string; business_profile?: any } | null>(null);
  const [user, setUser] = useState<{ full_name: string; email: string; role: string } | null>(null);
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const session = api.getCurrentSession();
    if (session.org) {
      setOrg(session.org);
      setOrgName(session.org.name);
      setIndustry(session.org.business_profile?.industry || 'Supply Chain & Logistics');
    }
    if (session.user) {
      setUser(session.user);
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg('');
      const updated = await api.updateOrganization({
        name: orgName,
        business_profile: {
          ...(org?.business_profile || {}),
          industry
        }
      });
      setOrg(updated);
      setSuccessMsg('Organization settings updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="Organization Settings"
        subtitle="Manage business profiles, enterprise tenant parameters, and integration health"
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {/* System & Architecture Status Cards */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>Platform Integration & Security Engine</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold mb-1">
                <Database className="w-4 h-4 text-indigo-500" />
                <span>PostgreSQL DB</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Alembic Migrated</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold mb-1">
                <Cpu className="w-4 h-4 text-indigo-500" />
                <span>AI Generator</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Structured Output Ready</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold mb-1">
                <HardDrive className="w-4 h-4 text-indigo-500" />
                <span>Document Storage</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Private Vault & Signed URLs</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold mb-1">
                <BellRing className="w-4 h-4 text-indigo-500" />
                <span>Reminder Engine</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Persistent Loop Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Profile Settings Form */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Organization Profile</h2>
            <p className="text-xs text-slate-700 font-medium">Configure business information shown on external vendor invitations</p>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">Organization Slug (Tenant Scope)</label>
                <input
                  type="text"
                  disabled
                  value={org?.slug || 'acme-corp'}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-800 font-mono font-semibold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-900 mb-1">Primary Business Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Administrator Profile Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-600" />
            <span>Active Administrator Session</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase">Name</span>
              <div className="font-bold text-slate-900">{user?.full_name || 'Sarah Jenkins'}</div>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase">Email</span>
              <div className="font-bold text-slate-900 font-mono">{user?.email || 'demo@vendorflow.io'}</div>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase">Role</span>
              <div className="font-bold text-indigo-700 uppercase">{user?.role || 'admin'}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
