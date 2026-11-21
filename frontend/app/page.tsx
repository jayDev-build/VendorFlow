'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileCheck2,
  AlertTriangle,
  Play,
  Layers,
  Lock,
  ChevronRight,
  Zap,
  RefreshCw,
  FileText,
  Mail,
  Send,
  Building2,
  Search,
  ExternalLink,
  Flame,
  Check,
  HelpCircle
} from 'lucide-react';

export default function PublicHomePage() {
  const router = useRouter();
  const [prospectCompany, setProspectCompany] = useState('');

  const handleLaunchDemo = (e: React.FormEvent) => {
    e.preventDefault();
    const companyParam = prospectCompany.trim()
      ? encodeURIComponent(prospectCompany.trim())
      : 'Sample_Firm';
    router.push(`/demo?company=${companyParam}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col relative overflow-x-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-80 -left-48 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[600px] -right-48 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                FormGate
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-slate-400 tracking-wide font-medium">Bookkeeping Intake & Portal</span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Security
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/70 rounded-xl transition-all border border-slate-700/60"
            >
              Sign In / Sign Up
            </Link>
            <Link
              href="/demo?company=Sample_Prospect_Corp"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 rounded-xl shadow-md shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Interactive Demo</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center space-y-8">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 text-xs font-medium shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Next-Gen UK & US Client Bookkeeping & Accounting Intake</span>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span className="text-indigo-200 font-semibold">v2.4 Live</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.12]">
          Automate Client Bookkeeping Intake & Financial Records Collection{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200 bg-clip-text text-transparent">
            Without Email Chaos
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
          Collect, verify, and continuously monitor client tax IDs, bank & credit card statements, and statutory filings for UK & US accounting firms.
          AI generates custom intake workflows in seconds, tracks accounting reference dates & filing deadlines, and sends automated reminders before documents lapse.
        </p>

        {/* Dual Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/demo?company=Sample_Prospect_Corp"
            className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Try Live Demo</span>
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
              No Login
            </span>
          </Link>

          <Link
            href="/auth"
            className="w-full sm:w-auto px-7 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-sm rounded-xl border border-slate-700/80 hover:border-slate-600 flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-4 h-4 text-indigo-400" />
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Zero credit card required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>SOC2-ready tenant isolation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Live in under 3 minutes</span>
          </div>
        </div>

        {/* 3. Hero Visual: Interactive Product Showcase Card */}
        <div className="pt-10 max-w-5xl mx-auto">
          <div className="relative rounded-2xl p-1 bg-gradient-to-b from-indigo-500/30 via-slate-800/40 to-slate-900/60 shadow-2xl">
            <div className="bg-slate-900/95 rounded-xl border border-slate-800 overflow-hidden shadow-2xl text-left">
              {/* Fake Browser Window Top Bar */}
              <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/70" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <span className="ml-2 text-xs font-mono text-slate-400">formgate.in/dashboard</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-semibold text-slate-300">Live AI Bookkeeping Queue</span>
                </div>
              </div>

              {/* Showcase Content Grid */}
              <div className="p-6 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5">
                    <div className="text-[11px] font-semibold text-slate-400">Total Client Entities</div>
                    <div className="text-2xl font-bold text-white mt-1">142</div>
                    <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                      <span>↑ 18% this month</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5">
                    <div className="text-[11px] font-semibold text-slate-400">Approved & Reconciled</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">128</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Filing-ready status</div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5">
                    <div className="text-[11px] font-semibold text-slate-400">Pending Review</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">9</div>
                    <div className="text-[10px] text-amber-300 font-medium mt-0.5">Avg turnaround 4m</div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5">
                    <div className="text-[11px] font-semibold text-slate-400">Deadlines in 30 Days</div>
                    <div className="text-2xl font-bold text-rose-400 mt-1">5</div>
                    <div className="text-[10px] text-rose-300 font-medium mt-0.5">Auto-chaser active</div>
                  </div>
                </div>

                {/* Sample Live Queue Item */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">IRS Form W-9 & EIN Confirmation CP 575</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Ready for Review
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Client: <strong className="text-slate-200">Apex Cloud Media LLC</strong> • Uploaded via single-use client portal link
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Link
                      href="/demo?company=Sample_Prospect_Corp"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Inspect Document</span>
                    </Link>
                    <Link
                      href="/demo?company=Sample_Prospect_Corp"
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <span>Simulate Review</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Features / Value Prop Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">Built for Bookkeepers & Accountants</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for Zero Email & Drive Chaos
          </h2>
          <p className="text-sm sm:text-base text-slate-400 font-normal">
            Every feature is purpose-built to eliminate manual chase emails, buried email attachments, messy Google Drive folders, and frantic tax-deadline panic.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: AI Workflow Generation */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 space-y-4 transition-all hover:shadow-xl hover:shadow-indigo-500/5 group">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">AI Intake Workflow Generator</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Describe your client onboarding requirements or tax checklist in plain English. FormGate generates customized client intake forms, document requests, and validation rules in seconds.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-indigo-400 flex items-center gap-1">
              <span>AI-Powered Intake Generator</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: Automated Expiry Chasing */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 space-y-4 transition-all hover:shadow-xl hover:shadow-purple-500/5 group">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">30, 14, 7-Day Deadline Radar</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              FormGate automatically monitors annual filing deadlines, accounting reference dates, and tax exemption expirations. Automated reminders dispatch before clients miss key filing windows.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-purple-400 flex items-center gap-1">
              <span>Automated Deadline Chaser</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: 1-Click Partial Rejection */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-rose-500/50 rounded-2xl p-6 space-y-4 transition-all hover:shadow-xl hover:shadow-rose-500/5 group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">1-Click Document Feedback & Rejection</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Never reject an entire client intake packet because one bank statement is blurry or a W-9 is outdated. Reject only the specific file with reviewer feedback and an instant re-upload link.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-rose-400 flex items-center gap-1">
              <span>Targeted Resubmission Links</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 4: No-Login Client Portal */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 space-y-4 transition-all hover:shadow-xl hover:shadow-emerald-500/5 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No-Login Client Experience</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Business owners hate creating another login just to send documents. Secure, single-click magic links let clients upload tax IDs, statements, and company filings directly from any phone or browser.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <span>Zero-Friction Client Onboarding</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 5: Strict Multi-Tenant Vault */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 space-y-4 transition-all hover:shadow-xl hover:shadow-blue-500/5 group">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Encrypted Private Client Vault</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every accounting firm's data is strictly isolated with bank-grade encryption. Financial statements are stored in private cloud vaults and accessible only through time-limited, secure viewing links.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-blue-400 flex items-center gap-1">
              <span>Bank-Grade Cloud Encryption</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 6: Tamper-Proof Audit Trail */}
          <div className="bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 space-y-4 transition-all hover:shadow-xl hover:shadow-amber-500/5 group">
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Complete Audit Trail & Timestamping</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every document upload, reviewer approval, rejection reason, and deadline reminder is logged with immutable timestamps. Keep your firm completely audit-ready for every tax season.
            </p>
            <div className="pt-2 text-[11px] font-semibold text-amber-400 flex items-center gap-1">
              <span>Audit-Ready Client Records</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works (3 Steps) */}
      <section id="how-it-works" className="py-20 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Streamlined Workflow</span>
            <h2 className="text-3xl font-extrabold text-white">From Chaotic Email Threads to Reconciled Books</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-3 relative">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-sm font-bold text-white">Describe or Pick Bookkeeping Preset</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Describe required financial documents in plain English (e.g. US Monthly Bookkeeping, IRS Form W-9, UK Companies House accounts, MTD VAT returns) and AI generates fields and validation automatically.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-3 relative">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-sm font-bold text-white">Share Secure Link (No Client Login)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Get a shareable intake portal link immediately. Share it via email or client onboarding message. Clients upload their bank statements, tax IDs, and financial records without sign-up friction.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-3 relative">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h3 className="text-sm font-bold text-white">Review Queue & Deadline Tracking</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Inspect submissions in the review queue. FormGate tracks filing deadlines and document expiration dates (e.g. tax filings, accounting reference dates) and sends automated email reminders before due dates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Interactive Prospect Sandbox CTA Banner */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-700/60 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personalized Prospect Sandbox</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            See FormGate Customized For Your Firm
          </h2>

          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Test the live review queue, inspect sample client tax filings, and test 1-click document feedback simulated for your firm.
          </p>

          <form onSubmit={handleLaunchDemo} className="max-w-md mx-auto flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <div className="relative w-full">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={prospectCompany}
                onChange={(e) => setProspectCompany(e.target.value)}
                placeholder="Enter your accounting firm name..."
                className="w-full text-xs pl-10 pr-3 py-3 bg-slate-950/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 shrink-0 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Launch Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="text-[11px] text-slate-400 font-medium pt-1">
            Or try pre-loaded demo:{' '}
            <Link
              href="/demo?company=Sample_Firm"
              className="text-indigo-400 hover:text-indigo-300 underline font-semibold"
            >
              Sample Firm →
            </Link>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Common Questions</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Do my clients need to create an account or remember passwords?</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed pl-6">
              No. Clients receive a secure, one-click magic link. They can open it directly on mobile or desktop, enter their entity details, upload bank statements and tax filings, and submit in minutes without creating an account or downloading an app.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>How does document rejection and feedback work?</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed pl-6">
              If a client uploads 6 valid records and 1 blurry bank statement, you can reject just that specific file with an explanation. FormGate sends the client a targeted link to re-upload only the requested document, leaving all previously approved records intact.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>How are filing deadlines and document renewals tracked?</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed pl-6">
              FormGate automatically monitors expiration dates and accounting reference dates against preset intervals (e.g., 30, 14, and 7 days). It sends automated email reminders to clients on your behalf so tax filings and statements are never received late.
            </p>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">FormGate</div>
              <div className="text-[11px] text-slate-400 font-normal">
                Client Bookkeeping Intake & Financial Document Portal
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 font-medium">
            <Link href="/auth" className="hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/demo?company=Sample_Firm" className="hover:text-white transition-colors">
              Interactive Sandbox
            </Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Admin Overview
            </Link>
            <a href="#security" className="hover:text-white transition-colors">
              Security Overview
            </a>
          </div>

          <div className="text-xs text-slate-400">
            © 2026 FormGate. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
