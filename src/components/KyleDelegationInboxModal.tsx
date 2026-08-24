import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Inbox, 
  CheckCircle2, 
  RotateCcw, 
  FileText, 
  Download, 
  ExternalLink, 
  Eye, 
  User, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Filter,
  Search,
  Sparkles,
  Paperclip,
  Check,
  ChevronRight
} from 'lucide-react';
import { Job, DelegatedWorkItem, DeliverableFile, StaffUser } from '../types';
import { STAFF_USERS } from '../data/mockData';
import { RequestRevisionModal } from './RequestRevisionModal';

interface KyleDelegationInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  currentStaff: StaffUser;
  onSelectJob: (job: Job) => void;
  onApproveTaskReview?: (jobId: string, taskId: string, reviewNote?: string) => void;
  onRequestTaskRevision?: (jobId: string, taskId: string, feedbackNote: string) => void;
  onOpenRevisionModal?: (task: DelegatedWorkItem, job?: Job) => void;
}

export const KyleDelegationInboxModal: React.FC<KyleDelegationInboxModalProps> = ({
  isOpen,
  onClose,
  jobs,
  currentStaff,
  onSelectJob,
  onApproveTaskReview,
  onRequestTaskRevision,
  onOpenRevisionModal,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'pending' | 'revisions' | 'approved' | 'all'>('pending');
  const [drafterFilter, setDrafterFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [revisionModalTask, setRevisionModalTask] = useState<{ task: DelegatedWorkItem; job?: Job } | null>(null);

  if (!isOpen) return null;

  // Extract all delegated tasks across all jobs
  const allTasks: DelegatedWorkItem[] = jobs.flatMap(j => 
    (j.delegated_tasks || []).map(t => ({
      ...t,
      jobId: t.jobId || j.id,
      jobNumber: t.jobNumber || j.job_number,
      customerName: t.customerName || j.customer_name
    }))
  );

  // Filter tasks based on selected tab and filters
  const filteredTasks = allTasks.filter(task => {
    // Kyle filter condition: items delegated by Kyle or items where Kyle is reviewer
    const isKyleDelegation = (task.delegatedBy || '').toLowerCase().includes('kyle') || !task.delegatedBy;

    if (selectedFilter === 'pending') {
      const isPending = (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
      if (!isPending) return false;
    } else if (selectedFilter === 'revisions') {
      const isRev = task.status === 'Revision Requested' || Boolean(task.revisionRequested);
      if (!isRev) return false;
    } else if (selectedFilter === 'approved') {
      const isAppr = task.status === 'Completed' && Boolean(task.isReviewed);
      if (!isAppr) return false;
    }

    if (drafterFilter !== 'all') {
      const matchDrafter = task.assignedTo.toLowerCase().includes(drafterFilter.toLowerCase());
      if (!matchDrafter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        task.componentTitle.toLowerCase().includes(q) ||
        (task.jobNumber || '').toLowerCase().includes(q) ||
        (task.customerName || '').toLowerCase().includes(q) ||
        task.assignedTo.toLowerCase().includes(q) ||
        (task.completionNotes || '').toLowerCase().includes(q);
      if (!matchSearch) return false;
    }

    return true;
  });

  // Keep a selected task active, or default to first
  const activeTask = filteredTasks.find(t => t.id === selectedTaskId) || filteredTasks[0] || null;
  const activeParentJob = activeTask ? jobs.find(j => j.id === activeTask.jobId || j.job_number === activeTask.jobNumber) : null;

  // Counts for tabs
  const pendingCount = allTasks.filter(t => (t.status === 'Completed' || t.status === 'Under Review') && !t.isReviewed).length;
  const revisionsCount = allTasks.filter(t => t.status === 'Revision Requested' || Boolean(t.revisionRequested)).length;
  const approvedCount = allTasks.filter(t => t.status === 'Completed' && Boolean(t.isReviewed)).length;

  const handleApprove = (task: DelegatedWorkItem) => {
    if (onApproveTaskReview) {
      onApproveTaskReview(task.jobId, task.id, approvalNote.trim() || 'Signed off & approved by Kyle');
      setApprovalNote('');
      setShowApprovalConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[90vh] max-h-[850px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono">Kyle's Delegation Review Inbox</h2>
                {pendingCount > 0 && (
                  <span className="text-[11px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full animate-pulse">
                    {pendingCount} Awaiting Review
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Direct submission inbox for completed delegated plan sets, sheet deliverables, and sign-offs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline-block">
              CC recipient: <strong className="text-slate-200">Jason (Director of Ops)</strong>
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Close Inbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedFilter('pending')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Pending Sign-Off ({pendingCount})</span>
            </button>

            <button
              onClick={() => setSelectedFilter('revisions')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedFilter === 'revisions'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>In Revisions ({revisionsCount})</span>
            </button>

            <button
              onClick={() => setSelectedFilter('approved')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approved & Signed Off ({approvedCount})</span>
            </button>

            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({allTasks.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Drafter filter */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={drafterFilter}
                onChange={(e) => setDrafterFilter(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Drafters</option>
                <option value="Aaron" className="bg-slate-900">Aaron</option>
                <option value="Carlos" className="bg-slate-900">Carlos</option>
                <option value="Sarah" className="bg-slate-900">Sarah</option>
                <option value="David" className="bg-slate-900">David</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inbox..."
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 w-36 sm:w-44"
              />
            </div>
          </div>
        </div>

        {/* Main 2-Pane Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden bg-slate-950">
          
          {/* Left Column: Submissions List */}
          <div className="md:col-span-5 lg:col-span-4 flex flex-col h-full min-h-0 bg-slate-900/60 overflow-y-auto divide-y divide-slate-800/80">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2 my-auto">
                <Inbox className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                <p className="font-semibold text-xs text-slate-400">No submissions in this queue</p>
                <p className="text-[11px]">When Aaron or other drafters mark delegated components complete, they will appear here.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isSelected = activeTask?.id === task.id;
                const isWaitingKyle = (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
                const isRevision = task.status === 'Revision Requested' || Boolean(task.revisionRequested);
                const isApproved = task.status === 'Completed' && Boolean(task.isReviewed);

                return (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setShowApprovalConfirm(false);
                    }}
                    className={`w-full text-left p-3.5 transition flex flex-col gap-1.5 cursor-pointer relative ${
                      isSelected
                        ? 'bg-slate-800/90 border-l-4 border-amber-500 text-white shadow-inner'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/80 px-1.5 py-0.5 rounded">
                          MPS #{task.jobNumber}
                        </span>
                        <span className="font-semibold text-slate-400">
                          {task.customerName}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400">
                        {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2 mt-0.5">
                      <div className="font-bold text-xs text-white line-clamp-1">
                        {task.componentTitle}
                      </div>
                      {isWaitingKyle && (
                        <span className="text-[9px] font-extrabold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-mono shrink-0 animate-pulse">
                          REVIEW
                        </span>
                      )}
                      {isRevision && (
                        <span className="text-[9px] font-extrabold bg-orange-600 text-white px-1.5 py-0.2 rounded font-mono shrink-0">
                          REV #{task.revisionCount || 1}
                        </span>
                      )}
                      {isApproved && (
                        <span className="text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-mono shrink-0">
                          APPROVED
                        </span>
                      )}
                    </div>

                    {/* Email preview line */}
                    <div className="text-[11px] text-slate-400 line-clamp-2 italic">
                      {task.completionNotes || task.neededWorkDescription || 'No description notes.'}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <div className="flex items-center gap-1 font-medium text-slate-300">
                        <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">
                          {task.assignedTo[0]}
                        </div>
                        <span>{task.assignedTo}</span>
                      </div>

                      {task.attachments && task.attachments.length > 0 && (
                        <span className="flex items-center gap-1 font-mono text-blue-400">
                          <Paperclip className="w-3 h-3" />
                          <span>{task.attachments.length} file{task.attachments.length === 1 ? '' : 's'}</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Email & Review Inspection Pane */}
          <div className="md:col-span-7 lg:col-span-8 flex flex-col h-full min-h-0 bg-slate-950 overflow-y-auto">
            {activeTask ? (
              <div className="p-6 space-y-5 flex-1">
                
                {/* Email Header Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                        Delegated Work Item Submission
                      </span>
                      <h3 className="text-base font-bold text-white mt-0.5">
                        {activeTask.componentTitle}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                        <span>Project:</span>
                        <strong className="text-blue-400 font-mono">MPS #{activeTask.jobNumber}</strong>
                        <span>•</span>
                        <span>{activeTask.customerName}</span>
                      </div>
                    </div>

                    {activeParentJob && (
                      <button
                        onClick={() => {
                          onSelectJob(activeParentJob);
                          onClose();
                        }}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>Open Blueprint</span>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    )}
                  </div>

                  {/* Email meta grid */}
                  <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-semibold w-12">From:</span>
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                          {activeTask.assignedTo[0]}
                        </div>
                        <strong className="text-white">{activeTask.assignedTo}</strong> (Drafter)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-semibold w-12">To:</span>
                      <span className="text-slate-200"><strong>Kyle</strong> (Lead Project Manager)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-semibold w-12">Cc:</span>
                      <span className="bg-indigo-950 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded text-[11px] font-medium">
                        Jason (Director of Operations)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-semibold w-12">Date:</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {activeTask.completedAt ? new Date(activeTask.completedAt).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Drafter Email Message Content */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span>Drafter's Submission Message & Notes:</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Category: {activeTask.category}
                    </span>
                  </div>

                  <div className="bg-slate-950/90 border border-slate-800/90 p-4 rounded-lg text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                    {activeTask.completionNotes || `Kyle,\n\nThe work for ${activeTask.componentTitle} on ${activeTask.jobNumber} — ${activeTask.customerName} has been completed and is ready for review.\n\nPlease review and approve or return with revisions.\n\n${activeTask.assignedTo}`}
                  </div>
                </div>

                {/* Attached Deliverables & Files */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-blue-400" />
                      <span>Attached Deliverables & Review Files ({activeTask.attachments?.length || 0})</span>
                    </span>
                  </div>

                  {activeTask.attachments && activeTask.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeTask.attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs group hover:border-slate-700 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded bg-blue-900/50 text-blue-400 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-200 truncate">{file.name}</p>
                              <span className="text-[10px] text-slate-500 font-mono">{file.size}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {file.url && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-400 hover:text-blue-400 rounded transition cursor-pointer"
                                title="Inspect deliverable"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No external attachments linked to this item.</p>
                  )}
                </div>

                {/* Review Actions Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Review Action for Kyle:</span>
                    </span>

                    {activeTask.isReviewed ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>Signed off by {activeTask.reviewedBy || 'Kyle'}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400 font-medium">
                        Action required: Review sheet and approve or request revision
                      </span>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRevisionModalTask({ task: activeTask, job: activeParentJob || undefined });
                      }}
                      className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Request Revisions from {activeTask.assignedTo}</span>
                    </button>

                    {onApproveTaskReview && !activeTask.isReviewed && (
                      <button
                        type="button"
                        onClick={() => handleApprove(activeTask)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer active:scale-95"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Sign Off & Approve Deliverable</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 my-auto">
                <p>Select a submission from the list on the left to review.</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Request Revision Modal inside Inbox */}
      {revisionModalTask && (
        <RequestRevisionModal
          isOpen={Boolean(revisionModalTask)}
          task={revisionModalTask.task}
          job={revisionModalTask.job}
          currentStaff={currentStaff}
          onClose={() => setRevisionModalTask(null)}
          onSubmitRevision={(jobId, taskId, feedbackNote) => {
            if (onRequestTaskRevision) {
              onRequestTaskRevision(jobId, taskId, feedbackNote);
            }
            setRevisionModalTask(null);
            setSelectedFilter('revisions');
          }}
        />
      )}
    </div>
  );
};
