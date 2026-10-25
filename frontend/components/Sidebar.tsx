'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  FileCheck2,
  ClockAlert,
  Settings,
  Sparkles,
  LogOut,
  Building2,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { api } from '@/lib/api';

const navItems = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Vendors', href: '/vendors', icon: Users },
  { name: 'Workflows', href: '/workflows', icon: GitBranch },
  { name: 'Documents', href: '/documents', icon: FileCheck2 },
  { name: 'Expiry Tracker', href: '/expiry', icon: ClockAlert },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [org, setOrg] = useState<{ name: string; slug: string } | null>(null);
  const [user, setUser] = useState<{ full_name: string; email: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const session = api.getCurrentSession();
    if (session.org) setOrg(session.org);
    if (session.user) setUser(session.user);
  }, []);

  // Do not render sidebar on public landing page, interactive demo, auth pages, or vendor portal
  if (
    pathname === '/' ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/vendor/onboard')
  ) {
    return null;
  }

  const handleLogout = () => {
    api.logout();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-white tracking-tight flex items-center gap-1.5 text-base">
              FormGate
              <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">AI</span>
            </div>
            <div className="text-xs text-slate-300 font-medium truncate max-w-[140px]">
              {org?.name || 'Enterprise'}
            </div>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-slate-300 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Action Button */}
      <div className="p-3">
        <Link
          href="/workflows/new"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-sm font-semibold shadow-sm transition-all shadow-indigo-600/20 hover:shadow-indigo-600/30"
        >
          <Sparkles className="w-4 h-4 text-indigo-100" />
          <span>New AI Workflow</span>
        </Link>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/overview'
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-slate-800 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-300'}`} />
                <span>{item.name}</span>
              </div>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User / Org Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-indigo-900/80 border border-indigo-600 text-indigo-200 flex items-center justify-center text-xs font-bold uppercase shrink-0">
              {user?.full_name ? user.full_name.charAt(0) : 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate max-w-[120px]">
                {user?.full_name || 'Administrator'}
              </div>
              <div className="text-[11px] text-slate-300 truncate max-w-[120px]">
                {user?.email || 'admin@formgate.io'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-slate-300 hover:text-rose-300 hover:bg-slate-800 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Trigger Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40">
        <Link href="/dashboard" className="flex items-center gap-2 text-white font-semibold">
          <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>FormGate</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-slate-300 hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-30">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10">{navContent}</div>
        </div>
      )}
    </>
  );
};
