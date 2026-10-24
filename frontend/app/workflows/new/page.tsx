'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Share2,
  X
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { WorkflowPreviewModal } from '@/components/WorkflowPreviewModal';
import { InvitationModal } from '@/components/InvitationModal';
import { api } from '@/lib/api';
import { WorkflowField, WorkflowSchemaDefinition, FieldType } from '@/lib/types';

export const PRESET_PROMPTS = [
  {
    title: 'CA Firm Client Tax & Statutory Audit Onboarding',
    category: 'CA & Tax Firms',
    badge: 'CA & Tax Firms',
    description: 'Document collection and verification for corporate client tax filing, statutory audit, and regulatory compliance.',
    prompt:
      'Collect PAN card, Aadhaar card, Certificate of Incorporation, last 3 years ITR acknowledgement, audited balance sheet and P&L statement, 12 months bank statement, and GST registration certificate. Bank statement and ITR must be verified. Administrator approval required. Send reminders 30 days before annual filing expiry.'
  },
  {
    title: 'Manufacturing & D2C Supplier Quality Onboarding',
    category: 'Manufacturing, D2C & Retail Procurement',
    badge: 'Manufacturing, D2C & Retail',
    description: 'Supplier quality verification, factory audit certificates, and regulatory product compliance.',
    prompt:
      'Collect factory audit report, BIS / ISO 9001 quality certificate, product lab test report, GST certificate, MSME registration, bank proof, and product liability insurance. Liability insurance and ISO quality certificate must have expiry tracking. Send reminders 60, 30, and 7 days prior to expiry.'
  },
  {
    title: 'Fleet Carrier & Transport Operator Verification',
    category: 'Logistics, Fleet Operators & 3PL Brokers',
    badge: 'Logistics, Fleet & 3PL',
    description: 'Commercial driver KYC, vehicle fitness certification, transport permits, and transit liability insurance.',
    prompt:
      'Collect commercial vehicle RC, national transport permit, vehicle fitness certificate, commercial driver license, pollution under control (PUC) certificate, and comprehensive goods transit insurance. Vehicle fitness, national permit, PUC, and transit insurance require expiry tracking. Administrator review mandatory. Send reminders 30 and 7 days before expiry.'
  },
  {
    title: 'Study Abroad & Student Visa Documentation Packet',
    category: 'Study Abroad, Visa & Immigration Consultants',
    badge: 'Study Abroad & Visa',
    description: 'Applicant identity verification, language proficiency scorecards, academic records, and financial solvency proof.',
    prompt:
      'Collect passport front and back copy, IELTS or TOEFL English proficiency scorecard, official university transcripts, financial solvency bank certificate, statement of purpose, and police clearance certificate. Passport, language scorecard, and police clearance must have expiry tracking. Administrator approval required. Send reminders 60 and 30 days before expiry.'
  },
  {
    title: 'Clinical Practitioner & Healthcare Staffing Credentialing',
    category: 'Hospitals, Healthcare Staffing & HR Agencies',
    badge: 'Hospitals & Healthcare Staffing',
    description: 'Doctor and nurse licensing, clinical credentials, life-support certifications, and malpractice coverage.',
    prompt:
      'Collect State Medical Council registration, nursing or medical degree certificate, BLS / ACLS life support certification, background check report, immunization record, and medical malpractice insurance. Medical council registration, BLS/ACLS certificate, and malpractice insurance must have expiry tracking. Mandatory administrator verification. Send reminders 45, 30, and 7 days before expiry.'
  }
];

