'use client';

import React, { useState } from 'react';
import { X, Eye, UploadCloud, Calendar, ShieldCheck, CheckCircle2, Lock, Send, FileText } from 'lucide-react';
import { WorkflowSchemaDefinition } from '@/lib/types';

interface WorkflowPreviewModalProps {
  schema: WorkflowSchemaDefinition | null;
  onClose: () => void;
}

export const WorkflowPreviewModal: React.FC<WorkflowPreviewModalProps> = ({ schema, onClose }) => {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  if (!schema) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Banner */}
        <div className="px-5 py-3 bg-amber-100 text-amber-950 text-xs font-semibold flex items-center justify-between border-b border-amber-300">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-800 shrink-0" />
            <span>Interactive Manager Preview Mode — This is how invited vendors will experience your Google Forms-style onboarding portal.</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-200 rounded text-amber-900 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Google Forms Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#f0ebf8] flex-1">
          {/* Header Card with Google Forms Signature Top Stripe */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
            <div className="h-2.5 bg-[#673ab7]" />
            <div className="p-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-2xl sm:text-3xl font-normal text-slate-900 tracking-tight">
                  {schema.name}
                </h2>
                <span className="self-start sm:self-center text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-[#673ab7] border border-purple-200">
                  {schema.vendor_category}
                </span>
              </div>
              {schema.description && (
                <p className="text-sm text-slate-700 font-normal leading-relaxed">
                  {schema.description}
                </p>
              )}
              <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-medium">
                  <Lock className="w-3.5 h-3.5 text-[#673ab7]" />
                  <span>Submitting to: <strong className="text-slate-900">Your Organization</strong> (vendor@company.com)</span>
                </div>
                <div className="text-rose-600 font-medium">
                  * Indicates required question
                </div>
              </div>
            </div>
          </div>

          {/* Question Cards */}
          {schema.fields.map((field) => {
            const isActive = activeFieldId === field.id;
            return (
              <div
                key={field.id}
                onClick={() => setActiveFieldId(field.id)}
                className={`bg-white rounded-lg p-6 shadow-2xs border transition-all ${
                  isActive
                    ? 'border-slate-300 border-l-[6px] border-l-[#673ab7]'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <label className="text-base font-normal text-slate-900 leading-snug cursor-pointer">
                    <span>{field.label}</span>
                    {field.required && <span className="text-rose-600 ml-1 font-bold">*</span>}
                  </label>
                  {field.track_expiry && (
                    <span className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded shrink-0 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      <span>Expiry Required</span>
                    </span>
                  )}
                </div>

                {field.help_text && (
                  <p className="text-xs text-slate-500 font-normal mb-3 leading-relaxed">
                    {field.help_text}
                  </p>
                )}

                {/* Render field control preview */}
                {field.field_type === 'file_upload' ? (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-slate-500 font-normal">
                      Upload supported file: {field.allowed_file_types?.map(t => t.split('/')[1]?.toUpperCase()).join(', ') || 'PDF, JPG, PNG'} (Max {field.max_file_size_mb || 10} MB)
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#673ab7] border border-slate-300 rounded-md text-sm font-medium shadow-2xs opacity-80"
                      >
                        <UploadCloud className="w-4 h-4 text-[#673ab7]" />
                        <span>Add file</span>
                      </button>
                    </div>

                    {field.track_expiry && (
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-700" />
                          <span>Certificate Expiration Date <span className="text-rose-600">*</span>:</span>
                        </label>
                        <input
                          type="date"
                          disabled
                          className="border-0 border-b border-slate-300 py-1 px-2 text-sm text-slate-900 bg-transparent"
                        />
                      </div>
                    )}
                  </div>
                ) : field.field_type === 'dropdown' ? (() => {
                  const opts = (field.options && field.options.length > 0)
                    ? field.options
                    : (field.validation?.options && field.validation.options.length > 0)
                    ? field.validation.options
                    : ['Option 1', 'Option 2', 'Option 3'];
                  return (
                    <div className="pt-1">
                      <select
                        disabled
                        className="min-w-[220px] text-sm px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 font-normal"
                      >
                        <option value="">Choose</option>
                        {opts.map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })() : field.field_type === 'long_text' ? (
                  <div className="pt-1">
                    <textarea
                      disabled
                      rows={2}
                      placeholder="Your answer"
                      className="w-full border-0 border-b border-slate-300 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-none"
                    />
                  </div>
                ) : field.field_type === 'checkbox' ? (() => {
                  const opts = (field.options && field.options.length > 0)
                    ? field.options
                    : (field.validation?.options && field.validation.options.length > 0)
                    ? field.validation.options
                    : ['I confirm and agree to this requirement'];
                  return (
                    <div className="pt-2 space-y-2.5">
                      {opts.map((opt, i) => (
                        <label key={i} className="flex items-start gap-3 cursor-pointer text-sm text-slate-800 font-normal">
                          <input
                            type="checkbox"
                            disabled
                            className="w-4 h-4 mt-0.5 rounded text-[#673ab7] border-slate-400"
                          />
                          <span className="leading-snug">{opt}</span>
                        </label>
                      ))}
                    </div>
                  );
                })() : field.field_type === 'date' ? (
                  <div className="pt-1">
                    <input
                      type="date"
                      disabled
                      className="border-0 border-b border-slate-300 py-2 text-sm text-slate-900 bg-transparent"
                    />
                  </div>
                ) : (
                  <div className="pt-1">
                    <input
                      type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
                      disabled
                      placeholder="Your answer"
                      className="w-full sm:w-3/5 border-0 border-b border-slate-300 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Action Bar preview */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled
                className="px-6 py-2 bg-[#673ab7] text-white text-sm font-medium rounded shadow-xs flex items-center gap-2 opacity-80"
              >
                <Send className="w-4 h-4" />
                <span>Submit</span>
              </button>

              <button
                type="button"
                disabled
                className="text-sm font-medium text-[#673ab7] px-3 py-2 rounded"
              >
                Clear form
              </button>
            </div>

            <span className="text-xs text-slate-500 font-normal hidden sm:inline">
              Never submit passwords through this form.
            </span>
          </div>

          <div className="text-center pt-4 pb-6 space-y-1 text-xs text-slate-500">
            <div className="flex items-center justify-center gap-1 font-medium text-slate-600">
              <ShieldCheck className="w-4 h-4 text-[#673ab7]" />
              <span>Secured by FormGate Enterprise Onboarding</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
