import React, { useState } from 'react';
import { X, Mail, Phone, MapPin, User, Save, Building, CheckCircle2, Layers } from 'lucide-react';
import { Job } from '../types';

export interface EditCustomerContactModalProps {
  job: Job;
  allJobs?: Job[];
  isOpen: boolean;
  onClose: () => void;
  onSaveContact: (updatedContact: {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    project_address?: string;
    updateAllPlans?: boolean;
    currentJobId: string;
  }) => void;
  performedByRole?: 'staff' | 'customer';
}

export const EditCustomerContactModal: React.FC<EditCustomerContactModalProps> = ({
  job,
  allJobs = [],
  isOpen,
  onClose,
  onSaveContact,
  performedByRole = 'staff'
}) => {
  const [customerName, setCustomerName] = useState(job.customer_name || '');
  const [email, setEmail] = useState(job.customer_email || '');
  const [phone, setPhone] = useState(job.customer_phone || '');
  const [address, setAddress] = useState(job.project_address || '');
  const [updateAllPlans, setUpdateAllPlans] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  // Find other active or non-archived plans associated with this customer
  const otherPlansForCustomer = allJobs.filter(
    (j) => j.id !== job.id && j.customer_name.toLowerCase().trim() === job.customer_name.toLowerCase().trim()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSaveContact({
      customer_name: customerName.trim() || job.customer_name,
      customer_email: email.trim(),
      customer_phone: phone.trim(),
      project_address: address.trim(),
      updateAllPlans: updateAllPlans && otherPlansForCustomer.length > 0,
      currentJobId: job.id
    });

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                Update Customer Contact Info
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {job.customer_name} • Plan #{job.job_number}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {performedByRole === 'staff' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Customer / Account Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Full Name"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com (or multiple separated by ;)"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports multiple email addresses separated by semicolons (e.g. <span className="font-mono text-slate-600">john@home.com; mary@home.com</span>).
            </p>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
          </div>

          {/* Project / Site Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Project / Site Delivery Address
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Builder Way, Rogers, AR 72758"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
              />
            </div>
          </div>

          {/* Sync with other plans if customer has multiple active plans */}
          {otherPlansForCustomer.length > 0 && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateAllPlans}
                  onChange={(e) => setUpdateAllPlans(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="text-xs text-slate-800">
                  <span className="font-bold block text-blue-900">
                    Sync to all {otherPlansForCustomer.length + 1} plans for {job.customer_name}
                  </span>
                  <span className="text-slate-600 mt-0.5 block">
                    Automatically update contact records across plans: {otherPlansForCustomer.map(p => `#${p.job_number}`).join(', ')}
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaved}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm flex items-center gap-1.5 active:scale-95 disabled:bg-emerald-600"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Contact Info</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
