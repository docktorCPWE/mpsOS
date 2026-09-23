import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  Upload, 
  FileText, 
  Paperclip, 
  Trash2, 
  Send, 
  Clock, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  Download, 
  Layers, 
  UserCheck, 
  BellRing,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Mail,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { Job, DelegatedWorkItem, DeliverableFile, TaskAttachment, StaffUser } from '../types';
import { STAFF_USERS } from '../data/mockData';
import { DELEGATION_COMPLETION_TEMPLATES, DelegationEmailTemplate } from '../data/delegationEmailTemplates';

export interface CompleteTaskPayload {
  jobId: string;
  taskId: string;
  resolutionNotes: string;
  reviewFiles: TaskAttachment[];
  deliverableSheets: DeliverableFile[];
  addToJobDeliverables: boolean;
  loggedHours?: number;
  loggedTaskDescription?: string;
  notifyDelegator: boolean;
  delegatorName: string;
  delegatorEmail?: string;
}

interface CompleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: DelegatedWorkItem | null;
  job?: Job | null;
  currentStaff: StaffUser;
  onCompleteTask: (payload: CompleteTaskPayload) => void;
}

const SAMPLE_REVIEW_FILES: { name: string; size: string; type: string; category: DeliverableFile['category']; url: string }[] = [
  {
    name: 'Foundation_Slab_Structural_Rev2.pdf',
    size: '4.2 MB',
    type: 'application/pdf',
    category: 'Foundation Plan',
    url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Kitchen_Island_Millwork_Detail.dwg',
    size: '5.8 MB',
    type: 'application/acad',
    category: 'CAD / DWG File',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Exterior_Elevations_Final_Render.jpg',
    size: '2.9 MB',
    type: 'image/jpeg',
    category: 'Exterior Elevations',
    url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
  }
];

