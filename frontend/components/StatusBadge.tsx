import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const norm = (status || '').toUpperCase().trim();

  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';
  let label = status;

  switch (norm) {
    case 'APPROVED':
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold';
      dotColor = 'bg-emerald-600';
      label = 'Approved';
      break;
    case 'SUBMITTED':
      style = 'bg-blue-50 text-blue-800 border-blue-300 font-semibold';
      dotColor = 'bg-blue-600';
      label = 'Submitted';
      break;
    case 'UNDER_REVIEW':
      style = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold';
      dotColor = 'bg-amber-600';
      label = 'Under Review';
      break;
    case 'IN_PROGRESS':
      style = 'bg-sky-50 text-sky-800 border-sky-300 font-semibold';
      dotColor = 'bg-sky-600';
      label = 'In Progress';
      break;
    case 'INVITED':
      style = 'bg-purple-50 text-purple-800 border-purple-300 font-semibold';
      dotColor = 'bg-purple-600';
      label = 'Invited';
      break;
    case 'REJECTED':
      style = 'bg-rose-50 text-rose-800 border-rose-300 font-semibold';
      dotColor = 'bg-rose-600';
      label = 'Rejected';
      break;
    case 'RESUBMISSION_REQUESTED':
      style = 'bg-orange-50 text-orange-900 border-orange-300 font-semibold';
      dotColor = 'bg-orange-600';
      label = 'Resubmit Requested';
      break;
    case 'EXPIRED':
      style = 'bg-red-50 text-red-900 border-red-300 font-bold';
      dotColor = 'bg-red-600';
      label = 'Expired';
      break;
    case 'EXPIRING':
      style = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold';
      dotColor = 'bg-amber-600';
      label = 'Expiring Soon';
      break;
    case 'PUBLISHED':
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold';
      dotColor = 'bg-emerald-600';
      label = 'Published';
      break;
    case 'DRAFT':
      style = 'bg-slate-100 text-slate-900 border-slate-300 font-semibold';
      dotColor = 'bg-slate-600';
      label = 'Draft';
      break;
    case 'ARCHIVED':
      style = 'bg-zinc-100 text-zinc-900 border-zinc-300 font-semibold';
      dotColor = 'bg-zinc-600';
      label = 'Archived';
      break;
    case 'MISSING':
      style = 'bg-rose-50 text-rose-800 border-rose-300 font-semibold';
      dotColor = 'bg-rose-600';
      label = 'Missing';
      break;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors ${sizeClasses} ${style} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
};
