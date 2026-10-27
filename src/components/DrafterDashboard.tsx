import React, { useState, useEffect } from 'react';
import { Kanban, Grid, List, Search, Filter, AlertTriangle, Layers, Plus, CheckCircle2, Clock, ShieldAlert, ArrowRight, Download, DollarSign, Play, Square, FileSpreadsheet, X, Share2, ListTodo, Paperclip, CheckCircle, UserCheck, Sparkles, FileText, ChevronDown, ChevronUp, User, ExternalLink, Users, Briefcase, Activity, Lock, RotateCcw, Archive, Hammer, Building, MapPin, Mail, Phone, Edit3, Pin, BookmarkCheck, Check, Eye, FolderOpen, Globe, ArrowUpDown, Calendar } from 'lucide-react';
import { Job, JobPhase, StaffUser, DelegatedWorkItem, GregDevProjectCard, GregDevTimeEntry, TaskAttachment } from '../types';
import { JobCard } from './JobCard';
import { calculateJobTotalSeconds, calculateJobBillableAmount, formatSecondsToReadable, formatSecondsToHHMMSS, exportInvoicingCSV } from '../utils/timeUtils';
import { STAFF_USERS, canViewAllProjectCards, isJobArchived, getStoredPreferredLayout, saveStoredPreferredLayout } from '../data/mockData';
import { JasonDrafterProjectBoard } from './JasonDrafterProjectBoard';
import { RequestRevisionModal } from './RequestRevisionModal';
import { EditCustomerContactModal } from './EditCustomerContactModal';

