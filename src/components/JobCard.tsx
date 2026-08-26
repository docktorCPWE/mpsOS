import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Eye, FileCheck, Layers, MessageSquare, ChevronRight, User, Sparkles, ShieldAlert, Play, Square, DollarSign, History, Share2, ListTodo, Paperclip, Archive, Coffee, PauseCircle } from 'lucide-react';
import { Job, JobPhase, DelegatedWorkItem } from '../types';
import { calculateJobTotalSeconds, calculateJobBillableAmount, formatSecondsToHHMMSS, formatSecondsToReadable } from '../utils/timeUtils';
import { isJobArchived } from '../data/mockData';

interface JobCardProps {
  job: Job;
  onUpdateStatus: (jobId: string, newStatus: JobPhase) => void;
  onToggleRoadblock: (jobId: string) => void;
  onSelectJob: (job: Job) => void;
  onStartTimer: (jobId: string, taskNote?: string) => void;
  onStopTimer: (jobId: string, taskNote?: string) => void;
  nowTimestamp?: number;
  canAccessFinancials?: boolean;
  canDelegate?: boolean;
  onOpenDelegateModal?: (job: Job) => void;
  onOpenCompleteTaskModal?: (task: DelegatedWorkItem, job: Job) => void;
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

export const JobCard: React.FC<JobCardProps> = ({
  job,
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
}) => {
  const currentPhaseStyle = PHASE_COLORS[job.current_status] || PHASE_COLORS['Customer Inquiry'];
  const [taskInput, setTaskInput] = useState('');
  const [showLogs, setShowLogs] = useState(false);

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
    onStopTimer(job.id, taskInput || job.active_timer_task || job.paused_timer_task);
    setTaskInput('');
  };

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
        
        {/* Header Row: Job Number & Status Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md shadow-2xs flex items-center gap-1">
              <span className="text-[10px] text-blue-500 font-sans uppercase">MPS</span>
              <span>#{job.job_number}</span>
            </span>
            <span className="text-xs font-mono text-slate-500 font-medium">
              {job.sq_ft} sq ft
            </span>
            {isJobArchived(job) && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <Archive className="w-3 h-3 text-emerald-600" />
                <span>Paid & Archived</span>
              </span>
            )}
          </div>

          {/* Roadblock Badge Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleRoadblock(job.id);
            }}
            title={job.roadblock ? 'Click to resolve roadblock' : 'Click to flag roadblock'}
            className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md transition border ${
              job.roadblock
                ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {job.roadblock ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                <span>Roadblock Active</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>On Track</span>
              </>
            )}
          </button>
        </div>

        {/* Customer & Style Info */}
        <div>
          <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition truncate">
            {job.customer_name}
          </h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{job.assigned_drafter}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
              🎨 {job.style}
            </span>
            
            {delegatedTasks.length > 0 && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1" title={`${delegatedTasks.length} delegated work components on this plan`}>
                <ListTodo className="w-3 h-3 text-indigo-600" />
                <span>{delegatedTasks.length} Delegated {delegatedTasks.length === 1 ? 'Task' : 'Tasks'}</span>
              </span>
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
                  PAUSED (ON BREAK)
                </span>
              )}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setShowLogs(!showLogs); }}
              className="text-[10px] text-slate-500 hover:text-blue-600 flex items-center gap-0.5 font-medium underline decoration-slate-300"
            >
              <History className="w-3 h-3" />
              <span>{(job.time_logs || []).length} logs</span>
            </button>
          </div>

          {/* Time & Metric Calculation Display */}
          <div className="flex items-baseline justify-between bg-white p-2.5 rounded-lg border border-slate-200 mb-2.5">
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-400 font-mono">Logged Time</div>
              <div className={`text-base font-bold font-mono ${
                isTimerRunning ? 'text-emerald-700' : isTimerPaused ? 'text-amber-700' : 'text-slate-800'
              }`}>
                {isTimerRunning ? formatSecondsToHHMMSS(activeSessionSeconds) : formatSecondsToReadable(totalSeconds)}
              </div>
            </div>

            <div className="text-right">
              {canAccessFinancials ? (
                <>
                  <div className="text-[10px] font-semibold uppercase text-slate-400 font-mono">Invoicing Value</div>
                  <div className="text-sm font-bold font-mono text-emerald-700 flex items-center justify-end">
                    <span>${totalBillable.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(@${hourlyRate}/h)</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] font-semibold uppercase text-slate-400 font-mono">Sessions Logged</div>
                  <div className="text-sm font-bold font-mono text-slate-700">
                    {(job.time_logs || []).length} Recorded
                  </div>
                </>
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
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase">Paused Task:</span>
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
              <div className="font-bold text-slate-700 text-[10px] uppercase">Session History</div>
              {(!job.time_logs || job.time_logs.length === 0) ? (
                <div className="text-slate-400 italic text-[10px]">No completed sessions yet.</div>
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

        {/* Status Phase Details Box */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-2 text-xs">
          
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Phase:</span>
            <span className={`font-semibold px-2 py-0.5 rounded border text-[11px] ${currentPhaseStyle.bg} ${currentPhaseStyle.text} ${currentPhaseStyle.border}`}>
              {job.current_status}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Layout Reviews:</span>
            <span className={`font-mono font-bold ${
              job.layout_reviews_count >= job.max_reviews_included ? 'text-red-600' : 'text-slate-800'
            }`}>
              {job.layout_reviews_count} / {job.max_reviews_included}
            </span>
          </div>

          <div className="text-slate-500 pt-1 border-t border-slate-200/60">
            <span className="font-semibold text-slate-700 block text-[11px]">Next Focus:</span>
            <span className="text-slate-600 line-clamp-1 italic text-[11px]">{job.next_step}</span>
          </div>
        </div>

      </div>

      {/* Footer: Quick Actions Bar */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1" title="Deliverable sheets">
            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            <strong className="text-slate-700">{job.deliverables.length}</strong>
          </span>
          <span className="flex items-center gap-1" title="Comments & Markups">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            <strong className="text-slate-700">{job.comments.length}</strong>
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
              className="text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 shadow-2xs active:scale-95"
            >
              <Share2 className="w-3 h-3" />
              <span>Delegate</span>
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

    </div>
  );
};


