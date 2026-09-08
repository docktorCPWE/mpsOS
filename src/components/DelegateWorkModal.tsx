import React, { useState } from 'react';
import { X, Send, Paperclip, FileText, CheckCircle2, UserCheck, AlertCircle, Calendar, Sparkles, Upload, FileCheck, Trash2, ArrowRight } from 'lucide-react';
import { Job, DelegatedWorkItem, TaskAttachment, StaffUser } from '../types';
import { STAFF_USERS } from '../data/mockData';

interface DelegateWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  currentStaff: StaffUser;
  onDelegateTask: (task: DelegatedWorkItem, notifyDrafter: boolean) => void;
}

const COMMON_COMPONENT_PRESETS = [
  'Foundation & Stem Wall Structural Detail',
  'Kitchen Island & Hidden Pantry Millwork CAD',
  'Main Floor Electrical & Lighting Layout',
  'Truss & Roof Overhang Engineering Calculations',
  'Front & Rear 3D Exterior Rendering',
  'Site Setbacks & Coastal Flood Plain Plan',
  'HVAC & Mechanical Duct Chase Plan',
  'Window & Door Architectural Schedule'
];

const PRESET_SAMPLE_FILES: TaskAttachment[] = [
  {
    id: 'att-sample-1',
    name: 'Topography_Civil_Survey.pdf',
    size: '3.1 MB',
    type: 'application/pdf',
    url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'att-sample-2',
    name: 'CAD_Redlines_Markup.dwg',
    size: '6.4 MB',
    type: 'application/acad',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'att-sample-3',
    name: 'Cabinetry_Reference_Photo.jpg',
    size: '1.9 MB',
    type: 'image/jpeg',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
  }
];