export default function NewWorkflowPage() {
  const router = useRouter();

  // Step 1: Prompt & Metadata
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0].prompt);
  const [workflowName, setWorkflowName] = useState(PRESET_PROMPTS[0].title);
  const [vendorCategory, setVendorCategory] = useState(PRESET_PROMPTS[0].category);
  const [description, setDescription] = useState(PRESET_PROMPTS[0].description);

  // States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Step 2 & 3: Structured Workflow Definition
  const [schema, setSchema] = useState<WorkflowSchemaDefinition | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [publishedWorkflowId, setPublishedWorkflowId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Generate with AI
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMsg('Please enter or paste your onboarding requirements.');
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMsg('');
      const generated = await api.generateWorkflowAI(
        prompt,
        workflowName,
        vendorCategory,
        description
      );
      setSchema(generated);
      if (generated.name) setWorkflowName(generated.name);
      if (generated.vendor_category) setVendorCategory(generated.vendor_category);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate workflow schema');
    } finally {
      setIsGenerating(false);
    }
  };

  // Field editing handlers
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
      label: 'New Document / Information Field',
      field_type: 'file_upload',
      required: true,
      help_text: 'Please upload the requested document.',
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

  // Publish / Save
  const handleSaveOrPublish = async (publish: boolean = false) => {
    if (!schema) return;

    try {
      setIsSaving(true);
      setErrorMsg('');

      // Create workflow in backend
      const created = await api.createWorkflow({
        name: workflowName,
        vendor_category: vendorCategory,
        description: description,
        schema_definition: schema,
        approval_required: schema.approval_required,
        reminder_rules: schema.reminder_rules
      });

      if (publish) {
        const published = await api.publishWorkflow(created.id);
        setPublishedWorkflowId(published.id);
        setShowInviteModal(true);
        setSuccessMsg('Workflow published successfully! You can now invite vendors.');
      } else {
        setSuccessMsg('Workflow draft saved successfully!');
        router.push('/workflows');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav
        title="AI Workflow Generator"
        subtitle="Transform plain-English requirements into an automated, production-ready vendor onboarding workflow"
        actions={
          <Link
            href="/workflows"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workflows</span>
          </Link>
        }
      />

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: AI Prompt Input Section */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-50/70 via-white to-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-5 h-5 text-indigo-100" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Step 1: Document Collection Requirements</h2>
                <p className="text-xs text-slate-700 font-medium">Select a curated industry preset or describe your custom document collection rules</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Industry Presets Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Select Industry & Use-Case Preset:
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Click a preset to auto-load standard documents & rules
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_PROMPTS.map((p, i) => {
                  const isSelected = selectedPresetIndex === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedPresetIndex(i);
                        setPrompt(p.prompt);
                        setWorkflowName(p.title);
                        setVendorCategory(p.category);
                        setDescription(p.description);
                        setSchema(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                          : 'bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 border-slate-300'
                      }`}
                    >
                      {p.badge}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">Workflow Title</label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">Target Industry / Category</label>
                <input
                  type="text"
                  value={vendorCategory}
                  onChange={(e) => setVendorCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1">
                Plain-English Compliance & Document Instructions
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Example: Collect PAN card, Aadhaar, ITR acknowledgement, audited balance sheet, 12 months bank statement, and GST certificate. Bank statement and ITR must be verified. Administrator approval required."
                className="w-full text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder-slate-500 font-sans leading-relaxed font-medium"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-slate-700 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>Automatic schema inference • Safe sandboxed execution • Zero hardcoded fields</span>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm shadow-indigo-600/20 disabled:opacity-50 transition-all"
              >
                <Sparkles className={`w-4 h-4 text-indigo-200 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'Analyzing & Building Schema...' : 'Generate Workflow with AI'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* STEP 2 & 3: Interactive Workflow Builder */}
        {schema && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-6">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Step 2: Interactive Workflow Builder</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {schema.fields.length} Fields Generated
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  Review and customize labels, types, expiry rules, and reminder intervals before publishing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>Preview Vendor View</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOrPublish(false)}
                  disabled={isSaving}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOrPublish(true)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/20"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Publish Workflow</span>
                </button>
              </div>
            </div>

            {/* AI Assumptions & Warnings Callout */}
            <div className="px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {schema.assumptions?.length > 0 && (
                <div className="p-3.5 bg-blue-50 border border-blue-300 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-700" />
                    <span>AI Inferred Assumptions</span>
                  </div>
                  <ul className="list-disc list-inside text-blue-900 space-y-1 pl-1 font-medium">
                    {schema.assumptions.map((item, idx) => (
                      <li key={idx} className="text-xs">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {schema.warnings?.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Compliance Guidance</span>
                  </div>
                  <ul className="list-disc list-inside text-amber-950 space-y-1 pl-1 font-medium">
                    {schema.warnings.map((item, idx) => (
                      <li key={idx} className="text-xs">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Workflow Configuration Strip: Approvals & Reminders */}
            <div className="mx-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
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
                <span className="bg-white px-2.5 py-1 rounded border border-slate-300 font-mono text-slate-900 font-bold">
                  {schema.reminder_rules.join(', ')} days before expiry
                </span>
              </div>
            </div>

            {/* Editable Fields List */}
            <div className="px-6 space-y-3 pb-6">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Configured Fields & Documents</span>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field Manually</span>
                </button>
              </div>

              {schema.fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Label Input */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Field Label</label>
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

                    {/* Reorder and Delete controls */}
                    <div className="flex items-center gap-1 pt-6 text-slate-600">
                      <button
                        type="button"
                        onClick={() => moveField(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 hover:text-slate-900 disabled:opacity-30"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, 'down')}
                        disabled={idx === schema.fields.length - 1}
                        className="p-1 hover:text-slate-900 disabled:opacity-30"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        className="p-1 hover:text-rose-600 text-slate-600"
                        title="Delete field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Options Editor (for dropdown & checkbox fields) */}
                  {(field.field_type === 'dropdown' || field.field_type === 'checkbox') && (() => {
                    const currentOpts = (field.options && field.options.length > 0)
                      ? field.options
                      : (field.validation?.options && field.validation.options.length > 0)
                      ? field.validation.options
                      : (field.field_type === 'dropdown'
                          ? ['Option 1', 'Option 2']
                          : ['I confirm and agree to this requirement']);

                    const setOptions = (newOpts: string[]) => {
                      updateField(idx, {
                        options: newOpts,
                        validation: {
                          ...field.validation,
                          options: newOpts
                        }
                      });
                    };

                    const isDropdown = field.field_type === 'dropdown';

                    return (
                      <div className="pt-3 border-t border-slate-100 space-y-2.5 bg-slate-50/50 -mx-4 px-4 py-3 rounded-b-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                              <span>{isDropdown ? 'Dropdown Choices / Selectable Options' : 'Checkbox Choices / Agreement Options'}</span>
                              <span className="text-[10px] font-semibold text-slate-500 lowercase">
                                ({currentOpts.length} {currentOpts.length === 1 ? 'choice' : 'choices'})
                              </span>
                            </span>
                            <p className="text-[10px] text-slate-500 font-normal">
                              {isDropdown
                                ? 'Vendors select one option from this list in the dropdown menu.'
                                : '1 choice creates a single-confirmation checkbox; 2+ choices create a multi-select checklist.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Quick Presets */}
                            <div className="hidden sm:flex items-center gap-1 text-[10px]">
                              <span className="text-slate-400 font-medium">Presets:</span>
                              {isDropdown ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setOptions(['Private Limited / Corporation', 'LLC / LLP', 'Partnership', 'Sole Proprietorship'])}
                                    className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Entity
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOptions(['Net 30 Days', 'Net 60 Days', 'Net 15 Days', 'Immediate / Advance'])}
                                    className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Terms
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOptions(['Yes', 'No'])}
                                    className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Yes/No
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setOptions(['I certify that all submitted business details and documents are authentic and accurate.'])}
                                    className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Single Agreement
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOptions(['ISO 9001 Quality Management', 'SOC 2 Type II Certified', 'GDPR / Privacy Compliant'])}
                                    className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Compliance
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setOptions(['Primary Services', 'Technical Consulting', 'Maintenance & SLA Support'])}
                                    className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    Multi-Scope
                                  </button>
                                </>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = [...currentOpts, isDropdown ? `Option ${currentOpts.length + 1}` : `Choice ${currentOpts.length + 1}`];
                                setOptions(newOpts);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[11px] font-bold flex items-center gap-1 border border-indigo-200 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Choice</span>
                            </button>
                          </div>
                        </div>

                        {/* List of option chips / editors */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {currentOpts.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-2xs group hover:border-indigo-400 transition-colors"
                            >
                              <span className="text-[10px] font-bold text-slate-400 select-none">
                                #{optIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...currentOpts];
                                  updated[optIdx] = e.target.value;
                                  setOptions(updated);
                                }}
                                className={`text-xs text-slate-900 bg-transparent outline-none font-medium ${
                                  opt.length > 25 ? 'w-64 sm:w-80' : 'w-32 sm:w-44'
                                }`}
                                placeholder={isDropdown ? 'Choice text...' : 'Agreement or checklist item...'}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = currentOpts.filter((_, i) => i !== optIdx);
                                  setOptions(updated);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer rounded transition-colors"
                                title="Delete option"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Help text & toggles */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                    <input
                      type="text"
                      value={field.help_text || ''}
                      onChange={(e) => updateField(idx, { help_text: e.target.value })}
                      placeholder="Optional helper text or guidance for vendor..."
                      className="flex-1 text-[11px] px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-900 placeholder-slate-500 font-medium"
                    />

                    <div className="flex items-center gap-4">
                      {/* Required Toggle */}
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
                          <span>Track Expiry</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {showPreview && (
        <WorkflowPreviewModal
          schema={schema}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Post-Publish Invitation Generator Modal */}
      {showInviteModal && publishedWorkflowId && (
        <InvitationModal
          workflowId={publishedWorkflowId}
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
