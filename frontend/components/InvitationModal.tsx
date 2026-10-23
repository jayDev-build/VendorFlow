'use client';

import React, { useState } from 'react';
import { X, Send, Copy, Check, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface InvitationModalProps {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  workflowId,
  workflowName,
  onClose,
  onSuccess
}) => {
  const [email, setEmail] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.createInvitation(workflowId, email, vendorName, undefined, notes);
      setGeneratedUrl(res.invitation_url);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate invitation link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Invite Vendor to Onboard</h2>
            <p className="text-xs text-slate-700 font-medium mt-0.5 truncate max-w-xs">Workflow: {workflowName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {generatedUrl ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-950 text-xs font-bold">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>Invitation Successfully Generated!</span>
                </div>
                <p className="text-xs text-emerald-950 font-medium">
                  An email notification has been dispatched. You can also directly share this single-use secure onboarding link:
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    className="flex-1 text-xs font-mono bg-white border border-emerald-300 rounded-lg px-2.5 py-2 text-slate-900 font-semibold select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-700 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span>Protected with high-entropy cryptographically hashed token. Valid for 14 days.</span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Vendor Representative Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="compliance@vendorcompany.com"
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Vendor Company Name (Optional)
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Acme Supplier Inc."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  Internal Notes / Instructions (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal reference notes for this vendor..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Creating Invitation...' : 'Send Invitation & Link'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
