import React, { useState, useEffect } from 'react';
import { Kanban, Grid, List, Search, Filter, AlertTriangle, Layers, Plus, CheckCircle2, Clock, ShieldAlert, ArrowRight, Download, DollarSign, Play, Square, FileSpreadsheet, X, Share2, ListTodo, Paperclip, CheckCircle, UserCheck, Sparkles, FileText, ChevronDown, ChevronUp, User, ExternalLink, Users, Briefcase, Activity, Lock, RotateCcw } from 'lucide-react';
import { Job, JobPhase, StaffUser, DelegatedWorkItem } from '../types';
import { JobCard } from './JobCard';
import { calculateJobTotalSeconds, calculateJobBillableAmount, formatSecondsToReadable, exportInvoicingCSV } from '../utils/timeUtils';
import { STAFF_USERS } from '../data/mockData';
import { JasonDrafterProjectBoard } from './JasonDrafterProjectBoard';
import { RequestRevisionModal } from './RequestRevisionModal';

interface DrafterDashboardProps {
  jobs: Job[];
  currentStaff: StaffUser;
  onUpdateStatus: (jobId: string, newStatus: JobPhase) => void;
  onToggleRoadblock: (jobId: string) => void;
  onSelectJob: (job: Job) => void;
  onOpenNewJobModal: () => void;
  onStartTimer: (jobId: string, taskNote?: string) => void;
  onStopTimer: (jobId: string, taskNote?: string) => void;
  onOpenDelegateModal?: (job: Job) => void;
  onOpenCompleteTaskModal?: (task: DelegatedWorkItem, job: Job) => void;
  onUpdateTaskStatus?: (jobId: string, taskId: string, newStatus: DelegatedWorkItem['status']) => void;
  onApproveTaskReview?: (jobId: string, taskId: string, reviewNotes?: string) => void;
  onRequestTaskRevision?: (jobId: string, taskId: string, feedbackNotes: string) => void;
  onOpenKyleInbox?: () => void;
  nowTimestamp?: number;
}

const PHASES: JobPhase[] = [
  'Customer Inquiry',
  'Preliminary Layout',
  'Customer Review',
  'Revisions',
  'Exterior Elevations',
  'Construction Prints',
  'Completed',
];