export const DelegateWorkModal: React.FC<DelegateWorkModalProps> = ({
  isOpen,
  onClose,
  job,
  currentStaff,
  onDelegateTask,
}) => {
  const [componentTitle, setComponentTitle] = useState('');
  const [category, setCategory] = useState<DelegatedWorkItem['category']>('Floor Plan');
  const [assignedTo, setAssignedTo] = useState('James');
  const [priority, setPriority] = useState<DelegatedWorkItem['priority']>('Normal');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [neededWorkDescription, setNeededWorkDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [notifyDrafter, setNotifyDrafter] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  // Filter staff to potential drafter assignees
  const drafterCandidates = STAFF_USERS.filter(s => s.name !== currentStaff.name);

  const handleAddSampleFile = (sample: TaskAttachment) => {
    if (!attachments.some(a => a.name === sample.name)) {
      setAttachments(prev => [...prev, { ...sample, id: `att-${Date.now()}-${Math.random()}` }]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setTimeout(() => {
      const newFiles: TaskAttachment[] = Array.from(files).map((f: File, i: number) => ({
        id: `att-upload-${Date.now()}-${i}`,
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
        type: f.type || 'application/octet-stream',
        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
      }));

      setAttachments(prev => [...prev, ...newFiles]);
      setIsUploading(false);
    }, 400);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!componentTitle.trim()) {
      alert('Please provide a component title for the delegated work.');
      return;
    }

    const assignedStaff = STAFF_USERS.find(s => s.name === assignedTo);

    const newTask: DelegatedWorkItem = {
      id: `del-${Date.now()}`,
      jobId: job.id,
      jobNumber: job.job_number,
      customerName: job.customer_name,
      componentTitle: componentTitle.trim(),
      category,
      priority,
      assignedTo,
      assignedToEmail: assignedStaff?.email || `${assignedTo.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
      delegatedBy: currentStaff.name,
      delegatedAt: new Date().toISOString(),
      dueDate,
      neededWorkDescription: neededWorkDescription.trim(),
      notes: notes.trim() || undefined,
      status: 'Pending',
      attachments: attachments.length > 0 ? attachments : undefined
    };

    onDelegateTask(newTask, notifyDrafter);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Delegate Work Component</h3>
                <span className="text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">
                  MPS #{job.job_number}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {job.customer_name} • Delegator: <strong className="text-blue-300">{currentStaff.name}</strong> ({currentStaff.title})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          
          {/* Quick Preset Chips */}
          <div>
            <label className="block font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span>Quick Component Presets</span>
              <span className="text-[10px] text-slate-400 font-normal">Click to auto-fill title</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_COMPONENT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setComponentTitle(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition border ${
                    componentTitle === preset
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Component Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-900 mb-1">
                Component / Work Item Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={componentTitle}
                onChange={(e) => setComponentTitle(e.target.value)}
                placeholder="e.g. Foundation & Stem Wall Structural Detail"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-900 mb-1">Work Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="Floor Plan">Floor Plan</option>
                <option value="Exterior Elevations">Exterior Elevations</option>
                <option value="Foundation Plan">Foundation Plan</option>
                <option value="Structural Details">Structural Details</option>
                <option value="Electrical & Reflected Ceiling">Electrical & Lighting</option>
                <option value="3D Render">3D Render & Perspective</option>
                <option value="Site Plan">Site Plan & Topography</option>
                <option value="CAD Modeling">CAD Modeling</option>
                <option value="Revisions">Revisions</option>
                <option value="General">General Task</option>
              </select>
            </div>
          </div>

          {/* Assignee, Priority & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-900 mb-1">
                Delegate To (Drafter) <span className="text-red-500">*</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none cursor-pointer"
              >
                {drafterCandidates.map((staff) => (
                  <option key={staff.id} value={staff.name}>
                    {staff.name} ({staff.title})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-900 mb-1">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className={`w-full border rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer ${
                  priority === 'Urgent'
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : priority === 'High'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-slate-50 text-slate-800 border-slate-300'
                }`}
              >
                <option value="Normal">Normal Priority</option>
                <option value="High">High Priority</option>
                <option value="Urgent">🚨 Urgent / Blocking</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-900 mb-1">Target Due Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Description of Needed Work */}
          <div>
            <label className="block font-bold text-slate-900 mb-1">
              Needed Work Description & Instructions <span className="text-red-500">*</span>
            </label>
            <textarea
              value={neededWorkDescription}
              onChange={(e) => setNeededWorkDescription(e.target.value)}
              placeholder="Clearly describe the technical drafting requirements, dimensions, municipal codes, or CAD drawing components needed..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none h-24 resize-none leading-relaxed"
              required
            />
          </div>

          {/* Notes & Special Instructions */}
          <div>
            <label className="block font-bold text-slate-900 mb-1">
              Notes & Background Reference (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add client preferences, specific redline comments, engineer notes, or coordinate with other sheets..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none h-16 resize-none"
            />
          </div>

          {/* File Attachments Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  <span>File Attachments & CAD Drawings ({attachments.length})</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Attach reference blueprints, CAD sketches, surveys, or redlines for the delegated drafter.
                </p>
              </div>

              {/* Upload Input */}
              <label className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Quick Sample Attachments Picker */}
            <div className="pt-2 border-t border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Quick Architectural Reference Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_SAMPLE_FILES.map((sample) => (
                  <button
                    key={sample.name}
                    type="button"
                    onClick={() => handleAddSampleFile(sample)}
                    className="flex items-center gap-1 text-[11px] bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 px-2 py-1 rounded-lg text-slate-700 transition"
                  >
                    <FileText className="w-3 h-3 text-blue-500" />
                    <span>+ {sample.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Attached Files List */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="font-semibold text-slate-800 block">{file.name}</span>
                        <span className="text-[10px] text-slate-400">{file.size}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                      title="Remove attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automatic Notification Toggle Box */}
          <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 flex items-start gap-3">
            <input
              type="checkbox"
              id="notifyDrafterToggle"
              checked={notifyDrafter}
              onChange={(e) => setNotifyDrafter(e.target.checked)}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="notifyDrafterToggle" className="cursor-pointer text-xs">
              <span className="font-bold text-blue-950 block">
                Instant Drafter Notification & Message Alert
              </span>
              <span className="text-blue-800 text-[11px] block mt-0.5">
                Automatically dispatches an in-app notification and email alert to <strong>{assignedTo}</strong> with direct links to this component and attached files.
              </span>
            </label>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Delegate Component & Notify {assignedTo.split(' ')[0]}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
