'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  Search,
  AlertCircle,
  FileCheck,
  ChevronDown,
  Trash2,
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { VendorListItem } from '@/lib/types';

interface UploadDocumentModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialVendorId?: string;
}

const COMMON_DOC_TYPES = [
  'Tax Certificate (GST / PAN / W-9)',
  'Commercial Liability Insurance',
  'Business Registration Certificate',
  'Non-Disclosure Agreement (NDA)',
  'Bank Account Proof / Void Cheque',
  'ISO 27001 / SOC 2 Security Audit'
];

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  onClose,
  onSuccess,
  initialVendorId
}) => {
  // State
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(initialVendorId || '');
  const [vendorSearch, setVendorSearch] = useState('');
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [documentType, setDocumentType] = useState(COMMON_DOC_TYPES[0]);
  const [customDocumentType, setCustomDocumentType] = useState('');
  const [isCustomType, setIsCustomType] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState<'APPROVED' | 'UNDER_REVIEW'>('APPROVED');

  const [loading, setLoading] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch vendors on mount
  useEffect(() => {
    const fetchVendorsList = async () => {
      try {
        setLoadingVendors(true);
        const data = await api.listVendors();
        setVendors(data);
        if (!selectedVendorId && data.length > 0) {
          setSelectedVendorId(data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load vendors', err);
      } finally {
        setLoadingVendors(false);
      }
    };
    fetchVendorsList();
  }, []);

  // Close vendor dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsVendorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter vendors based on search query
  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.contact_email.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.category && v.category.toLowerCase().includes(vendorSearch.toLowerCase()))
  );

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  // File handling
  const handleFileSelect = (selectedFile: File) => {
    setErrorMsg('');
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      setErrorMsg('Invalid file format. Please upload a PDF, PNG, or JPEG file.');
      return;
    }
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSizeBytes) {
      setErrorMsg('File exceeds 10MB size limit. Please upload a smaller file.');
      return;
    }
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Quick date presets
  const setQuickExpiry = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setExpiryDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) {
      setErrorMsg('Please select a supplier / vendor.');
      return;
    }

    const finalDocType = isCustomType ? customDocumentType.trim() : documentType.trim();
    if (!finalDocType) {
      setErrorMsg('Please specify a document type or select one from the presets.');
      return;
    }

    if (!file) {
      setErrorMsg('Please select or drop a file to upload.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      await api.uploadDocument({
        vendorId: selectedVendorId,
        documentType: finalDocType,
        file: file,
        expiryDate: expiryDate ? expiryDate : undefined,
        status: status
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload document. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Upload Vendor Document</h2>
              <p className="text-xs text-slate-600 font-medium">Add compliance files or signed agreements on behalf of a vendor</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* 1. Vendor Selector (Searchable Dropdown) */}
          <div className="space-y-1.5" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Supplier / Vendor <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsVendorDropdownOpen(!isVendorDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-900 transition-all shadow-2xs text-left focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {selectedVendor ? (
                  <div className="flex items-center gap-2.5 truncate">
                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-bold text-slate-900 truncate">{selectedVendor.name}</span>
                    <span className="text-slate-500 text-[11px] truncate">({selectedVendor.contact_email})</span>
                  </div>
                ) : (
                  <span className="text-slate-400 font-normal">
                    {loadingVendors ? 'Loading suppliers...' : 'Select a vendor...'}
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </button>

              {/* Dropdown Menu */}
              {isVendorDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                    <input
                      type="text"
                      placeholder="Search vendor by name, email, or category..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="w-full text-xs bg-transparent border-0 focus:outline-hidden text-slate-800 placeholder:text-slate-400 font-medium"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {filteredVendors.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No matching suppliers found.
                      </div>
                    ) : (
                      filteredVendors.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVendorId(v.id);
                            setIsVendorDropdownOpen(false);
                            setVendorSearch('');
                          }}
                          className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between transition-colors ${
                            selectedVendorId === v.id ? 'bg-indigo-50/70' : ''
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">{v.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">{v.contact_email}</div>
                          </div>
                          {v.category && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {v.category}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Document Type */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Document Type <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomType(!isCustomType)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {isCustomType ? '← Choose from common presets' : '+ Enter custom title'}
              </button>
            </div>

            {isCustomType ? (
              <input
                type="text"
                placeholder="e.g. Master Services Agreement, ISO 9001, Trade License"
                value={customDocumentType}
                onChange={(e) => setCustomDocumentType(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-900 shadow-2xs"
                autoFocus
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {COMMON_DOC_TYPES.map((type) => {
                  const isSelected = documentType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDocumentType(type)}
                      className={`text-left p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <div className="truncate">{type}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. File Drag-and-Drop */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              File Attachment <span className="text-rose-500">*</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-slate-200 flex items-center justify-center mx-auto text-indigo-600 mb-2.5">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Click to select file or drag and drop here
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Supports PDF, PNG, JPG (maximum size 10MB)
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 truncate">{file.name}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {formatFileSize(file.size)} • {file.type || 'Document'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Expiration Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Certificate Expiration Date (Optional)</span>
              </label>
              {expiryDate && (
                <button
                  type="button"
                  onClick={() => setExpiryDate('')}
                  className="text-[11px] text-rose-600 hover:underline font-medium"
                >
                  Clear date
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="flex-1 text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-semibold shadow-2xs"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickExpiry(6)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors border border-slate-200"
                >
                  +6 Mo
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiry(12)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors border border-slate-200"
                >
                  +1 Yr
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiry(24)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors border border-slate-200"
                >
                  +2 Yrs
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              If supplied, VendorFlow automatically monitors renewal milestones at 30, 7, and 1 days prior to expiry.
            </p>
          </div>

          {/* 5. Status Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Verification Status
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Auto-mark APPROVED */}
              <div
                onClick={() => setStatus('APPROVED')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  status === 'APPROVED'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-1 rounded-full mt-0.5 ${status === 'APPROVED' ? 'bg-emerald-600 text-white' : 'text-slate-400 bg-slate-100'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Mark as Approved</div>
                  <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                    Instantly verifies the document. Bypasses the review queue.
                  </div>
                </div>
              </div>

              {/* Option B: Send to UNDER_REVIEW */}
              <div
                onClick={() => setStatus('UNDER_REVIEW')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  status === 'UNDER_REVIEW'
                    ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-1 rounded-full mt-0.5 ${status === 'UNDER_REVIEW' ? 'bg-blue-600 text-white' : 'text-slate-400 bg-slate-100'}`}>
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Send to Review Queue</div>
                  <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                    Places document under review for secondary compliance inspection.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !file || !selectedVendorId}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
