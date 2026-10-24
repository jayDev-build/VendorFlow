'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  Sparkles,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  Archive,
  RefreshCw,
  AlertTriangle,
  FileText,
  Trash2,
  Pencil
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { StatusBadge } from '@/components/StatusBadge';
import { InvitationModal } from '@/components/InvitationModal';
import { WorkflowPreviewModal } from '@/components/WorkflowPreviewModal';
import { api } from '@/lib/api';
import { Workflow, WorkflowSchemaDefinition } from '@/lib/types';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals & action state
  const [activeWorkflowForInvite, setActiveWorkflowForInvite] = useState<{ id: string; name: string } | null>(null);
  const [activeSchemaForPreview, setActiveSchemaForPreview] = useState<WorkflowSchemaDefinition | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await api.listWorkflows();
      setWorkflows(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handlePublish = async (workflowId: string) => {
    try {
      await api.publishWorkflow(workflowId);
      fetchWorkflows();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish workflow');
    }
  };

  const handleDeleteWorkflow = async (workflowId: string, workflowName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete workflow "${workflowName}"?`)) {
      return;
    }
    try {
      setDeletingId(workflowId);
      setErrorMsg('');
      await api.deleteWorkflow(workflowId);
      fetchWorkflows();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete workflow');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="Onboarding Workflows"
        subtitle="Manage compliance templates, published form schemas, and vendor invitation tokens"
        actions={
          <Link
            href="/workflows/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate with AI</span>
          </Link>
        }
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={fetchWorkflows} className="underline font-semibold">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-700 font-semibold">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              <span>Loading onboarding workflows...</span>
            </div>
          ) : workflows.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <GitBranch className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No onboarding workflows yet</h3>
              <p className="text-xs text-slate-700 font-medium mt-1 max-w-md mx-auto">
                Paste your compliance guidelines into our AI generator to automatically create a complete onboarding workflow with forms, uploads, and expiry schedules.
              </p>
              <Link
                href="/workflows/new"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Create First Workflow</span>
              </Link>
            </div>
          ) : (
            workflows.map((wf) => {
              const fieldCount = wf.schema_definition?.fields?.length || 0;
              const docCount = wf.schema_definition?.fields?.filter(f => f.field_type === 'file_upload').length || 0;
              const hasExpiry = wf.schema_definition?.fields?.some(f => f.track_expiry);

              return (
                <div
                  key={wf.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all p-5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {wf.vendor_category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          v{wf.current_version_number}
                        </span>
                        <StatusBadge status={wf.status} size="sm" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {wf.name}
                      </h3>
                      {wf.description && (
                        <p className="text-xs text-slate-700 font-medium mt-1 line-clamp-2">{wf.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-800">
                      <div>
                        <span className="text-slate-700 font-semibold">Total Fields:</span>{' '}
                        <span className="font-bold text-slate-900">{fieldCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-700 font-semibold">Documents:</span>{' '}
                        <span className="font-bold text-slate-900">{docCount}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1 text-slate-700 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        <span>Reminders: {wf.reminder_rules?.join(', ')}d before expiry</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/workflows/${wf.id}/edit`}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-medium transition-colors"
                        title={wf.status === 'PUBLISHED' ? `Edit Workflow (creates v${wf.current_version_number + 1})` : "Edit Draft Workflow"}
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setActiveSchemaForPreview(wf.schema_definition)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
                        title="Preview Vendor View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                        disabled={deletingId === wf.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        title={`Delete ${wf.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {wf.status === 'DRAFT' ? (
                        <button
                          type="button"
                          onClick={() => handlePublish(wf.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveWorkflowForInvite({ id: wf.id, name: wf.name })}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Invite Vendor</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Invite Modal */}
      {activeWorkflowForInvite && (
        <InvitationModal
          workflowId={activeWorkflowForInvite.id}
          workflowName={activeWorkflowForInvite.name}
          onClose={() => setActiveWorkflowForInvite(null)}
          onSuccess={fetchWorkflows}
        />
      )}

      {/* Preview Modal */}
      {activeSchemaForPreview && (
        <WorkflowPreviewModal
          schema={activeSchemaForPreview}
          onClose={() => setActiveSchemaForPreview(null)}
        />
      )}
    </div>
  );
}
