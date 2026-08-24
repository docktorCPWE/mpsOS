import React from 'react';
import { Mail, CheckCircle, X, Send, Clock, User, FileText, ArrowRight } from 'lucide-react';
import { EmailTemplate } from '../types';

interface EmailSimulatorModalProps {
  email: EmailTemplate | null;
  onClose: () => void;
  onSend: () => void;
}

export const EmailSimulatorModal: React.FC<EmailSimulatorModalProps> = ({ email, onClose, onSend }) => {
  if (!email) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200 font-sans">
        
        {/* Email Modal Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Automated Customer Notification</h3>
              <p className="text-xs text-slate-400">Triggered by Plan Store OS Phase Update</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email Meta Card */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>To: <strong className="text-slate-200">{email.recipientName}</strong> (&lt;{email.recipientEmail}&gt;)</span>
              </span>
              <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                Job #{email.jobNumber}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-2 flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">Subject:</span>
              <span className="text-blue-300 font-semibold">{email.subject}</span>
            </div>
          </div>

          {/* Email Preview Body */}
          <div className="bg-white text-slate-900 p-5 rounded-xl text-sm leading-relaxed shadow-inner font-sans border border-slate-200 max-h-64 overflow-y-auto">
            <div className="border-b border-slate-200 pb-3 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold font-mono">
                  MPS
                </div>
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">My Plan Store OS</span>
              </div>
              <span className="text-[10px] text-slate-400">{new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="whitespace-pre-line text-xs text-slate-700">
              {email.body}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
              <span>Login to your customer portal to view drawing sheets & leave feedback.</span>
              <span className="text-blue-600 font-bold flex items-center gap-1">
                Open Portal <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Ready to dispatch to client email</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg transition"
            >
              Cancel / Skip Email
            </button>
            <button
              onClick={onSend}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition shadow-md border border-blue-400/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Customer Email</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
