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
  Key,
  Mail,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [org, setOrg] = useState<{ id: string; name: string; slug: string; business_profile?: any } | null>(null);
  const [user, setUser] = useState<{ id?: string; full_name: string; email: string; role: string } | null>(null);

  // Organization settings state
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [industry, setIndustry] = useState('');
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgSuccessMsg, setOrgSuccessMsg] = useState('');
  const [orgErrorMsg, setOrgErrorMsg] = useState('');

  // Administrator settings state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState('');
  const [adminErrorMsg, setAdminErrorMsg] = useState('');

  useEffect(() => {
    const session = api.getCurrentSession();
    if (session.org) {
      setOrg(session.org);
      setOrgName(session.org.name);
      setOrgSlug(session.org.slug || '');
      setIndustry(session.org.business_profile?.industry || 'CA & Tax Firms');
    }
    if (session.user) {
      setUser(session.user);
      setAdminName(session.user.full_name || '');
      setAdminEmail(session.user.email || '');
    }
  }, []);

  const handleOrgSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setOrgLoading(true);
      setOrgErrorMsg('');
      setOrgSuccessMsg('');
      const updated = await api.updateOrganization({
        name: orgName.trim(),
        slug: orgSlug.trim().toLowerCase(),
        business_profile: {
          ...(org?.business_profile || {}),
          industry: industry.trim()
        }
      });
      setOrg(updated);
      setOrgName(updated.name);
      setOrgSlug(updated.slug);
      setOrgSuccessMsg('Organization settings updated successfully.');
    } catch (err: any) {
      setOrgErrorMsg(err.message || 'Failed to update organization settings');
    } finally {
      setOrgLoading(false);
    }
  };

  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAdminLoading(true);
      setAdminErrorMsg('');
      setAdminSuccessMsg('');

      if (!adminName.trim()) {
        throw new Error('Full name cannot be blank');
      }
      if (!adminEmail.trim()) {
        throw new Error('Email address cannot be blank');
      }

      if (newPassword) {
        if (!currentPassword) {
          throw new Error('Current password is required to set a new password');
        }
        if (newPassword.length < 8) {
          throw new Error('New password must be at least 8 characters long');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('New password confirmation does not match');
        }
      }

      const payload: {
        full_name: string;
        email: string;
        current_password?: string;
        new_password?: string;
      } = {
        full_name: adminName.trim(),
        email: adminEmail.trim()
      };

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const updated = await api.updateCurrentUser(payload);
      setUser(updated);
      setAdminName(updated.full_name);
      setAdminEmail(updated.email);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      setAdminSuccessMsg('Administrator profile and credentials updated successfully.');
    } catch (err: any) {
      setAdminErrorMsg(err.message || 'Failed to update administrator profile');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="Settings & Administration"
        subtitle="Manage FormGate organization profile, tenant parameters, and administrator security"
      />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* System & Architecture Status Cards */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>FormGate Platform Integration & Security Engine</span>
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
                <span>AI Multi-Tier</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Gemini 3.5 & Ollama</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold mb-1">
                <HardDrive className="w-4 h-4 text-indigo-500" />
                <span>Document Storage</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Private Vault Active</span>
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

        {/* Administrator Profile & Security Form (Interactive Editing) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Administrator Profile & Security</span>
              </h2>
              <p className="text-xs text-slate-700 font-medium mt-0.5">
                Update your administrative login credentials, name, and security password
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {user?.role || 'System Administrator'}
            </span>
          </div>

          <form onSubmit={handleAdminSave} className="p-6 space-y-5">
            {adminErrorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
                <span>{adminErrorMsg}</span>
                <button type="button" onClick={() => setAdminErrorMsg('')} className="font-semibold underline ml-2">Dismiss</button>
              </div>
            )}

            {adminSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{adminSuccessMsg}</span>
                </div>
                <button type="button" onClick={() => setAdminSuccessMsg('')} className="font-semibold underline ml-2">Dismiss</button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">Email Address (Login Identity)</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@formgate.io"
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-mono font-medium placeholder-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Password Change Expandable Section */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-slate-800 hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-slate-600" />
                  <span>Change Password (Optional)</span>
                </div>
                {showPasswordChange ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {showPasswordChange && (
                <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-mono placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-mono placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-mono placeholder-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={adminLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{adminLoading ? 'Updating Profile...' : 'Save Administrator Profile'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Organization Profile Settings Form */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Organization Profile & Tenancy</span>
            </h2>
            <p className="text-xs text-slate-700 font-medium mt-0.5">
              Configure legal entity information displayed on external invitation links and onboarding portals
            </p>
          </div>

          <form onSubmit={handleOrgSave} className="p-6 space-y-4">
            {orgErrorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
                <span>{orgErrorMsg}</span>
                <button type="button" onClick={() => setOrgErrorMsg('')} className="font-semibold underline ml-2">Dismiss</button>
              </div>
            )}

            {orgSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{orgSuccessMsg}</span>
                </div>
                <button type="button" onClick={() => setOrgSuccessMsg('')} className="font-semibold underline ml-2">Dismiss</button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-900">Organization Slug (Tenant Scope)</label>
                  <span className="text-[10px] text-slate-500 font-medium">Domain identifier</span>
                </div>
                <input
                  type="text"
                  required
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="e.g. formgate-enterprise"
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-mono font-semibold placeholder-slate-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Unique tenant slug used for workspace isolation. Allowed: lowercase letters, numbers, hyphens.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-900 mb-1.5">Primary Business Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. CA & Tax Audit Firms, Manufacturing & D2C, Healthcare Staffing"
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-400"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={orgLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{orgLoading ? 'Saving...' : 'Save Organization Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
