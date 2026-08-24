import React, { useState } from 'react';
import { X, Plus, Compass, User, Mail, Phone, Home, DollarSign, Calendar } from 'lucide-react';
import { Job, JobPhase } from '../types';

interface NewJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateJob: (newJob: Job) => void;
}

export const NewJobModal: React.FC<NewJobModalProps> = ({ isOpen, onClose, onCreateJob }) => {
  if (!isOpen) return null;

  const [jobNumber, setJobNumber] = useState(() => `M26-${Math.floor(210 + Math.random() * 80)}`);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [assignedDrafter, setAssignedDrafter] = useState('Sarah Jenkins, Senior Architect');
  const [sqFt, setSqFt] = useState(2500);
  const [style, setStyle] = useState('Modern Farmhouse');
  const [lotDetails, setLotDetails] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(3200);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerEmail.trim()) return;

    const finalJobNumber = jobNumber.trim() || `M26-${Math.floor(210 + Math.random() * 80)}`;

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
      comments: [
        {
          id: `c-${Date.now()}`,
          author: 'System Intake',
          role: 'system',
          text: `Intake order created for ${customerName} (${style} - ${sqFt} sq ft). Job / MPS Number: ${finalJobNumber}`,
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
          details: `Registered new job with Job/MPS Number ${finalJobNumber}`
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
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-lg">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">New House Plan Intake</h3>
              <p className="text-xs text-slate-400">Register new drafting client project</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
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
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Drafter / Architect</label>
              <select
                value={assignedDrafter}
                onChange={(e) => setAssignedDrafter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Sarah Jenkins, Senior Architect">Sarah Jenkins, Senior Architect</option>
                <option value="Alex Rivers, CAD Designer">Alex Rivers, CAD Designer</option>
                <option value="Elena Rostova, Structural Specialist">Elena Rostova, Structural Specialist</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Site / Lot Description</label>
              <textarea
                value={lotDetails}
                onChange={(e) => setLotDetails(e.target.value)}
                placeholder="Describe lot slope, orientation, HOA setbacks, pool zoning..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none h-20 resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimated Plan Package Fee ($)</label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

          </div>

          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl transition shadow-sm"
            >
              Create Job Intake
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
