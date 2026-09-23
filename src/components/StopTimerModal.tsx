import React, { useState, useEffect } from 'react';
import { X, Square, Clock, AlertCircle, Sparkles, MessageSquare, Check, Layers } from 'lucide-react';
import { Job, StaffUser } from '../types';
import { formatSecondsToReadable, formatSecondsToHHMMSS } from '../utils/timeUtils';

interface StopTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  currentStaff: StaffUser;
  onConfirmStopTimer: (jobId: string, completedWorkNote: string) => void;
  initialNote?: string;
  nowTimestamp?: number;
}

const COMMON_COMPLETION_PRESETS = [
  'Floor Plan Layout & Wall Adjustments',
  'Exterior Elevations & Roofline Details',
  'Customer Redline Revisions Addressed',
  'Electrical, Fixture & Lighting Plan',
  'Foundation Details & Footing Notes',
  'Structural Framing & Truss Bearings',
  'Permit Package Sheet Finalization',
  'Kitchen & Bath CAD Millwork Dimensions',
  'Site Plan, Zoning & Setback Annotations',
  'Customer Plan Review Coordination'
];

export const StopTimerModal: React.FC<StopTimerModalProps> = ({
  isOpen,
  onClose,
  job,
  currentStaff,
  onConfirmStopTimer,
  initialNote = '',
  nowTimestamp = Date.now()
}) => {
  const [completedNote, setCompletedNote] = useState('');
  const [error, setError] = useState('');
  const [currentTick, setCurrentTick] = useState(Date.now());

  const initializedJobIdRef = React.useRef<string | null>(null);

  // Update live clock ticker while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && job) {
      if (initializedJobIdRef.current !== job.id) {
        initializedJobIdRef.current = job.id;
        // If initialNote is provided and isn't a default generic start, suggest it; otherwise empty to require input
        setCompletedNote(initialNote || '');
        setError('');
      }
    } else if (!isOpen) {
      initializedJobIdRef.current = null;
    }
  }, [isOpen, job?.id, initialNote]);

  if (!isOpen || !job) return null;

  // Calculate elapsed session seconds
  const startMs = job.active_timer_start ? new Date(job.active_timer_start).getTime() : currentTick;
  const elapsedSeconds = job.active_timer_start 
    ? Math.max(1, Math.floor((currentTick - startMs) / 1000))
    : (job.paused_elapsed_seconds || 0);

  const initialStartingTask = job.active_timer_task || job.paused_timer_task;
  const drafterName = job.active_timer_drafter_name || currentStaff.name || job.assigned_drafter.split(',')[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = completedNote.trim();
    if (!trimmed) {
      setError('Please provide a note describing exactly what was completed during this time session.');
      return;
    }

    onConfirmStopTimer(job.id, trimmed);
    onClose();
  };

  const handleSelectPreset = (preset: string) => {
    setError('');
    if (!completedNote.trim()) {
      setCompletedNote(preset);
    } else if (!completedNote.includes(preset)) {
      setCompletedNote(`${completedNote} - ${preset}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/40 text-red-400 flex items-center justify-center">
              <Square className="w-5 h-5 fill-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Stop Drafting Session</span>
                <span className="text-[10px] font-mono uppercase bg-red-500/20 text-red-300 border border-red-400/30 px-2 py-0.5 rounded-full font-bold">
                  Work Note Required
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Log completed work notes to save your session and publish to Messages & Notes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-slate-700/50 cursor-pointer"
            title="Cancel and keep timer running"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Target Job & Session Metrics Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs sm:text-sm bg-black text-white px-2.5 py-1 rounded border border-black shadow-xs tracking-wide">
                    #{job.job_number.replace(/^#/, '')}
                  </span>
                  <span className="font-bold text-slate-900 text-sm truncate max-w-[240px]" title={job.customer_name}>
                    {job.project_name || job.customer_name}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Drafter: <span className="font-semibold text-slate-700">{drafterName}</span> • Phase: <span className="font-semibold text-slate-700">{job.current_status}</span>
                </p>
              </div>

              {/* Live Session Duration Box */}
              <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Session Time</div>
                <div className="font-mono font-bold text-base text-red-600 flex items-center justify-end gap-1">
                  <Clock className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                  <span>{formatSecondsToHHMMSS(elapsedSeconds)}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {formatSecondsToReadable(elapsedSeconds)}
                </div>
              </div>
            </div>

            {/* Initial Starting Task Note (if exists) */}
            {initialStartingTask && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Started With:</span>
                <span className="truncate italic font-medium text-slate-800">"{initialStartingTask}"</span>
              </div>
            )}
          </div>

          {/* Required Work Completed Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="completed-note-input" className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>What was completed at this time?</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Required Note</span>
            </div>
            
            <textarea
              id="completed-note-input"
              rows={3}
              value={completedNote}
              onChange={(e) => {
                setCompletedNote(e.target.value);
                if (error) setError('');
              }}
              placeholder="Describe exactly what was done during this drafting session (e.g. Completed foundation dimensions, resolved 2nd floor bathroom redlines, finalized roof framing)..."
              autoFocus
              className={`w-full text-xs p-3 bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition leading-relaxed ${
                error
                  ? 'border-red-400 focus:ring-red-400 ring-1 ring-red-300'
                  : 'border-slate-300 focus:ring-blue-500'
              }`}
            />

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Notice Callout: Appears in Messages & Notes */}
            <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-indigo-900">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-indigo-950">Messages & Notes Sync:</span>
                <span className="ml-1 text-indigo-800">
                  This work note will be logged in the project's Time Logs and automatically posted as an item in the <strong>Messages & Notes</strong> area inside the project card.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preset Work Chips */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Quick Work Note Presets (click to add):</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {COMMON_COMPLETION_PRESETS.map((preset) => {
                const isSelected = completedNote.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition text-left cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-100 text-blue-800 border-blue-300 font-semibold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-blue-600" />}
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel (Keep Running)
            </button>

            <button
              type="submit"
              disabled={!completedNote.trim()}
              className={`flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition active:scale-98 cursor-pointer ${
                completedNote.trim()
                  ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-red-500/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop & Save Session</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
