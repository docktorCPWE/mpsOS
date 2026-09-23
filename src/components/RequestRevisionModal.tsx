import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  AlertTriangle, 
  Send, 
  FileText, 
  User, 
  CheckCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { Job, DelegatedWorkItem, StaffUser } from '../types';

interface RequestRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: DelegatedWorkItem | null;
  job?: Job | null;
  currentStaff: StaffUser;
  onSubmitRevision: (jobId: string, taskId: string, feedbackNote: string) => void;
}

const REVISION_REASON_PRESETS = [
  'Please adjust dimensions & clear headroom per architectural redlines.',
  'Update footing depth and stem wall callouts to match civil site slope.',
  'Correct window header heights and door swing directions.',
  'Missing electrical switch legends & reflected ceiling light layout.',
  'Revise roof truss pitch & overhang soffit detail per builder notes.',
  'Re-export high-resolution vector PDF with verified title block scale.'
];

export const RequestRevisionModal: React.FC<RequestRevisionModalProps> = ({
  isOpen,
  onClose,
  task,
  job,
  currentStaff,
  onSubmitRevision
}) => {
  const [feedbackNote, setFeedbackNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  const currentRevNumber = (task.revisionCount || 0) + 1;
  const drafterName = task.assignedTo || 'Assigned Drafter';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackNote.trim()) {
      setErrorMsg('Please enter clear revision instructions for the drafter.');
      return;
    }

    onSubmitRevision(task.jobId, task.id, feedbackNote.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-amber-300 overflow-hidden my-6 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white p-5 flex items-center justify-between border-b border-amber-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/30 border border-amber-300/40 flex items-center justify-center text-amber-100 shadow-xs">
              <RotateCcw className="w-5 h-5 animate-spin-reverse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-white">Request Revisions on Component</h3>
                <span className="text-[10px] font-mono font-extrabold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded uppercase">
                  Revision #{currentRevNumber}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-amber-100/90 flex-wrap">
                <span className="font-mono font-black text-xs bg-black text-white border border-slate-700 px-2 py-0.5 rounded shadow-xs tracking-wide">
                  #{task.jobNumber.replace(/^#/, '')}
                </span>
                <span>• Sending feedback to <strong className="text-white underline">{drafterName}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-amber-200 hover:text-white rounded-lg transition hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs text-slate-700 overflow-y-auto flex-1">
          
          {/* Target Component Context Banner */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 font-mono">
                  Target Work Item
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{task.componentTitle}</h4>
                <p className="text-[11px] text-slate-500">{task.customerName}</p>
              </div>

              <span className="text-[10px] font-bold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
                {task.category}
              </span>
            </div>

            {task.completionNotes && (
              <div className="pt-2 border-t border-amber-200/70 text-[11px]">
                <span className="font-semibold text-amber-900 block mb-0.5">
                  Drafter's Submission Notes ({task.completedBy || drafterName}):
                </span>
                <p className="bg-white/90 p-2 rounded border border-amber-100 italic text-slate-700">
                  "{task.completionNotes}"
                </p>
              </div>
            )}
          </div>

          {/* Quick Preset Feedback Chips */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-900 text-xs flex items-center justify-between">
              <span>Select Common Revision Reason or Guidance:</span>
              <span className="text-[10px] text-slate-400 font-normal">Click to insert</span>
            </label>

            <div className="space-y-1.5">
              {REVISION_REASON_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset);
                    setFeedbackNote(preset);
                    setErrorMsg('');
                  }}
                  className={`w-full text-left p-2 rounded-lg border transition text-[11px] cursor-pointer flex items-center justify-between gap-2 ${
                    selectedPreset === preset
                      ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>{preset}</span>
                  {selectedPreset === preset && <CheckCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Revision Feedback Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-900 text-xs">
                Detailed Revision Instructions for {drafterName} <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Clear modifications needed</span>
            </div>

            <textarea
              value={feedbackNote}
              onChange={(e) => {
                setFeedbackNote(e.target.value);
                setErrorMsg('');
              }}
              rows={4}
              placeholder={`Specify what ${drafterName} needs to correct or adjust before you can sign off and approve...`}
              className={`w-full p-3 rounded-xl border text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition leading-relaxed ${
                errorMsg ? 'border-red-400 bg-red-50/20' : 'border-slate-300 bg-slate-50/50 focus:bg-white'
              }`}
            />

            {errorMsg && (
              <p className="text-red-600 font-semibold flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          {/* Revision Workflow Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>What happens next:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
              <li>Status changes to <strong className="text-amber-700">"Revision Requested (Rev #{currentRevNumber})"</strong> on both your workspace and the drafter's board.</li>
              <li>A direct revision alert and notification is sent to <strong>{drafterName}</strong>.</li>
              <li>The drafter will update the CAD/PDF files and re-submit for your sign-off.</li>
            </ul>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold transition flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Submit Revision Request to {drafterName}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
