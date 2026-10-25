'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface TopNavProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const TopNav: React.FC<TopNavProps> = ({ title, subtitle, actions }) => {
  const pathname = usePathname();

  // If title is not passed, deduce from pathname
  const getPageTitle = () => {
    if (title) return title;
    if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/overview')) return 'Overview';
    if (pathname.startsWith('/vendors')) return 'Vendors Directory';
    if (pathname.startsWith('/workflows/new')) return 'AI Workflow Generator';
    if (pathname.startsWith('/workflows')) return 'Onboarding Workflows';
    if (pathname.startsWith('/documents')) return 'Document Review Queue';
    if (pathname.startsWith('/expiry')) return 'Document Expiry Tracker';
    if (pathname.startsWith('/settings')) return 'Organization Settings';
    return 'Dashboard';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          {getPageTitle()}
        </h1>
        {subtitle && <p className="text-xs text-slate-700 font-medium mt-0.5">{subtitle}</p>}
      </div>

      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
};
