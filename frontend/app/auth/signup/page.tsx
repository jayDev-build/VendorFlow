'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Building2, User, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('Supply Chain & Logistics');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg('');
      await api.signup({
        organization_name: orgName.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        business_profile: { industry }
      });
      router.push('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 -z-10 pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Create your Organization</h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Start automating vendor compliance workflows in minutes
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Organization / Business Name</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Apex Global Logistics"
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Industry Category</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="Supply Chain & Logistics">Supply Chain & Logistics</option>
              <option value="IT & Cloud Services">IT & Cloud Services</option>
              <option value="Manufacturing & Hardware">Manufacturing & Hardware</option>
              <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
              <option value="Construction & Facilities">Construction & Facilities</option>
              <option value="Financial Services">Financial Services</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Your Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Work Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">Password (min 8 characters)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 mt-4 cursor-pointer"
          >
            <span>{loading ? 'Creating Organization...' : 'Complete Setup'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-300 font-medium">
          <span>Already have an account? </span>
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-semibold underline ml-1">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
