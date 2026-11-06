import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Eye, 
  FileCheck, 
  Layers, 
  MessageSquare, 
  ChevronRight, 
  User, 
  Sparkles, 
  ShieldAlert, 
  Play, 
  Square, 
  DollarSign, 
  History, 
  Share2, 
  ListTodo, 
  Paperclip, 
  Archive, 
  Coffee, 
  PauseCircle,
  MapPin,
  Hammer,
  Mail,
  Phone,
  Copy,
  Check,
  Calendar,
  Building,
  Edit3,
  Trash2
} from 'lucide-react';
import { Job, JobPhase, DelegatedWorkItem, StaffUser } from '../types';
import { calculateJobTotalSeconds, calculateJobBillableAmount, formatSecondsToHHMMSS, formatSecondsToReadable } from '../utils/timeUtils';
import { isJobArchived, canUserDeleteDelegatedItem } from '../data/mockData';
import { EditCustomerContactModal } from './EditCustomerContactModal';

interface JobCardProps {
  job: Job;
  allJobs?: Job[];
  onUpdateStatus: (jobId: string, newStatus: JobPhase) => void;
  onToggleRoadblock: (jobId: string) => void;
  onSelectJob: (job: Job) => void;
  onStartTimer: (jobId: string, taskNote?: string) => void;
  onStopTimer: (jobId: string, taskNote?: string) => void;
  nowTimestamp?: number;
  canAccessFinancials?: boolean;
  canDelegate?: boolean;
  onOpenDelegateModal?: (job) => void;
  onOpenCompleteTaskModal?: (task: DelegatedWorkItem, job: Job) => void;
  onDeleteJob?: (jobId: string) => void;
  currentStaff?: StaffUser;
  onUpdateCustomerContact?: (customerName: string, updatedContact: {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    project_address?: string;
    updateAllPlans?: boolean;
    currentJobId?: string;
  }) => void;
}