export const DrafterDashboard: React.FC<DrafterDashboardProps> = ({
  jobs,
  currentStaff,
  onUpdateStatus,
  onToggleRoadblock,
  onSelectJob,
  onOpenNewJobModal,
  onStartTimer,
  onStopTimer,
  onOpenDelegateModal,
  onOpenCompleteTaskModal,
  onUpdateTaskStatus,
  onApproveTaskReview,
  onRequestTaskRevision,
  onOpenKyleInbox,
  nowTimestamp = Date.now(),
}) => {
  const [viewMode, setViewMode] = useState<'board' | 'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Determine if the current staff member is a dedicated drafter
  const isIndividualDrafter = currentStaff.role === 'drafter';

  // Initialize selectedDrafter: If current logged-in user is an individual drafter (e.g. James, Aaron, Sarah),
  // default strictly to their own name so only their assigned projects display.
  const [selectedDrafter, setSelectedDrafter] = useState<string>(() => {
    return isIndividualDrafter ? currentStaff.name : 'all';
  });
  
  const [roadblockOnly, setRoadblockOnly] = useState(false);
  const [showWorkloadMatrix, setShowWorkloadMatrix] = useState(false);
  const [showDelegationHub, setShowDelegationHub] = useState(true);
  const [showKyleReviewDrawer, setShowKyleReviewDrawer] = useState(false);
  const [delegationFilter, setDelegationFilter] = useState<'all' | 'my_assigned' | 'pending' | 'completed' | 'waiting_kyle' | 'revisions_requested' | 'approved'>('all');
  const [revisionModalTask, setRevisionModalTask] = useState<{ task: DelegatedWorkItem; job?: Job } | null>(null);

  // Whenever the active staff user is switched, update the board scope
  useEffect(() => {
    if (isIndividualDrafter) {
      setSelectedDrafter(currentStaff.name);
    } else if (selectedDrafter !== 'all') {
      // Check if selectedDrafter is still in drafter list
      const exists = STAFF_USERS.some(s => s.name.toLowerCase() === selectedDrafter.toLowerCase());
      if (!exists) setSelectedDrafter('all');
    }
  }, [currentStaff.id, currentStaff.name, isIndividualDrafter]);

  const canAccessFinancials = currentStaff.canAccessFinancials;
  const canDelegate = currentStaff.canDelegate;

  // Collect all delegated tasks across all jobs
  const allDelegatedTasks: DelegatedWorkItem[] = jobs.flatMap(j => j.delegated_tasks || []);

  // Comprehensive list of all drafters & team members
  const draftersList = Array.from(
    new Set([
      ...STAFF_USERS.map(s => s.name),
      ...jobs.map(j => j.assigned_drafter.split(',')[0].trim()),
      ...allDelegatedTasks.map(t => t.assignedTo.trim())
    ])
  ).filter(Boolean);

  // Helper function to check if a job belongs to a specific drafter
  const isJobAssignedToDrafter = (job: Job, drafterName: string) => {
    const drafterLower = drafterName.toLowerCase().trim();
    const isLead = job.assigned_drafter.toLowerCase().includes(drafterLower);
    const hasDelegated = (job.delegated_tasks || []).some(t => t.assignedTo.toLowerCase().includes(drafterLower));
    const hasTimeLogged = (job.time_logs || []).some(tl => (tl.drafterName || '').toLowerCase().includes(drafterLower));
    return isLead || hasDelegated || hasTimeLogged;
  };

  // Helper to calculate stats per drafter
  const getDrafterStats = (drafterName: string) => {
    const drafterLower = drafterName.toLowerCase();
    const relevantJobs = jobs.filter(j => isJobAssignedToDrafter(j, drafterName));
    const delegatedTasks = allDelegatedTasks.filter(t => 
      t.assignedTo.toLowerCase().includes(drafterLower)
    );
    const activeTasks = delegatedTasks.filter(t => t.status !== 'Completed' || (t.status === 'Completed' && !t.isReviewed));
    const hasActiveTimer = relevantJobs.some(j => Boolean(j.active_timer_start));

    return {
      projectCount: relevantJobs.length,
      delegatedCount: delegatedTasks.length,
      activeTasksCount: activeTasks.length,
      hasActiveTimer,
      relevantJobs
    };
  };

  // Active drafter target:
  // For individual drafters (e.g. James, Aaron, Sarah, Alex, Elena), target strictly currentStaff.name
  // For managers/leads (Jason, Greg, Kyle), target selectedDrafter ('all' or specific drafter)
  const activeDrafterTarget = isIndividualDrafter 
    ? (selectedDrafter !== 'all' ? selectedDrafter : currentStaff.name)
    : selectedDrafter;

  // Filter logic: Search by MPS / Job Number, Customer Name, House Style, or Drafter
  const filteredJobs = jobs.filter(job => {
    const q = searchQuery.toLowerCase().trim();
    
    let matchesSearch = true;
    if (q) {
      const cleanQuery = q.replace(/[^a-z0-9]/gi, '');
      const cleanJobNum = job.job_number.toLowerCase().replace(/[^a-z0-9]/gi, '');

      const matchesNumber = 
        job.job_number.toLowerCase().includes(q) ||
        `mps${job.job_number}`.toLowerCase().includes(q) ||
        `mps-${job.job_number}`.toLowerCase().includes(q) ||
        `mps ${job.job_number}`.toLowerCase().includes(q) ||
        (cleanQuery.length > 0 && cleanJobNum.includes(cleanQuery)) ||
        (cleanQuery.length > 0 && cleanQuery.includes(cleanJobNum));

      const matchesCustomer = job.customer_name.toLowerCase().includes(q);
      const matchesStyle = job.style.toLowerCase().includes(q);
      const matchesDrafterName = job.assigned_drafter.toLowerCase().includes(q);
      const matchesDelegatedTask = (job.delegated_tasks || []).some(t => 
        t.assignedTo.toLowerCase().includes(q) || t.componentTitle.toLowerCase().includes(q)
      );

      matchesSearch = matchesNumber || matchesCustomer || matchesStyle || matchesDrafterName || matchesDelegatedTask;
    }

    // Drafter filter: matches if drafter is assigned as lead drafter OR has delegated components OR has logged time
    let matchesDrafter = true;
    if (activeDrafterTarget !== 'all') {
      matchesDrafter = isJobAssignedToDrafter(job, activeDrafterTarget);
    }

    const matchesRoadblock = !roadblockOnly || job.roadblock;

    return matchesSearch && matchesDrafter && matchesRoadblock;
  });
  
  // Delegated tasks assigned to the current active user
  const myAssignedTasks = allDelegatedTasks.filter(
    t => t.assignedTo.toLowerCase().includes(currentStaff.name.toLowerCase()) ||
         currentStaff.name.toLowerCase().includes(t.assignedTo.toLowerCase())
  );

  // Completed items waiting for Kyle's review (strictly where !t.isReviewed)
  const tasksWaitingForKyle = allDelegatedTasks.filter(t => {
    const isKyleDelegator = (t.delegatedBy || '').toLowerCase().includes('kyle');
    const isCompleted = t.status === 'Completed' || t.status === 'Under Review';
    return isKyleDelegator && isCompleted && !t.isReviewed;
  });
  const waitingForKyleCount = tasksWaitingForKyle.length;

  // Revision requested tasks
  const tasksRevisionsRequested = allDelegatedTasks.filter(t => 
    t.status === 'Revision Requested' || Boolean(t.revisionRequested)
  );

  // Approved & signed off tasks
  const tasksApproved = allDelegatedTasks.filter(t => 
    t.status === 'Completed' && Boolean(t.isReviewed)
  );

  // Time & Invoicing Aggregate Calculations
  const totalTrackedSeconds = filteredJobs.reduce((acc, j) => acc + calculateJobTotalSeconds(j, nowTimestamp), 0);
  const totalInvoicingValue = filteredJobs.reduce((acc, j) => acc + calculateJobBillableAmount(j, nowTimestamp), 0);
  const runningTimers = filteredJobs.filter(j => j.active_timer_start);

  const activeDrafterStaff = STAFF_USERS.find(s => s.name.toLowerCase() === activeDrafterTarget.toLowerCase()) || (isIndividualDrafter ? currentStaff : undefined);
  const activeDrafterStats = activeDrafterTarget !== 'all' ? getDrafterStats(activeDrafterTarget) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {canDelegate ? 'Team Delegation & Drafter Studio' : 'Drafter Workspace Studio'}
            </h2>
            <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
              {filteredJobs.length} Active Plans
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <strong>{currentStaff.name}</strong> ({currentStaff.title}) • {canAccessFinancials ? 'Full Financial & Admin Access' : 'Drafter Permissions (Financials Confidential)'}
          </p>
        </div>

        {/* Action Controls: New Job & Export Invoicing */}
        <div className="flex flex-wrap items-center gap-2">
          {canAccessFinancials && (
            <button
              onClick={() => exportInvoicingCSV(filteredJobs)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              title="Download formatted time log CSV for the invoicing team"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Invoicing CSV</span>
            </button>
          )}

          {canDelegate && onOpenDelegateModal && jobs.length > 0 && (
            <button
              onClick={() => onOpenDelegateModal(jobs[0])}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              title="Delegate work component or sub-task to another drafter"
            >
              <Share2 className="w-4 h-4" />
              <span>+ Delegate Work Component</span>
            </button>
          )}

          {canDelegate && (
            <button
              onClick={() => setShowWorkloadMatrix(!showWorkloadMatrix)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer border shadow-xs ${
                showWorkloadMatrix
                  ? 'bg-indigo-700 text-white border-indigo-700 ring-2 ring-indigo-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}
              title="View Drafter Workload & Project Assignment Matrix"
            >
              <Users className="w-4 h-4" />
              <span>{showWorkloadMatrix ? 'Close Workload Matrix' : 'Team Workload Matrix'}</span>
            </button>
          )}

          <button
            onClick={onOpenNewJobModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Job Intake</span>
          </button>

          {/* View Switchers (Board / Grid / Table) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Grid Cards</span>
            </button>

            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                viewMode === 'board' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* PROMINENT "WAITING FOR KYLE TO REVIEW" INDICATOR BANNER (STRICTLY FOR KYLE) */}
      {currentStaff.name.toLowerCase().includes('kyle') && waitingForKyleCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-indigo-500/15 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-sm ring-4 ring-amber-400/10 transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-xs relative">
                <CheckCircle2 className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-ping"></span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-amber-950 tracking-tight">
                    Waiting for Kyle to review
                  </h3>
                  <span className="bg-amber-500 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs uppercase tracking-wider flex items-center gap-1">
                    <span>{waitingForKyleCount} {waitingForKyleCount === 1 ? 'item' : 'items'} in queue</span>
                  </span>
                </div>
                <p className="text-xs text-amber-900/90 mt-0.5">
                  Drafters have marked their delegated components as completed and uploaded deliverable files ready for Kyle's review and sign-off.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenKyleInbox && (
                <button
                  onClick={onOpenKyleInbox}
                  className="bg-slate-900 hover:bg-slate-850 text-amber-400 text-xs font-bold px-3 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-800"
                  title="Open Kyle's Dedicated Full Delegation Review Inbox"
                >
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open Full Inbox Modal</span>
                </button>
              )}
              <button
                onClick={() => {
                  setDelegationFilter('waiting_kyle');
                  setShowDelegationHub(true);
                  setShowKyleReviewDrawer(!showKyleReviewDrawer);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>{showKyleReviewDrawer ? 'Hide Quick Queue' : `View Quick Queue (${waitingForKyleCount})`}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showKyleReviewDrawer ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Expandable Review Queue Drawer */}
          {showKyleReviewDrawer && (
            <div className="mt-4 pt-4 border-t border-amber-300/60 space-y-3">
              <div className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-amber-700" />
                <span>Pending Submissions Ready for Kyle's Sign-Off:</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tasksWaitingForKyle.map(task => {
                  const parentJob = jobs.find(j => j.id === task.jobId || j.job_number === task.jobNumber);
                  return (
                    <div 
                      key={`kyle-rev-${task.id}`}
                      className="bg-white/95 rounded-xl p-3.5 border border-amber-300 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                              MPS #{task.jobNumber}
                            </span>
                            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                              {task.category}
                            </span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                              Completed by {task.completedBy || task.assignedTo}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 mt-1">{task.componentTitle}</h4>
                          <p className="text-[11px] text-slate-500">{task.customerName}</p>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Ready'}
                        </span>
                      </div>

                      {task.completionNotes && (
                        <p className="text-xs text-slate-700 bg-amber-50/50 p-2 rounded border border-amber-200/60 italic">
                          "{task.completionNotes}"
                        </p>
                      )}

                      {task.attachments && task.attachments.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-600">Attached Deliverables:</span>
                          {task.attachments.map(att => (
                            <span 
                              key={att.id}
                              className="bg-slate-50 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-2xs"
                            >
                              <FileText className="w-3 h-3 text-indigo-600" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        {parentJob && (
                          <button
                            type="button"
                            onClick={() => onSelectJob(parentJob)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open Plan #{task.jobNumber}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="flex items-center gap-1.5">
                          {onRequestTaskRevision && (
                            <button
                              type="button"
                              onClick={() => setRevisionModalTask({ task, job: parentJob })}
                              className="text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-700" />
                              <span>Request Revisions</span>
                            </button>
                          )}

                          {onApproveTaskReview && (
                            <button
                              type="button"
                              onClick={() => onApproveTaskReview(task.jobId, task.id, 'Signed off & approved by Kyle')}
                              className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Sign Off & Approve</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEAM WORKLOAD & PROJECT ASSIGNMENT MATRIX (For Kyle, Jason, Greg & Leads) */}
      {canDelegate && showWorkloadMatrix && (
        <div className="my-3">
          <JasonDrafterProjectBoard
            jobs={jobs}
            onSelectJob={onSelectJob}
            onFilterByDrafter={(drafterName) => {
              setSelectedDrafter(drafterName);
            }}
            nowTimestamp={nowTimestamp}
            currentStaff={currentStaff}
            onOpenCompleteTaskModal={onOpenCompleteTaskModal}
          />
        </div>
      )}

      {/* METRICS SUMMARY BAR (Respects Financial Permissions) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Metric 1: Total Logged Time */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-xs flex items-center justify-between border border-slate-700">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Total Logged Time</div>
            <div className="text-xl font-bold font-mono mt-0.5 text-emerald-400">
              {formatSecondsToReadable(totalTrackedSeconds)}
            </div>
          </div>
          <div className="bg-slate-700/60 p-2.5 rounded-lg border border-slate-600">
            <Clock className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* Metric 2: Financial Card OR Delegated Tasks Card */}
        {canAccessFinancials ? (
          <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white p-4 rounded-xl shadow-xs flex items-center justify-between border border-emerald-700">
            <div>
              <div className="text-[10px] font-mono uppercase text-emerald-200/80 font-semibold">Billable Invoicing Total</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-white">
                ${totalInvoicingValue.toFixed(2)}
              </div>
            </div>
            <div className="bg-emerald-700/60 p-2.5 rounded-lg border border-emerald-600">
              <DollarSign className="w-5 h-5 text-emerald-200" />
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-4 rounded-xl shadow-xs flex items-center justify-between border border-indigo-700">
            <div>
              <div className="text-[10px] font-mono uppercase text-indigo-200/80 font-semibold">Delegated Work Queue</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-white">
                {myAssignedTasks.length} Assigned To Me
              </div>
            </div>
            <div className="bg-indigo-700/60 p-2.5 rounded-lg border border-indigo-600">
              <ListTodo className="w-5 h-5 text-indigo-200" />
            </div>
          </div>
        )}

        {/* Metric 3: Active Live Timers & Quick Report */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Active Live Timers</div>
            <div className="text-xl font-bold font-mono mt-0.5 text-slate-800 flex items-center gap-2">
              <span>{runningTimers.length} Active</span>
              {runningTimers.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-mono block">Delegated Tasks</span>
            <span className="text-xs font-bold text-indigo-700 font-mono">
              {allDelegatedTasks.length} Active Total
            </span>
          </div>
        </div>
      </div>

      {/* --- DELEGATION COMMAND HUB / MY WORK QUEUE PANEL --- */}
      {allDelegatedTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
          
          {/* Panel Header */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>{canDelegate ? 'Delegated Work Management Center' : 'My Delegated Work Queue'}</span>
                  <span className="text-[10px] bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded font-mono">
                    {canDelegate ? `${allDelegatedTasks.length} Total Delegated` : `${myAssignedTasks.length} Assigned`}
                  </span>
                </h3>
                <p className="text-[11px] text-indigo-200">
                  {canDelegate
                    ? 'Kyle, Jason, and Greg Hyatt can assign specific plan components, notes, and CAD file attachments to drafters.'
                    : 'Components delegated to you by Kyle, Jason, or Greg Hyatt with technical notes & files.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canDelegate && onOpenDelegateModal && jobs.length > 0 && (
                <button
                  onClick={() => onOpenDelegateModal(jobs[0])}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Delegate Component</span>
                </button>
              )}

              <button
                onClick={() => setShowDelegationHub(!showDelegationHub)}
                className="text-indigo-300 hover:text-white p-1 rounded-lg transition"
              >
                {showDelegationHub ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Panel Content */}
          {showDelegationHub && (
            <div className="p-4 space-y-3 bg-indigo-50/30">
              
              {/* Filter Tabs & Drafter Dropdown */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setDelegationFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      delegationFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-indigo-100/70'
                    }`}
                  >
                    All Delegations ({allDelegatedTasks.length})
                  </button>

                  <button
                    onClick={() => setDelegationFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                      delegationFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-indigo-100/70'
                    }`}
                  >
                    All ({allDelegatedTasks.length})
                  </button>

                  <button
                    onClick={() => setDelegationFilter('my_assigned')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                      delegationFilter === 'my_assigned' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-indigo-100/70'
                    }`}
                  >
                    Assigned to {currentStaff.name.split(' ')[0]} ({myAssignedTasks.length})
                  </button>

                  <button
                    onClick={() => setDelegationFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                      delegationFilter === 'pending' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-indigo-100/70'
                    }`}
                  >
                    Active / In Progress ({allDelegatedTasks.filter(t => t.status !== 'Completed' || !t.isReviewed).length})
                  </button>

                  <button
                    onClick={() => setDelegationFilter('waiting_kyle')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer text-xs flex items-center gap-1.5 ${
                      delegationFilter === 'waiting_kyle' 
                        ? 'bg-amber-500 text-slate-950 shadow-2xs' 
                        : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    {currentStaff.name.toLowerCase().includes('kyle') ? (
                      <span>Waiting for My Review ({waitingForKyleCount})</span>
                    ) : (
                      <span>Under Review ({allDelegatedTasks.filter(t => (t.status === 'Completed' || t.status === 'Under Review') && !t.isReviewed && (isIndividualDrafter ? t.assignedTo.toLowerCase().includes(currentStaff.name.toLowerCase()) : true)).length})</span>
                    )}
                  </button>

                  <button
                    onClick={() => setDelegationFilter('revisions_requested')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer text-xs flex items-center gap-1.5 ${
                      delegationFilter === 'revisions_requested'
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'bg-orange-50 text-orange-900 border border-orange-200 hover:bg-orange-100'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3 text-orange-600" />
                    <span>Revisions Requested ({tasksRevisionsRequested.length})</span>
                  </button>

                  <button
                    onClick={() => setDelegationFilter('approved')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                      delegationFilter === 'approved' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    ✓ Approved & Signed Off ({tasksApproved.length})
                  </button>
                </div>

                {/* Quick Drafter Dropdown in Delegated Hub */}
                {!isIndividualDrafter && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Drafter Filter:</span>
                    </span>
                    <select
                      value={selectedDrafter}
                      onChange={(e) => setSelectedDrafter(e.target.value)}
                      className="bg-white border border-indigo-200 text-indigo-900 font-bold rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="all">All Drafters ({allDelegatedTasks.length} tasks)</option>
                      {draftersList.map((d) => {
                        const stats = getDrafterStats(d);
                        return (
                          <option key={`hub-${d}`} value={d}>
                            {d} ({stats.delegatedCount} tasks, {stats.projectCount} plans)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Delegated Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allDelegatedTasks
                  .filter(task => {
                    // If waiting for Kyle / Under Review filter is active
                    if (delegationFilter === 'waiting_kyle') {
                      if (currentStaff.name.toLowerCase().includes('kyle')) {
                        return (task.delegatedBy || '').toLowerCase().includes('kyle') && (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
                      } else if (isIndividualDrafter) {
                        return task.assignedTo.toLowerCase().includes(currentStaff.name.toLowerCase()) && (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
                      } else {
                        return (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
                      }
                    }
                    if (delegationFilter === 'revisions_requested') {
                      return task.status === 'Revision Requested' || Boolean(task.revisionRequested);
                    }
                    if (delegationFilter === 'approved') {
                      return task.status === 'Completed' && Boolean(task.isReviewed);
                    }

                    // If a specific drafter is selected or active, filter by that drafter
                    if (activeDrafterTarget !== 'all') {
                      const drafterLower = activeDrafterTarget.toLowerCase();
                      if (!task.assignedTo.toLowerCase().includes(drafterLower) && !task.delegatedBy.toLowerCase().includes(drafterLower)) {
                        return false;
                      }
                    }

                    if (delegationFilter === 'my_assigned') {
                      return task.assignedTo.toLowerCase().includes(currentStaff.name.toLowerCase()) ||
                             currentStaff.name.toLowerCase().includes(task.assignedTo.toLowerCase());
                    }
                    if (delegationFilter === 'pending') {
                      return task.status !== 'Completed' || !task.isReviewed;
                    }
                    if (delegationFilter === 'completed') return task.status === 'Completed';
                    return true;
                  })
                  .map((task) => {
                    const parentJob = jobs.find(j => j.id === task.jobId || j.job_number === task.jobNumber);
                    const isAssignedToMe = task.assignedTo.toLowerCase().includes(currentStaff.name.toLowerCase());
                    const isWaitingKyle = (task.delegatedBy || '').toLowerCase().includes('kyle') && (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
                    const isRevisionReq = task.status === 'Revision Requested' || Boolean(task.revisionRequested);
                    const isApproved = task.status === 'Completed' && Boolean(task.isReviewed);

                    return (
                      <div
                        key={task.id}
                        className={`bg-white rounded-xl p-4 border transition-all shadow-xs space-y-2.5 ${
                          isRevisionReq
                            ? 'border-orange-400 ring-2 ring-orange-300/40 bg-gradient-to-b from-orange-50/30 to-white'
                            : isWaitingKyle 
                            ? 'border-amber-400 ring-2 ring-amber-300/40 bg-gradient-to-b from-amber-50/20 to-white' 
                            : isApproved
                            ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/20 to-white'
                            : isAssignedToMe 
                            ? 'border-indigo-300 ring-1 ring-indigo-200' 
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                                MPS #{task.jobNumber}
                              </span>
                              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                {task.category}
                              </span>
                              {isRevisionReq && (
                                <span className="text-[10px] font-extrabold bg-orange-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Revision Requested {task.revisionCount ? `(Rev #${task.revisionCount})` : ''}</span>
                                </span>
                              )}
                              {isWaitingKyle && (
                                <span className="text-[10px] font-extrabold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                                  <span>Waiting for Kyle to review</span>
                                </span>
                              )}
                              {isApproved && (
                                <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Approved & Signed Off</span>
                                </span>
                              )}
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
                            <h4 className="font-bold text-slate-900 text-xs mt-1">{task.componentTitle}</h4>
                          </div>

                          {/* Status Badge & Actions */}
                          <div className="flex items-center gap-2">
                            {task.status !== 'Completed' && parentJob && onOpenCompleteTaskModal && (
                              <button
                                type="button"
                                onClick={() => onOpenCompleteTaskModal(task, parentJob)}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 ${
                                  isRevisionReq
                                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                                    : 'text-emerald-800 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-300'
                                }`}
                                title={isRevisionReq ? 'Upload revised files and resubmit' : `Mark task completed, upload review drawings, and notify ${task.delegatedBy}`}
                              >
                                {isRevisionReq ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                <span>{isRevisionReq ? 'Upload Revisions' : 'Mark Completed & Upload Files'}</span>
                              </button>
                            )}

                            <select
                              value={task.status}
                              onChange={(e) => {
                                const newStat = e.target.value as DelegatedWorkItem['status'];
                                if (newStat === 'Completed' && parentJob && onOpenCompleteTaskModal) {
                                  onOpenCompleteTaskModal(task, parentJob);
                                } else if (onUpdateTaskStatus) {
                                  onUpdateTaskStatus(task.jobId, task.id, newStat);
                                }
                              }}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${
                                task.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : task.status === 'Revision Requested'
                                  ? 'bg-orange-50 text-orange-800 border-orange-300'
                                  : task.status === 'In Progress'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : 'bg-slate-50 text-slate-700 border-slate-300'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Revision Requested">Revision Requested</option>
                              <option value="Completed">✓ Completed</option>
                            </select>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                          {task.neededWorkDescription}
                        </p>

                        {/* Notes */}
                        {task.notes && (
                          <div className="text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded border border-amber-100">
                            <strong>Note from {task.delegatedBy}:</strong> {task.notes}
                          </div>
                        )}

                        {/* Revision Request Highlight Callout */}
                        {isRevisionReq && task.revisionNotes && (
                          <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 space-y-2 text-xs text-orange-950">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1.5 text-orange-900">
                                <RotateCcw className="w-4 h-4 text-orange-600" />
                                <span>Revision Requested by <strong>{task.revisionRequestedBy || task.delegatedBy}</strong></span>
                              </span>
                              {task.revisionRequestedAt && (
                                <span className="text-[10px] text-orange-800 font-mono">
                                  {new Date(task.revisionRequestedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="bg-white/90 p-2 rounded border border-orange-200 text-orange-900 text-xs italic">
                              "{task.revisionNotes}"
                            </div>
                          </div>
                        )}

                        {/* Completion Details & Review Submission Banner */}
                        {task.status === 'Completed' && (
                          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 space-y-2 text-xs text-emerald-950">
                            <div className="flex items-center justify-between font-semibold flex-wrap gap-1">
                              <span className="flex items-center gap-1.5 text-emerald-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  {isApproved 
                                    ? `Signed Off & Approved by ${task.reviewedBy || 'Kyle'}`
                                    : `Task Completed & Submitted to ${task.delegatedBy}`
                                  }
                                </span>
                              </span>
                              {task.completedAt && (
                                <span className="text-[10px] text-emerald-700 font-mono">
                                  {new Date(task.completedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            {/* Kyle Review Actions Callout Box */}
                            {isWaitingKyle && (
                              <div className="bg-amber-500/15 border border-amber-400 p-2.5 rounded-lg flex items-center justify-between gap-2 flex-wrap text-amber-950">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                  <span className="font-extrabold text-xs">Waiting for Kyle to review</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {onRequestTaskRevision && (
                                    <button
                                      type="button"
                                      onClick={() => setRevisionModalTask({ task, job: parentJob })}
                                      className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3 text-amber-700" />
                                      <span>Request Revisions</span>
                                    </button>
                                  )}

                                  {onApproveTaskReview && (
                                    <button
                                      type="button"
                                      onClick={() => onApproveTaskReview(task.jobId, task.id, 'Signed off & approved by Kyle')}
                                      className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      <span>Sign Off & Approve</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {task.completionNotes && (
                              <p className="text-[11px] text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-100 italic">
                                "{task.completionNotes}"
                              </p>
                            )}

                            {task.attachments && task.attachments.length > 0 && (
                              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                                  <Paperclip className="w-3 h-3 text-emerald-700" />
                                  <span>Review Deliverables ({task.attachments.length}):</span>
                                </span>
                                {task.attachments.map((att) => (
                                  <span
                                    key={att.id}
                                    className="bg-white text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-2xs"
                                    title={`${att.name} (${att.size})`}
                                  >
                                    <FileText className="w-3 h-3 text-emerald-600" />
                                    <span className="truncate max-w-[140px]">{att.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Attachments & Meta Info */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                          <div className="space-y-0.5">
                            <span className="text-slate-500 block">
                              Assigned to: <strong className="text-slate-800">{task.assignedTo}</strong> (by {task.delegatedBy})
                            </span>
                            {task.dueDate && (
                              <span className="text-slate-400 text-[10px] block">
                                Due: {task.dueDate}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {task.attachments && task.attachments.length > 0 && (
                              <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-1 rounded font-semibold text-[10px]" title="Attached blueprint/CAD files">
                                <Paperclip className="w-3 h-3 text-blue-600" />
                                <span>{task.attachments.length} Files</span>
                              </span>
                            )}

                            {parentJob && (
                              <button
                                onClick={() => onSelectJob(parentJob)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                              >
                                <span>Open Plan</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
              </div>

            </div>
          )}
        </div>
      )}

      {/* DRAFTER WORKSPACE BANNER & QUICK SELECTOR CHIPS */}
      {isIndividualDrafter ? (
        /* INDIVIDUAL DRAFTER SCOPED WORKSPACE HEADER (James, Aaron, Sarah, Alex, Elena) */
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl border border-blue-800 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 border border-blue-400/40 text-white flex items-center justify-center font-bold text-lg shadow-lg shrink-0">
                {currentStaff.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {currentStaff.name}'s Personal Drafter Board
                  </h3>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Assigned Drafter Scope
                  </span>
                  {runningTimers.length > 0 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400 animate-spin" />
                      Timer Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Exclusively displaying projects and delegated components assigned to <strong>{currentStaff.name}</strong> ({currentStaff.title}).
                </p>
              </div>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">My Active Plans</span>
                <span className="text-sm font-bold text-white font-mono">{filteredJobs.length} Assigned</span>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">My Delegated Tasks</span>
                <span className="text-sm font-bold text-indigo-300 font-mono">{myAssignedTasks.length} Components</span>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Logged CAD Time</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{formatSecondsToReadable(totalTrackedSeconds)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MANAGER & OPERATIONS DRAFTER SELECTOR CHIPS BAR (Jason, Greg, Kyle) */
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Filter by Specific Drafter's Board
              </span>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                (Click a drafter to view only their assigned projects & delegated tasks)
              </span>
            </div>

            {selectedDrafter !== 'all' && (
              <button
                onClick={() => setSelectedDrafter('all')}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset to All Drafters</span>
              </button>
            )}
          </div>

          {/* Drafter Pill Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedDrafter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                selectedDrafter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>All Drafters</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                selectedDrafter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
              }`}>
                {jobs.length}
              </span>
            </button>

            {draftersList.map((drafter) => {
              const stats = getDrafterStats(drafter);
              const isSelected = selectedDrafter.toLowerCase() === drafter.toLowerCase();
              const staffObj = STAFF_USERS.find(s => s.name.toLowerCase() === drafter.toLowerCase());

              return (
                <button
                  key={`chip-${drafter}`}
                  onClick={() => setSelectedDrafter(isSelected ? 'all' : drafter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {drafter.charAt(0)}
                  </div>

                  <span>{drafter}</span>

                  {stats.hasActiveTimer && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Active timer currently running!" />
                  )}

                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {stats.projectCount} {stats.projectCount === 1 ? 'plan' : 'plans'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE DRAFTER SPOTLIGHT BANNER */}
          {selectedDrafter !== 'all' && activeDrafterStats && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {selectedDrafter.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-sm">{selectedDrafter}'s Board</h4>
                    <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                      {activeDrafterStaff?.title || 'Drafter'}
                    </span>
                    {activeDrafterStats.hasActiveTimer && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-600 animate-spin" />
                        Live Timer Running
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Currently assigned to <strong>{activeDrafterStats.projectCount} project(s)</strong> and <strong>{activeDrafterStats.delegatedCount} delegated work component(s)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-blue-900 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-2xs">
                  Showing {filteredJobs.length} of {jobs.length} Total Projects
                </span>
                <button
                  onClick={() => setSelectedDrafter('all')}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  title="Show all projects"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Search Input for MPS #, Customer, Style, Drafter */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isIndividualDrafter ? `Search within ${currentStaff.name}'s assigned plans (MPS #, customer, style)...` : "Search by MPS # (e.g. 195, M26-195), customer name, house style, or drafter..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Drafter Dropdown Filter (Available for Managers/Leads, or showing active drafter status) */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isIndividualDrafter ? (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl w-full sm:w-auto">
              <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-slate-500 font-bold whitespace-nowrap text-[11px]">Drafter Board:</span>
              <select
                value={selectedDrafter}
                onChange={(e) => setSelectedDrafter(e.target.value)}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer w-full text-xs"
              >
                <option value="all">All Drafters ({jobs.length} Plans)</option>
                {draftersList.map((d) => {
                  const stats = getDrafterStats(d);
                  return (
                    <option key={`select-${d}`} value={d}>
                      {d} ({stats.projectCount} {stats.projectCount === 1 ? 'plan' : 'plans'}{stats.activeTasksCount > 0 ? `, ${stats.activeTasksCount} active task` : ''})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl w-full sm:w-auto text-blue-900 font-bold text-[11px]">
              <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Board: {currentStaff.name} ({filteredJobs.length} plans)</span>
            </div>
          )}

          {/* Roadblock Filter Pill */}
          <button
            onClick={() => setRoadblockOnly(!roadblockOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold transition cursor-pointer shrink-0 ${
              roadblockOnly
                ? 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${roadblockOnly ? 'text-red-600' : 'text-slate-400'}`} />
            <span>Roadblocks Only</span>
          </button>
        </div>

      </div>

      {/* VIEW MODE 1: GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onUpdateStatus={onUpdateStatus}
              onToggleRoadblock={onToggleRoadblock}
              onSelectJob={onSelectJob}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
              nowTimestamp={nowTimestamp}
              canAccessFinancials={canAccessFinancials}
              canDelegate={canDelegate}
              onOpenDelegateModal={onOpenDelegateModal}
              onOpenCompleteTaskModal={onOpenCompleteTaskModal}
            />
          ))}

          {filteredJobs.length === 0 && (
            <div className="col-span-full bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 text-sm">No Matching Plan Store Jobs Found</h3>
              <p className="text-xs text-slate-400 mt-1">Try relaxing search filters or create a new job intake.</p>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: KANBAN PIPELINE BOARD */}
      {viewMode === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
          {PHASES.map((phase) => {
            const phaseJobs = filteredJobs.filter(j => j.current_status === phase);

            return (
              <div
                key={phase}
                className="w-80 shrink-0 bg-slate-100/80 border border-slate-200 rounded-xl p-3 flex flex-col max-h-[750px]"
              >
                {/* Column Header */}
                <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800 text-xs tracking-tight flex items-center gap-1.5">
                    <span>{phase}</span>
                    <span className="bg-slate-200 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded-full">
                      {phaseJobs.length}
                    </span>
                  </h3>
                </div>

                {/* Column Job Cards List */}
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {phaseJobs.map((job) => {
                    const isRunning = Boolean(job.active_timer_start);
                    const jobSecs = calculateJobTotalSeconds(job, nowTimestamp);
                    const jobBillable = calculateJobBillableAmount(job, nowTimestamp);
                    const delegatedCount = (job.delegated_tasks || []).length;

                    return (
                      <div
                        key={job.id}
                        className={`bg-white p-4 rounded-xl border shadow-xs hover:shadow-md transition space-y-2.5 ${
                          isRunning ? 'border-emerald-400 bg-emerald-50/20' : job.roadblock ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                            MPS #{job.job_number}
                          </span>
                          {isRunning ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3 text-emerald-600 animate-spin" />
                              Timer Active
                            </span>
                          ) : job.roadblock ? (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              Roadblock
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 text-xs">{job.customer_name}</h4>
                          <p className="text-[11px] text-slate-500">{job.style} • {job.sq_ft} sq ft</p>
                          {delegatedCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded mt-1">
                              <ListTodo className="w-3 h-3" />
                              <span>{delegatedCount} Delegated</span>
                            </span>
                          )}
                        </div>

                        {/* Kanban Quick Timer Control */}
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono block uppercase">Logged</span>
                            <span className="font-mono font-bold text-slate-800">{formatSecondsToReadable(jobSecs)}</span>
                          </div>
                          <div>
                            {isRunning ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); onStopTimer(job.id); }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                              >
                                <Square className="w-3 h-3 fill-white" />
                                Stop
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); onStartTimer(job.id); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-white" />
                                Start
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="pt-1 flex justify-between items-center text-[10px] text-slate-400">
                          {canAccessFinancials ? (
                            <span className="font-semibold text-emerald-700">${jobBillable.toFixed(2)} billable</span>
                          ) : (
                            <span>{(job.time_logs || []).length} sessions</span>
                          )}
                          <button
                            onClick={() => onSelectJob(job)}
                            className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                          >
                            Open Project <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {phaseJobs.length === 0 && (
                    <div className="text-center py-8 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      No jobs in {phase}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 3: DETAILED TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-mono text-[10px] text-slate-500 tracking-wider">
                <tr>
                  <th className="p-3.5">Job #</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Style & Sq Ft</th>
                  <th className="p-3.5">Drafter</th>
                  <th className="p-3.5">Current Phase</th>
                  <th className="p-3.5">Time Logged</th>
                  {canAccessFinancials && <th className="p-3.5">Invoicing ($)</th>}
                  <th className="p-3.5">Delegated Tasks</th>
                  <th className="p-3.5">Timer Controls</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => {
                  const isRunning = Boolean(job.active_timer_start);
                  const totalSecs = calculateJobTotalSeconds(job, nowTimestamp);
                  const billable = calculateJobBillableAmount(job, nowTimestamp);
                  const delegatedTasks = job.delegated_tasks || [];

                  return (
                    <tr key={job.id} className={`transition ${isRunning ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                      <td className="p-3.5 font-mono font-bold text-blue-700">MPS #{job.job_number}</td>
                      <td className="p-3.5 font-bold text-slate-900">{job.customer_name}</td>
                      <td className="p-3.5">{job.style} ({job.sq_ft} sq ft)</td>
                      <td className="p-3.5">{job.assigned_drafter}</td>
                      <td className="p-3.5">
                        <select
                          value={job.current_status}
                          onChange={(e) => onUpdateStatus(job.id, e.target.value as JobPhase)}
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold cursor-pointer"
                        >
                          {PHASES.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">
                        {formatSecondsToReadable(totalSecs)}
                      </td>
                      {canAccessFinancials && (
                        <td className="p-3.5 font-mono font-bold text-emerald-700">
                          ${billable.toFixed(2)}
                        </td>
                      )}
                      <td className="p-3.5">
                        {delegatedTasks.length > 0 ? (
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            {delegatedTasks.length} Sub-Tasks
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {isRunning ? (
                          <button
                            onClick={() => onStopTimer(job.id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Square className="w-3 h-3 fill-white" />
                            Stop Timer
                          </button>
                        ) : (
                          <button
                            onClick={() => onStartTimer(job.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            Start Timer
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canDelegate && onOpenDelegateModal && (
                            <button
                              onClick={() => onOpenDelegateModal(job)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold px-2.5 py-1 rounded text-xs transition cursor-pointer"
                              title="Delegate work component on this plan"
                            >
                              Delegate
                            </button>
                          )}
                          <button
                            onClick={() => onSelectJob(job)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1 rounded shadow-xs text-xs cursor-pointer"
                          >
                            Open Project
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Revisions Modal for Kyle / Managers */}
      {revisionModalTask && (
        <RequestRevisionModal
          isOpen={Boolean(revisionModalTask)}
          task={revisionModalTask.task}
          job={revisionModalTask.job}
          currentStaff={currentStaff}
          onClose={() => setRevisionModalTask(null)}
          onSubmitRevision={(jobId, taskId, notes) => {
            if (onRequestTaskRevision) {
              onRequestTaskRevision(jobId, taskId, notes);
            }
            setRevisionModalTask(null);
          }}
        />
      )}

    </div>
  );
};
