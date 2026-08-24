import React, { useState, useEffect } from 'react';
import { X, Play, Clock, User, AlertCircle, Sparkles, Check, ListTodo, FileText } from 'lucide-react';
import { Job, StaffUser } from '../types';

interface StartTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  currentStaff: StaffUser;
  onConfirmStartTimer: (jobId: string, taskNote: string) => void;
  initialNote?: string;
}

const COMMON_TASK_PRESETS = [
  'Floor Plan Layout & Walls',
  'Exterior Elevations & Rooflines',
  'Electrical & Lighting Plan',
  'Foundation & Footing Details',
  'Customer Redline Revisions',
  'Structural Framing & Trusses',
  'Kitchen & Bath Millwork CAD',
  'Site Plan & Setbacks',
  'Permit Package Finalization',
  '3D Concept Renderings'
];

export const StartTimerModal: React.FC<StartTimerModalProps> = ({
  isOpen,
  onClose,
  job,
  currentStaff,
  onConfirmStartTimer,
  initialNote = ''
}) => {
  const [taskNote, setTaskNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && job) {
      setTaskNote(initialNote || '');
      setError('');
    }
  }, [isOpen, job, initialNote]);

  if (!isOpen || !job) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = taskNote.trim();
    if (!trimmed) {
      setError('Please enter a required note describing what you are doing before starting the timer.');
      return;
    }

    onConfirmStartTimer(job.id, trimmed);
    onClose();
  };

  const handleSelectPreset = (preset: string) => {
    setError('');
    if (!taskNote.trim()) {
      setTaskNote(preset);
    } else if (!taskNote.includes(preset)) {
      setTaskNote(`${taskNote} - ${preset}`);
    }
  };

  const myDelegatedTasks = (job.delegated_tasks || []).filter(
    t => t.assignedTo === currentStaff.name || t.status !== 'Completed'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Start Drafting Timer</span>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  Active Logging
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                A descriptive task note is required for all time tracking entries.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-slate-700/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Target Job Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                  MPS #{job.job_number}
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {job.customer_name}
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                {job.style} • {job.sq_ft} sq ft • Phase: <span className="font-semibold text-slate-700">{job.current_status}</span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Logging As</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 justify-end text-xs">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {currentStaff.name}
              </span>
            </div>
          </div>

          {/* Quick Delegated Tasks Picker (if any) */}
          {myDelegatedTasks.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                <ListTodo className="w-3.5 h-3.5 text-indigo-600" />
                <span>Assigned Delegated Component(s):</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {myDelegatedTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectPreset(`Working on ${t.componentTitle}`)}
                    className="text-left text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer font-medium"
                  >
                    <FileText className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span className="truncate max-w-xs">{t.componentTitle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Required Note Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="task-note-input" className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>What are you working on?</span>
                <span className="text-red-500 font-bold">* (Required)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {taskNote.length} chars
              </span>
            </div>

            <textarea
              id="task-note-input"
              rows={3}
              autoFocus
              value={taskNote}
              onChange={(e) => {
                setTaskNote(e.target.value);
                if (error && e.target.value.trim()) setError('');
              }}
              placeholder="e.g. Drafting second floor framing details, adjusting beam spans per structural engineer, and updating window schedule..."
              className={`w-full text-xs p-3 bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                error
                  ? 'border-red-400 ring-2 ring-red-400/20 bg-red-50/20'
                  : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500'
              }`}
            />

            {error && (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Quick Preset Badges */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Quick Activity Presets:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TASK_PRESETS.map((preset) => {
                const isSelected = taskNote.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-emerald-600" />}
                    <span>{preset}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!taskNote.trim()}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm cursor-pointer ${
                taskNote.trim()
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Timer & Begin Session</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
