import React, { useState } from 'react';
import { Mail, CheckCircle, X, Send, Clock, User, FileText, ArrowRight, Paperclip, Download, Eye } from 'lucide-react';
import { EmailTemplate, EmailAttachment } from '../types';
import { triggerDownloadBlob } from '../utils/pdfGenerator';

interface EmailSimulatorModalProps {
  email: EmailTemplate | null;
  onClose: () => void;
  onSend: () => void;
}

export const EmailSimulatorModal: React.FC<EmailSimulatorModalProps> = ({ email, onClose, onSend }) => {
  const [isSentSuccess, setIsSentSuccess] = useState(false);

  if (!email) return null;

  const attachments = email.attachments || [];

  const handleDownloadAttachment = (att: EmailAttachment) => {
    if (att.downloadUrl) {
      const link = document.createElement('a');
      link.href = att.downloadUrl;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (att.dataUrl) {
      const link = document.createElement('a');
      link.href = att.dataUrl;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSendClick = () => {
    setIsSentSuccess(true);
    setTimeout(() => {
      onSend();
      setIsSentSuccess(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200 font-sans flex flex-col max-h-[92vh]">
        
        {/* Email Modal Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Customer Email Notification Dispatch</span>
                {attachments.length > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    <span>PDF Attached</span>
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Triggered by Plan Store OS Automated Billing & Workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email Content Container */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Metadata Card */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="flex flex-wrap justify-between items-center gap-2 text-slate-400">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>To: <strong className="text-slate-200">{email.recipientName}</strong> &lt;{email.recipientEmail}&gt;</span>
              </span>
              <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                Job #{email.jobNumber}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-2 flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold shrink-0">Subject:</span>
              <span className="text-blue-300 font-semibold">{email.subject}</span>
            </div>
          </div>

          {/* Attached Files Section */}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Attachments ({attachments.length})</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Ready for client delivery</span>
              </div>

              <div className="space-y-2">
                {attachments.map((att, idx) => {
                  const sizeFormatted = att.sizeBytes 
                    ? `${(att.sizeBytes / 1024).toFixed(1)} KB`
                    : 'Generated PDF';

                  return (
                    <div 
                      key={idx}
                      className="bg-slate-950/80 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-3 flex items-center justify-between gap-3 transition shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-100 truncate font-mono">
                            {att.name}
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span className="text-emerald-400 font-semibold">Official Invoice PDF</span>
                            <span>•</span>
                            <span className="font-mono">{sizeFormatted}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(att)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                        title="Download attached PDF file"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Email Preview Body */}
          <div className="bg-white text-slate-900 p-5 rounded-xl text-sm leading-relaxed shadow-inner font-sans border border-slate-200">
            <div className="border-b border-slate-200 pb-3 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold font-mono">
                  MPS
                </div>
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">My Plan Store OS</span>
              </div>
              <span className="text-[10px] text-slate-400">{new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="whitespace-pre-line text-xs text-slate-700 font-sans">
              {email.body}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
              <span>Customer Portal & Architectural Design Services</span>
              <span className="text-blue-600 font-bold flex items-center gap-1">
                My Plan Store <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="bg-slate-950 px-5 py-3.5 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Ready to dispatch to client email</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            >
              Cancel / Skip
            </button>
            <button
              onClick={handleSendClick}
              disabled={isSentSuccess}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md border border-blue-400/30 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSentSuccess ? 'Dispatching...' : 'Send Customer Email'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

