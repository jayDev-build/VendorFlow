'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClockAlert,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Send,
  Download,
  Building2,
  RefreshCw,
  BellRing,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { ExpiryTrackerData, ExpiryDocumentItem } from '@/lib/types';

export default function ExpiryPage() {
  const [trackerData, setTrackerData] = useState<ExpiryTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [sendingRenewalId, setSendingRenewalId] = useState<string | null>(null);

  const fetchTracker = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await api.getExpiryTracker();
      setTrackerData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load expiry tracker data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracker();
  }, []);

  const handleRequestRenewal = async (docId: string) => {
    try {
      setSendingRenewalId(docId);
      setErrorMsg('');
      const res = await api.requestRenewal(docId);
      setSuccessMsg(res.message || 'Renewal request notification queued successfully.');
      fetchTracker();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch renewal request');
    } finally {
      setSendingRenewalId(null);
    }
  };

  const renderBucketSection = (
    title: string,
    badgeColor: string,
    items: ExpiryDocumentItem[],
    emptyText: string
  ) => (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${badgeColor}`} />
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{title}</h2>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-slate-900 border border-slate-300">
          {items.length} {items.length === 1 ? 'Document' : 'Documents'}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-600 font-semibold italic">
            {emptyText}
          </div>
        ) : (
          items.map((item) => {
            const isOverdue = item.days_remaining < 0;
            const downloadFullUrl = item.download_url
              ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${item.download_url}`
              : '#';

            return (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{item.document_type}</span>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 font-medium">
                    <Link
                      href={`/vendors/${item.vendor_id}`}
                      className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                    >
                      {item.vendor_name}
                    </Link>
                    <span>•</span>
                    <span className="text-slate-700 font-mono text-[11px] font-medium">{item.vendor_email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Expiry Pill */}
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold ${
                        isOverdue
                          ? 'text-red-600'
                          : item.days_remaining <= 7
                          ? 'text-rose-600'
                          : item.days_remaining <= 30
                          ? 'text-amber-600'
                          : 'text-slate-900 font-bold'
                      }`}
                    >
                      {isOverdue ? `Expired ${Math.abs(item.days_remaining)}d ago` : `${item.days_remaining} days left`}
                    </div>
                    <div className="text-[10px] text-slate-600 font-semibold">
                      {new Date(item.expiry_date).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <a
                      href={downloadFullUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Download document"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleRequestRenewal(item.id)}
                      disabled={sendingRenewalId === item.id}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                    >
                      <Send className="w-3 h-3 text-indigo-500" />
                      <span>{sendingRenewalId === item.id ? 'Sending...' : 'Request Renewal'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="Document Expiry & Renewal Tracker"
        subtitle="Monitors perishable vendor compliance certificates with automated 30, 7, and 1-day reminders"
        actions={
          <button
            onClick={fetchTracker}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh expiry buckets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {/* Informational Banner */}
        <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Background Reminder Engine is Active</h2>
              <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                Scheduled background tasks continuously scan certificate timestamps and dispatch automated warnings to vendors without requiring an active browser window.
              </p>
            </div>
          </div>
        </div>

        {/* Five Grouped Buckets */}
        {loading ? (
          <div className="py-16 text-center text-slate-700 font-semibold">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Scanning certificate expiration dates...</span>
          </div>
        ) : trackerData ? (
          <div className="space-y-5">
            {renderBucketSection(
              'Already Expired',
              'bg-red-500',
              trackerData.expired,
              'No expired documents. All suppliers are currently up to date.'
            )}

            {renderBucketSection(
              'Critical: Expiring Within 7 Days',
              'bg-rose-500',
              trackerData.expiring_7d,
              'No documents expiring within the next 7 days.'
            )}

            {renderBucketSection(
              'Expiring Within 30 Days',
              'bg-amber-500',
              trackerData.expiring_30d,
              'No documents expiring in the next 30 days.'
            )}

            {renderBucketSection(
              'Expiring Within 60 Days',
              'bg-blue-500',
              trackerData.expiring_60d,
              'No documents expiring in 31 to 60 days.'
            )}

            {renderBucketSection(
              'Valid For Longer (> 60 Days)',
              'bg-emerald-500',
              trackerData.valid_longer,
              'No long-term documents found.'
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
