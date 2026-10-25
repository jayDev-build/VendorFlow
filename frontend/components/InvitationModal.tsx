'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Copy,
  Check,
  Mail,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Link as LinkIcon,
  CheckCircle2
} from 'lucide-react';
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
  // Form link states
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [linkError, setLinkError] = useState('');
  const [copied, setCopied] = useState(false);

  // Email dispatch states
  const [email, setEmail] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [notes, setNotes] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Current session admin
  const [sessionUser, setSessionUser] = useState<any>(null);

  // Auto-generate form link as soon as modal opens
  const generateLink = async () => {
    try {
      setLoadingLink(true);
      setLinkError('');
      const res = await api.createInvitation(workflowId);
      setGeneratedUrl(res.invitation_url);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to generate onboarding link');
    } finally {
      setLoadingLink(false);
    }
  };

  useEffect(() => {
    const session = api.getCurrentSession();
    if (session.user) setSessionUser(session.user);
    generateLink();
  }, [workflowId]);

  const handleCopy = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setSendingEmail(true);
      setEmailError('');
      setEmailSuccess('');
      const res = await api.createInvitation(workflowId, email.trim(), vendorName.trim() || undefined, undefined, notes.trim() || undefined);
      // Update displayed link to the recipient's specific invitation link
      setGeneratedUrl(res.invitation_url);
      setEmailSuccess(`Invitation successfully sent to ${email}`);
      setEmail('');
      setVendorName('');
      setNotes('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setEmailError(err.message || 'Failed to dispatch email invitation');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white shadow-2xs">
                <LinkIcon className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Vendor Onboarding Form Link</h2>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5 truncate max-w-md">
              Workflow: <span className="text-slate-900 font-semibold">{workflowName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Section 1: Instant Shareable Form Link */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-950 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Shareable Onboarding Link</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live & Ready to Share
              </span>
            </div>

            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Anyone with this link can fill out the form, upload certificates, and submit without logging in. Share it via WhatsApp, Slack, SMS, or client portals:
            </p>

            {loadingLink ? (
              <div className="p-3 bg-white border border-indigo-200 rounded-lg flex items-center justify-center gap-2 text-xs text-indigo-600 font-medium">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating live form link...</span>
              </div>
            ) : linkError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between">
                <span>{linkError}</span>
                <button
                  onClick={generateLink}
                  className="font-semibold underline cursor-pointer hover:text-rose-900 ml-2"
                >
                  Retry
                </button>
              </div>
            ) : generatedUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 text-xs font-mono bg-white border border-indigo-300 rounded-lg px-3 py-2 text-slate-900 font-medium select-all shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={generatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                    title="Open live vendor form in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Open Form</span>
                  </a>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    Encrypted single-tenant token • Valid for 14 days
                  </span>
                  <button
                    type="button"
                    onClick={generateLink}
                    className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                    title="Generate a new distinct link"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate New Link</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Section 2: Optional Email Dispatch */}
          <div className="pt-2 border-t border-slate-200">
            <div className="mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Or send invitation directly via email
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                We'll dispatch an automated notification with this link and reply routing to your email address.
              </p>
            </div>

            {emailError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{emailError}</span>
              </div>
            )}

            {emailSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{emailSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSendEmail} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="compliance@vendor.com"
                      className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor Company Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Acme Supplier Inc."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internal Notes / Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Priority vendor for Q4 logistics rollout"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 font-medium placeholder-slate-400"
                />
              </div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {sessionUser ? `Sender: ${sessionUser.email}` : ''}
                </span>
                <button
                  type="submit"
                  disabled={sendingEmail || !email.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {sendingEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Invitation Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
