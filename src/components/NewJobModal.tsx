import React, { useState, useEffect } from 'react';
import { X, Plus, Compass, User, Mail, Phone, Home, DollarSign, Calendar, CheckCircle2, Receipt, ShieldCheck } from 'lucide-react';
import { Job, JobPhase, StaffUser } from '../types';
import { STAFF_USERS } from '../data/mockData';

interface NewJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateJob: (newJob: Job) => void;
  staffList?: StaffUser[];
}

export const NewJobModal: React.FC<NewJobModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateJob, 
  staffList = STAFF_USERS 
}) => {
  if (!isOpen) return null;

  const availableStaff = staffList && staffList.length > 0 ? staffList : STAFF_USERS;
  
  // Format drafter display label: "Name, Title"
  const getStaffOptionValue = (staff: StaffUser) => {
    return staff.title ? `${staff.name}, ${staff.title}` : staff.name;
  };

  const defaultDrafter = availableStaff.find(s => s.role === 'drafter' || s.role === 'drafter_lead') || availableStaff[0];
  const initialDrafterValue = defaultDrafter ? getStaffOptionValue(defaultDrafter) : 'Kyle, Lead Project Manager & Senior Drafter';

  const [jobNumber, setJobNumber] = useState(() => `M26-${Math.floor(210 + Math.random() * 80)}`);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [assignedDrafter, setAssignedDrafter] = useState(initialDrafterValue);
  const [sqFt, setSqFt] = useState(2500);
  const [style, setStyle] = useState('Modern Farmhouse');
  const [lotDetails, setLotDetails] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(3200);

  // Upfront Deposit / Retainer fields
  const [depositCollected, setDepositCollected] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(1600); // 50% default
  const [depositDate, setDepositDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [depositNotes, setDepositNotes] = useState('');

  // Synchronize default drafter if staffList changes
  useEffect(() => {
    if (!assignedDrafter && availableStaff.length > 0) {
      setAssignedDrafter(getStaffOptionValue(availableStaff[0]));
    }
  }, [availableStaff]);

  const handleQuickDepositPct = (pct: number) => {
    const calculated = Math.round(estimatedCost * pct);
    setDepositAmount(calculated);
    setDepositCollected(true);
  };

  const netBalanceDue = Math.max(0, estimatedCost - (depositCollected ? (depositAmount || 0) : 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim()) return;

    const finalJobNumber = jobNumber.trim() || `M26-${Math.floor(210 + Math.random() * 80)}`;
    const effectiveDepositAmount = depositCollected ? Math.max(0, Number(depositAmount || 0)) : 0;

    const newJob: Job = {
      id: `job-${Date.now()}`,
      job_number: finalJobNumber,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      customer_phone: customerPhone.trim() || '(555) 000-0000',
      assigned_drafter: assignedDrafter,
      sq_ft: Number(sqFt),
      style: style.trim(),
      lot_details: lotDetails.trim() || 'Standard suburban lot with standard setbacks.',
      current_status: 'Customer Inquiry',
      roadblock: false,
      layout_reviews_count: 0,
      max_reviews_included: 3,
      last_customer_contact: new Date().toISOString(),
      next_step: 'Conducting initial architectural scope intake & lot setback analysis.',
      created_at: new Date().toISOString(),
      target_completion_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      estimated_cost: Number(estimatedCost),
      hourly_rate: 85,
      deposit_collected: depositCollected && effectiveDepositAmount > 0,
      deposit_amount: effectiveDepositAmount,
      deposit_date: depositCollected ? depositDate : undefined,
      deposit_notes: depositCollected ? (depositNotes.trim() || `Upfront deposit collected for ${finalJobNumber}`) : undefined,
      comments: [
        {
          id: `c-${Date.now()}`,
          author: 'System Intake',
          role: 'system',
          text: `Intake order created for ${customerName} (${style} - ${sqFt} sq ft). Job / MPS Number: ${finalJobNumber}${
            depositCollected && effectiveDepositAmount > 0 
              ? ` • Upfront Deposit Collected: $${effectiveDepositAmount.toLocaleString()} (Net Invoice Balance: $${netBalanceDue.toLocaleString()})`
              : ''
          }`,
          timestamp: new Date().toISOString()
        }
      ],
      deliverables: [],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Job Intake Created',
          performedBy: assignedDrafter.split(',')[0],
          timestamp: new Date().toISOString(),
          details: `Registered new job with Job/MPS Number ${finalJobNumber}. Assigned to ${assignedDrafter}.${
            depositCollected && effectiveDepositAmount > 0
              ? ` Deposit recorded: $${effectiveDepositAmount.toLocaleString()} via ${depositNotes || 'Retainer'}.`
              : ''
          }`
        }
      ]
    };

    onCreateJob(newJob);
    onClose();

    // Reset fields
    setJobNumber(`M26-${Math.floor(210 + Math.random() * 80)}`);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setLotDetails('');
    setDepositCollected(false);
    setDepositAmount(1600);
    setDepositNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full my-8 overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-lg">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">New House Plan Intake</h3>
              <p className="text-xs text-slate-400">Register new drafting client project & configure initial deposit</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-blue-950 mb-1 flex items-center justify-between">
                <span>Job Number / MPS Number *</span>
                <span className="text-[10px] text-slate-500 font-mono font-normal">Primary Identifier (e.g., MPS-1042)</span>
              </label>
              <input
                type="text"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                placeholder="e.g. MPS-1042 or M26-215"
                className="w-full bg-blue-50/60 border border-blue-300 rounded-lg p-2.5 text-xs font-mono font-bold text-blue-950 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Full Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Jonathan & Clare Dupont"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Email *</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="jonathan@example.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Sq Footage</label>
                <input
                  type="number"
                  value={sqFt}
                  onChange={(e) => setSqFt(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Architectural Style</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Modern Farmhouse">Modern Farmhouse</option>
                  <option value="Craftsman Bungalow">Craftsman Bungalow</option>
                  <option value="Barndominium">Barndominium</option>
                  <option value="Coastal Cottage">Coastal Cottage</option>
                  <option value="Modern Villa">Modern Villa</option>
                  <option value="European Country">European Country</option>
                  <option value="Contemporary Ranch">Contemporary Ranch</option>
                </select>
              </div>
            </div>

            {/* ASSIGNED DRAFTER / ARCHITECT DROPDOWN - Populates all active drafters and team members */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Assigned Drafter / Architect *</span>
                <span className="text-[10px] text-blue-600 font-normal">All {availableStaff.length} team members available</span>
              </label>
              <select
                value={assignedDrafter}
                onChange={(e) => setAssignedDrafter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                required
              >
                <optgroup label="Drafting & Architectural Staff">
                  {availableStaff
                    .filter(s => s.role === 'drafter' || s.role === 'drafter_lead' || s.department === 'Architecture' || s.department === 'Drafting' || s.department === 'Engineering')
                    .map((staff) => {
                      const val = getStaffOptionValue(staff);
                      return (
                        <option key={staff.id} value={val}>
                          {val} ({staff.role === 'drafter_lead' ? 'Lead' : 'Drafter'})
                        </option>
                      );
                    })}
                </optgroup>
                <optgroup label="Management, Admin & Operations">
                  {availableStaff
                    .filter(s => !(s.role === 'drafter' || s.role === 'drafter_lead' || s.department === 'Architecture' || s.department === 'Drafting' || s.department === 'Engineering'))
                    .map((staff) => {
                      const val = getStaffOptionValue(staff);
                      return (
                        <option key={staff.id} value={val}>
                          {val} ({staff.role})
                        </option>
                      );
                    })}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Site / Lot Description</label>
              <textarea
                value={lotDetails}
                onChange={(e) => setLotDetails(e.target.value)}
                placeholder="Describe lot slope, orientation, HOA setbacks, pool zoning..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none h-16 resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimated Plan Package Fee ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  value={estimatedCost}
                  onChange={(e) => {
                    const newEst = Number(e.target.value);
                    setEstimatedCost(newEst);
                    if (depositCollected && depositAmount > newEst) {
                      setDepositAmount(newEst);
                    }
                  }}
                  className="w-full pl-7 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* DEPOSIT AMOUNT COLLECTED & BILLING INVOICE CALCULATION SECTION */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={depositCollected}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDepositCollected(checked);
                      if (checked && (!depositAmount || depositAmount === 0)) {
                        setDepositAmount(Math.round(estimatedCost * 0.5));
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Deposit / Upfront Retainer Collected</span>
                  </span>
                </label>

                {depositCollected && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    Deposit Active
                  </span>
                )}
              </div>

              {depositCollected && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  {/* Quick percentage shortcuts */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-medium">Quick Amount:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickDepositPct(0.5)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 transition cursor-pointer"
                    >
                      50% (${Math.round(estimatedCost * 0.5).toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDepositPct(0.33)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 transition cursor-pointer"
                    >
                      33% (${Math.round(estimatedCost * 0.33).toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDepositPct(0.25)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 transition cursor-pointer"
                    >
                      25% (${Math.round(estimatedCost * 0.25).toLocaleString()})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Deposit Amount Collected ($) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-emerald-600 font-bold">$</span>
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
                          placeholder="e.g. 1500"
                          className="w-full pl-7 bg-white border border-emerald-300 rounded-lg p-2 text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          required={depositCollected}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Date Collected
                      </label>
                      <input
                        type="date"
                        value={depositDate}
                        onChange={(e) => setDepositDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Deposit Reference / Payment Note
                    </label>
                    <input
                      type="text"
                      value={depositNotes}
                      onChange={(e) => setDepositNotes(e.target.value)}
                      placeholder="e.g. Check #1042, Stripe 50% Retainer, Wire transfer..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Net Invoicing Calculation Breakdown Box */}
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-600 font-sans">
                      <span>Total Estimated Project Fee:</span>
                      <span className="font-bold font-mono">${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-sans">
                      <span className="flex items-center gap-1">
                        <span>Less: Deposit Collected:</span>
                      </span>
                      <span className="font-bold font-mono">-${(depositAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-emerald-300 pt-1.5 flex justify-between text-emerald-950 font-bold font-sans text-[13px]">
                      <span>Remaining Balance to Invoice:</span>
                      <span className="text-emerald-800 font-mono">${netBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="pt-3 border-t flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Job Intake</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