export const CompleteTaskModal: React.FC<CompleteTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  job,
  currentStaff,
  onCompleteTask,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('preliminary_plan_completed');
  const [completionNotes, setCompletionNotes] = useState('');
  const [reviewFiles, setReviewFiles] = useState<TaskAttachment[]>([]);
  const [fileCategories, setFileCategories] = useState<Record<string, DeliverableFile['category']>>({});
  const [addToDeliverables, setAddToDeliverables] = useState(true);
  const [loggedHours, setLoggedHours] = useState('');
  const [timeTaskDescription, setTimeTaskDescription] = useState('');
  const [notifyDelegator, setNotifyDelegator] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-populate template on mount or task change
  useEffect(() => {
    if (!task) return;

    // Detect most appropriate initial template based on task properties
    let initialTemplateId = 'preliminary_plan_completed';
    const cat = (task.category || '').toLowerCase();
    const title = (task.componentTitle || '').toLowerCase();

    if (task.revisionRequested || task.status === 'Revision Requested' || title.includes('revision') || title.includes('post-final')) {
      initialTemplateId = 'revisions_after_finals_completed';
    } else if (title.includes('change') || title.includes('preliminary changes') || title.includes('redline')) {
      initialTemplateId = 'changes_to_preliminary_completed';
    } else if (cat.includes('elevation') || title.includes('elevation')) {
      initialTemplateId = 'elevations_completed';
    } else if (cat.includes('final') || title.includes('final') || title.includes('construction doc') || cat.includes('electrical')) {
      initialTemplateId = 'final_construction_docs_completed';
    }

    setSelectedTemplateId(initialTemplateId);

    const tmpl = DELEGATION_COMPLETION_TEMPLATES.find(t => t.id === initialTemplateId);
    if (tmpl) {
      const generated = tmpl.generateText({
        projectNumber: task.jobNumber ? `#${task.jobNumber.replace(/^#/, '')}` : (job ? `#${job.job_number.replace(/^#/, '')}` : '#1042'),
        customerName: task.customerName || (job ? job.customer_name : 'Customer'),
        drafterName: currentStaff.name || 'Aaron',
        attachedFiles: reviewFiles.map(f => f.name),
        dateStr: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        revisionCount: task.revisionCount || 1
      });
      setCompletionNotes(generated);
    }
  }, [task, job?.id, currentStaff.name]);

  if (!isOpen || !task) return null;

  const delegator = task.delegatedBy || 'Kyle';
  const isDelegatedByKyle = delegator.toLowerCase().includes('kyle');

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setErrorMsg('');

    if (templateId === 'custom') {
      setCompletionNotes(`Kyle,\n\nThe work for ${task.componentTitle} on #${(task.jobNumber || job?.job_number || '').replace(/^#/, '')} — ${task.customerName || job?.customer_name} has been completed and is ready for review.\n\nFiles:\n${reviewFiles.length > 0 ? reviewFiles.map(f => `• ${f.name}`).join('\n') : '[FILE LINKS OR ATTACHMENTS]'}\n\nDrafter notes:\n[NOTES]\n\nPlease review and either approve it or return with corrections.\n\n${currentStaff.name}`);
      return;
    }

    const tmpl = DELEGATION_COMPLETION_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      const text = tmpl.generateText({
        projectNumber: task.jobNumber ? `#${task.jobNumber.replace(/^#/, '')}` : (job ? `#${job.job_number.replace(/^#/, '')}` : '#1042'),
        customerName: task.customerName || (job ? job.customer_name : 'Customer'),
        drafterName: currentStaff.name || 'Aaron',
        attachedFiles: reviewFiles.map(f => f.name),
        dateStr: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        revisionCount: task.revisionCount || 1
      });
      setCompletionNotes(text);
    }
  };

  const handleSyncFilesIntoEmail = () => {
    if (reviewFiles.length === 0) return;
    const fileListText = reviewFiles.map(f => `• ${f.name} (${f.size})`).join('\n');
    
    if (completionNotes.includes('Files:\n')) {
      // Replace between Files:\n and next section
      const regex = /Files:\n([\s\S]*?)(\n\n[A-Z]|\nDrafter|\nItems|\nPlease|\n\[DRAFTER)/;
      if (regex.test(completionNotes)) {
        setCompletionNotes(prev => prev.replace(regex, `Files:\n${fileListText}\n$2`));
        return;
      }
    }
    
    // Append or replace generic placeholder
    if (completionNotes.includes('[FILE LINKS OR ATTACHMENTS]') || completionNotes.includes('[UPDATED FILE LINKS OR ATTACHMENTS]') || completionNotes.includes('[FINAL PDF LINKS OR ATTACHMENTS]') || completionNotes.includes('[REVISED FILE LINKS OR ATTACHMENTS]')) {
      setCompletionNotes(prev => 
        prev.replace(/\[(FILE LINKS OR ATTACHMENTS|UPDATED FILE LINKS OR ATTACHMENTS|FINAL PDF LINKS OR ATTACHMENTS|REVISED FILE LINKS OR ATTACHMENTS)\]/g, fileListText)
      );
    }
  };

  // Handle local file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newItems: TaskAttachment[] = [];
    const newCats: Record<string, DeliverableFile['category']> = { ...fileCategories };

    Array.from(files).forEach((file: File, index: number) => {
      const fileId = `att-comp-${Date.now()}-${index}`;
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const defaultCat: DeliverableFile['category'] = 
          file.name.toLowerCase().endsWith('.dwg') ? 'CAD / DWG File' :
          file.name.toLowerCase().includes('foundation') ? 'Foundation Plan' :
          file.name.toLowerCase().includes('elevation') ? 'Exterior Elevations' :
          file.name.toLowerCase().includes('render') ? '3D Render' :
          file.name.toLowerCase().includes('electrical') ? 'Electrical & Reflected Ceiling' :
          'Floor Plan';

        newCats[fileId] = defaultCat;

        setReviewFiles(prev => [
          ...prev,
          {
            id: fileId,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            type: file.type || 'application/octet-stream',
            url: dataUrl
          }
        ]);
        setFileCategories({ ...newCats });
      };

      reader.readAsDataURL(file);
    });

    setIsUploading(false);
  };

  // Add preset sample file
  const handleAddSampleFile = (sample: typeof SAMPLE_REVIEW_FILES[0]) => {
    const fileId = `att-sample-${Date.now()}-${Math.random()}`;
    if (!reviewFiles.some(f => f.name === sample.name)) {
      setReviewFiles(prev => [
        ...prev,
        {
          id: fileId,
          name: sample.name,
          size: sample.size,
          type: sample.type,
          url: sample.url
        }
      ]);
      setFileCategories(prev => ({
        ...prev,
        [fileId]: sample.category
      }));
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setReviewFiles(prev => prev.filter(f => f.id !== fileId));
    const nextCats = { ...fileCategories };
    delete nextCats[fileId];
    setFileCategories(nextCats);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionNotes.trim()) {
      setErrorMsg('Please enter a brief completion note or review summary for Kyle.');
      return;
    }

    const delegatorStaff = STAFF_USERS.find(s => s.name.toLowerCase().includes(delegator.toLowerCase()));

    // Create DeliverableFile objects for project gallery if option selected
    const deliverableSheets: DeliverableFile[] = reviewFiles.map(f => {
      const cat = fileCategories[f.id] || 'Floor Plan';
      return {
        id: `deliv-${Date.now()}-${f.id}`,
        title: f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        category: cat,
        version: `v2.${Date.now().toString().slice(-2)} (Review)`,
        uploadedAt: new Date().toISOString(),
        fileSize: f.size,
        previewType: cat === 'CAD / DWG File' ? 'cad_file' : cat === '3D Render' ? 'render_image' : cat === 'Exterior Elevations' ? 'canvas_elevation' : 'pdf_spec',
        fileUrl: f.url,
        fileName: f.name,
        changeNotes: `Submitted for review on delegated task "${task.componentTitle}". Notes: ${completionNotes.trim()}`,
        authorDrafter: currentStaff.name
      };
    });

    const payload: CompleteTaskPayload = {
      jobId: task.jobId,
      taskId: task.id,
      resolutionNotes: completionNotes.trim(),
      reviewFiles,
      deliverableSheets,
      addToJobDeliverables: addToDeliverables,
      loggedHours: loggedHours ? parseFloat(loggedHours) : undefined,
      loggedTaskDescription: timeTaskDescription.trim() || `Drafting & Review Prep: ${task.componentTitle}`,
      notifyDelegator,
      delegatorName: delegator,
      delegatorEmail: delegatorStaff?.email || `${delegator.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`
    };

    onCompleteTask(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b shrink-0 text-white ${
          task.status === 'Revision Requested' || task.revisionRequested
            ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-orange-800 border-amber-900'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${
              task.status === 'Revision Requested' || task.revisionRequested ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-emerald-600'
            }`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-white">
                  {task.status === 'Revision Requested' || task.revisionRequested 
                    ? `Submit Revised Deliverable (Rev #${task.revisionCount || 1})` 
                    : 'Mark Task Completed & Submit for Review'}
                </h3>
                <span className="text-xs sm:text-sm font-mono font-black bg-black text-white border border-slate-700 px-2.5 py-0.5 rounded shadow-xs tracking-wide">
                  #{task.jobNumber.replace(/^#/, '')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {task.customerName} • Delegated by <strong className="text-amber-300 font-semibold">{delegator}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg transition hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-700 overflow-y-auto flex-1">
          
          {/* Revision Instructions Alert if Revision Requested */}
          {(task.status === 'Revision Requested' || task.revisionRequested) && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 space-y-1.5 text-amber-950 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wide text-amber-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                  <span>Revision Request from {task.revisionRequestedBy || delegator}</span>
                </div>
                {task.revisionRequestedAt && (
                  <span className="text-[10px] text-amber-800 font-mono">
                    {new Date(task.revisionRequestedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="bg-white/90 p-3 rounded-lg border border-amber-300 text-xs leading-relaxed font-medium">
                "{task.revisionNotes || task.notes || 'Please make the requested adjustments and upload new deliverable files.'}"
              </div>
            </div>
          )}

          {/* Task Context Card */}
          <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono">
                  Assigned Work Component
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{task.componentTitle}</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold bg-white text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded">
                  {task.category}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  task.priority === 'Urgent'
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : task.priority === 'High'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {task.priority} Priority
                </span>
              </div>
            </div>

            {task.neededWorkDescription && (
              <div className="pt-2 border-t border-indigo-100 text-slate-600 text-xs">
                <span className="font-semibold text-indigo-900 block mb-0.5">Original Task Brief:</span>
                <p className="bg-white/80 p-2.5 rounded-lg border border-indigo-100 italic leading-relaxed">
                  "{task.neededWorkDescription}"
                </p>
              </div>
            )}
          </div>

          {/* Email Composer & Review Summary for Kyle */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <label className="block font-bold text-slate-900 text-xs">
                    Completion Notice & Email Composer for {delegator} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Select template below and customize email body</span>
                </div>
              </div>

              {/* Template Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600 hidden sm:inline">Template:</span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="bg-white border border-slate-300 hover:border-blue-500 text-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer shadow-2xs"
                >
                  <option value="preliminary_plan_completed">1. Preliminary plan completed</option>
                  <option value="changes_to_preliminary_completed">2. Changes to preliminary plan completed</option>
                  <option value="elevations_completed">3. Elevations completed</option>
                  <option value="final_construction_docs_completed">4. Final construction documents completed</option>
                  <option value="revisions_after_finals_completed">5. Revisions after finals completed</option>
                  <option value="custom">Custom / Freeform Notice</option>
                </select>
              </div>
            </div>

            {/* Email Metadata Simulation Header */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold w-12 text-[11px]">To:</span>
                <span className="font-semibold text-slate-800">
                  {delegator} &lt;{delegator.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com&gt;
                </span>
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                  Lead Reviewer
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold w-12 text-[11px]">Cc:</span>
                <span className="font-semibold text-slate-800">
                  Jason &lt;jason@myplanstore.com&gt;
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded font-mono font-bold">
                  ✓ Automatically CC'd
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold w-12 text-[11px]">From:</span>
                <span className="font-semibold text-slate-700">
                  {currentStaff.name} &lt;{currentStaff.email || `${currentStaff.name.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`}&gt;
                </span>
              </div>
            </div>

            {/* Sync Files Button */}
            {reviewFiles.length > 0 && (
              <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 p-2 rounded-lg text-xs text-blue-950">
                <div className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                  <span>{reviewFiles.length} file(s) attached ready to include in notice.</span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncFilesIntoEmail}
                  className="bg-white hover:bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-1 rounded border border-blue-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync Files into Email Text</span>
                </button>
              </div>
            )}

            {/* Email Body Editor */}
            <div className="space-y-1">
              <textarea
                value={completionNotes}
                onChange={(e) => {
                  setCompletionNotes(e.target.value);
                  if (e.target.value.trim()) setErrorMsg('');
                }}
                placeholder="Compose completion email notes for Kyle..."
                className="w-full bg-white border border-slate-300 rounded-xl p-3.5 text-xs text-slate-900 font-mono h-48 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y leading-relaxed"
                required
              />
              <p className="text-[10px] text-slate-400 text-right">
                Tip: Replace bracketed text like [MAIN FLOOR] or [NOTES] with project details.
              </p>
            </div>

            {errorMsg && (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          {/* Upload Deliverables & Review Files */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  <span>Upload Files / Deliverables for {delegator}'s Review</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Attach revised CAD sheets (.dwg), high-res floor plans (.pdf), or 3D renderings (.jpg)
                </p>
              </div>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                {reviewFiles.length} file{reviewFiles.length === 1 ? '' : 's'} attached
              </span>
            </div>

            {/* Drag & Drop Upload Zone */}
            <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition text-center group">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition" />
              <span className="font-bold text-slate-800 text-xs">
                Click to browse or drop completed drawing files here
              </span>
              <span className="text-[10px] text-slate-400">
                Supports PDF, DWG, DXF, PNG, JPG, ZIP (multi-file selection enabled)
              </span>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.zip"
              />
            </label>

            {/* Quick Sample File Presets */}
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-slate-500 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Add Sample Sheet:</span>
              </span>
              {SAMPLE_REVIEW_FILES.map(sample => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => handleAddSampleFile(sample)}
                  className="bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 px-2.5 py-1 rounded-lg text-[11px] transition flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3 h-3 text-blue-500" />
                  <span>{sample.name}</span>
                </button>
              ))}
            </div>

            {/* Attached Files List */}
            {reviewFiles.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {reviewFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{file.name}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{file.size}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={fileCategories[file.id] || 'Floor Plan'}
                        onChange={(e) => {
                          setFileCategories({
                            ...fileCategories,
                            [file.id]: e.target.value as DeliverableFile['category']
                          });
                        }}
                        className="bg-white border border-slate-300 text-slate-700 text-[11px] font-semibold rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="Floor Plan">Floor Plan</option>
                        <option value="Foundation Plan">Foundation Plan</option>
                        <option value="Exterior Elevations">Exterior Elevations</option>
                        <option value="Electrical & Reflected Ceiling">Electrical & Reflected Ceiling</option>
                        <option value="CAD / DWG File">CAD / DWG File</option>
                        <option value="PDF Specs">PDF Specs</option>
                        <option value="3D Render">3D Render</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                        title="Remove attached file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Checkbox: Add to Deliverables */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addToDeliverables}
                onChange={(e) => setAddToDeliverables(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-700 font-medium">
                Publish uploaded files directly to project's official <strong>Deliverables / Drawing Sheets</strong> tab
              </span>
            </label>
          </div>

          {/* Optional Quick Time Log Entry */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Log Drafting Time Spent (Optional)</span>
              </span>
              <span className="text-[10px] text-slate-400">Adds session to project time sheet</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={timeTaskDescription}
                  onChange={(e) => setTimeTaskDescription(e.target.value)}
                  placeholder={`Drafting: ${task.componentTitle}`}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>
              <div>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={loggedHours}
                  onChange={(e) => setLoggedHours(e.target.value)}
                  placeholder="Hours (e.g. 2.0)"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Review Notification Handoff Summary Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <BellRing className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-emerald-950 text-xs block">
                    Instant Notification for {delegator} (Lead Project Manager)
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    Dispatched to {delegator}'s Ops Notification Center & email log
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-emerald-900">
                <input
                  type="checkbox"
                  checked={notifyDelegator}
                  onChange={(e) => setNotifyDelegator(e.target.checked)}
                  className="w-3.5 h-3.5 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500"
                />
                <span>Notify {delegator}</span>
              </label>
            </div>

            {/* Notification preview box */}
            <div className="bg-white/90 p-3 rounded-lg border border-emerald-200/80 text-[11px] space-y-1 text-slate-700">
              <div className="flex justify-between font-mono font-bold text-emerald-900 border-b border-emerald-100 pb-1">
                <span>🔔 Task Completed: {task.componentTitle}</span>
                <span className="text-[10px] text-slate-400">Just now</span>
              </div>
              <p className="text-slate-600 mt-1">
                <strong className="text-slate-800">{currentStaff.name}</strong> has completed the delegated component on{' '}
                <span className="font-mono font-black text-xs bg-black text-white px-2 py-0.5 rounded shadow-xs">#{task.jobNumber.replace(/^#/, '')}</span> ({task.customerName}).
              </p>
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3 pt-1">
                <span>📁 {reviewFiles.length} file(s) attached</span>
                <span>👤 Drafter: {currentStaff.name}</span>
                <span>📅 {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

        </form>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark Task Completed & Submit to {delegator}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