const PHASE_COLORS: Record<JobPhase, { bg: string; text: string; border: string }> = {
  'Customer Inquiry': { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  'Preliminary Layout': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  'Customer Review': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  'Revisions': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300' },
  'Exterior Elevations': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  'Construction Prints': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  'Completed': { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-300' },
};

function getSheetStatusColor(status?: string): { bg: string; text: string; border: string } {
  const s = (status || '').toLowerCase();
  if (s.includes('customer review')) {
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' };
  }
  if (s.includes('changes')) {
    return { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300' };
  }
  if (s.includes('no status') || !s) {
    return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
  }
  return { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' };
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  allJobs = [],
  onUpdateStatus,
  onToggleRoadblock,
  onSelectJob,
  onStartTimer,
  onStopTimer,
  nowTimestamp = Date.now(),
  canAccessFinancials = false,
  canDelegate = false,
  onOpenDelegateModal,
  onOpenCompleteTaskModal,
  onUpdateCustomerContact,
  onDeleteJob,
  currentStaff,
}) => {
  const currentPhaseStyle = PHASE_COLORS[job.current_status] || PHASE_COLORS['Customer Inquiry'];
  const [taskInput, setTaskInput] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = canUserDeleteDelegatedItem(currentStaff);

  const isTimerRunning = Boolean(job.active_timer_start);
  const isTimerPaused = Boolean(job.paused_by_break);
  const totalSeconds = calculateJobTotalSeconds(job, nowTimestamp);
  const totalBillable = calculateJobBillableAmount(job, nowTimestamp);
  const hourlyRate = job.hourly_rate || 85;
  const delegatedTasks = job.delegated_tasks || [];

  // Active elapsed seconds for ticker
  const activeSessionSeconds = job.active_timer_start
    ? Math.max(0, Math.floor((nowTimestamp - new Date(job.active_timer_start).getTime()) / 1000))
    : 0;

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartTimer(job.id, taskInput.trim() || job.paused_timer_task);
    setTaskInput('');
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Trigger StopTimerModal to enforce mandatory work completed note
    onStopTimer(job.id);
    setTaskInput('');
  };

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!job.project_address) return;
    navigator.clipboard.writeText(job.project_address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Resolve primary and secondary titles
  const projectTitle = job.project_name || job.customer_name;
  const showSecondaryCustomer = Boolean(
    job.project_name && 
    job.customer_name && 
    job.project_name.trim().toLowerCase() !== job.customer_name.trim().toLowerCase()
  );

  // Email and phone shortcuts
  const primaryEmail = job.customer_email ? job.customer_email.split(';')[0].trim() : '';
  const primaryPhone = job.customer_phone ? job.customer_phone.split(';')[0].trim() : '';
  const sheetStatusStyle = getSheetStatusColor(job.sheet_status);

  // Format created date
  const formattedCreatedDate = job.created_at ? new Date(job.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : '';

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden relative group font-sans ${
      isTimerRunning
        ? 'border-emerald-400 ring-2 ring-emerald-400/30'
        : isTimerPaused
        ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/10'
        : job.roadblock
        ? 'border-red-300 ring-2 ring-red-400/20'
        : 'border-slate-200 hover:border-blue-400'
    }`}>
      
      {/* Top Banner Stripe */}
      <div className={`h-1.5 w-full ${
        isTimerRunning 
          ? 'bg-emerald-500 animate-pulse' 
          : isTimerPaused
          ? 'bg-amber-500 animate-pulse'
          : job.roadblock 
          ? 'bg-red-500 animate-pulse' 
          : 'bg-blue-600'
      }`} />

      <div className="p-5 flex-1 space-y-4">
        
        {/* Header Row: Job Number, Owner Badge, & Status Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-mono font-black bg-black text-white border border-black px-3 py-1 rounded-md shadow-xs flex items-center gap-1 tracking-wide">
              <span>#{job.job_number.replace(/^#/, '')}</span>
            </span>

            {/* Owner Badge */}
            {job.owner && (
              <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md flex items-center gap-1" title={`Job Owner: ${job.owner}`}>
                <Building className="w-2.5 h-2.5 text-purple-500" />
                <span>Owner: {job.owner}</span>
              </span>
            )}

            {/* Archived Indicator */}
            {isJobArchived(job) && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <Archive className="w-3 h-3 text-emerald-600" />
                <span>Paid & Archived</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {canDelete && onDeleteJob && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md border border-slate-200 hover:border-red-200 transition cursor-pointer"
                title="Delete Project (Greg, Kyle, Jason only)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Roadblock Badge Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleRoadblock(job.id);
              }}
              title={job.roadblock ? 'Click to resolve roadblock' : 'Click to flag roadblock'}
              className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md transition border cursor-pointer ${
                job.roadblock
                  ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {job.roadblock ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                  <span>Roadblock</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>On Track</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Project Name & Builder Row */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition truncate" title={projectTitle}>
              {projectTitle}
            </h3>
            {job.builder && (
              <span className="text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0" title={`Builder: ${job.builder}`}>
                <Hammer className="w-3 h-3 text-amber-600" />
                <span className="truncate max-w-[130px]">{job.builder}</span>
              </span>
            )}
          </div>

          {/* Secondary Customer Entity (if different from project title) */}
          {showSecondaryCustomer && (
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Customer: <span className="text-slate-800 font-semibold">{job.customer_name}</span>
            </p>
          )}

          {/* Assigned Drafter */}
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{job.assigned_drafter}</span>
          </p>

          {/* Property Address with Quick Copy */}
          {job.project_address && (
            <div className="flex items-center justify-between gap-1.5 mt-2 bg-slate-50 hover:bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200/80 transition text-xs">
              <div className="flex items-center gap-1.5 truncate text-slate-700 font-medium">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate" title={job.project_address}>{job.project_address}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyAddress}
                className="text-slate-400 hover:text-blue-600 p-1 rounded transition shrink-0 cursor-pointer"
                title={copiedAddress ? 'Address copied!' : 'Copy address to clipboard'}
              >
                {copiedAddress ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Goal, Style & Delegated Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {/* Sq Ft Goal or Sq Ft */}
            {job.sq_ft_goal ? (
              <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                📐 Goal: {job.sq_ft_goal} {job.sq_ft_goal.toLowerCase().includes('remodel') ? '' : 'sq ft'}
              </span>
            ) : job.sq_ft > 0 ? (
              <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                📐 {job.sq_ft} sq ft
              </span>
            ) : null}

            {job.style && (
              <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                🎨 {job.style}
              </span>
            )}
            
            {delegatedTasks.length > 0 && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1" title={`${delegatedTasks.length} delegated work components on this plan`}>
                <ListTodo className="w-3 h-3 text-indigo-600" />
                <span>{delegatedTasks.length} Delegated</span>
              </span>
            )}
          </div>

          {/* Direct Client Contact Shortcuts (Email & Phone) with quick edit */}
          <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-slate-600 pt-1.5 border-t border-slate-100">
            <div className="flex items-center gap-3 truncate min-w-0">
              {primaryEmail ? (
                <a
                  href={`mailto:${primaryEmail}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[170px]"
                  title={job.customer_email}
                >
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{primaryEmail}</span>
                </a>
              ) : null}
              {primaryPhone ? (
                <a
                  href={`tel:${primaryPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-slate-700 hover:text-blue-600 hover:underline font-mono shrink-0"
                  title={job.customer_phone}
                >
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{primaryPhone}</span>
                </a>
              ) : null}
              {!primaryEmail && !primaryPhone && (
                <span className="text-slate-400 italic text-[10px]">No contact info on file</span>
              )}
            </div>

            {onUpdateCustomerContact && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEditContactModal(true);
                }}
                className="shrink-0 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition flex items-center gap-1 text-[10px] font-semibold"
                title="Update Customer Contact Info (Email/Phone)"
              >
                <Edit3 className="w-3 h-3" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* --- DRAFTER START/STOP TIMER WIDGET CARD --- */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          isTimerRunning
            ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
            : isTimerPaused
            ? 'bg-amber-50/80 border-amber-300 shadow-2xs'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Clock className={`w-4 h-4 ${
                isTimerRunning ? 'text-emerald-600 animate-spin' : isTimerPaused ? 'text-amber-600' : 'text-slate-500'
              }`} />
              <span>Drafter Timer</span>
              {isTimerRunning && (
                <span className="flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-mono px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  RUNNING
                </span>
              )}
              {isTimerPaused && (
                <span className="flex items-center gap-1 bg-amber-500 text-slate-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full animate-pulse">
                  <Coffee className="w-3 h-3 text-slate-950" />
                  PAUSED
                </span>
              )}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setShowLogs(!showLogs); }}
              className="text-[10px] text-slate-500 hover:text-blue-600 flex items-center gap-0.5 font-medium underline decoration-slate-300 cursor-pointer"
            >
              <History className="w-3 h-3" />
              <span>{job.total_time_entries || (job.time_logs || []).length} logs</span>
            </button>
          </div>

          {/* Time & Metric Calculation Display */}
          <div className="flex items-baseline justify-between bg-white p-2.5 rounded-lg border border-slate-200 mb-2.5">
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-400 font-mono">Logged Time</div>
              <div className={`text-base font-bold font-mono ${
                isTimerRunning ? 'text-emerald-700' : isTimerPaused ? 'text-amber-700' : 'text-slate-800'
              }`}>
                {isTimerRunning ? formatSecondsToHHMMSS(totalSeconds) : formatSecondsToReadable(totalSeconds)}
              </div>
              {job.total_duration_hours ? (
                <div className="text-[10px] text-slate-400 font-mono">
                  Sheet: {job.total_duration_hours} hrs ({job.total_duration_minutes} min)
                </div>
              ) : null}
            </div>

            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase text-slate-400 font-mono">Total Sessions</div>
              <div className="text-sm font-bold font-mono text-slate-700">
                {job.total_time_entries || (job.time_logs || []).length} Recorded
              </div>
              {canAccessFinancials && (
                <div className={`text-[10px] font-mono font-semibold ${isTimerRunning ? 'text-emerald-600 font-bold animate-pulse' : 'text-emerald-700'}`}>
                  ${totalBillable.toFixed(2)} billable
                </div>
              )}
            </div>
          </div>

          {/* Active Task Note / Task Input */}
          <div className="mb-2.5">
            {isTimerRunning ? (
              <div className="text-xs bg-white/80 p-2 rounded border border-emerald-200 text-emerald-900 font-medium truncate flex items-center gap-1.5">
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">Task:</span>
                <span className="truncate">{job.active_timer_task || `Drafting ${job.current_status}`}</span>
              </div>
            ) : isTimerPaused ? (
              <div className="text-xs bg-amber-100/90 p-2 rounded border border-amber-300 text-amber-950 font-medium flex items-center justify-between gap-1.5">
                <div className="truncate flex items-center gap-1">
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase">Paused:</span>
                  <span className="truncate">{job.paused_timer_task || `Drafting ${job.current_status}`}</span>
                </div>
                <span className="text-[10px] text-amber-800 italic shrink-0">Resumes on return</span>
              </div>
            ) : (
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="What are you drafting? (e.g. Floor Plan, Elevations)"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Start / Stop Buttons */}
          <div>
            {isTimerRunning ? (
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Stop & Save Session</span>
              </button>
            ) : isTimerPaused ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStart}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-2.5 rounded-lg text-xs shadow-xs transition active:scale-98 cursor-pointer"
                  title="Manually resume drafting timer now"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume Timer</span>
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center justify-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-2.5 rounded-lg text-xs transition cursor-pointer"
                  title="Clear paused state"
                >
                  <Square className="w-3 h-3 text-slate-600" />
                  <span>Stop</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Timer</span>
              </button>
            )}
          </div>

          {/* Expanded Session Logs List */}
          {showLogs && (
            <div className="mt-3 pt-2 border-t border-slate-200 space-y-1.5 max-h-36 overflow-y-auto text-[11px]">
              <div className="font-bold text-slate-700 text-[10px] uppercase">Session History ({job.time_logs?.length || 0})</div>
              {(!job.time_logs || job.time_logs.length === 0) ? (
                <div className="text-slate-400 italic text-[10px]">No recorded sessions yet.</div>
              ) : (
                job.time_logs.map((log) => (
                  <div key={log.id} className="bg-white p-1.5 rounded border border-slate-200 flex justify-between items-center text-slate-600">
                    <div className="truncate pr-2">
                      <span className="font-semibold text-slate-800">{log.taskDescription}</span>
                      <span className="text-[10px] text-slate-400 block">{log.drafterName} &bull; {new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 shrink-0">
                      {formatSecondsToReadable(log.durationSeconds)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Phase & Sheet Status Matrix */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-2 text-xs">
          
          {/* Phase & Sheet Status Row */}
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Phase:</span>
            <span className={`font-semibold px-2 py-0.5 rounded border text-[11px] ${currentPhaseStyle.bg} ${currentPhaseStyle.text} ${currentPhaseStyle.border}`}>
              {job.phase_name || job.current_status}
            </span>
          </div>

          {job.sheet_status && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Sheet Status:</span>
              <span className={`font-semibold px-2 py-0.5 rounded border text-[11px] ${sheetStatusStyle.bg} ${sheetStatusStyle.text} ${sheetStatusStyle.border}`}>
                {job.sheet_status}
              </span>
            </div>
          )}

          {/* Dates Row */}
          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Created: {formattedCreatedDate || 'N/A'}</span>
            </div>
            {job.due_date && (
              <span className="font-semibold text-slate-700">Due: {job.due_date}</span>
            )}
          </div>

          {job.next_step && (
            <div className="text-slate-500 pt-1 border-t border-slate-200/60">
              <span className="font-semibold text-slate-700 block text-[11px]">Next Focus:</span>
              <span className="text-slate-600 line-clamp-1 italic text-[11px]">{job.next_step}</span>
            </div>
          )}
        </div>

      </div>

      {/* Footer: Deliverables, Comments & Action Buttons */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1" title="Deliverable sheets">
            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            <strong className="text-slate-700">{(job.deliverables || []).length}</strong>
          </span>
          <span className="flex items-center gap-1" title="Comments & Markups">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            <strong className="text-slate-700">{(job.comments || []).length}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {canDelegate && onOpenDelegateModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDelegateModal(job);
              }}
              title="Delegate work component or sub-task to another drafter"
              className="text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
            >
              <Share2 className="w-3 h-3" />
              <span>Delegate</span>
            </button>
          )}

          {canDelete && onDeleteJob && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition cursor-pointer"
              title="Delete Project (Greg, Kyle, Jason only)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onSelectJob(job)}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <span>Open OS</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Customer Contact Update Modal */}
      {showEditContactModal && onUpdateCustomerContact && (
        <EditCustomerContactModal
          job={job}
          allJobs={allJobs}
          isOpen={showEditContactModal}
          onClose={() => setShowEditContactModal(false)}
          onSaveContact={(contact) => {
            onUpdateCustomerContact(job.customer_name, contact);
          }}
          performedByRole="staff"
        />
      )}

      {/* Confirmation Modal: Permanently Delete Project Plan (Greg, Kyle, Jason Only) */}
      {showDeleteConfirm && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200 shadow-2xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Permanently Delete Project?</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Plan #{job.job_number.replace(/^#/, '')} • {job.customer_name}
                </p>
              </div>
            </div>

            <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-3.5 space-y-2 text-xs text-red-950">
              <p className="font-bold text-slate-900">
                Project: <span className="text-red-700 font-mono">{job.project_name || job.customer_name}</span>
              </p>
              <p className="text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete this project? This will permanently remove the project card, all associated time logs ({(job.time_logs || []).length}), deliverable files ({(job.deliverables || []).length}), comments, and delegated tasks from the database. This action cannot be undone.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-800 font-medium pt-1 border-t border-red-200/60">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Only Greg Hyatt, Kyle Edmonson, or Jason Barnett can delete projects.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (onDeleteJob) {
                    setShowDeleteConfirm(false);
                    setIsDeleting(true);
                    try {
                      await onDeleteJob(job.id);
                    } catch (err) {
                      console.error('Delete job error in JobCard:', err);
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/20 transition cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting Project...' : 'Permanently Delete Project'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


