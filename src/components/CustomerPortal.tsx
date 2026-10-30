import React, { useState } from 'react';
import { CheckCircle2, Clock, FileText, Send, Download, Sparkles, MessageSquare, AlertCircle, ArrowRight, Layers, ShieldCheck, UserCheck, Pin, ThumbsUp, ShieldAlert, Maximize2, X, Paperclip, Image, Mail, Phone, MapPin, Edit3, User, Check } from 'lucide-react';
import { Job, PinnedLocation, DeliverableFile } from '../types';
import { BlueprintCanvas } from './BlueprintCanvas';
import { EditCustomerContactModal } from './EditCustomerContactModal';
import { UniversalFileViewerModal } from './UniversalFileViewerModal';

interface CustomerPortalProps {
  job: Job;
  allJobs?: Job[];
  onAddComment: (text: string, pinnedLoc?: PinnedLocation, attachmentUrl?: string, attachmentName?: string) => void;
  onApprovePhase: () => void;
  onRequestRevision: (notes: string) => void;
  onUpdateCustomerContact?: (customerName: string, updatedContact: {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    project_address?: string;
    updateAllPlans?: boolean;
    currentJobId?: string;
  }) => void;
}

const PHASES = [
  'Customer Inquiry',
  'Preliminary Layout',
  'Customer Review',
  'Revisions',
  'Exterior Elevations',
  'Construction Prints',
  'Completed',
];

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  job,
  allJobs = [],
  onAddComment,
  onApprovePhase,
  onRequestRevision,
  onUpdateCustomerContact,
}) => {
  const [commentText, setCommentText] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'blueprint' | 'deliverables' | 'discussion'>('blueprint');
  const [selectedDeliverable, setSelectedDeliverable] = useState<DeliverableFile | null>(null);

  // Customer comment attachment state
  const [clientAttachmentUrl, setClientAttachmentUrl] = useState<string>('');
  const [clientAttachmentName, setClientAttachmentName] = useState<string>('');

  const currentPhaseIndex = PHASES.indexOf(job.current_status);

  const handleClientFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setClientAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setClientAttachmentUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim() || clientAttachmentUrl) {
      onAddComment(
        commentText.trim() || (clientAttachmentName ? `Attached file: ${clientAttachmentName}` : 'Attached image'),
        undefined,
        clientAttachmentUrl || undefined,
        clientAttachmentName || undefined
      );
      setCommentText('');
      setClientAttachmentUrl('');
      setClientAttachmentName('');
    }
  };

  const handleConfirmRevision = () => {
    if (revisionNotes.trim()) {
      onRequestRevision(revisionNotes.trim());
      setRevisionNotes('');
      setShowRevisionModal(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      
      {/* Top Welcome Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/80 relative overflow-hidden">
        
        {/* Subtle Background Decorative Graphic */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <Layers className="w-96 h-96 text-blue-400" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs sm:text-sm font-mono font-black bg-black text-white border border-slate-700 px-3 py-1 rounded-full shadow-xs tracking-wide">
                  #{job.job_number.replace(/^#/, '')}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {job.style} • {job.sq_ft} sq ft
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Welcome, {job.customer_name}
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                Assigned Architect/Drafter: <strong className="text-white">{job.assigned_drafter}</strong>
              </p>
            </div>

            {/* Approval & Revision Request Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowRevisionModal(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-600 transition shadow-sm active:scale-95"
              >
                Request Revision ({job.layout_reviews_count}/3 Used)
              </button>

              <button
                onClick={() => setShowApprovalModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-lg shadow-blue-600/30 border border-blue-400/30 flex items-center gap-2 active:scale-95"
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Approve Current Layout</span>
              </button>
            </div>
          </div>

          {/* Current Milestone Spotlight Box */}
          <div className="bg-slate-950/80 border border-blue-800/60 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="text-blue-400 font-bold uppercase tracking-wider text-[10px]">
                Current Phase
              </p>
              <p className="text-base font-bold text-white flex items-center gap-2">
                <span>{job.current_status}</span>
                {job.roadblock && (
                  <span className="text-xs bg-red-900/80 text-red-200 px-2 py-0.5 rounded font-medium border border-red-700">
                    Roadblock Active
                  </span>
                )}
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl text-slate-300 max-w-lg">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">What We're Working On Next:</p>
              <p className="font-medium text-slate-200 mt-0.5">{job.next_step}</p>
            </div>
          </div>

          {/* Customer Contact & Notification Bar */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-300">
              <div className="flex items-center gap-1.5 font-medium text-white">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>{job.customer_name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                {job.customer_email ? (
                  <span className="text-slate-200">{job.customer_email}</span>
                ) : (
                  <span className="text-slate-400 italic">No email on file</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                {job.customer_phone ? (
                  <span className="text-slate-200 font-mono">{job.customer_phone}</span>
                ) : (
                  <span className="text-slate-400 italic">No phone on file</span>
                )}
              </div>
              {job.project_address && (
                <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-[240px]">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{job.project_address}</span>
                </div>
              )}
            </div>

            {onUpdateCustomerContact && (
              <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span>Update Contact Info</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Visual Phase Progression Stepper */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
          Project Design Timeline Stepper
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
          {PHASES.map((phaseName, index) => {
            const isDone = index < currentPhaseIndex;
            const isCurrent = index === currentPhaseIndex;

            return (
              <div
                key={phaseName}
                className={`p-3 rounded-xl border flex flex-col justify-between items-center transition ${
                  isCurrent
                    ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold ring-2 ring-blue-400/20 shadow-xs'
                    : isDone
                    ? 'bg-slate-50 border-emerald-300 text-emerald-800 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="mb-2">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : isCurrent ? (
                    <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 text-[10px] flex items-center justify-center font-mono font-bold text-slate-400">
                      {index + 1}
                    </div>
                  )}
                </div>

                <span className="text-[11px] leading-tight">{phaseName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Tabs for Customer View */}
      <div className="flex border-b border-slate-200 text-sm font-semibold gap-6">
        <button
          onClick={() => setActiveTab('blueprint')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'blueprint'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Interactive CAD Blueprint Viewer</span>
        </button>

        <button
          onClick={() => setActiveTab('deliverables')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'deliverables'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Deliverables & Download Center ({job.deliverables.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('discussion')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'discussion'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Drafter Discussion ({job.comments.length})</span>
        </button>
      </div>

      {/* TAB 1: BLUEPRINT VIEWER */}
      {activeTab === 'blueprint' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>Interactive Feature:</strong> Click anywhere directly on the drawing sheet below to drop feedback pins for your drafter!</span>
            </span>
            <span className="font-mono font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              {job.comments.filter(c => c.pinnedLocation).length} Pins Placed
            </span>
          </div>

          <BlueprintCanvas
            job={job}
            onAddPinnedComment={(loc, text) => onAddComment(text, loc)}
          />
        </div>
      )}

      {/* TAB 2: DELIVERABLES & RENDERING GALLERY */}
      {activeTab === 'deliverables' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.deliverables.map((file) => (
              <div key={file.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-blue-100 text-blue-800 font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-blue-200">
                        {file.category}
                      </span>
                      <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded">
                        {file.version}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{file.title}</h4>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Preview Thumbnail Box */}
                <div className="relative group bg-slate-900 rounded-xl overflow-hidden border border-slate-200 aspect-video flex items-center justify-center">
                  {file.fileUrl ? (
                    <>
                      <img src={file.fileUrl} alt={file.title} className="w-full h-full object-cover transition duration-200 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedDeliverable(file)}
                          className="bg-white text-slate-900 text-xs font-bold px-3.5 py-1.5 rounded-lg transition shadow-md flex items-center gap-1.5"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Expand Full View</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-1 text-slate-500" />
                      <p className="text-xs font-medium text-slate-300">{file.fileName || 'CAD Spec Sheet'}</p>
                    </div>
                  )}
                </div>

                {/* Drafter Revision & Rendering Notes */}
                <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>Drafter Revision Notes:</span>
                  </p>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {file.changeNotes ? file.changeNotes : 'No specific change notes indicated for this deliverable.'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 font-mono">File Size: {file.fileSize}</span>
                  <div className="flex gap-2">
                    {file.fileUrl && (
                      <button
                        onClick={() => setSelectedDeliverable(file)}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                    )}
                    <a
                      href={file.fileUrl || '#'}
                      download={file.fileName || `${file.title}.jpg`}
                      onClick={(e) => {
                        if (!file.fileUrl) {
                          e.preventDefault();
                          alert(`Downloading high-res ${file.title} (${file.version})...`);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {job.deliverables.length === 0 && (
              <div className="col-span-full bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-1">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">No drawings or renderings uploaded yet.</p>
                <p className="text-[11px] text-slate-500">Your assigned drafter will post preliminary layouts and 3D renderings here for your review.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DISCUSSION THREAD */}
      {activeTab === 'discussion' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 text-base">Direct Messaging & Markup Feedback</h3>

          {/* Comment Thread */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {job.comments.map((comment) => {
              const isRoadblockFlag = comment.text.includes('ROADBLOCK FLAGGED') || comment.text.includes('ROADBLOCK ACTIVATED') || comment.text.startsWith('🚨');
              const isRoadblockResolved = comment.text.includes('ROADBLOCK RESOLVED') || comment.text.startsWith('✅ ROADBLOCK');

              return (
                <div
                  key={comment.id}
                  className={`p-4 rounded-xl border text-xs space-y-2 transition ${
                    isRoadblockFlag
                      ? 'bg-red-50/90 border-red-300 text-red-950 font-medium'
                      : isRoadblockResolved
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-medium'
                      : comment.role === 'customer'
                      ? 'bg-blue-50/70 border-blue-200 ml-8'
                      : comment.role === 'drafter'
                      ? 'bg-slate-50 border-slate-200 mr-8'
                      : 'bg-amber-50 border-amber-200 font-mono'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span>{comment.author} ({comment.role})</span>
                      {isRoadblockFlag && (
                        <span className="bg-red-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                          <ShieldAlert className="w-3 h-3" />
                          <span>ROADBLOCK FLAGGED</span>
                        </span>
                      )}
                      {isRoadblockResolved && (
                        <span className="bg-emerald-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ROADBLOCK RESOLVED</span>
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(comment.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className={`leading-relaxed whitespace-pre-wrap ${
                    isRoadblockFlag ? 'text-red-900 font-semibold' : isRoadblockResolved ? 'text-emerald-900 font-semibold' : 'text-slate-800'
                  }`}>{comment.text}</p>

                  {/* Comment Image Attachment */}
                  {comment.attachmentUrl && (
                    <div className="mt-2 bg-white/90 p-2 rounded-xl border border-slate-200 max-w-sm">
                      <img
                        src={comment.attachmentUrl}
                        alt="Attachment"
                        className="w-full max-h-48 object-cover rounded-lg border border-slate-200 cursor-pointer"
                        onClick={() => setSelectedDeliverable({
                          id: comment.id,
                          title: comment.attachmentName || 'Comment Attachment',
                          category: '3D Render',
                          version: 'Attachment',
                          uploadedAt: comment.timestamp,
                          fileSize: 'Attachment',
                          previewType: 'render_image',
                          fileUrl: comment.attachmentUrl,
                          changeNotes: comment.text
                        })}
                      />
                      {comment.attachmentName && (
                        <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                          📎 {comment.attachmentName}
                        </p>
                      )}
                    </div>
                  )}

                  {comment.pinnedLocation && (
                    <span className="inline-block text-[10px] bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded border border-blue-300 mt-1">
                      📌 Pinned at ({comment.pinnedLocation.x}%, {comment.pinnedLocation.y}%)
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* New Message Form */}
          <form onSubmit={handlePostComment} className="space-y-2 pt-2 border-t border-slate-200">
            {clientAttachmentUrl && (
              <div className="bg-blue-50 border border-blue-200 p-2 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <img src={clientAttachmentUrl} alt="Attached" className="w-8 h-8 object-cover rounded" />
                  <span className="font-semibold text-blue-900 truncate">{clientAttachmentName || 'Attached File'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClientAttachmentUrl('');
                    setClientAttachmentName('');
                  }}
                  className="text-slate-400 hover:text-red-600 transition p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <label className="cursor-pointer p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition shrink-0" title="Attach image or sketch">
                <Paperclip className="w-4 h-4 text-slate-600" />
                <input
                  type="file"
                  accept="image/*,.pdf,.dwg"
                  onChange={handleClientFileSelect}
                  className="hidden"
                />
              </label>

              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Type a question or note for your architect/drafter..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="submit"
                disabled={!commentText.trim() && !clientAttachmentUrl}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: REQUEST REVISION MODAL */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-sans text-slate-900 border border-slate-200">
            <h3 className="font-bold text-lg text-slate-900">Request Layout Revision</h3>
            <p className="text-xs text-slate-600">
              You are using Revision Review <strong>#{job.layout_reviews_count + 1}</strong> of {job.max_reviews_included} included in your plan package.
            </p>

            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Describe the changes needed (e.g. Expand master closet by 2ft, add patio cover, shift kitchen sink)..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none h-28 resize-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevision}
                disabled={!revisionNotes.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPROVE LAYOUT MODAL */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-sans text-slate-900 border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <h3 className="font-bold text-lg text-slate-900">Approve Floor Plan Phase?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              By approving <strong>{job.current_status}</strong>, your architect will begin drafting the next phase (Exterior Elevations / Construction Prints).
            </p>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Not Yet
              </button>
              <button
                onClick={() => {
                  onApprovePhase();
                  setShowApprovalModal(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2 rounded-xl transition shadow-md"
              >
                Confirm Formal Sign-off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: UNIVERSAL HIGH-DEFINITION DELIVERABLE & IMAGE PREVIEW MODAL */}
      {selectedDeliverable && (
        <UniversalFileViewerModal
          file={{
            id: selectedDeliverable.id,
            name: selectedDeliverable.fileName || selectedDeliverable.title,
            url: selectedDeliverable.fileUrl,
            size: selectedDeliverable.fileSize,
            title: selectedDeliverable.title,
            category: selectedDeliverable.category,
            version: selectedDeliverable.version,
            uploadedAt: selectedDeliverable.uploadedAt,
            authorDrafter: selectedDeliverable.authorDrafter,
            notes: selectedDeliverable.changeNotes
          }}
          subtitle={selectedDeliverable.category ? `${selectedDeliverable.category} • ${selectedDeliverable.version}` : undefined}
          onClose={() => setSelectedDeliverable(null)}
        />
      )}

      {/* Customer Contact Update Modal */}
      {showContactModal && onUpdateCustomerContact && (
        <EditCustomerContactModal
          job={job}
          allJobs={allJobs}
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          onSaveContact={(contact) => {
            onUpdateCustomerContact(job.customer_name, contact);
          }}
          performedByRole="customer"
        />
      )}

    </div>
  );
};
