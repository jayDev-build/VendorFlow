'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  Eye,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  Calendar,
  ShieldCheck,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  GitBranch,
  RefreshCw,
  Share2
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { WorkflowPreviewModal } from '@/components/WorkflowPreviewModal';
import { InvitationModal } from '@/components/InvitationModal';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { Workflow, WorkflowField, WorkflowSchemaDefinition, FieldType } from '@/lib/types';
import { PRESET_PROMPTS } from '@/app/workflows/new/page';

import { Suspense } from 'react';

function EditWorkflowContent() {
  const router = useRouter();
  const params = useParams();
  const workflowId = (params?.id as string) || '';

  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);

  // Editable workflow metadata
  const [workflowName, setWorkflowName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('General');
  const [description, setDescription] = useState('');

  // Editable schema
  const [schema, setSchema] = useState<WorkflowSchemaDefinition | null>(null);

  // AI Refinement Prompt state
  const [showAiRefine, setShowAiRefine] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Fetch existing workflow
  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        setLoading(true);
        setErrorMsg('');
        const data = await api.getWorkflow(workflowId);
        setWorkflow(data);
        setWorkflowName(data.name);
        setVendorCategory(data.vendor_category);
        setDescription(data.description || '');

        // Initialize schema from workflow
        if (data.schema_definition) {
          setSchema({
            name: data.schema_definition.name || data.name,
            vendor_category: data.schema_definition.vendor_category || data.vendor_category,
            description: data.schema_definition.description || data.description || '',
            fields: data.schema_definition.fields || [],
            approval_required: data.approval_required ?? true,
            reminder_rules: data.reminder_rules || [30, 7, 1],
            generated_questions: data.schema_definition.generated_questions || [],
            assumptions: data.schema_definition.assumptions || [],
            warnings: data.schema_definition.warnings || []
          });
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load workflow details');
      } finally {
        setLoading(false);
      }
    };

    if (workflowId) {
      fetchWorkflow();
    }
  }, [workflowId]);

  // AI Refinement / Regeneration using local Ollama model
  const handleAiRefine = async () => {
    if (!aiPrompt.trim()) {
      setErrorMsg('Please enter your prompt describing the updates or new compliance requirements.');
      return;
    }

    try {
      setIsAiGenerating(true);
      setErrorMsg('');
      const generated = await api.generateWorkflowAI(
        aiPrompt,
        workflowName,
        vendorCategory,
        description
      );

      // Merge or replace: update schema with generated fields
      setSchema(generated);
      if (generated.name) setWorkflowName(generated.name);
      if (generated.vendor_category) setVendorCategory(generated.vendor_category);
      setSuccessMsg('AI updated workflow structure according to your new instructions.');
      setShowAiRefine(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to refine workflow with AI');
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Field manipulation handlers
  const updateField = (index: number, updates: Partial<WorkflowField>) => {
    if (!schema) return;
    const newFields = [...schema.fields];
    newFields[index] = { ...newFields[index], ...updates };
    setSchema({ ...schema, fields: newFields });
  };

  const removeField = (index: number) => {
    if (!schema) return;
    const newFields = schema.fields.filter((_, i) => i !== index);
    setSchema({ ...schema, fields: newFields });
  };

  const addCustomField = () => {
    if (!schema) return;
    const newId = `field_custom_${Date.now()}`;
    const newField: WorkflowField = {
      id: newId,
      label: 'New Required Document / Information',
      field_type: 'file_upload',
      required: true,
      help_text: 'Please upload the requested certificate.',
      document_category: 'General',
      track_expiry: false,
      allowed_file_types: ['application/pdf', 'image/png', 'image/jpeg'],
      max_file_size_mb: 10
    };
    setSchema({ ...schema, fields: [...schema.fields, newField] });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (!schema) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schema.fields.length) return;
    const newFields = [...schema.fields];
    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;
    setSchema({ ...schema, fields: newFields });
  };

  // Save changes handler (Supports Draft in-place update or Published auto-versioning)
  const handleSave = async (publishIfDraft: boolean = false) => {
    if (!schema) return;

    try {
      setIsSaving(true);
      setErrorMsg('');

      const updatedSchema: WorkflowSchemaDefinition = {
        ...schema,
        name: workflowName,
        vendor_category: vendorCategory,
        description: description
      };

      // Call PATCH /api/v1/workflows/{id}
      const updated = await api.updateWorkflow(workflowId, {
        name: workflowName,
        vendor_category: vendorCategory,
        description: description,
        schema_definition: updatedSchema,
        approval_required: schema.approval_required,
        reminder_rules: schema.reminder_rules
      });

      if (publishIfDraft && workflow?.status === 'DRAFT') {
        await api.publishWorkflow(workflowId);
        setSuccessMsg('Draft workflow published successfully!');
        setShowInviteModal(true);
      } else {
        if (workflow?.status === 'PUBLISHED') {
          setSuccessMsg(`Workflow successfully updated to Version ${updated.current_version_number}!`);
        } else {
          setSuccessMsg('Workflow draft successfully saved.');
        }
        setTimeout(() => {
          router.push('/workflows');
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save workflow changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-slate-700">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <span className="font-semibold text-sm">Loading workflow editor...</span>
      </div>
    );
  }

  if (!workflow || !schema) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Workflow Not Found</h2>
        <p className="text-xs text-slate-600">The requested workflow does not exist or has been deleted.</p>
        <Link
          href="/workflows"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Workflows</span>
        </Link>
      </div>
    );
  }

  const isPublished = workflow.status === 'PUBLISHED';
  const nextVersionNumber = workflow.current_version_number + 1;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title={`Edit Workflow: ${workflow.name}`}
        subtitle={
          isPublished
            ? `Active Version v${workflow.current_version_number} • Updates will create Version v${nextVersionNumber}`
            : `Draft Workflow • Updates will save directly to this draft`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/workflows"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </Link>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" />
              <span>Preview</span>
            </button>
            {isPublished ? (
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Save as Version {nextVersionNumber}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold border border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Publish Workflow</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {/* Status & Version Awareness Banner */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
          isPublished
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
        }`}>
          {isPublished ? (
            <GitBranch className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          ) : (
            <Layers className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">
                {isPublished ? `Published Workflow (Active: v${workflow.current_version_number})` : 'Draft Workflow (Unpublished)'}
              </span>
              <StatusBadge status={workflow.status} size="sm" />
            </div>
            <p className="text-xs leading-relaxed font-medium">
              {isPublished ? (
                <>
                  Modifying this workflow will automatically increment it to <strong>Version {nextVersionNumber}</strong>. Existing vendors currently in-flight on v{workflow.current_version_number} will stay on their version so their document submissions remain stable. New invitations will use <strong>v{nextVersionNumber}</strong>.
                </>
              ) : (
                <>
                  You are editing an unpublished draft. Changes are saved in-place to this draft. Once satisfied with the configuration, click <strong>Publish Workflow</strong> to make it active for vendor invitations.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Workflow Basic Metadata Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Workflow Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Workflow Title</label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Standard Logistics Compliance"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Vendor Category</label>
              <input
                type="text"
                value={vendorCategory}
                onChange={(e) => setVendorCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Supply Chain, IT Services, Facilities"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-medium text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500"
                placeholder="Brief summary of onboarding and compliance scope..."
              />
            </div>
          </div>
        </div>

        {/* AI Assistant Refine Drawer (Optional AI re-prompting with Ollama) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div
            onClick={() => setShowAiRefine(!showAiRefine)}
            className="p-4 bg-gradient-to-r from-indigo-50/70 via-white to-white flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4 text-indigo-100" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900">AI Assistant: Refine or Add Requirements</span>
                <p className="text-[11px] text-slate-600 font-medium">Use local Ollama (gemma4:e4b) to regenerate or inject new compliance requirements</p>
              </div>
            </div>
            <div className="text-slate-500">
              {showAiRefine ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {showAiRefine && (
            <div className="p-5 border-t border-slate-200 space-y-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                <span className="text-[11px] font-semibold text-slate-700 mr-1">Insert Industry Template:</span>
                {PRESET_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setAiPrompt(p.prompt);
                      setVendorCategory(p.category);
                    }}
                    className="px-2 py-1 text-[11px] font-medium text-slate-800 bg-white hover:bg-indigo-50 hover:text-indigo-700 rounded-md border border-slate-300 transition-colors cursor-pointer"
                  >
                    {p.badge}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Add ISO 27001 certificate and SOC 2 Type II report. Both require expiry tracking. Collect trade license."
                className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiRefine(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAiRefine}
                  disabled={isAiGenerating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
                >
                  {isAiGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isAiGenerating ? 'Generating with Ollama...' : 'Update Schema with AI'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Workflow Configuration Strip: Approvals & Reminders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900">
            <input
              type="checkbox"
              checked={schema.approval_required}
              onChange={(e) => setSchema({ ...schema, approval_required: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span>Require Administrator Approval before Vendor Certification</span>
          </label>

          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <Clock className="w-4 h-4 text-slate-600" />
            <span>Reminder Schedule:</span>
            <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-300 font-mono text-slate-900 font-bold">
              {schema.reminder_rules?.join(', ') || '30, 7, 1'} days before expiry
            </span>
          </div>
        </div>

        {/* Form Fields & Documents Builder */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Configured Form Fields & Documents</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {schema.fields.length} Fields
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">Customize labels, document requirements, and expiration tracking rules</p>
            </div>
            <button
              type="button"
              onClick={addCustomField}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Field</span>
            </button>
          </div>

          <div className="p-5 space-y-3">
            {schema.fields.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-xs">
                No fields defined in this workflow. Click &quot;Add Field&quot; above to create one.
              </div>
            ) : (
              schema.fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Label Input */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Field / Certificate Label</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 bg-white"
                        />
                      </div>

                      {/* Field Type Select */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Field Type</label>
                        <select
                          value={field.field_type}
                          onChange={(e) => updateField(idx, { field_type: e.target.value as FieldType })}
                          className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                        >
                          <option value="file_upload">Document Upload</option>
                          <option value="short_text">Short Text</option>
                          <option value="long_text">Long Text</option>
                          <option value="email">Email Address</option>
                          <option value="phone">Phone Number</option>
                          <option value="dropdown">Dropdown Select</option>
                          <option value="date">Date</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </div>
                    </div>

                    {/* Reorder & Delete controls */}
                    <div className="flex items-center gap-1 pt-6 text-slate-600">
                      <button
                        type="button"
                        onClick={() => moveField(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, 'down')}
                        disabled={idx === schema.fields.length - 1}
                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded ml-1"
                        title="Delete Field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Help text input */}
                  <div>
                    <input
                      type="text"
                      value={field.help_text || ''}
                      onChange={(e) => updateField(idx, { help_text: e.target.value })}
                      placeholder="Instructions or help text for vendor..."
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/60 text-slate-800 placeholder-slate-400 focus:bg-white"
                    />
                  </div>

                  {/* Field Configuration Toggles */}
                  <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-100">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span>Required</span>
                    </label>

                    {/* Expiry Tracking Toggle (for file uploads or dates) */}
                    {field.field_type === 'file_upload' && (
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded border border-amber-300">
                        <input
                          type="checkbox"
                          checked={field.track_expiry}
                          onChange={(e) => updateField(idx, { track_expiry: e.target.checked })}
                          className="rounded text-amber-600 focus:ring-amber-500 border-amber-400"
                        />
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>Track Expiry (Perishable Document)</span>
                      </label>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href="/workflows"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Workflows List
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 shadow-2xs"
            >
              Preview Form
            </button>
            {isPublished ? (
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50"
              >
                Save as Version {nextVersionNumber}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 shadow-2xs disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                >
                  Publish Workflow
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {showPreview && (
        <WorkflowPreviewModal
          schema={schema}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Post-Publish Invitation Generator Modal */}
      {showInviteModal && (
        <InvitationModal
          workflowId={workflowId}
          workflowName={workflowName}
          onClose={() => {
            setShowInviteModal(false);
            router.push('/workflows');
          }}
        />
      )}
    </div>
  );
}

export default function EditWorkflowPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-slate-700 font-semibold">Loading editor...</div>}>
      <EditWorkflowContent />
    </Suspense>
  );
}