interface DrafterDashboardProps {
  jobs: Job[];
  currentStaff: StaffUser;
  onUpdateStatus: (jobId: string, newStatus: JobPhase) => void;
  onToggleRoadblock: (jobId: string) => void;
  onSelectJob: (job: Job) => void;
  onOpenNewJobModal: () => void;
  onStartTimer: (jobId: string, taskNote?: string, delegatedTaskId?: string) => void;
  onStopTimer: (jobId: string, taskNote?: string, delegatedTaskId?: string) => void;
  onOpenDelegateModal?: (job: Job) => void;
  onOpenCompleteTaskModal?: (task: DelegatedWorkItem, job: Job) => void;
  onUpdateTaskStatus?: (jobId: string, taskId: string, newStatus: DelegatedWorkItem['status']) => void;
  onApproveTaskReview?: (jobId: string, taskId: string, reviewNotes?: string) => void;
  onRequestTaskRevision?: (jobId: string, taskId: string, feedbackNotes: string) => void;
  onOpenKyleInbox?: () => void;
  onSaveDefaultLayout?: (staffId: string, layout: 'board' | 'grid' | 'list' | 'table') => void;
  onUpdateCustomerContact?: (customerName: string, updatedContact: {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    project_address?: string;
    updateAllPlans?: boolean;
    currentJobId?: string;
  }) => void;
  nowTimestamp?: number;
  staffList?: StaffUser[];
  devCards?: GregDevProjectCard[];
  devEntries?: GregDevTimeEntry[];
  onOpenDevReviewModal?: () => void;
  onAddJobNote?: (jobId: string, text: string, timestamp?: string) => void;
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
  staffList,
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
  onSaveDefaultLayout,
  onUpdateCustomerContact,
  nowTimestamp = Date.now(),
  devCards,
  devEntries,
  onOpenDevReviewModal,
  onAddJobNote,
}) => {
  const effectiveStaff = staffList && staffList.length > 0 ? staffList : STAFF_USERS;

  // Add Job Note Modal state
  const [addJobNoteModalJob, setAddJobNoteModalJob] = useState<Job | null>(null);
  const [noteModalTimestamp, setNoteModalTimestamp] = useState<string>('');
  const [noteModalIsoTimestamp, setNoteModalIsoTimestamp] = useState<string>('');
  const [noteModalText, setNoteModalText] = useState<string>('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<boolean>(false);

  const handleOpenAddJobNoteModal = (job: Job) => {
    const now = new Date();
    setAddJobNoteModalJob(job);
    setNoteModalIsoTimestamp(now.toISOString());
    setNoteModalTimestamp(now.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }));
    setNoteModalText('');
    setNoteSavedFeedback(false);
  };

  const handleSaveJobNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addJobNoteModalJob || !noteModalText.trim()) return;

    if (onAddJobNote) {
      onAddJobNote(addJobNoteModalJob.id, noteModalText.trim(), noteModalIsoTimestamp);
    }

    setNoteSavedFeedback(true);
    setTimeout(() => {
      setAddJobNoteModalJob(null);
      setNoteModalText('');
      setNoteSavedFeedback(false);
    }, 1100);
  };

  // Preferred default layout management
  const getStaffDefaultLayout = (): 'board' | 'grid' | 'list' | 'table' => {
    if (currentStaff?.preferredLayout) {
      return currentStaff.preferredLayout;
    }
    return getStoredPreferredLayout(currentStaff?.id || currentStaff?.email);
  };

  const [defaultLayout, setDefaultLayout] = useState<'board' | 'grid' | 'list' | 'table'>(() => getStaffDefaultLayout());
  const [viewMode, setViewMode] = useState<'board' | 'grid' | 'list' | 'table'>(() => getStaffDefaultLayout());
  const [justSavedDefault, setJustSavedDefault] = useState(false);

  // When active staff member changes or their preferredLayout is updated, reflect their preference
  useEffect(() => {
    const pref = getStaffDefaultLayout();
    setDefaultLayout(pref);
    setViewMode(pref);
  }, [currentStaff?.id, currentStaff?.email, currentStaff?.preferredLayout]);

  const handleSetAsDefault = () => {
    setDefaultLayout(viewMode);
    saveStoredPreferredLayout(currentStaff.id, viewMode, currentStaff.email);
    if (onSaveDefaultLayout) {
      onSaveDefaultLayout(currentStaff.id, viewMode);
    }
    setJustSavedDefault(true);
    setTimeout(() => {
      setJustSavedDefault(false);
    }, 2800);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobForContactEdit, setSelectedJobForContactEdit] = useState<Job | null>(null);
  
  // Authorized users who can view all cards and switch between boards: Kyle, Jason, Drew, Ethan, Greg Hyatt
  const isAllCardsAuthorized = canViewAllProjectCards(currentStaff);
  const isIndividualDrafter = !isAllCardsAuthorized;

  // Authorization for team workload matrix: Kyle, Jason, Drew, Greg, and delegated leads
  const canViewWorkloadMatrix = Boolean(
    currentStaff?.canDelegate || 
    isAllCardsAuthorized || 
    currentStaff?.canAccessFinancials || 
    currentStaff?.name.toLowerCase().includes('drew') ||
    currentStaff?.name.toLowerCase().includes('jason') ||
    currentStaff?.name.toLowerCase().includes('kyle') ||
    currentStaff?.name.toLowerCase().includes('greg')
  );

  // Initialize selectedDrafter: If current logged-in user is an individual drafter,
  // lock strictly to their own name so only their assigned cards display.
  const [selectedDrafter, setSelectedDrafter] = useState<string>(() => {
    return isAllCardsAuthorized ? 'all' : currentStaff.name;
  });
  
  const [roadblockOnly, setRoadblockOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showWorkloadMatrix, setShowWorkloadMatrix] = useState(false);
  const [showDelegationHub, setShowDelegationHub] = useState(true);
  const [showKyleReviewDrawer, setShowKyleReviewDrawer] = useState(false);
  const [delegationFilter, setDelegationFilter] = useState<'all' | 'my_assigned' | 'pending' | 'completed' | 'waiting_kyle' | 'revisions_requested' | 'approved'>('all');
  const [revisionModalTask, setRevisionModalTask] = useState<{ task: DelegatedWorkItem; job?: Job } | null>(null);
  const [previewingAttachment, setPreviewingAttachment] = useState<{
    file: TaskAttachment;
    taskTitle: string;
    jobNumber?: string;
  } | null>(null);

  // Delegated Work Management Center Layout & Sort preferences
  const getStaffDefaultDelegatedLayout = (): 'grid' | 'board' | 'list' | 'table' => {
    try {
      const saved = localStorage.getItem(`delegated_layout_${currentStaff?.id || currentStaff?.email}`);
      if (saved === 'grid' || saved === 'board' || saved === 'list' || saved === 'table') {
        return saved;
      }
    } catch {}
    return 'grid';
  };

  const [delegatedViewMode, setDelegatedViewMode] = useState<'grid' | 'board' | 'list' | 'table'>(() => getStaffDefaultDelegatedLayout());
  const [justSavedDelegatedDefault, setJustSavedDelegatedDefault] = useState(false);
  const [delegatedSortBy, setDelegatedSortBy] = useState<'drafter_asc' | 'drafter_desc' | 'my_assigned_first'>('drafter_asc');
  const [activeDelegatedTaskId, setActiveDelegatedTaskId] = useState<string | null>(null);

  useEffect(() => {
    setDelegatedViewMode(getStaffDefaultDelegatedLayout());
  }, [currentStaff?.id, currentStaff?.email]);

  const handleSaveDelegatedDefault = () => {
    try {
      localStorage.setItem(`delegated_layout_${currentStaff?.id || currentStaff?.email}`, delegatedViewMode);
    } catch {}
    setJustSavedDelegatedDefault(true);
    setTimeout(() => {
      setJustSavedDelegatedDefault(false);
    }, 2800);
  };

  // Helper to find parent job for a delegated task
  const resolveParentJob = (task: DelegatedWorkItem): Job | undefined => {
    const cleanTaskNum = (task.jobNumber || '').replace(/^[#M\-_]+/i, '').trim().toLowerCase();
    return jobs.find(j => 
      (j.id && task.jobId && j.id === task.jobId) || 
      (j.job_number && (j.job_number || '').replace(/^#/, '').trim().toLowerCase() === (task.jobNumber || '').replace(/^#/, '').trim().toLowerCase()) ||
      (j.job_number && (j.job_number || '').replace(/^[#M\-_]+/i, '').trim().toLowerCase() === cleanTaskNum)
    );
  };

  // Check if a timer is running for a delegated task
  const isTaskTimerRunning = (task: DelegatedWorkItem, parentJob?: Job): boolean => {
    if (parentJob && parentJob.active_timer_start) {
      const taskTitle = (task.componentTitle || '').toLowerCase();
      const activeTaskNote = (parentJob.active_timer_task || '').toLowerCase();
      if (activeTaskNote.includes(taskTitle) || (task.id && activeTaskNote.includes(task.id))) {
        return true;
      }
      if (task.status === 'In Progress') {
        return true;
      }
    }
    if (activeDelegatedTaskId === task.id) return true;
    return false;
  };

  // Live timer elapsed text for a delegated task
  const getTaskElapsedTime = (task: DelegatedWorkItem, parentJob?: Job): string | null => {
    if (!isTaskTimerRunning(task, parentJob)) return null;
    const startMs = parentJob?.active_timer_start 
      ? new Date(parentJob.active_timer_start).getTime() 
      : (nowTimestamp || Date.now());
    const elapsedSeconds = Math.max(0, Math.floor(((nowTimestamp || Date.now()) - startMs) / 1000));
    return formatSecondsToHHMMSS(elapsedSeconds);
  };

  // Start timer for delegated task -> starts job timer and sets task status to In Progress atomically
  const handleStartTaskTimer = (task: DelegatedWorkItem, parentJob?: Job) => {
    setActiveDelegatedTaskId(task.id);
    const targetJobId = parentJob?.id || task.jobId || task.jobNumber;
    if (targetJobId) {
      onStartTimer(targetJobId, `${task.category}: ${task.componentTitle}`, task.id);
    }
  };

  // Stop timer for delegated task -> stops job timer, calculates logs, and sets task to Pending atomically
  const handleStopTaskTimer = (task: DelegatedWorkItem, parentJob?: Job) => {
    setActiveDelegatedTaskId(null);
    const targetJobId = parentJob?.id || task.jobId || task.jobNumber;
    if (targetJobId) {
      onStopTimer(targetJobId, `Worked on ${task.componentTitle}`, task.id);
    }
  };

  // Mark task complete -> opens CompleteTaskModal or marks completed
  const handleMarkTaskComplete = (task: DelegatedWorkItem, parentJob?: Job) => {
    if (isTaskTimerRunning(task, parentJob)) {
      handleStopTaskTimer(task, parentJob);
    }
    if (onOpenCompleteTaskModal && parentJob) {
      onOpenCompleteTaskModal(task, parentJob);
    } else if (onUpdateTaskStatus) {
      onUpdateTaskStatus(task.jobId, task.id, 'Completed');
    }
  };

  // For individual drafters: allow toggling between 'touched' (worked on / assigned / tagged) and 'all' (all company plans)
  const [drafterScopeFilter, setDrafterScopeFilter] = useState<'touched' | 'all'>('touched');

  // Whenever the active staff user is switched, update the board scope
  useEffect(() => {
    setDrafterScopeFilter('touched');
    if (!isAllCardsAuthorized) {
      setSelectedDrafter(currentStaff.name);
    } else if (selectedDrafter !== 'all') {
      // Check if selectedDrafter is still in drafter list
      const exists = effectiveStaff.some(s => s.name.toLowerCase() === selectedDrafter.toLowerCase());
      if (!exists) setSelectedDrafter('all');
    }
  }, [currentStaff.id, currentStaff.name, isAllCardsAuthorized, effectiveStaff]);

  const canAccessFinancials = currentStaff.canAccessFinancials;
  const canDelegate = currentStaff.canDelegate;
  const canMarkProjectCompleted = Boolean(
    currentStaff &&
    (currentStaff.name.toLowerCase().includes('kyle') || currentStaff.name.toLowerCase().includes('jason'))
  );

  // Active jobs (excluding paid and archived)
  const activeJobs = jobs.filter(j => !isJobArchived(j));

  // Collect all delegated tasks across all jobs
  const allDelegatedTasks: DelegatedWorkItem[] = jobs.flatMap(j => j.delegated_tasks || []);
  const activeDelegatedTasks: DelegatedWorkItem[] = activeJobs.flatMap(j => j.delegated_tasks || []);

  // Canonicalize raw drafter names so that if a name corresponds to an existing staff user, it maps to their full name
  const canonicalizeDrafterName = (rawName: string): string => {
    const trimmed = rawName.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    const matched = effectiveStaff.find(s => {
      const sLower = s.name.toLowerCase();
      const sFirst = sLower.split(' ')[0];
      return sLower === lower || sFirst === lower || sLower.includes(lower) || lower.includes(sLower);
    });
    return matched ? matched.name : trimmed;
  };

  // Comprehensive list of all drafters & team members
  const draftersList = Array.from(
    new Set([
      ...effectiveStaff.map(s => s.name),
      ...jobs.map(j => canonicalizeDrafterName(j.assigned_drafter.split(',')[0])),
      ...allDelegatedTasks.map(t => canonicalizeDrafterName(t.assignedTo))
    ])
  ).filter(Boolean).filter(name => {
    const lower = name.trim().toLowerCase();
    return lower !== 'aaron' && lower !== 'james';
  });

  // Helper function to get all drafters who have touched, worked on, been assigned, or been tagged in a job
  const getJobInvolvedDrafters = (job: Job): string[] => {
    const namesSet = new Set<string>();

    // 1. Assigned drafter(s) / Lead
    if (job.assigned_drafter) {
      job.assigned_drafter.split(',').forEach(d => {
        const c = canonicalizeDrafterName(d);
        if (c) namesSet.add(c);
      });
    }

    // 2. Delegated tasks: assignees, completedBy, and delegators
    (job.delegated_tasks || []).forEach(t => {
      if (t.assignedTo) {
        const c = canonicalizeDrafterName(t.assignedTo);
        if (c) namesSet.add(c);
      }
      if (t.completedBy) {
        const c = canonicalizeDrafterName(t.completedBy);
        if (c) namesSet.add(c);
      }
      if (t.delegatedBy) {
        const c = canonicalizeDrafterName(t.delegatedBy);
        if (c) namesSet.add(c);
      }
    });

    // 3. Time loggers (anyone who worked on / logged CAD time on the job)
    (job.time_logs || []).forEach(tl => {
      if (tl.drafterName) {
        const c = canonicalizeDrafterName(tl.drafterName);
        if (c) namesSet.add(c);
      }
    });

    // 4. Deliverables authors
    (job.deliverables || []).forEach(d => {
      if (d.authorDrafter) {
        const c = canonicalizeDrafterName(d.authorDrafter);
        if (c) namesSet.add(c);
      }
    });

    // 5. Comments & job notes (authors and tagged staff)
    (job.comments || []).forEach(c => {
      if (c.author && (c.role === 'drafter' || c.isJobNote)) {
        const cAuthor = canonicalizeDrafterName(c.author);
        if (cAuthor) namesSet.add(cAuthor);
      }
      (c.taggedStaff || []).forEach(ts => {
        const cTagged = canonicalizeDrafterName(ts);
        if (cTagged) namesSet.add(cTagged);
      });
    });

    return Array.from(namesSet).filter(Boolean);
  };

  // Helper function to check if a job belongs to or was touched by a specific drafter
  // (worked on, been assigned, been tagged in, delegated tasks, logged CAD time, etc.)
  const isJobAssignedToDrafter = (job: Job, drafterName: string) => {
    const drafterLower = drafterName.toLowerCase().trim();
    const drafterFirst = drafterLower.split(' ')[0];
    const matchesDrafter = (target?: string) => {
      if (!target) return false;
      const t = target.toLowerCase().trim();
      return t === drafterLower || t === drafterFirst || t.includes(drafterLower) || drafterLower.includes(t);
    };

    const involved = getJobInvolvedDrafters(job);
    return involved.some(d => matchesDrafter(d));
  };

  // Helper to calculate stats per drafter (only counting active, non-archived/unpaid jobs)
  const getDrafterStats = (drafterName: string) => {
    const drafterLower = drafterName.toLowerCase();
    const drafterFirst = drafterLower.split(' ')[0];
    const matchesDrafter = (target?: string) => {
      if (!target) return false;
      const t = target.toLowerCase().trim();
      return t === drafterLower || t === drafterFirst || t.includes(drafterLower) || drafterLower.includes(t);
    };

    const relevantJobs = activeJobs.filter(j => isJobAssignedToDrafter(j, drafterName));
    const delegatedTasks = activeDelegatedTasks.filter(t => 
      matchesDrafter(t.assignedTo)
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
  // For individual drafters, target strictly currentStaff.name
  // For managers/leads (Kyle, Jason, Drew, Ethan, Greg), target selectedDrafter ('all' or specific drafter)
  const activeDrafterTarget = isAllCardsAuthorized ? selectedDrafter : currentStaff.name;

  // Count of plans touched by the current active staff user
  const myTouchedJobsCount = activeJobs.filter(j => isJobAssignedToDrafter(j, currentStaff.name)).length;

  // Filter logic: Search by MPS / Job Number, Customer Name, House Style, or Drafter
  const filteredJobs = jobs.filter(job => {
    const isArchived = isJobArchived(job);
    const q = searchQuery.toLowerCase().trim();
    const hasSearch = q.length > 0;

    // 1. Mandatory Drafter Scope & Universal Global Search:
    // If a search query is typed: Drafters can search ANY job across all plans (not just those assigned to them directly)!
    if (hasSearch) {
      // In search mode, allow searching all plans.
      // If job is archived, exclude unless explicitly searching for that job number or customer
      if (isArchived && !showArchived) {
        const cleanQuery = q.replace(/[^a-z0-9]/gi, '');
        const cleanJobNum = job.job_number.toLowerCase().replace(/[^a-z0-9]/gi, '');
        const matchesDirectly = 
          job.job_number.toLowerCase().includes(q) ||
          (cleanQuery.length > 0 && cleanJobNum.includes(cleanQuery)) ||
          job.customer_name.toLowerCase().includes(q);
        if (!matchesDirectly) return false;
      }
    } else {
      // When NO search query is active:
      if (!isAllCardsAuthorized) {
        if (isArchived && !showArchived) {
          return false;
        }
        // If drafterScopeFilter is 'touched' (default), show all jobs the drafter worked on, was assigned, or was tagged in
        if (drafterScopeFilter === 'touched') {
          if (!isJobAssignedToDrafter(job, currentStaff.name)) {
            return false;
          }
        }
      } else {
        // For managers/leads (Kyle, Jason, Drew, Ethan, Greg):
        if (activeDrafterTarget !== 'all') {
          if (!isJobAssignedToDrafter(job, activeDrafterTarget)) {
            return false;
          }
        }
        if (!showArchived && isArchived) {
          return false;
        }
      }
    }

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

      const matchesCustomer = 
        job.customer_name.toLowerCase().includes(q) || 
        (job.project_name || '').toLowerCase().includes(q);
      const matchesStyle = job.style.toLowerCase().includes(q);
      const matchesDrafterName = job.assigned_drafter.toLowerCase().includes(q);
      const matchesInvolvedDrafter = getJobInvolvedDrafters(job).some(d => d.toLowerCase().includes(q));
      const matchesDelegatedTask = (job.delegated_tasks || []).some(t => 
        t.assignedTo.toLowerCase().includes(q) || 
        t.componentTitle.toLowerCase().includes(q) ||
        (t.customerName || '').toLowerCase().includes(q)
      );

      matchesSearch = matchesNumber || matchesCustomer || matchesStyle || matchesDrafterName || matchesInvolvedDrafter || matchesDelegatedTask;
    }

    const matchesRoadblock = !roadblockOnly || job.roadblock;

    return matchesSearch && matchesRoadblock;
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

  const activeDrafterStaff = effectiveStaff.find(s => s.name.toLowerCase() === activeDrafterTarget.toLowerCase()) || (isIndividualDrafter ? currentStaff : undefined);
  const activeDrafterStats = activeDrafterTarget !== 'all' ? getDrafterStats(activeDrafterTarget) : null;

  // Render View Controls for Project Board (Grid, Kanban, Lists, Table + Make Default)
  const renderProjectViewControls = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-indigo-700/60 shadow-inner">
        <button
          type="button"
          id="view-mode-grid-btn"
          onClick={() => setViewMode('grid')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            viewMode === 'grid' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
          }`}
          title="Grid layout of project cards"
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>

        <button
          type="button"
          id="view-mode-board-btn"
          onClick={() => setViewMode('board')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            viewMode === 'board' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
          }`}
          title="Kanban columns by workflow phase"
        >
          <Kanban className="w-3.5 h-3.5" />
          <span>Kanban</span>
        </button>

        <button
          type="button"
          id="view-mode-list-btn"
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            viewMode === 'list' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
          }`}
          title="Streamlined list layout of project cards"
        >
          <List className="w-3.5 h-3.5" />
          <span>Lists</span>
        </button>

        <button
          type="button"
          id="view-mode-table-btn"
          onClick={() => setViewMode('table')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            viewMode === 'table' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
          }`}
          title="Detailed data table sheet view"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Table</span>
        </button>
      </div>

      {/* BUTTON TO MAKE DEFAULT / DEFAULT STATUS BADGE */}
      {justSavedDefault ? (
        <div 
          id="default-layout-saved-feedback"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white shadow-xs select-none transition-all animate-bounce"
          title={`Saved! ${viewMode === 'grid' ? 'Grid' : viewMode === 'board' ? 'Kanban' : viewMode === 'list' ? 'Lists' : 'Table'} will now load automatically whenever you log in.`}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>Saved!</span>
        </div>
      ) : viewMode === defaultLayout ? (
        <div
          id="default-layout-active-badge"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 select-none shadow-2xs"
          title={`This is currently your default startup layout for ${currentStaff.name}. It loads automatically whenever you log in.`}
        >
          <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden sm:inline text-emerald-300/80">Default View:</span>
          <span className="font-bold">
            {viewMode === 'grid' ? 'Grid' : viewMode === 'board' ? 'Kanban' : viewMode === 'list' ? 'Lists' : 'Table'}
          </span>
        </div>
      ) : (
        <button
          type="button"
          id="make-default-view-btn"
          onClick={handleSetAsDefault}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer border border-blue-400/50 bg-blue-800/70 hover:bg-blue-700 text-blue-100 active:scale-95 shadow-2xs group"
          title={`Make ${viewMode === 'grid' ? 'Grid' : viewMode === 'board' ? 'Kanban' : viewMode === 'list' ? 'Lists' : 'Table'} your permanent default view for ${currentStaff.name} when logged in`}
        >
          <Pin className="w-3.5 h-3.5 text-blue-300 group-hover:rotate-45 transition-transform shrink-0" />
          <span>Make Default</span>
          <span className="text-[10px] bg-blue-950 text-blue-200 font-bold px-1.5 py-0.5 rounded font-mono">
            {viewMode === 'grid' ? 'Grid' : viewMode === 'board' ? 'Kanban' : viewMode === 'list' ? 'Lists' : 'Table'}
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
      
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

          {canViewWorkloadMatrix && (
            <button
              onClick={() => setShowWorkloadMatrix(!showWorkloadMatrix)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer border shadow-xs ${
                showWorkloadMatrix
                  ? 'bg-indigo-700 text-white border-indigo-700 ring-2 ring-indigo-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}
              title="View Drafter & Dev Workload & Project Assignment Matrix"
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
                  const cleanTaskNum = (task.jobNumber || '').replace(/^[#M\-_]+/i, '').trim().toLowerCase();
                  const parentJob = jobs.find(j => 
                    (j.id && task.jobId && j.id === task.jobId) || 
                    (j.job_number && (j.job_number || '').replace(/^#/, '').trim().toLowerCase() === (task.jobNumber || '').replace(/^#/, '').trim().toLowerCase()) ||
                    (j.job_number && (j.job_number || '').replace(/^[#M\-_]+/i, '').trim().toLowerCase() === cleanTaskNum)
                  );
                  const jobCustomerName = task.customerName || parentJob?.customer_name || parentJob?.project_name || '';
                  return (
                    <div 
                      key={`kyle-rev-${task.id}`}
                      className="bg-white/95 rounded-xl p-3.5 border border-amber-300 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-mono font-black bg-black text-white border border-black px-2.5 py-1 rounded-md shadow-xs tracking-wide">
                              #{task.jobNumber.replace(/^#/, '')}
                            </span>
                            {jobCustomerName && (
                              <span 
                                onClick={() => parentJob && onSelectJob(parentJob)}
                                className={`text-xs sm:text-sm font-bold text-slate-900 ${
                                  parentJob ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                                }`}
                                title={parentJob ? `Open Plan for ${jobCustomerName}` : undefined}
                              >
                                {jobCustomerName}
                              </span>
                            )}
                            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                              {task.category}
                            </span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                              Completed by {task.completedBy || task.assignedTo}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 mt-1">{task.componentTitle}</h4>
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

      {/* TEAM WORKLOAD & PROJECT ASSIGNMENT MATRIX (For Kyle, Jason, Greg, Drew & Leads) */}
      {canViewWorkloadMatrix && showWorkloadMatrix && (
        <div className="my-3">
          <JasonDrafterProjectBoard
            jobs={jobs}
            onSelectJob={onSelectJob}
            onFilterByDrafter={(drafterName) => {
              setSelectedDrafter(drafterName);
            }}
            nowTimestamp={nowTimestamp}
            currentStaff={currentStaff}
            staffList={effectiveStaff}
            onOpenCompleteTaskModal={onOpenCompleteTaskModal}
            devCards={devCards}
            devEntries={devEntries}
            onOpenDevReviewModal={onOpenDevReviewModal}
          />
        </div>
      )}

      {/* METRICS SUMMARY BAR */}
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

        {/* Metric 2: Delegated Tasks & Work Queue Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-4 rounded-xl shadow-xs flex items-center justify-between border border-indigo-700">
          <div>
            <div className="text-[10px] font-mono uppercase text-indigo-200/80 font-semibold">Delegated Work Queue</div>
            <div className="text-xl font-bold font-mono mt-0.5 text-white">
              {myAssignedTasks.length > 0 ? `${myAssignedTasks.length} Assigned To Me` : `${allDelegatedTasks.length} Active in Queue`}
            </div>
          </div>
          <div className="bg-indigo-700/60 p-2.5 rounded-lg border border-indigo-600">
            <ListTodo className="w-5 h-5 text-indigo-200" />
          </div>
        </div>

        {/* Metric 3: Active Live Timers & Projects */}
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
            <span className="text-[10px] text-slate-400 font-mono block">Filtered Plans</span>
            <span className="text-xs font-bold text-blue-700 font-mono">
              {filteredJobs.length} Active
            </span>
          </div>
        </div>
      </div>

      {/* --- DELEGATION COMMAND HUB / MY WORK QUEUE PANEL --- */}
      {allDelegatedTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
          
          {/* Panel Header */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow shrink-0">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
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

            {/* Layout Controls Bar (Grid / Kanban / Lists / Table) + Make Default + Sort by Drafter Name */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* View Switchers */}
              <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-indigo-700/60 shadow-inner">
                <button
                  type="button"
                  id="delegated-view-grid-btn"
                  onClick={() => setDelegatedViewMode('grid')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    delegatedViewMode === 'grid' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Grid view of delegated task cards"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>

                <button
                  type="button"
                  id="delegated-view-kanban-btn"
                  onClick={() => setDelegatedViewMode('board')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    delegatedViewMode === 'board' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Kanban columns by status"
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Kanban</span>
                </button>

                <button
                  type="button"
                  id="delegated-view-lists-btn"
                  onClick={() => setDelegatedViewMode('list')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    delegatedViewMode === 'list' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Streamlined list view of delegated cards"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lists</span>
                </button>

                <button
                  type="button"
                  id="delegated-view-table-btn"
                  onClick={() => setDelegatedViewMode('table')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    delegatedViewMode === 'table' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                  title="Detailed data table sheet view"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
              </div>

              {/* Make Default Button */}
              {justSavedDelegatedDefault ? (
                <div 
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white shadow-xs select-none transition-all animate-bounce"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Saved!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveDelegatedDefault}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer border border-indigo-400/50 bg-indigo-800/80 hover:bg-indigo-700 text-indigo-100 active:scale-95 shadow-2xs group"
                  title={`Make ${delegatedViewMode === 'grid' ? 'Grid' : delegatedViewMode === 'board' ? 'Kanban' : delegatedViewMode === 'list' ? 'Lists' : 'Table'} your permanent default view for delegated work`}
                >
                  <Pin className="w-3.5 h-3.5 text-indigo-300 group-hover:rotate-45 transition-transform shrink-0" />
                  <span>Make Default</span>
                  <span className="text-[10px] bg-indigo-950 text-indigo-200 font-bold px-1.5 py-0.5 rounded font-mono">
                    {delegatedViewMode === 'grid' ? 'Grid' : delegatedViewMode === 'board' ? 'Kanban' : delegatedViewMode === 'list' ? 'Lists' : 'Table'}
                  </span>
                </button>
              )}

              {/* Sort Dropdown: ONLY by Drafter Name */}
              <div className="flex items-center gap-1.5 bg-slate-800/90 border border-indigo-700/60 px-3 py-1.5 rounded-xl text-xs text-white">
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                <span className="text-[11px] font-bold text-indigo-200">Sort:</span>
                <select
                  value={delegatedSortBy}
                  onChange={(e) => setDelegatedSortBy(e.target.value as any)}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs pr-1"
                  title="Sort delegated tasks by drafter name only"
                >
                  <option value="drafter_asc" className="bg-slate-900 text-white">Drafter Name (A → Z)</option>
                  <option value="drafter_desc" className="bg-slate-900 text-white">Drafter Name (Z → A)</option>
                  <option value="my_assigned_first" className="bg-slate-900 text-white">My Assigned First</option>
                </select>
              </div>

              {/* Collapse/Expand Toggle */}
              <button
                onClick={() => setShowDelegationHub(!showDelegationHub)}
                className="text-indigo-300 hover:text-white p-1 rounded-lg transition cursor-pointer"
                title={showDelegationHub ? "Collapse panel" : "Expand panel"}
              >
                {showDelegationHub ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Panel Content */}
          {showDelegationHub && (() => {
            // 1. Filter Tasks
            const filteredTasks = allDelegatedTasks.filter(task => {
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
            });

            // 2. Sort strictly by Drafter Name only
            const sortedTasks = [...filteredTasks].sort((a, b) => {
              const drafterA = (a.assignedTo || '').trim().toLowerCase();
              const drafterB = (b.assignedTo || '').trim().toLowerCase();
              const myName = currentStaff.name.trim().toLowerCase();

              if (delegatedSortBy === 'my_assigned_first') {
                const aIsMine = drafterA.includes(myName) ? 0 : 1;
                const bIsMine = drafterB.includes(myName) ? 0 : 1;
                if (aIsMine !== bIsMine) return aIsMine - bIsMine;
                return drafterA.localeCompare(drafterB);
              }
              if (delegatedSortBy === 'drafter_desc') {
                return drafterB.localeCompare(drafterA);
              }
              // Default: drafter_asc (A to Z)
              return drafterA.localeCompare(drafterB);
            });

            // Card Renderer Helper
            const renderDelegatedCard = (task: DelegatedWorkItem) => {
              const parentJob = resolveParentJob(task);
              const jobCustomerName = task.customerName || parentJob?.customer_name || parentJob?.project_name || '';
              const isAssignedToMe = task.assignedTo.toLowerCase().includes(currentStaff.name.toLowerCase());
              const delegatorName = task.delegatedBy || 'Kyle';
              const isWaitingReview = (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
              const isRevisionReq = task.status === 'Revision Requested' || Boolean(task.revisionRequested);
              const isApproved = task.status === 'Completed' && Boolean(task.isReviewed);
              const isTimerActive = isTaskTimerRunning(task, parentJob);
              const timeDisplay = getTaskElapsedTime(task, parentJob);
              const isAuthorizedReviewer = Boolean(
                currentStaff && (
                  currentStaff.name.toLowerCase().includes('kyle') ||
                  currentStaff.name.toLowerCase().includes('jason') ||
                  (task.delegatedBy && currentStaff.name.toLowerCase().includes(task.delegatedBy.toLowerCase()))
                )
              );

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl p-4 border transition-all shadow-xs space-y-3 ${
                    isRevisionReq
                      ? 'border-orange-400 ring-2 ring-orange-300/40 bg-gradient-to-b from-orange-50/30 to-white'
                      : isWaitingReview 
                      ? 'border-amber-400 ring-2 ring-amber-300/40 bg-gradient-to-b from-amber-50/20 to-white' 
                      : isApproved
                      ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/20 to-white'
                      : isTimerActive
                      ? 'border-emerald-400 ring-2 ring-emerald-300/40 bg-gradient-to-b from-emerald-50/30 to-white'
                      : isAssignedToMe 
                      ? 'border-indigo-300 ring-1 ring-indigo-200' 
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Row: Job # & Customer + Dynamic Status Badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="text-xs sm:text-sm font-mono font-black bg-black text-white border border-black px-2.5 py-0.5 rounded shadow-xs tracking-wide shrink-0">
                        #{task.jobNumber.replace(/^#/, '')}
                      </span>
                      {jobCustomerName && (
                        <span 
                          onClick={() => parentJob && onSelectJob(parentJob)}
                          className={`text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[170px] sm:max-w-xs ${
                            parentJob ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''
                          }`}
                          title={parentJob ? `Open Plan for ${jobCustomerName}` : undefined}
                        >
                          {jobCustomerName}
                        </span>
                      )}
                    </div>

                    {/* Dynamic Status Badge (Neatly right aligned, never squashed) */}
                    <div className="shrink-0">
                      {isTimerActive ? (
                        <span className="text-[10px] sm:text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          <span>In Progress</span>
                        </span>
                      ) : isApproved ? (
                        <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Approved</span>
                        </span>
                      ) : isWaitingReview ? (
                        <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Under Review</span>
                        </span>
                      ) : isRevisionReq ? (
                        <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-800 border border-orange-300 flex items-center gap-1 shadow-2xs">
                          <RotateCcw className="w-3 h-3 text-orange-600" />
                          <span>Revision</span>
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category, Priority & Component Title */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
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
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm mt-1 leading-snug break-words">
                      {task.componentTitle}
                    </h4>
                  </div>

                  {/* Dedicated Action Controls Tray: Start/Stop Timer Button + Mark Complete Button */}
                  <div className="bg-slate-50/90 p-2 rounded-xl border border-slate-200 flex items-center gap-2 flex-wrap">
                    {/* Start / Stop Timer Button */}
                    {isTimerActive ? (
                      <button
                        type="button"
                        onClick={() => handleStopTaskTimer(task, parentJob)}
                        className="flex-1 min-w-[120px] justify-center bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer animate-pulse"
                        title="Stop active drafting timer"
                      >
                        <Square className="w-3 h-3 fill-white shrink-0" />
                        <span>Stop Timer</span>
                        {timeDisplay && (
                          <span className="font-mono bg-red-800/90 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                            {timeDisplay}
                          </span>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartTaskTimer(task, parentJob)}
                        className="flex-1 min-w-[110px] justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        title="Start drafting timer for this component"
                      >
                        <Play className="w-3 h-3 fill-white shrink-0" />
                        <span>Start Timer</span>
                      </button>
                    )}

                    {/* Mark Complete Button */}
                    {!isApproved && !isWaitingReview ? (
                      <button
                        type="button"
                        onClick={() => handleMarkTaskComplete(task, parentJob)}
                        className="flex-1 min-w-[110px] justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        title="Mark this delegated task as complete and submit for review"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Mark Complete</span>
                      </button>
                    ) : isWaitingReview ? (
                      <div className="flex-1 min-w-[100px] text-center text-[11px] font-bold text-amber-800 bg-amber-100/70 py-1.5 rounded-lg border border-amber-200">
                        Submitted for Review
                      </div>
                    ) : (
                      <div className="flex-1 min-w-[100px] text-center text-[11px] font-bold text-emerald-800 bg-emerald-100/70 py-1.5 rounded-lg border border-emerald-200 flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Signed Off</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {task.neededWorkDescription && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                      {task.neededWorkDescription}
                    </p>
                  )}

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
                          <span>Revision Requested by <strong>{task.revisionRequestedBy || delegatorName}</strong></span>
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
                  {(task.status === 'Completed' || task.status === 'Under Review') && (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 space-y-2 text-xs text-emerald-950">
                      <div className="flex items-center justify-between font-semibold flex-wrap gap-1">
                        <span className="flex items-center gap-1.5 text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {isApproved 
                              ? `Signed Off & Approved by ${task.reviewedBy || delegatorName}`
                              : `Task Completed & Submitted to ${delegatorName} for Review`
                            }
                          </span>
                        </span>
                        {task.completedAt && (
                          <span className="text-[10px] text-emerald-700 font-mono">
                            {new Date(task.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Review Callout Box: ONLY Kyle or Jason or Delegator see action buttons */}
                      {isWaitingReview && (
                        <div className="bg-amber-500/15 border border-amber-400 p-2.5 rounded-lg flex items-center justify-between gap-2 flex-wrap text-amber-950">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span className="font-extrabold text-xs">
                              {isAuthorizedReviewer
                                ? `Waiting for your review and sign-off`
                                : `Waiting for ${delegatorName} to review`}
                            </span>
                          </div>

                          {isAuthorizedReviewer && (
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
                                  onClick={() => onApproveTaskReview(task.jobId, task.id, `Signed off & approved by ${currentStaff.name}`)}
                                  className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Sign Off & Approve</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {task.completionNotes && (
                        <p className="text-[11px] text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-100 italic">
                          "{task.completionNotes}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Attached Project & CAD Files Tray */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                          <span>Attached Plan & Reference Files ({task.attachments.length})</span>
                        </span>
                        <span className="text-[10px] text-blue-600 font-medium">Click to view or download</span>
                      </div>

                      <div className="space-y-1.5">
                        {task.attachments.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-200/80 hover:border-blue-400 text-xs shadow-2xs transition group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs truncate max-w-[200px] sm:max-w-xs" title={file.name}>
                                  {file.name}
                                </p>
                                <span className="text-[10px] text-slate-500 font-mono">{file.size}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {file.url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewingAttachment({
                                    file,
                                    taskTitle: task.componentTitle,
                                    jobNumber: parentJob?.job_number || task.jobNumber
                                  })}
                                  className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition flex items-center gap-1 cursor-pointer border border-blue-200"
                                  title="Preview file"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                              )}
                              <a
                                href={file.url || '#'}
                                download={file.name}
                                className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition flex items-center gap-1 cursor-pointer border border-slate-200"
                                title="Download file"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Meta & Open Plan Link */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                    <div className="space-y-1">
                      <span className="text-slate-500 block">
                        Assigned to: <strong className="text-slate-800">{task.assignedTo}</strong> (by {task.delegatedBy})
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          <Calendar className="w-3 h-3 text-indigo-600" />
                          <span>Delegated: <strong>{task.delegatedAt ? new Date(task.delegatedAt).toLocaleDateString() : 'N/A'}</strong></span>
                        </span>
                        {task.completedAt && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Completed: <strong>{new Date(task.completedAt).toLocaleDateString()}</strong></span>
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="text-slate-500">
                            Due: <strong className="text-slate-700">{task.dueDate}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.attachments && task.attachments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewingAttachment({
                            file: task.attachments![0],
                            taskTitle: task.componentTitle,
                            jobNumber: parentJob?.job_number || task.jobNumber
                          })}
                          className="flex items-center gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded font-bold text-[10px] transition cursor-pointer"
                          title="Open attached file viewer"
                        >
                          <Paperclip className="w-3 h-3 text-blue-600" />
                          <span>{task.attachments.length} {task.attachments.length === 1 ? 'File' : 'Files'}</span>
                        </button>
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
            };

            // Table Row Renderer Helper
            const renderDelegatedTableRow = (task: DelegatedWorkItem) => {
              const parentJob = resolveParentJob(task);
              const jobCustomerName = task.customerName || parentJob?.customer_name || parentJob?.project_name || '';
              const isWaitingReview = (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
              const isRevisionReq = task.status === 'Revision Requested' || Boolean(task.revisionRequested);
              const isApproved = task.status === 'Completed' && Boolean(task.isReviewed);
              const isTimerActive = isTaskTimerRunning(task, parentJob);
              const timeDisplay = getTaskElapsedTime(task, parentJob);

              return (
                <tr key={task.id} className="hover:bg-indigo-50/40 border-b border-indigo-100 text-xs transition">
                  {/* Job # & Customer */}
                  <td className="p-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-mono font-black bg-black text-white px-2 py-0.5 rounded shadow-2xs">
                        #{task.jobNumber.replace(/^#/, '')}
                      </span>
                      {jobCustomerName && (
                        <span
                          onClick={() => parentJob && onSelectJob(parentJob)}
                          className={`font-bold text-slate-900 ${parentJob ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''}`}
                        >
                          {jobCustomerName}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Component & Category */}
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{task.componentTitle}</div>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 font-semibold px-1.5 py-0.5 rounded">
                      {task.category}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      task.priority === 'Urgent'
                        ? 'bg-red-100 text-red-700'
                        : task.priority === 'High'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {task.priority}
                    </span>
                  </td>

                  {/* Drafter */}
                  <td className="p-3">
                    <div className="flex items-center gap-1 font-semibold text-slate-800">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{task.assignedTo}</span>
                    </div>
                  </td>

                  {/* Delegated By & Due */}
                  <td className="p-3 text-slate-500 text-[11px]">
                    <div>by <strong>{task.delegatedBy}</strong></div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      Delegated: <strong>{task.delegatedAt ? new Date(task.delegatedAt).toLocaleDateString() : 'N/A'}</strong>
                    </div>
                    {task.completedAt && (
                      <div className="text-[10px] text-emerald-700 font-mono font-bold">
                        Completed: {new Date(task.completedAt).toLocaleDateString()}
                      </div>
                    )}
                    {task.dueDate && <div className="text-[10px] text-slate-400">Due: {task.dueDate}</div>}
                  </td>

                  {/* Status Badge */}
                  <td className="p-3">
                    {isTimerActive ? (
                      <span className="text-[10px] font-extrabold px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>In Progress</span>
                      </span>
                    ) : isApproved ? (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>Approved</span>
                      </span>
                    ) : isWaitingReview ? (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Under Review</span>
                      </span>
                    ) : isRevisionReq ? (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-orange-50 text-orange-800 border border-orange-300 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3 text-orange-600" />
                        <span>Revision</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-300">
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Timer Controls */}
                  <td className="p-3">
                    {isTimerActive ? (
                      <button
                        type="button"
                        onClick={() => handleStopTaskTimer(task, parentJob)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer animate-pulse"
                      >
                        <Square className="w-3 h-3 fill-white" />
                        <span>Stop</span>
                        {timeDisplay && <span className="font-mono text-[10px] bg-red-800 px-1 rounded">{timeDisplay}</span>}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartTaskTimer(task, parentJob)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Start</span>
                      </button>
                    )}
                  </td>

                  {/* Mark Complete */}
                  <td className="p-3">
                    {!isApproved && !isWaitingReview ? (
                      <button
                        type="button"
                        onClick={() => handleMarkTaskComplete(task, parentJob)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    ) : isWaitingReview ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Submitted
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Done
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {task.attachments && task.attachments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewingAttachment({
                            file: task.attachments![0],
                            taskTitle: task.componentTitle,
                            jobNumber: parentJob?.job_number || task.jobNumber
                          })}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded transition cursor-pointer"
                          title="Preview attached file"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {parentJob && (
                        <button
                          onClick={() => onSelectJob(parentJob)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition cursor-pointer"
                        >
                          Open Plan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            };

            // Kanban Board Renderer Helper
            const renderDelegatedKanban = (tasks: DelegatedWorkItem[]) => {
              const pendingTasks = tasks.filter(t => {
                const parentJob = resolveParentJob(t);
                const isRunning = isTaskTimerRunning(t, parentJob);
                return !isRunning && t.status !== 'Completed' && t.status !== 'Under Review' && t.status !== 'Revision Requested' && !t.revisionRequested && !t.isReviewed;
              });

              const inProgressTasks = tasks.filter(t => {
                const parentJob = resolveParentJob(t);
                const isRunning = isTaskTimerRunning(t, parentJob);
                return (isRunning || t.status === 'In Progress') && t.status !== 'Completed' && t.status !== 'Under Review';
              });

              const underReviewTasks = tasks.filter(t => 
                (t.status === 'Completed' || t.status === 'Under Review') && !t.isReviewed && !t.revisionRequested
              );

              const revisionTasks = tasks.filter(t => 
                t.status === 'Revision Requested' || Boolean(t.revisionRequested)
              );

              const approvedTasks = tasks.filter(t => 
                t.status === 'Completed' && Boolean(t.isReviewed)
              );

              const kanbanColumns = [
                { id: 'pending', title: 'Pending', count: pendingTasks.length, items: pendingTasks, color: 'border-slate-300 bg-slate-50/70', badgeColor: 'bg-slate-200 text-slate-800' },
                { id: 'in_progress', title: 'In Progress', count: inProgressTasks.length, items: inProgressTasks, color: 'border-blue-300 bg-blue-50/40', badgeColor: 'bg-blue-200 text-blue-900', hasPulse: inProgressTasks.some(t => isTaskTimerRunning(t, resolveParentJob(t))) },
                { id: 'under_review', title: 'Under Review', count: underReviewTasks.length, items: underReviewTasks, color: 'border-amber-300 bg-amber-50/40', badgeColor: 'bg-amber-200 text-amber-900' },
                { id: 'revisions', title: 'Revisions', count: revisionTasks.length, items: revisionTasks, color: 'border-orange-300 bg-orange-50/40', badgeColor: 'bg-orange-200 text-orange-900' },
                { id: 'approved', title: 'Approved & Signed Off', count: approvedTasks.length, items: approvedTasks, color: 'border-emerald-300 bg-emerald-50/40', badgeColor: 'bg-emerald-200 text-emerald-900' },
              ];

              return (
                <div className="flex gap-4 overflow-x-auto pb-5 pt-1 items-start scrollbar-thin">
                  {kanbanColumns.map(col => (
                    <div key={col.id} className={`w-80 shrink-0 rounded-2xl border ${col.color} p-3.5 space-y-3 min-h-[220px] bg-white/60 shadow-2xs flex flex-col`}>
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-100/60">
                        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          {col.hasPulse && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>}
                          <span>{col.title}</span>
                        </h4>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                          {col.count}
                        </span>
                      </div>

                      <div className="space-y-3 flex-1">
                        {col.items.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 italic bg-white/70 rounded-xl border border-dashed border-slate-200">
                            No tasks
                          </div>
                        ) : (
                          col.items.map(t => renderDelegatedCard(t))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            };

            return (
              <div className="p-4 space-y-3.5 bg-indigo-50/30">
                {/* Filter Tabs & Quick Drafter Dropdown */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setDelegationFilter('all')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                        delegationFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:bg-indigo-100/70'
                      }`}
                    >
                      All Delegations ({allDelegatedTasks.length})
                    </button>

                    <button
                      onClick={() => setDelegationFilter('my_assigned')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                        delegationFilter === 'my_assigned' ? 'bg-indigo-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:bg-indigo-100/70'
                      }`}
                    >
                      Assigned to {currentStaff.name.split(' ')[0]} ({myAssignedTasks.length})
                    </button>

                    <button
                      onClick={() => setDelegationFilter('pending')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                        delegationFilter === 'pending' ? 'bg-indigo-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:bg-indigo-100/70'
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
                        delegationFilter === 'approved' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
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

                {/* Main Views Container according to delegatedViewMode */}
                {sortedTasks.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center border border-indigo-100 shadow-xs space-y-2">
                    <ListTodo className="w-8 h-8 text-indigo-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">No delegated work items match the current filter</p>
                    <p className="text-xs text-slate-400">Try selecting another filter tab or drafter above.</p>
                  </div>
                ) : delegatedViewMode === 'table' ? (
                  /* TABLE VIEW */
                  <div className="bg-white rounded-xl border border-indigo-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-indigo-950 text-white text-[11px] font-mono uppercase tracking-wider">
                            <th className="p-3">Job # & Customer</th>
                            <th className="p-3">Component / Task</th>
                            <th className="p-3">Priority</th>
                            <th className="p-3">Assigned Drafter</th>
                            <th className="p-3">Delegated By</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Timer Controls</th>
                            <th className="p-3">Mark Complete</th>
                            <th className="p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTasks.map(t => renderDelegatedTableRow(t))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : delegatedViewMode === 'board' ? (
                  /* KANBAN BOARD VIEW */
                  renderDelegatedKanban(sortedTasks)
                ) : delegatedViewMode === 'list' ? (
                  /* LISTS VIEW (Single column stacked full-width cards) */
                  <div className="grid grid-cols-1 gap-3.5">
                    {sortedTasks.map(t => renderDelegatedCard(t))}
                  </div>
                ) : (
                  /* GRID VIEW (Default 2/3 Column Grid) */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {sortedTasks.map(t => renderDelegatedCard(t))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* DRAFTER WORKSPACE BANNER & QUICK SELECTOR CHIPS */}
      {isIndividualDrafter ? (
        /* INDIVIDUAL DRAFTER SCOPED WORKSPACE HEADER */
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
                    {drafterScopeFilter === 'all' ? 'All Company Plans' : 'My Touched Plans'}
                  </span>
                  {runningTimers.length > 0 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400 animate-spin" />
                      Timer Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {drafterScopeFilter === 'all'
                    ? `Displaying all company plans. You can search or view any project across the organization.`
                    : `Displaying projects where you are assigned, delegated work, logged CAD time, or tagged in notes.`}
                </p>
              </div>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  {drafterScopeFilter === 'all' ? 'Company Plans' : 'My Touched Plans'}
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {filteredJobs.length} {drafterScopeFilter === 'all' ? 'Total' : 'Active'}
                </span>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">My Delegated Tasks</span>
                <span className="text-sm font-bold text-indigo-300 font-mono">{myAssignedTasks.length} Components</span>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Logged CAD Time</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{formatSecondsToReadable(totalTrackedSeconds)}</span>
              </div>
              {renderProjectViewControls()}
            </div>
          </div>
        </div>
      ) : (
        /* MANAGER & OPERATIONS DRAFTER SELECTOR CHIPS BAR (Jason, Greg, Kyle) */
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-4.5 rounded-2xl border border-indigo-800/80 shadow-md space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Filter by Specific Drafter's Board
              </span>
              <span className="text-[11px] text-indigo-200/90 font-medium hidden sm:inline">
                (Click a drafter to view only their assigned projects & delegated tasks)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedDrafter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedDrafter('all')}
                  className="text-xs text-indigo-200 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer bg-indigo-800/60 hover:bg-indigo-700/80 px-2.5 py-1.5 rounded-xl border border-indigo-600/50 transition shadow-2xs"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset to All Drafters</span>
                </button>
              )}

              {renderProjectViewControls()}
            </div>
          </div>

          {/* Drafter Pill Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedDrafter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                selectedDrafter === 'all'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-xs ring-2 ring-blue-400/50'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 hover:text-white border-indigo-700/70 shadow-2xs'
              }`}
            >
              <span>All Drafters</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                selectedDrafter === 'all' ? 'bg-blue-800 text-white' : 'bg-slate-900/90 text-indigo-200 border border-indigo-800/80'
              }`}>
                {jobs.length}
              </span>
            </button>

            {draftersList.map((drafter) => {
              const stats = getDrafterStats(drafter);
              const isSelected = selectedDrafter.toLowerCase() === drafter.toLowerCase();

              return (
                <button
                  key={`chip-${drafter}`}
                  onClick={() => setSelectedDrafter(isSelected ? 'all' : drafter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400/50'
                      : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 hover:text-white border-indigo-700/70 shadow-2xs'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? 'bg-blue-800 text-white' : 'bg-indigo-900 text-indigo-200 border border-indigo-700/60'
                  }`}>
                    {drafter.charAt(0)}
                  </div>

                  <span>{drafter}</span>

                  {stats.hasActiveTimer && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Active timer currently running!" />
                  )}

                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-blue-800 text-white' : 'bg-slate-900/90 text-indigo-200 border border-indigo-800/80'
                  }`}>
                    {stats.projectCount} {stats.projectCount === 1 ? 'plan' : 'plans'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ACTIVE DRAFTER SPOTLIGHT BANNER */}
          {selectedDrafter !== 'all' && activeDrafterStats && (
            <div className="bg-slate-900/85 border border-indigo-700/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {selectedDrafter.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-white text-sm">{selectedDrafter}'s Board</h4>
                    <span className="text-[10px] bg-blue-900/80 text-blue-200 border border-blue-700/60 px-2 py-0.5 rounded-full font-semibold">
                      {activeDrafterStaff?.title || 'Drafter'}
                    </span>
                    {activeDrafterStats.hasActiveTimer && (
                      <span className="text-[10px] bg-emerald-900/70 text-emerald-300 border border-emerald-600/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400 animate-spin" />
                        Live Timer Running
                      </span>
                    )}
                  </div>
                  <p className="text-indigo-200/90 text-[11px] mt-0.5">
                    Currently assigned to <strong className="text-white">{activeDrafterStats.projectCount} project(s)</strong> and <strong className="text-white">{activeDrafterStats.delegatedCount} delegated work component(s)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-indigo-200 bg-slate-950/80 border border-indigo-700/80 px-3 py-1.5 rounded-lg shadow-2xs">
                  Showing {filteredJobs.length} of {jobs.length} Total Projects
                </span>
                <button
                  onClick={() => setSelectedDrafter('all')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-slate-700"
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
        
        {/* Search Input for Job #, Customer, Style, Drafter */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search all plans (Job #, customer name, house style, drafter)..."
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
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setDrafterScopeFilter('touched')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  drafterScopeFilter === 'touched'
                    ? 'bg-white text-blue-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Display plans you have worked on, been assigned, or been tagged in"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>My Plans ({myTouchedJobsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrafterScopeFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  drafterScopeFilter === 'all'
                    ? 'bg-white text-blue-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Display all active plans across the entire company"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>All Plans ({activeJobs.length})</span>
              </button>
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

          {/* Archived & Paid Filter Pill (Authorized Managers: Kyle, Jason, Drew, Ethan, Greg Hyatt) */}
          {isAllCardsAuthorized && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold transition cursor-pointer shrink-0 ${
                showArchived
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Show paid & archived projects (retrievable by Kyle, Jason, Drew, Ethan for notes & records)"
            >
              <Archive className={`w-3.5 h-3.5 ${showArchived ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Archived ({jobs.filter(j => isJobArchived(j)).length})</span>
            </button>
          )}
        </div>

      </div>

      {/* Active Search & Filter Indicator */}
      {(searchQuery || (isAllCardsAuthorized && showArchived)) && (
        <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs flex items-center justify-between gap-2 text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'project' : 'projects'}
            </span>
            {searchQuery && (
              <span className="text-slate-500">
                matching query <strong className="text-blue-700">"{searchQuery}"</strong>
                {isAllCardsAuthorized && ' (includes active and archived/paid plans)'}
              </span>
            )}
            {isAllCardsAuthorized && showArchived && !searchQuery && (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                • Displaying archived/paid plans along with active boards
              </span>
            )}
          </div>

          {(searchQuery || showArchived) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowArchived(false);
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* VIEW MODE 1: GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              allJobs={jobs}
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
              onUpdateCustomerContact={onUpdateCustomerContact}
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
                        <div className="flex justify-between items-start gap-1 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs sm:text-sm font-mono font-black bg-black text-white px-2.5 py-1 rounded-md border border-black shadow-xs tracking-wide">
                              #{job.job_number.replace(/^#/, '')}
                            </span>
                            {job.owner && (
                              <span className="text-[9px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-0.5" title={`Owner: ${job.owner}`}>
                                <Building className="w-2.5 h-2.5 text-purple-500" />
                                <span>{job.owner}</span>
                              </span>
                            )}
                            {isJobArchived(job) && (
                              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Archive className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Archived</span>
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-bold text-slate-900 text-xs truncate" title={job.project_name || job.customer_name}>
                              {job.project_name || job.customer_name}
                            </h4>
                            {job.builder && (
                              <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5" title={`Builder: ${job.builder}`}>
                                <Hammer className="w-2.5 h-2.5 text-amber-600" />
                                <span className="truncate max-w-[80px]">{job.builder}</span>
                              </span>
                            )}
                          </div>

                          {job.project_name && job.customer_name && job.project_name.toLowerCase() !== job.customer_name.toLowerCase() && (
                            <p className="text-[10px] text-slate-500">Customer: <span className="font-medium text-slate-700">{job.customer_name}</span></p>
                          )}

                          {job.project_address && (
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate" title={job.project_address}>
                              <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                              <span className="truncate">{job.project_address}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10px]">
                            {job.sq_ft_goal ? (
                              <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                Goal: {job.sq_ft_goal}
                              </span>
                            ) : job.sq_ft > 0 ? (
                              <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                {job.sq_ft} sq ft
                              </span>
                            ) : null}
                            {job.sheet_status && (
                              <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                {job.sheet_status}
                              </span>
                            )}
                          </div>

                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                            <User className="w-2.5 h-2.5 text-slate-400" />
                            <span className="truncate">{job.assigned_drafter}</span>
                          </p>

                          {delegatedCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded mt-1">
                              <ListTodo className="w-3 h-3" />
                              <span>{delegatedCount} Delegated</span>
                            </span>
                          )}

                          {/* Client Contact Shortcuts in Kanban with Edit */}
                          <div className="flex items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-600">
                            <div className="flex items-center gap-2 truncate min-w-0">
                              {job.customer_email && (
                                <a 
                                  href={`mailto:${job.customer_email.split(';')[0].trim()}`} 
                                  onClick={(e) => e.stopPropagation()} 
                                  className="flex items-center gap-0.5 text-blue-600 hover:underline truncate max-w-[120px]"
                                  title={job.customer_email}
                                >
                                  <Mail className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{job.customer_email.split(';')[0].trim()}</span>
                                </a>
                              )}
                              {job.customer_phone && (
                                <a 
                                  href={`tel:${job.customer_phone}`} 
                                  onClick={(e) => e.stopPropagation()} 
                                  className="flex items-center gap-0.5 text-slate-700 hover:underline font-mono shrink-0"
                                  title={job.customer_phone}
                                >
                                  <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span>{job.customer_phone}</span>
                                </a>
                              )}
                              {!job.customer_email && !job.customer_phone && (
                                <span className="text-slate-400 italic text-[9px]">No contact info</span>
                              )}
                            </div>
                            {onUpdateCustomerContact && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJobForContactEdit(job);
                                }}
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition shrink-0"
                                title="Update Customer Contact Info"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Kanban Quick Timer Control */}
                        <div className={`p-2 rounded-lg border flex items-center justify-between text-[11px] transition ${
                          isRunning ? 'bg-emerald-50/80 border-emerald-300' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono block uppercase">Logged</span>
                            <span className={`font-mono font-bold ${isRunning ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {isRunning ? formatSecondsToHHMMSS(jobSecs) : formatSecondsToReadable(jobSecs)}
                            </span>
                          </div>
                          <div>
                            {isRunning ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); onStopTimer(job.id); }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs animate-pulse"
                              >
                                <Square className="w-3 h-3 fill-white" />
                                Stop
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); onStartTimer(job.id); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Play className="w-3 h-3 fill-white" />
                                Start
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="pt-1 flex justify-between items-center text-[10px] text-slate-400">
                          {canAccessFinancials ? (
                            <span className={`font-semibold ${isRunning ? 'text-emerald-600 font-bold' : 'text-emerald-700'}`}>
                              ${jobBillable.toFixed(2)} billable
                            </span>
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

      {/* VIEW MODE: STREAMLINED LISTS VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const isRunning = Boolean(job.active_timer_start);
            const totalSecs = calculateJobTotalSeconds(job, nowTimestamp);
            const billable = calculateJobBillableAmount(job, nowTimestamp);
            const delegatedTasks = job.delegated_tasks || [];

            return (
              <div
                key={`list-${job.id}`}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs hover:shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isRunning
                    ? 'border-emerald-400 ring-2 ring-emerald-300/40 bg-gradient-to-r from-emerald-50/30 via-white to-white'
                    : job.roadblock
                    ? 'border-red-300 ring-1 ring-red-200/50 bg-gradient-to-r from-red-50/20 via-white to-white'
                    : 'border-slate-200/90 hover:border-blue-300'
                }`}
              >
                {/* Left Section: Identifiers, Project Name, Customer & Location */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-mono font-black bg-black text-white px-2.5 py-1 rounded-md border border-black shadow-xs tracking-wide">
                      #{job.job_number.replace(/^#/, '')}
                    </span>

                    {job.owner && (
                      <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Building className="w-3 h-3 text-purple-600" />
                        <span>{job.owner}</span>
                      </span>
                    )}

                    {isJobArchived(job) && (
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Archive className="w-3 h-3 text-emerald-600" />
                        <span>Archived</span>
                      </span>
                    )}

                    {isRunning ? (
                      <span className="text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <Clock className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
                        <span>TIMER ACTIVE</span>
                      </span>
                    ) : job.roadblock ? (
                      <span className="text-[11px] bg-red-100 text-red-900 border border-red-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        <span>ROADBLOCK</span>
                      </span>
                    ) : null}

                    {job.builder && (
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Hammer className="w-3 h-3 text-amber-600" />
                        <span>{job.builder}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 
                      onClick={() => onSelectJob(job)}
                      className="text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition flex items-center gap-1.5"
                    >
                      <span>{job.project_name || job.customer_name}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </h4>
                    {job.project_name && job.customer_name && job.project_name.toLowerCase() !== job.customer_name.toLowerCase() && (
                      <p className="text-xs text-slate-500">Customer: <span className="font-semibold text-slate-700">{job.customer_name}</span></p>
                    )}
                  </div>

                  {/* Project Meta Chips */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
                    {job.project_address && (
                      <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs" title={job.project_address}>
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">{job.project_address}</span>
                      </span>
                    )}

                    {job.sq_ft_goal ? (
                      <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Goal: {job.sq_ft_goal} sq ft
                      </span>
                    ) : job.sq_ft > 0 ? (
                      <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {job.sq_ft} sq ft
                      </span>
                    ) : null}

                    {job.style && (
                      <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {job.style}
                      </span>
                    )}

                    {job.sheet_status && (
                      <span className="font-semibold text-slate-700 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                        {job.sheet_status}
                      </span>
                    )}
                  </div>

                  {/* Contact Shortcuts */}
                  <div className="flex items-center gap-3 pt-1 text-xs text-slate-600 flex-wrap">
                    {job.customer_email && (
                      <a 
                        href={`mailto:${job.customer_email.split(';')[0].trim()}`} 
                        className="text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[180px]"
                        title={job.customer_email}
                      >
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{job.customer_email.split(';')[0].trim()}</span>
                      </a>
                    )}
                    {job.customer_phone && (
                      <a 
                        href={`tel:${job.customer_phone}`} 
                        className="text-slate-700 hover:underline font-mono flex items-center gap-1"
                        title={job.customer_phone}
                      >
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{job.customer_phone}</span>
                      </a>
                    )}
                    {onUpdateCustomerContact && (
                      <button
                        type="button"
                        onClick={() => setSelectedJobForContactEdit(job)}
                        className="text-slate-400 hover:text-blue-600 flex items-center gap-1 transition cursor-pointer text-[11px]"
                        title="Edit Customer Contact Info"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Contact</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Middle Section: Workflow Phase, Drafter, Delegated & Logged Time */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-4 border-t lg:border-t-0 lg:border-l border-slate-200/80 pt-3 lg:pt-0 lg:pl-5">
                  
                  {/* Phase Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Workflow Phase</span>
                    <select
                      value={job.current_status}
                      onChange={(e) => {
                        const newPhase = e.target.value as JobPhase;
                        if (newPhase === 'Completed' && !canMarkProjectCompleted) {
                          alert('Permission Restricted: Only Kyle or Jason have the authority to mark a project as Completed.');
                          return;
                        }
                        onUpdateStatus(job.id, newPhase);
                      }}
                      className="bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      {PHASES.map((p) => (
                        <option key={`list-phase-${job.id}-${p}`} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assigned & Involved Drafters */}
                  <div className="space-y-1 min-w-[130px]">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Drafter(s)</span>
                    {(() => {
                      const involved = getJobInvolvedDrafters(job);
                      if (involved.length === 0) {
                        return <span className="text-slate-400 text-xs">—</span>;
                      }
                      return (
                        <div className="flex flex-col gap-1 max-w-[180px]">
                          {involved.slice(0, 3).map(name => (
                            <span key={`list-dr-${job.id}-${name}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-indigo-50/70 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                              <User className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate">{name}</span>
                            </span>
                          ))}
                          {involved.length > 3 && (
                            <span className="text-[10px] text-slate-500 font-bold">
                              +{involved.length - 3} more
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Logged Time */}
                  <div className="space-y-1 min-w-[110px]">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">CAD Time</span>
                    <div className="flex items-center gap-1.5 text-sm font-bold font-mono text-slate-900">
                      <Clock className={`w-3.5 h-3.5 ${isRunning ? 'text-emerald-600 animate-spin' : 'text-slate-400'}`} />
                      <span className={isRunning ? 'text-emerald-700 font-mono font-black' : ''}>
                        {isRunning ? formatSecondsToHHMMSS(totalSecs) : formatSecondsToReadable(totalSecs)}
                      </span>
                    </div>
                    {canAccessFinancials ? (
                      <span className={`text-[10px] font-mono font-semibold block ${isRunning ? 'text-emerald-600 font-bold animate-pulse' : 'text-emerald-700'}`}>
                        ${billable.toFixed(2)} billable
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 block">
                        {(job.time_logs || []).length} session{(job.time_logs || []).length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {/* Right Actions: Timer, Roadblock, Delegate & Open */}
                  <div className="flex items-center gap-2 pt-2 lg:pt-0">
                    {/* Timer Start / Stop */}
                    {isRunning ? (
                      <button
                        onClick={() => onStopTimer(job.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                        title="Stop live drafting timer"
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartTimer(job.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                        title="Start live drafting timer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Start</span>
                      </button>
                    )}

                    {/* Roadblock Toggle */}
                    <button
                      onClick={() => onToggleRoadblock(job.id)}
                      className={`p-2 rounded-xl border transition cursor-pointer ${
                        job.roadblock
                          ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                      title={job.roadblock ? 'Resolve Roadblock' : 'Flag Roadblock'}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>

                    {/* Delegate Work Button */}
                    {canDelegate && onOpenDelegateModal && (
                      <button
                        onClick={() => onOpenDelegateModal(job)}
                        className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                        title="Delegate work component to another drafter"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Open Plan Modal */}
                    <button
                      onClick={() => onSelectJob(job)}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      <span>Open Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>

              </div>
            );
          })}

          {filteredJobs.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
              <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No project plans match your current criteria</h4>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your drafter filter, roadblock toggle, or search query.</p>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 3: DETAILED TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[1100px] text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-mono text-[10px] text-slate-500 tracking-wider">
                <tr>
                  <th className="p-3.5 pl-4">Job # / Owner</th>
                  <th className="p-3.5">Project & Customer</th>
                  <th className="p-3.5">Drafter</th>
                  <th className="p-3.5">Phase & Status</th>
                  <th className="p-3.5">Time Logged</th>
                  {canAccessFinancials && <th className="p-3.5">Invoicing ($)</th>}
                  <th className="p-3.5 whitespace-nowrap">Job Notes</th>
                  <th className="p-3.5">Timer Controls</th>
                  <th className="p-3.5 pr-8 text-right min-w-[240px] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => {
                  const isRunning = Boolean(job.active_timer_start);
                  const totalSecs = calculateJobTotalSeconds(job, nowTimestamp);
                  const billable = calculateJobBillableAmount(job, nowTimestamp);
                  const delegatedTasks = job.delegated_tasks || [];
                  const delegatedAssignees = Array.from(
                    new Set(delegatedTasks.map(t => t.assignedTo?.trim()).filter(Boolean))
                  );

                  return (
                    <tr key={job.id} className={`transition ${isRunning ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm sm:text-base font-mono font-black bg-black text-white border border-black px-2.5 py-1 rounded-md shadow-xs inline-flex items-center tracking-wide">
                              #{job.job_number.replace(/^#/, '')}
                            </span>
                            {job.owner && (
                              <span className="text-[9px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded">
                                {job.owner}
                              </span>
                            )}
                          </div>
                          {isJobArchived(job) && (
                            <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded flex items-center gap-0.5 w-fit">
                              <Archive className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Archived</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900">{job.project_name || job.customer_name}</div>
                          {job.project_name && job.customer_name && job.project_name.toLowerCase() !== job.customer_name.toLowerCase() && (
                            <div className="text-[11px] text-slate-500">Customer: {job.customer_name}</div>
                          )}
                          {job.project_address && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate max-w-[200px]" title={job.project_address}>
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="truncate">{job.project_address}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-600">
                            {job.customer_email && (
                              <a href={`mailto:${job.customer_email.split(';')[0].trim()}`} className="text-blue-600 hover:underline flex items-center gap-0.5 truncate max-w-[130px]" title={job.customer_email}>
                                <Mail className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{job.customer_email.split(';')[0].trim()}</span>
                              </a>
                            )}
                            {job.customer_phone && (
                              <a href={`tel:${job.customer_phone}`} className="text-slate-700 hover:underline font-mono flex items-center gap-0.5" title={job.customer_phone}>
                                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span>{job.customer_phone}</span>
                              </a>
                            )}
                            {onUpdateCustomerContact && (
                              <button
                                type="button"
                                onClick={() => setSelectedJobForContactEdit(job)}
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition"
                                title="Update Customer Contact Info"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Drafter Column: displays any drafter who has worked on, been assigned, or been tagged in this job */}
                      <td className="p-3.5">
                        {(() => {
                          const involved = getJobInvolvedDrafters(job);
                          if (involved.length === 0) {
                            return <span className="text-slate-400 text-xs">—</span>;
                          }
                          return (
                            <div className="flex flex-col gap-1">
                              {involved.map(name => {
                                const isLead = (job.assigned_drafter || '').toLowerCase().includes(name.toLowerCase());
                                const isDelegated = (job.delegated_tasks || []).some(t => (t.assignedTo || '').toLowerCase().includes(name.toLowerCase()));
                                const hasTime = (job.time_logs || []).some(tl => (tl.drafterName || '').toLowerCase().includes(name.toLowerCase()));
                                const isTagged = (job.comments || []).some(c => (c.taggedStaff || []).some(ts => ts.toLowerCase().includes(name.toLowerCase())));

                                let roleLabel = '';
                                if (isLead && isDelegated) roleLabel = 'Lead & Delegated';
                                else if (isLead) roleLabel = 'Lead';
                                else if (isDelegated) roleLabel = 'Delegated';
                                else if (hasTime) roleLabel = 'CAD Time';
                                else if (isTagged) roleLabel = 'Tagged';

                                return (
                                  <span
                                    key={`involved-dr-${job.id}-${name}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md w-fit shadow-2xs"
                                    title={`${name}: ${[
                                      isLead ? 'Lead Drafter' : '',
                                      isDelegated ? 'Delegated Work' : '',
                                      hasTime ? 'Logged Time' : '',
                                      isTagged ? 'Tagged in Notes' : ''
                                    ].filter(Boolean).join(', ') || 'Involved'}`}
                                  >
                                    <User className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <span>{name}</span>
                                    {roleLabel && (
                                      <span className="text-[9px] font-mono font-normal text-indigo-600 bg-indigo-100/70 px-1 py-0.2 rounded">
                                        {roleLabel}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <select
                            value={job.current_status}
                            onChange={(e) => {
                              const newPhase = e.target.value as JobPhase;
                              if (newPhase === 'Completed' && !canMarkProjectCompleted) {
                                alert('Permission Restricted: Only Kyle or Jason have the authority to mark a project as Completed.');
                                return;
                              }
                              onUpdateStatus(job.id, newPhase);
                            }}
                            className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold cursor-pointer block"
                          >
                            {PHASES.map(p => {
                              const isLocked = p === 'Completed' && !canMarkProjectCompleted;
                              return (
                                <option key={p} value={p} disabled={isLocked}>
                                  {isLocked ? `🔒 ${p} (Kyle & Jason only)` : p}
                                </option>
                              );
                            })}
                          </select>
                          {job.sheet_status && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block">
                              {job.sheet_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono font-bold">
                        {isRunning ? (
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <Clock className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                            <span className="font-mono text-emerald-800 font-black">{formatSecondsToHHMMSS(totalSecs)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-800">{formatSecondsToReadable(totalSecs)}</span>
                        )}
                      </td>
                      {canAccessFinancials && (
                        <td className="p-3.5 font-mono font-bold">
                          {isRunning ? (
                            <div className="flex items-center gap-1.5 text-emerald-600">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                              <span className="font-mono font-black text-emerald-700">${billable.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-emerald-700">${billable.toFixed(2)}</span>
                          )}
                        </td>
                      )}
                      {/* Job Notes Column with Add Job Note button on each line */}
                      <td className="p-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenAddJobNoteModal(job)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 transition cursor-pointer shadow-2xs group active:scale-95"
                          title={`Add job note to Plan #${job.job_number} (saved to Messages & Notes)`}
                        >
                          <Plus className="w-3.5 h-3.5 text-indigo-600 group-hover:rotate-90 transition-transform" />
                          <span>Add Job Note</span>
                        </button>
                      </td>
                      <td className="p-3.5">
                        {isRunning ? (
                          <button
                            onClick={() => onStopTimer(job.id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer animate-pulse transition active:scale-95"
                            title="Stop live drafting timer"
                          >
                            <Square className="w-3 h-3 fill-white" />
                            <span>Stop Timer</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onStartTimer(job.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95"
                            title="Start drafting timer"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>Start Timer</span>
                          </button>
                        )}
                      </td>
                      <td className="p-3.5 pr-8 text-right min-w-[240px] whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          {canDelegate && onOpenDelegateModal && (
                            <button
                              onClick={() => onOpenDelegateModal(job)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer shrink-0"
                              title="Delegate work component on this plan"
                            >
                              Delegate
                            </button>
                          )}
                          <button
                            onClick={() => onSelectJob(job)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-1.5 rounded-lg shadow-xs text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition active:scale-95"
                          >
                            <span>Open Project</span>
                            <ArrowRight className="w-3.5 h-3.5" />
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

      {/* Customer Contact Update Modal */}
      {selectedJobForContactEdit && onUpdateCustomerContact && (
        <EditCustomerContactModal
          job={selectedJobForContactEdit}
          allJobs={jobs}
          isOpen={Boolean(selectedJobForContactEdit)}
          onClose={() => setSelectedJobForContactEdit(null)}
          onSaveContact={(contact) => {
            onUpdateCustomerContact(selectedJobForContactEdit.customer_name, contact);
            setSelectedJobForContactEdit(null);
          }}
          performedByRole="staff"
        />
      )}

      {/* MODAL: Add Job Note Popup Modal */}
      {addJobNoteModalJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-2xs shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Add Job Note</h3>
                    <span className="text-xs font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                      #{addJobNoteModalJob.job_number.replace(/^#/, '')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Customer: <span className="font-semibold text-slate-700">{addJobNoteModalJob.customer_name}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAddJobNoteModalJob(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveJobNoteSubmit} className="p-5 space-y-4">
              {/* Permanent Locked Timestamp Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Timestamp (Permanent / Non-Editable)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">Locked</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={noteModalTimestamp}
                    className="w-full bg-slate-100/90 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-700 select-none cursor-not-allowed"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-400">
                  This timestamp is automatically captured and cannot be changed or backdated.
                </p>
              </div>

              {/* Drafter / Author Display */}
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600">
                <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  Author: <strong className="text-slate-800">{currentStaff.name}</strong> ({currentStaff.title})
                </span>
              </div>

              {/* Note Details Textarea */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Type Note</span>
                </label>
                <textarea
                  rows={4}
                  autoFocus
                  required
                  value={noteModalText}
                  onChange={(e) => setNoteModalText(e.target.value)}
                  placeholder="Type specific job note, project updates, client requirements, or milestone details..."
                  className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition resize-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    Note will be saved into the <strong>Messages & Notes</strong> tab of #{addJobNoteModalJob.job_number}.
                  </span>
                </p>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddJobNoteModalJob(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!noteModalText.trim() || noteSavedFeedback}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                    noteSavedFeedback
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {noteSavedFeedback ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Saved to Messages & Notes!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Save Job Note</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox File / Attachment Preview Modal in Drafter Dashboard */}
      {previewingAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden text-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                  {previewingAttachment.jobNumber ? `Job #${previewingAttachment.jobNumber}` : 'Attached File'}
                </span>
                <span className="font-bold text-sm text-white truncate max-w-md">
                  {previewingAttachment.file.name}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({previewingAttachment.file.size})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingAttachment(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-black/40 min-h-[320px]">
              {(previewingAttachment.file.url && previewingAttachment.file.url.startsWith('data:image')) || previewingAttachment.file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|svg)$/) ? (
                <img
                  src={previewingAttachment.file.url}
                  alt={previewingAttachment.file.name}
                  className="max-h-[60vh] object-contain rounded-lg border border-slate-800 shadow-xl"
                />
              ) : previewingAttachment.file.url && (previewingAttachment.file.url.startsWith('data:application/pdf') || previewingAttachment.file.name.toLowerCase().endsWith('.pdf')) ? (
                <iframe
                  src={previewingAttachment.file.url}
                  title={previewingAttachment.file.name}
                  className="w-full h-[60vh] rounded-lg border border-slate-800 bg-white"
                />
              ) : (
                <div className="p-12 text-center text-slate-300 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-blue-950/80 border border-blue-700/60 text-blue-400 flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">{previewingAttachment.file.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{previewingAttachment.file.size} • {previewingAttachment.file.type || 'Attached File'}</p>
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Binary or CAD drawing files can be downloaded directly to open in your CAD software (AutoCAD, Chief Architect, Revit).
                  </p>
                </div>
              )}

              <div className="mt-4 bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs w-full text-slate-300 flex items-center justify-between gap-2">
                <span className="text-slate-400">Attached to Component: <strong className="text-white">{previewingAttachment.taskTitle}</strong></span>
                <span className="text-[10px] text-slate-500 font-mono">{previewingAttachment.file.type || 'Attached File'}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-400 font-mono truncate max-w-xs">
                {previewingAttachment.file.name}
              </div>
              <div className="flex items-center gap-2">
                {previewingAttachment.file.url && (
                  <a
                    href={previewingAttachment.file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Tab</span>
                  </a>
                )}
                <a
                  href={previewingAttachment.file.url || '#'}
                  download={previewingAttachment.file.name}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewingAttachment(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
