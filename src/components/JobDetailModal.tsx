import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Clock, FileText, Send, Plus, Trash2, Mail, ShieldAlert, Layers, User, Phone, MapPin, DollarSign, Calendar, RefreshCw, Play, Square, Download, FileSpreadsheet, History, Image, Upload, Paperclip, Sparkles, Maximize2, ExternalLink, FileCode, Edit3, Share2, ListTodo, Lock, RotateCcw, CheckCircle, Archive } from 'lucide-react';
import { Job, JobPhase, DeliverableFile, EmailTemplate, TimeLog, JobVersionSnapshot, JobComment, DelegatedWorkItem, StaffUser } from '../types';
import { BlueprintCanvas } from './BlueprintCanvas';
import { calculateJobTotalSeconds, calculateJobBillableAmount, formatSecondsToReadable, formatSecondsToHHMMSS, exportInvoicingCSV } from '../utils/timeUtils';
import { RequestRevisionModal } from './RequestRevisionModal';
import { isJobArchived } from '../data/mockData';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onUpdateJob: (updatedJob: Job) => void;
  onTriggerEmail: (email: EmailTemplate) => void;
  onStartTimer?: (jobId: string, taskNote?: string) => void;
  onStopTimer?: (jobId: string, taskNote?: string) => void;
  canAccessFinancials?: boolean;
  canDelegate?: boolean;
  onOpenDelegateModal?: (job: Job) => void;
  onOpenCompleteTaskModal?: (task: DelegatedWorkItem, job: Job) => void;
  onUpdateTaskStatus?: (jobId: string, taskId: string, newStatus: DelegatedWorkItem['status']) => void;
  onApproveTaskReview?: (jobId: string, taskId: string, reviewNotes?: string) => void;
  onRequestTaskRevision?: (jobId: string, taskId: string, feedbackNotes: string) => void;
  currentStaff?: StaffUser;
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

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onUpdateJob,
  onTriggerEmail,
  onStartTimer,
  onStopTimer,
  canAccessFinancials = true,
  canDelegate = false,
  onOpenDelegateModal,
  onOpenCompleteTaskModal,
  onUpdateTaskStatus,
  onApproveTaskReview,
  onRequestTaskRevision,
  currentStaff,
  nowTimestamp,
}) => {
  if (!job) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'canvas' | 'deliverables' | 'comments' | 'audit' | 'time'>('overview');
  const [roadblockNoteInput, setRoadblockNoteInput] = useState(job.roadblock_note || '');
  const [newCommentInput, setNewCommentInput] = useState('');

  // Resolve Roadblock Modal State
  const [showResolveRoadblockModal, setShowResolveRoadblockModal] = useState(false);
  const [roadblockResolutionInput, setRoadblockResolutionInput] = useState('');
  const [roadblockResolveError, setRoadblockResolveError] = useState('');
  
  // Delegated Task Revision Modal State
  const [revisionModalTask, setRevisionModalTask] = useState<DelegatedWorkItem | null>(null);

  // Completed status authorization (Kyle or Jason only)
  const canMarkProjectCompleted = Boolean(
    currentStaff &&
    (currentStaff.name.toLowerCase().includes('kyle') || currentStaff.name.toLowerCase().includes('jason'))
  );

  // Version History Snapshot State
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('live');
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotLabelInput, setSnapshotLabelInput] = useState('');
  const [snapshotNoteInput, setSnapshotNoteInput] = useState('');

  // Active Snapshot & Displayed Job Resolution
  const activeSnapshot = selectedSnapshotId !== 'live'
    ? (job.version_snapshots || []).find(s => s.id === selectedSnapshotId)
    : null;

  const displayedJob: Job = activeSnapshot
    ? {
        ...job,
        current_status: activeSnapshot.phase,
        comments: activeSnapshot.comments,
      }
    : job;

  // Create Version Snapshot
  const handleCreateSnapshot = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const count = (job.version_snapshots || []).length;
    const defaultLabel = `v1.${count + 1} - ${job.current_status}`;
    const finalLabel = snapshotLabelInput.trim() || defaultLabel;

    const newSnapshot: JobVersionSnapshot = {
      id: `snap-${Date.now()}`,
      versionLabel: finalLabel,
      timestamp: new Date().toISOString(),
      phase: job.current_status,
      createdByName: job.assigned_drafter.split(',')[0],
      note: snapshotNoteInput.trim() || `Captured milestone during ${job.current_status} phase.`,
      comments: JSON.parse(JSON.stringify(job.comments)),
      deliverables: JSON.parse(JSON.stringify(job.deliverables || []))
    };

    const updated: Job = {
      ...job,
      version_snapshots: [newSnapshot, ...(job.version_snapshots || [])],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Version Snapshot Created',
          performedBy: job.assigned_drafter.split(',')[0],
          timestamp: new Date().toISOString(),
          details: `Captured version snapshot "${finalLabel}" (${job.comments.length} comments, phase: ${job.current_status})`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);
    setIsSnapshotModalOpen(false);
    setSnapshotLabelInput('');
    setSnapshotNoteInput('');
    setSelectedSnapshotId(newSnapshot.id);
  };

  // Restore Snapshot as Active Version
  const handleRestoreSnapshot = (snapshot: JobVersionSnapshot) => {
    if (window.confirm(`Restore "${snapshot.versionLabel}" as the active working floor plan? This will revert the job phase to "${snapshot.phase}" and restore its markup comments.`)) {
      const updated: Job = {
        ...job,
        current_status: snapshot.phase,
        comments: JSON.parse(JSON.stringify(snapshot.comments)),
        audit_logs: [
          {
            id: `a-${Date.now()}`,
            action: 'Version Restored',
            performedBy: job.assigned_drafter.split(',')[0],
            timestamp: new Date().toISOString(),
            details: `Restored floor plan comments and phase from snapshot "${snapshot.versionLabel}"`
          },
          ...job.audit_logs
        ]
      };

      onUpdateJob(updated);
      setSelectedSnapshotId('live');
    }
  };

  // Delete Snapshot
  const handleDeleteSnapshot = (snapshotId: string) => {
    if (window.confirm('Delete this version snapshot from history?')) {
      const updated: Job = {
        ...job,
        version_snapshots: (job.version_snapshots || []).filter(s => s.id !== snapshotId)
      };
      onUpdateJob(updated);
      if (selectedSnapshotId === snapshotId) {
        setSelectedSnapshotId('live');
      }
    }
  };

  // New File Upload Form State
  const [fileTitle, setFileTitle] = useState('');
  const [fileCategory, setFileCategory] = useState<DeliverableFile['category']>('Floor Plan');
  const [fileVersion, setFileVersion] = useState('v1.0');
  const [fileChangeNotes, setFileChangeNotes] = useState('');
  const [attachedFileUrl, setAttachedFileUrl] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const [previewModalFile, setPreviewModalFile] = useState<DeliverableFile | null>(null);

  // Comment attachment state
  const [commentAttachmentUrl, setCommentAttachmentUrl] = useState<string>('');
  const [commentAttachmentName, setCommentAttachmentName] = useState<string>('');

  // Job Number / MPS Number Editing State
  const [isEditingMpsNumber, setIsEditingMpsNumber] = useState(false);
  const [mpsNumberInput, setMpsNumberInput] = useState(job.job_number);

  // Sync mpsNumberInput when job changes
  React.useEffect(() => {
    setMpsNumberInput(job.job_number);
  }, [job.job_number]);

  const handleSaveMpsNumber = () => {
    if (!mpsNumberInput.trim()) return;
    const oldNumber = job.job_number;
    const newNumber = mpsNumberInput.trim();
    if (oldNumber === newNumber) {
      setIsEditingMpsNumber(false);
      return;
    }

    const updated: Job = {
      ...job,
      job_number: newNumber,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Job / MPS Number Updated',
          performedBy: job.assigned_drafter.split(',')[0],
          timestamp: new Date().toISOString(),
          details: `Updated Job/MPS Number from ${oldNumber} to ${newNumber}`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updated);
    setIsEditingMpsNumber(false);
  };

  // Manual Time Log Form State
  const [manualTaskInput, setManualTaskInput] = useState('');
  const [manualHoursInput, setManualHoursInput] = useState('');
  const [hourlyRateInput, setHourlyRateInput] = useState<number>(job.hourly_rate || 85);

  const handleUpdateHourlyRate = (rate: number) => {
    setHourlyRateInput(rate);
    const updated: Job = {
      ...job,
      hourly_rate: rate,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Hourly Rate Updated',
          performedBy: job.assigned_drafter.split(',')[0],
          timestamp: new Date().toISOString(),
          details: `Updated hourly rate to $${rate}/hr`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updated);
  };

  const handleAddManualTimeLog = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(manualHoursInput);
    if (!hours || hours <= 0 || !manualTaskInput.trim()) return;

    const seconds = Math.round(hours * 3600);
    const newLog: TimeLog = {
      id: `tl-${Date.now()}`,
      drafterName: job.assigned_drafter.split(',')[0],
      startTime: new Date(Date.now() - seconds * 1000).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: seconds,
      taskDescription: manualTaskInput.trim(),
      hourlyRate: job.hourly_rate || 85
    };

    const updated: Job = {
      ...job,
      time_logs: [...(job.time_logs || []), newLog],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Manual Time Log Added',
          performedBy: job.assigned_drafter.split(',')[0],
          timestamp: new Date().toISOString(),
          details: `Added ${hours} hrs for "${manualTaskInput.trim()}"`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);
    setManualTaskInput('');
    setManualHoursInput('');
  };

  // Phase change handler
  const handlePhaseChange = (newPhase: JobPhase) => {
    if (newPhase === 'Completed' && !canMarkProjectCompleted) {
      alert('Permission Restricted: Only Kyle or Jason have the authority to mark a project as Completed.');
      return;
    }

    const updated: Job = {
      ...job,
      current_status: newPhase,
      last_customer_contact: new Date().toISOString(),
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Phase Updated',
          performedBy: currentStaff?.name || 'Drafter Studio',
          timestamp: new Date().toISOString(),
          details: `Changed phase from ${job.current_status} to ${newPhase}`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);

    // Auto generate draft email notification
    const email: EmailTemplate = {
      recipientEmail: job.customer_email,
      recipientName: job.customer_name,
      subject: `Project Update: Job #${job.job_number} Moved to ${newPhase}`,
      body: `Hello ${job.customer_name},\n\nYour house plan project (#${job.job_number}) has officially progressed to the ${newPhase} phase!\n\nNext steps: ${job.next_step}\n\nPlease visit your Plan Store customer portal to review updated drawing sheets and provide feedback.\n\nBest regards,\n${job.assigned_drafter}`,
      timestamp: new Date().toISOString(),
      jobId: job.id,
      jobNumber: job.job_number
    };

    onTriggerEmail(email);
  };

  // Flag or update roadblock note
  const handleFlagOrUpdateRoadblock = () => {
    const note = roadblockNoteInput.trim() || 'Awaiting site survey & customer input';
    const isNewFlag = !job.roadblock;

    const flagComment = {
      id: `c-rb-flag-${Date.now()}`,
      author: job.assigned_drafter.split(',')[0] || 'Drafter Studio',
      role: 'drafter' as const,
      text: isNewFlag ? `🚨 ROADBLOCK FLAGGED: ${note}` : `🚨 ROADBLOCK NOTE UPDATED: ${note}`,
      timestamp: new Date().toISOString()
    };

    const updated: Job = {
      ...job,
      roadblock: true,
      roadblock_note: note,
      comments: [...job.comments, flagComment],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: isNewFlag ? 'Roadblock Activated' : 'Roadblock Note Updated',
          performedBy: job.assigned_drafter.split(',')[0] || 'Drafter Studio',
          timestamp: new Date().toISOString(),
          details: `Roadblock note: ${note}`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);

    if (isNewFlag) {
      onTriggerEmail({
        recipientEmail: job.customer_email,
        recipientName: job.customer_name,
        subject: `Notice: Site Roadblock Flagged for Job #${job.job_number}`,
        body: `Dear ${job.customer_name},\n\nA roadblock requires attention for your project #${job.job_number}.\n\nNote: ${note}\n\nPlease contact your assigned drafter ${job.assigned_drafter} or check the portal for details.`,
        timestamp: new Date().toISOString(),
        jobId: job.id,
        jobNumber: job.job_number
      });
    }
  };

  // Open resolve roadblock modal
  const handleOpenResolveRoadblock = () => {
    setRoadblockResolutionInput('');
    setRoadblockResolveError('');
    setShowResolveRoadblockModal(true);
  };

  // Confirm resolve roadblock
  const handleConfirmResolveRoadblock = (e: React.FormEvent) => {
    e.preventDefault();
    const resolutionText = roadblockResolutionInput.trim();
    if (!resolutionText) {
      setRoadblockResolveError('Please provide a comment explaining how the roadblock was resolved.');
      return;
    }

    const resolutionComment = {
      id: `c-rb-res-${Date.now()}`,
      author: job.assigned_drafter.split(',')[0] || 'Drafter Studio',
      role: 'drafter' as const,
      text: `✅ ROADBLOCK RESOLVED: ${resolutionText}`,
      timestamp: new Date().toISOString()
    };

    const updated: Job = {
      ...job,
      roadblock: false,
      roadblock_note: '',
      comments: [...job.comments, resolutionComment],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Roadblock Resolved',
          performedBy: job.assigned_drafter.split(',')[0] || 'Drafter Studio',
          timestamp: new Date().toISOString(),
          details: `Cleared active roadblock. Resolution: ${resolutionText}`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);
    setRoadblockNoteInput('');
    setShowResolveRoadblockModal(false);

    onTriggerEmail({
      recipientEmail: job.customer_email,
      recipientName: job.customer_name,
      subject: `Notice: Roadblock Resolved for Job #${job.job_number}`,
      body: `Dear ${job.customer_name},\n\nThe active roadblock for your project #${job.job_number} has been resolved!\n\nResolution Details: ${resolutionText}\n\nWork on your project is resuming immediately.`,
      timestamp: new Date().toISOString(),
      jobId: job.id,
      jobNumber: job.job_number
    });
  };

  // Review count change
  const handleReviewCountChange = (delta: number) => {
    const newCount = Math.max(0, job.layout_reviews_count + delta);
    const updated: Job = {
      ...job,
      layout_reviews_count: newCount,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Review Count Updated',
          performedBy: 'Drafter Studio',
          timestamp: new Date().toISOString(),
          details: `Updated review count to ${newCount}/${job.max_reviews_included}`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updated);
  };

  // Handle local file selection for deliverables
  const handleDeliverableFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAttachedFileUrl(result);
      if (!fileTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setFileTitle(nameWithoutExt);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle comment file attachment
  const handleCommentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCommentAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCommentAttachmentUrl(result);
    };
    reader.readAsDataURL(file);
  };

  // Add Comment with Attachment
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentInput.trim() && !commentAttachmentUrl) return;

    const drafterName = job.assigned_drafter.split(',')[0] || 'Drafter Studio';
    const newComment: JobComment = {
      id: `c-${Date.now()}`,
      author: drafterName,
      role: 'drafter' as const,
      text: newCommentInput.trim() || (commentAttachmentName ? `Attached file: ${commentAttachmentName}` : 'Attached image'),
      timestamp: new Date().toISOString(),
      attachmentUrl: commentAttachmentUrl || undefined,
      attachmentName: commentAttachmentName || undefined
    };

    const updated: Job = {
      ...job,
      comments: [...job.comments, newComment]
    };

    onUpdateJob(updated);
    setNewCommentInput('');
    setCommentAttachmentUrl('');
    setCommentAttachmentName('');
  };

  // Upload CAD Sheet / Deliverable
  const handleUploadDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileTitle.trim()) return;

    const drafterName = job.assigned_drafter.split(',')[0] || 'Drafter Studio';
    const finalUrl = attachedFileUrl || (
      fileCategory === '3D Render' ? 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' :
      fileCategory === 'Exterior Elevations' ? 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80' :
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
    );

    const newFile: DeliverableFile = {
      id: `d-${Date.now()}`,
      title: fileTitle.trim(),
      category: fileCategory,
      version: fileVersion.trim() || 'v1.0',
      uploadedAt: new Date().toISOString(),
      fileSize: attachedFileName ? `${(Math.random() * 5 + 1).toFixed(1)} MB` : '6.4 MB',
      previewType: fileCategory === '3D Render' ? 'render_image' : fileCategory === 'CAD / DWG File' ? 'cad_file' : 'canvas_floorplan',
      fileUrl: finalUrl,
      fileName: attachedFileName || `${fileTitle.trim().replace(/\s+/g, '_')}_${fileVersion}.png`,
      changeNotes: fileChangeNotes.trim(),
      authorDrafter: drafterName
    };

    // Auto publish a comment to Messages & Notes so customer sees it in chat thread too!
    const publishComment: JobComment = {
      id: `c-deliv-${Date.now()}`,
      author: drafterName,
      role: 'drafter' as const,
      text: `📁 NEW DELIVERABLE PUBLISHED: ${newFile.title} (${newFile.category} - ${newFile.version})${newFile.changeNotes ? `\n\n📝 Drafter Notes on Revisions:\n"${newFile.changeNotes}"` : ''}`,
      timestamp: new Date().toISOString(),
      attachmentUrl: finalUrl,
      attachmentName: newFile.fileName
    };

    const updated: Job = {
      ...job,
      deliverables: [newFile, ...job.deliverables],
      comments: [...job.comments, publishComment],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'CAD Sheet & Render Published',
          performedBy: drafterName,
          timestamp: new Date().toISOString(),
          details: `Published deliverable "${fileTitle}" (${fileVersion}). Change notes: ${fileChangeNotes || 'None'}`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);

    // Reset form
    setFileTitle('');
    setFileVersion('v1.0');
    setFileChangeNotes('');
    setAttachedFileUrl('');
    setAttachedFileName('');

    // Trigger email notice
    onTriggerEmail({
      recipientEmail: job.customer_email,
      recipientName: job.customer_name,
      subject: `New Plan / Render Published for Job #${job.job_number}: ${newFile.title}`,
      body: `Dear ${job.customer_name},\n\nYour assigned drafter (${drafterName}) has published a new drawing deliverable:\n\nTitle: ${newFile.title} (${newFile.version})\nCategory: ${newFile.category}\n${newFile.changeNotes ? `Drafter Revision Notes: "${newFile.changeNotes}"\n\n` : ''}Please visit your customer portal to view the attached renderings/plans and provide feedback.`,
      timestamp: new Date().toISOString(),
      jobId: job.id,
      jobNumber: job.job_number
    });
  };

  // Delete Deliverable
  const handleDeleteDeliverable = (deliverableId: string) => {
    if (window.confirm('Are you sure you want to remove this deliverable sheet?')) {
      const updated: Job = {
        ...job,
        deliverables: job.deliverables.filter(d => d.id !== deliverableId),
        audit_logs: [
          {
            id: `a-${Date.now()}`,
            action: 'Deliverable Removed',
            performedBy: job.assigned_drafter.split(',')[0],
            timestamp: new Date().toISOString(),
            details: `Deleted deliverable sheet ID: ${deliverableId}`
          },
          ...job.audit_logs
        ]
      };
      onUpdateJob(updated);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono font-bold bg-blue-600 text-white px-2.5 py-1 rounded border border-blue-400/30 flex items-center gap-1 shadow-2xs">
                <span className="text-[10px] text-blue-200 font-sans font-bold uppercase">MPS #:</span>
                <span>{job.job_number}</span>
              </span>
              {isJobArchived(job) && (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                  <Archive className="w-3 h-3 text-emerald-400" />
                  <span>Paid & Archived</span>
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">{job.customer_name}</h3>
              <p className="text-xs text-slate-400">{job.style} • {job.sq_ft} sq ft • Drafter: {job.assigned_drafter}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Version History Selector Toggle Bar */}
            <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
              <div className="flex items-center gap-1.5 px-1.5 text-xs text-slate-300 font-semibold">
                <History className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">Version:</span>
              </div>

              <select
                value={selectedSnapshotId}
                onChange={(e) => setSelectedSnapshotId(e.target.value)}
                className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none transition ${
                  selectedSnapshotId === 'live'
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-amber-600 border-amber-400 text-white animate-pulse'
                }`}
              >
                <option value="live" className="bg-slate-900 text-white font-sans">
                  ● Live Working Version ({job.current_status})
                </option>
                {(job.version_snapshots || []).map((snap) => (
                  <option key={snap.id} value={snap.id} className="bg-slate-900 text-white font-sans">
                    📜 {snap.versionLabel} ({snap.phase})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setIsSnapshotModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Capture current floor plan comments & phase status snapshot"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span className="hidden md:inline">Save Snapshot</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paid & Archived Banner */}
        {isJobArchived(job) && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Archived & Paid Project:</strong> This project has been paid and archived from active drafter board(s). Retrievable via search by Kyle, Jason, Drew, and Ethan for notes, records, and client follow-ups.
              </span>
            </div>
            {job.archived_at && (
              <span className="text-[11px] text-emerald-800 font-mono bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                Paid {new Date(job.archived_at).toLocaleDateString()} {job.archived_by ? `by ${job.archived_by}` : ''}
              </span>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-slate-50 px-6 py-2 border-b border-slate-200 flex items-center gap-4 text-xs font-semibold text-slate-600 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-1.5 px-3 rounded-lg transition shrink-0 ${
              activeTab === 'overview' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            Job Controls
          </button>

          <button
            onClick={() => setActiveTab('canvas')}
            className={`py-1.5 px-3 rounded-lg transition shrink-0 ${
              activeTab === 'canvas' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            CAD Plan Canvas
          </button>

          <button
            onClick={() => setActiveTab('deliverables')}
            className={`py-1.5 px-3 rounded-lg transition shrink-0 ${
              activeTab === 'deliverables' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            Deliverable Sheets ({job.deliverables.length})
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`py-1.5 px-3 rounded-lg transition shrink-0 ${
              activeTab === 'comments' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            Messages & Notes ({displayedJob.comments.length})
          </button>

          <button
            onClick={() => setActiveTab('time')}
            className={`py-1.5 px-3 rounded-lg transition shrink-0 flex items-center gap-1 ${
              activeTab === 'time' ? 'bg-emerald-600 text-white shadow-xs' : 'hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{canAccessFinancials ? 'Time & Invoicing' : 'Logged Time & Sessions'}</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-1.5 px-3 rounded-lg transition shrink-0 ${
              activeTab === 'audit' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            Audit Log ({job.audit_logs.length})
          </button>
        </div>

        {/* Historical Snapshot Banner Notice */}
        {activeSnapshot && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-amber-950 text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0">
                Historical Snapshot Mode
              </span>
              <span className="font-bold text-slate-900">{activeSnapshot.versionLabel}</span>
              <span className="text-slate-600 font-medium hidden sm:inline">
                • Phase: <strong className="text-slate-900">{activeSnapshot.phase}</strong>
                • <strong className="text-slate-900">{activeSnapshot.comments.length}</strong> floor plan notes
                • Saved on {new Date(activeSnapshot.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleRestoreSnapshot(activeSnapshot)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition shadow-2xs"
              >
                Restore as Active Version
              </button>
              <button
                onClick={() => setSelectedSnapshotId('live')}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1 rounded-lg text-xs transition"
              >
                Back to Live
              </button>
            </div>
          </div>
        )}

        {/* Modal Main Content Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: JOB CONTROLS & OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Phase Progression Selector Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Update Phase Pipeline
                </label>
                <div className="flex flex-wrap gap-2">
                  {PHASES.map((p) => {
                    const isCurrent = job.current_status === p;
                    const isCompletedPhase = p === 'Completed';
                    const isLocked = isCompletedPhase && !canMarkProjectCompleted;

                    return (
                      <button
                        key={p}
                        onClick={() => {
                          if (isLocked) {
                            alert('Permission Restricted: Only Kyle or Jason have the authority to mark a project as Completed.');
                            return;
                          }
                          handlePhaseChange(p);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                            : isLocked
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 cursor-pointer'
                        }`}
                        title={isLocked ? 'Only Kyle or Jason can mark a project as Completed' : undefined}
                      >
                        {isLocked && <Lock className="w-3 h-3 text-slate-400" />}
                        <span>{p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Roadblock Management & Layout Review Counter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Roadblock Box */}
                <div className={`p-4 rounded-xl border space-y-3 ${
                  job.roadblock ? 'bg-red-50 border-red-300 shadow-2xs' : 'bg-emerald-50/60 border-emerald-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-slate-900">
                      <ShieldAlert className={`w-4 h-4 ${job.roadblock ? 'text-red-600' : 'text-emerald-600'}`} />
                      <span>Roadblock Status</span>
                    </h4>

                    {job.roadblock ? (
                      <button
                        onClick={handleOpenResolveRoadblock}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve Roadblock</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleFlagOrUpdateRoadblock}
                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Flag Roadblock</span>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roadblockNoteInput}
                      onChange={(e) => setRoadblockNoteInput(e.target.value)}
                      placeholder="Describe roadblock issue (e.g. Septic location pending)..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {job.roadblock && (
                      <button
                        onClick={handleFlagOrUpdateRoadblock}
                        className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition"
                      >
                        Save Note
                      </button>
                    )}
                  </div>
                  {job.roadblock && (
                    <p className="text-[11px] text-red-700 font-medium flex items-center gap-1">
                      <span>⚠️ Roadblock issue is logged in Messages & Notes. Click <strong>Resolve Roadblock</strong> to log resolution details.</span>
                    </p>
                  )}
                </div>

                {/* Layout Reviews Counter Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Layout Reviews Counter
                  </h4>

                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-2xl font-mono font-bold text-blue-700">
                        {job.layout_reviews_count}
                      </span>
                      <span className="text-xs text-slate-500 font-mono"> / {job.max_reviews_included} Max Included</span>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleReviewCountChange(-1)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleReviewCountChange(1)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {job.layout_reviews_count > job.max_reviews_included && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 font-semibold">
                      ⚠️ Customer has exceeded included reviews! Extra review fee may apply.
                    </p>
                  )}
                </div>

              </div>

              {/* Customer Info & Lot Details */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Customer & Site Details
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Project Identifier
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-200">
                    <span className="text-[10px] text-blue-800 font-bold uppercase block font-mono">Job # / MPS Number:</span>
                    {isEditingMpsNumber ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={mpsNumberInput}
                          onChange={(e) => setMpsNumberInput(e.target.value)}
                          className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleSaveMpsNumber}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[11px] font-bold shrink-0 shadow-2xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMpsNumberInput(job.job_number);
                            setIsEditingMpsNumber(false);
                          }}
                          className="text-slate-500 hover:text-slate-800 p-1 text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-blue-950 text-sm">{job.job_number}</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingMpsNumber(true)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-0.5"
                          title="Edit Job / MPS Number"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block font-semibold">Email:</span>
                    <span className="font-medium text-slate-800">{job.customer_email}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-semibold">Phone:</span>
                    <span className="font-medium text-slate-800">{job.customer_phone}</span>
                  </div>

                  {canAccessFinancials ? (
                    <div>
                      <span className="text-slate-400 block font-semibold">Estimated Fee:</span>
                      <span className="font-medium text-slate-800">${job.estimated_cost}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-slate-400 block font-semibold">Square Footage:</span>
                      <span className="font-medium text-slate-800">{job.sq_ft} sq ft</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <span className="text-slate-400 block font-semibold">Lot & Site Details:</span>
                  <p className="text-slate-700 mt-0.5">{job.lot_details}</p>
                </div>
              </div>

              {/* Delegated Work Items & Sub-Tasks Card */}
              <div className="bg-white p-4 rounded-xl border border-indigo-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4.5 h-4.5 text-indigo-600" />
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                        Delegated Work Components & Reviews ({(job.delegated_tasks || []).length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Sub-tasks assigned to team drafters for drafting, structural calculations, and QA review.
                      </p>
                    </div>
                  </div>

                  {canDelegate && onOpenDelegateModal && (
                    <button
                      type="button"
                      onClick={() => onOpenDelegateModal(job)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Delegate Component</span>
                    </button>
                  )}
                </div>

                {(!job.delegated_tasks || job.delegated_tasks.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No components have been delegated on this plan yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {job.delegated_tasks.map((task) => {
                      const delegatorName = task.delegatedBy || 'Kyle';
                      const isWaitingReview = (task.status === 'Completed' || task.status === 'Under Review') && !task.isReviewed;
                      const isRevisionReq = task.status === 'Revision Requested' || Boolean(task.revisionRequested);
                      const isApproved = task.status === 'Completed' && Boolean(task.isReviewed);
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
                          className={`p-3.5 rounded-xl border transition ${
                            isRevisionReq
                              ? 'bg-orange-50/40 border-orange-300 ring-1 ring-orange-200'
                              : isWaitingReview
                              ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200'
                              : isApproved
                              ? 'bg-emerald-50/40 border-emerald-300'
                              : task.status === 'Completed'
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900">{task.componentTitle}</span>
                                <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                                  {task.category}
                                </span>
                                {isRevisionReq && (
                                  <span className="text-[10px] font-extrabold bg-orange-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Revision Requested {task.revisionCount ? `(Rev #${task.revisionCount})` : ''}</span>
                                  </span>
                                )}
                                {isWaitingReview && (
                                  <span className="text-[10px] font-extrabold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                                    <span>Waiting for {delegatorName} to review</span>
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
                                    ? 'bg-red-100 text-red-700'
                                    : task.priority === 'High'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {task.priority} Priority
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 mt-1.5 bg-white p-2 rounded border border-slate-200/80">
                                {task.neededWorkDescription}
                              </p>

                              {task.notes && (
                                <p className="text-[11px] text-slate-500 italic mt-1">
                                  <strong>Note from {task.delegatedBy}:</strong> {task.notes}
                                </p>
                              )}

                              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1.5">
                                <span>Assigned to: <strong className="text-slate-800">{task.assignedTo}</strong></span>
                                <span>• Delegated by: <strong className="text-slate-800">{task.delegatedBy}</strong></span>
                                {task.dueDate && <span>• Due: <strong>{task.dueDate}</strong></span>}
                              </div>

                              {/* Revision Request Banner */}
                              {isRevisionReq && task.revisionNotes && (
                                <div className="mt-2 bg-orange-50 p-2.5 rounded-lg border border-orange-200 text-xs text-orange-950 space-y-1.5">
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="flex items-center gap-1.5 text-orange-900">
                                      <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                                      <span>Revision Requested by <strong>{task.revisionRequestedBy || delegatorName}</strong></span>
                                    </span>
                                    {task.revisionRequestedAt && (
                                      <span className="text-[10px] text-orange-800 font-mono">
                                        {new Date(task.revisionRequestedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  <p className="bg-white/90 p-2 rounded border border-orange-200 text-orange-900 text-xs italic">
                                    "{task.revisionNotes}"
                                  </p>
                                </div>
                              )}

                              {/* Completed details & Review banner */}
                              {(task.status === 'Completed' || task.status === 'Under Review') && (
                                <div className="mt-2 bg-white/90 p-2.5 rounded-lg border border-emerald-200 text-xs text-emerald-950 space-y-2">
                                  <div className="flex items-center justify-between font-semibold flex-wrap gap-1">
                                    <span className="flex items-center gap-1.5 text-emerald-800">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>
                                        {isApproved
                                          ? `Approved & Signed Off by ${task.reviewedBy || delegatorName}`
                                          : `Completed & Submitted for Review to ${delegatorName}`
                                        }
                                      </span>
                                    </span>
                                    {task.completedAt && (
                                      <span className="text-[10px] text-emerald-700 font-mono">
                                        {new Date(task.completedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>

                                  {isWaitingReview && (
                                    <div className="bg-amber-500/15 border border-amber-400 text-amber-950 p-2.5 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                        <span className="font-extrabold text-[11px]">
                                          {isAuthorizedReviewer
                                            ? `Waiting for your review and sign-off`
                                            : `Waiting for ${delegatorName} to review`}
                                        </span>
                                      </div>
                                      
                                      {/* Only Kyle, Jason, or the original delegator can Sign Off & Approve or Request Revisions */}
                                      {isAuthorizedReviewer && (
                                        <div className="flex items-center gap-1.5">
                                          {onRequestTaskRevision && (
                                            <button
                                              type="button"
                                              onClick={() => setRevisionModalTask(task)}
                                              className="text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer"
                                            >
                                              <RotateCcw className="w-3 h-3 text-amber-700" />
                                              <span>Request Revisions</span>
                                            </button>
                                          )}
                                          {onApproveTaskReview && (
                                            <button
                                              type="button"
                                              onClick={() => onApproveTaskReview(job.id, task.id, `Approved by ${currentStaff?.name || 'Reviewer'}`)}
                                              className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                              <span>Sign Off & Approve</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {task.completionNotes && (
                                    <p className="text-[11px] text-emerald-900 bg-emerald-50/50 p-1.5 rounded border border-emerald-100 italic">
                                      "{task.completionNotes}"
                                    </p>
                                  )}
                                  {task.attachments && task.attachments.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                      <span className="text-[10px] text-emerald-800 font-semibold">Review Deliverables:</span>
                                      {task.attachments.map((att) => (
                                        <span
                                          key={att.id}
                                          className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"
                                        >
                                          <FileText className="w-3 h-3 text-emerald-600" />
                                          <span className="truncate max-w-[150px]">{att.name}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 mt-2 sm:mt-0">
                              <select
                                value={task.status === 'Under Review' ? 'Completed' : task.status}
                                onChange={(e) => {
                                  const newStat = e.target.value as DelegatedWorkItem['status'];
                                  if (newStat === 'Completed' && onOpenCompleteTaskModal) {
                                    onOpenCompleteTaskModal(task, job);
                                  } else if (onUpdateTaskStatus) {
                                    onUpdateTaskStatus(job.id, task.id, newStat);
                                  }
                                }}
                                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none transition shadow-2xs ${
                                  task.status === 'Completed' || task.status === 'Under Review'
                                    ? isApproved
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                    : task.status === 'Revision Requested'
                                    ? 'bg-orange-50 text-orange-800 border-orange-300'
                                    : task.status === 'In Progress'
                                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Revision Requested">Revision Requested</option>
                                <option value="Completed">
                                  {isApproved
                                    ? `✓ Approved by ${task.reviewedBy || delegatorName}`
                                    : `Sent back to ${delegatorName} for Review`}
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Version History & Snapshots Timeline Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4.5 h-4.5 text-blue-600" />
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                        Version Snapshots Timeline ({ (job.version_snapshots || []).length })
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Checkpoint floor plan comments and phase statuses across drawing iterations.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSnapshotModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Capture Snapshot</span>
                  </button>
                </div>

                {(!job.version_snapshots || job.version_snapshots.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No version snapshots saved yet. Click "Capture Snapshot" to freeze a checkpoint of floor plan markup notes & phase status.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {job.version_snapshots.map((snap) => {
                      const isSelected = selectedSnapshotId === snap.id;
                      return (
                        <div
                          key={snap.id}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                            isSelected ? 'bg-amber-50 border-amber-300 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-xs text-slate-900">{snap.versionLabel}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                                {snap.phase}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {snap.comments.length} Markup Notes
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              {snap.note || 'No notes provided.'}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                              Saved by {snap.createdByName} on {new Date(snap.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isSelected ? (
                              <span className="bg-amber-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase">
                                Active View
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedSnapshotId(snap.id);
                                  setActiveTab('canvas');
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1 rounded-lg transition"
                              >
                                Preview Canvas
                              </button>
                            )}
                            <button
                              onClick={() => handleRestoreSnapshot(snap)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1 rounded-lg transition"
                              title="Restore comments and status from this snapshot"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteSnapshot(snap.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition"
                              title="Delete snapshot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: BLUEPRINT VIEWER */}
          {activeTab === 'canvas' && (
            <div className="space-y-3">
              {activeSnapshot && (
                <div className="bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2 rounded-xl text-xs flex items-center justify-between">
                  <span>
                    📜 Showing CAD Plan Markup pins from Snapshot: <strong>{activeSnapshot.versionLabel}</strong> ({activeSnapshot.comments.length} notes)
                  </span>
                  <button
                    onClick={() => setSelectedSnapshotId('live')}
                    className="font-bold text-amber-900 underline hover:text-amber-950"
                  >
                    Switch to Live Canvas
                  </button>
                </div>
              )}
              <BlueprintCanvas job={displayedJob} />
            </div>
          )}

          {/* TAB 3: DELIVERABLE SHEETS & ATTACHMENTS */}
          {activeTab === 'deliverables' && (
            <div className="space-y-6">
              
              {/* File Upload Form */}
              <form onSubmit={handleUploadDeliverable} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2 font-mono">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Attach Image, CAD Drawing, or Deliverable Sheet</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    All attached files & notes will be viewable on Client Portal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sheet / File Title *</label>
                    <input
                      type="text"
                      value={fileTitle}
                      onChange={(e) => setFileTitle(e.target.value)}
                      placeholder="e.g. Front & Rear 3D Concept Elevation"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
                    <select
                      value={fileCategory}
                      onChange={(e) => setFileCategory(e.target.value as DeliverableFile['category'])}
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Floor Plan">Floor Plan</option>
                      <option value="Exterior Elevations">Exterior Elevations</option>
                      <option value="Foundation Plan">Foundation Plan</option>
                      <option value="Electrical & Reflected Ceiling">Electrical & Ceiling</option>
                      <option value="3D Render">3D Render</option>
                      <option value="PDF Specs">PDF Specs</option>
                      <option value="CAD / DWG File">CAD / DWG File</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Version Tag</label>
                    <input
                      type="text"
                      value={fileVersion}
                      onChange={(e) => setFileVersion(e.target.value)}
                      placeholder="Version (e.g. v1.2)"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* File Attachment Picker & Preset Quick Buttons */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500">Attach Image File / CAD Asset</label>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <label className="cursor-pointer bg-white border border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50/50 p-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs text-blue-700 font-semibold shadow-2xs shrink-0">
                      <Paperclip className="w-4 h-4 text-blue-600" />
                      <span>Choose File from Computer...</span>
                      <input
                        type="file"
                        accept="image/*,.pdf,.dwg,.dxf"
                        onChange={handleDeliverableFileSelect}
                        className="hidden"
                      />
                    </label>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase px-1">Quick Sample:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFileUrl('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80');
                          setAttachedFileName('Modern_Farmhouse_3D_Render.jpg');
                          if (!fileTitle) setFileTitle('Modern Farmhouse 3D Perspective Render');
                          setFileCategory('3D Render');
                        }}
                        className="bg-white hover:bg-slate-200 text-slate-800 px-2 py-1 rounded border border-slate-300 transition font-medium text-[11px]"
                      >
                        🏡 3D Render
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFileUrl('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80');
                          setAttachedFileName('Floorplan_CAD_Drawing_Main.png');
                          if (!fileTitle) setFileTitle('Main Floor CAD Layout & Dimensions');
                          setFileCategory('Floor Plan');
                        }}
                        className="bg-white hover:bg-slate-200 text-slate-800 px-2 py-1 rounded border border-slate-300 transition font-medium text-[11px]"
                      >
                        📐 CAD Floorplan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFileUrl('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80');
                          setAttachedFileName('Front_Elevation_Concept.jpg');
                          if (!fileTitle) setFileTitle('Front Exterior Architectural Elevation');
                          setFileCategory('Exterior Elevations');
                        }}
                        className="bg-white hover:bg-slate-200 text-slate-800 px-2 py-1 rounded border border-slate-300 transition font-medium text-[11px]"
                      >
                        🏛️ Front Elevation
                      </button>
                    </div>
                  </div>

                  {/* Attached File Preview Bar */}
                  {attachedFileUrl && (
                    <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img src={attachedFileUrl} alt="Attached Preview" className="w-10 h-10 object-cover rounded-lg border border-blue-300 shrink-0" />
                        <div className="truncate">
                          <p className="font-bold text-blue-950 truncate">{attachedFileName || 'Image Attached'}</p>
                          <p className="text-[10px] text-blue-700">Ready to publish to client view</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFileUrl('');
                          setAttachedFileName('');
                        }}
                        className="text-slate-400 hover:text-red-600 transition p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Drafter Revision & Change Notes */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-blue-600" />
                    <span>Drafter Revision Notes / Rendering Changes (Visible to Client)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={fileChangeNotes}
                    onChange={(e) => setFileChangeNotes(e.target.value)}
                    placeholder="Provide notes for the client regarding changes to prior rendering or plan specs (e.g. 'Updated master bedroom window to 6ft egress style, raised ceiling height to 9ft, adjusted porch gable pitch per review')."
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Publish Deliverable & Notify Client</span>
                  </button>
                </div>
              </form>

              {/* Published Deliverables & CAD Renders Cards */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 font-mono">
                    Published Deliverables & Renderings ({job.deliverables.length})
                  </h4>
                </div>

                {job.deliverables.map(file => (
                  <div key={file.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-100 text-blue-800 font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-blue-200">
                          {file.category}
                        </span>
                        <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded">
                          {file.version}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{file.title}</h4>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>Uploaded {new Date(file.uploadedAt).toLocaleDateString()}</span>
                        <span>• {file.fileSize}</span>
                        <button
                          onClick={() => handleDeleteDeliverable(file.id)}
                          className="text-slate-400 hover:text-red-600 transition p-1 ml-2"
                          title="Delete deliverable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Preview Thumbnail & Drafter Change Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* Left: File / Image Preview Thumbnail */}
                      <div className="md:col-span-5 relative group bg-slate-900 rounded-xl overflow-hidden border border-slate-200 aspect-video flex items-center justify-center">
                        {file.fileUrl ? (
                          <>
                            <img src={file.fileUrl} alt={file.title} className="w-full h-full object-cover transition duration-200 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                              <button
                                onClick={() => setPreviewModalFile(file)}
                                className="bg-white/90 hover:bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-md flex items-center gap-1.5"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>Expand Image</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-6 text-center text-slate-400">
                            <FileText className="w-8 h-8 mx-auto mb-1 text-slate-500" />
                            <p className="text-xs font-medium text-slate-300">{file.fileName || 'CAD Specification Sheet'}</p>
                          </div>
                        )}
                      </div>

                      {/* Right: Notes & Actions */}
                      <div className="md:col-span-7 space-y-3">
                        {/* Drafter Notes Box */}
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>Drafter Revision & Rendering Notes:</span>
                          </p>
                          <p className="text-xs text-slate-800 leading-relaxed font-medium">
                            {file.changeNotes ? file.changeNotes : 'No specific change notes indicated for this version.'}
                          </p>
                          {file.authorDrafter && (
                            <p className="text-[10px] text-slate-400 font-mono pt-1">
                              — Notes left by {file.authorDrafter}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          {file.fileUrl && (
                            <button
                              onClick={() => setPreviewModalFile(file)}
                              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1.5"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>View Full Resolution</span>
                            </button>
                          )}
                          <a
                            href={file.fileUrl || '#'}
                            download={file.fileName || `${file.title}.jpg`}
                            onClick={(e) => {
                              if (!file.fileUrl) {
                                e.preventDefault();
                                alert(`Downloading CAD Spec file (${file.version})...`);
                              }
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition border border-blue-200 flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Asset</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {job.deliverables.length === 0 && (
                  <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No deliverable sheets or renderings attached yet.</p>
                    <p className="text-[11px] text-slate-500">Use the form above to attach drawings, 3D renders, or CAD files with revision notes for the client.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: COMMENTS & DISCUSSION */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {activeSnapshot && (
                <div className="bg-amber-100 border border-amber-300 text-amber-900 p-3 rounded-xl text-xs flex items-center justify-between">
                  <span>
                    📜 Displaying <strong>{activeSnapshot.comments.length}</strong> floor plan notes captured in Snapshot: <strong>{activeSnapshot.versionLabel}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedSnapshotId('live')}
                    className="font-bold underline text-amber-950"
                  >
                    View Live Discussion
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {displayedJob.comments.map(c => {
                  const isRoadblockFlag = c.text.includes('ROADBLOCK FLAGGED') || c.text.includes('ROADBLOCK ACTIVATED') || c.text.startsWith('🚨');
                  const isRoadblockResolved = c.text.includes('ROADBLOCK RESOLVED') || c.text.startsWith('✅ ROADBLOCK');

                  return (
                    <div
                      key={c.id}
                      className={`p-3.5 rounded-xl border text-xs shadow-2xs transition space-y-2 ${
                        isRoadblockFlag
                          ? 'bg-red-50/90 border-red-300 text-red-950'
                          : isRoadblockResolved
                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex justify-between font-bold">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span>{c.author}</span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded uppercase ${
                            isRoadblockFlag
                              ? 'bg-red-200 text-red-900 font-bold'
                              : isRoadblockResolved
                              ? 'bg-emerald-200 text-emerald-900 font-bold'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {c.role}
                          </span>

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

                          {c.pinnedLocation && (
                            <span className="bg-blue-100 text-blue-800 font-mono text-[10px] px-1.5 py-0.2 rounded font-bold">
                              📍 CAD Pin ({c.pinnedLocation.x.toFixed(0)}%, {c.pinnedLocation.y.toFixed(0)}%)
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{new Date(c.timestamp).toLocaleString()}</span>
                      </div>

                      <p className={`whitespace-pre-wrap ${
                        isRoadblockFlag ? 'font-medium text-red-900' : isRoadblockResolved ? 'font-medium text-emerald-900' : 'text-slate-700'
                      }`}>
                        {c.text}
                      </p>

                      {/* Attached Image / File Preview inside comment */}
                      {c.attachmentUrl && (
                        <div className="mt-2 bg-white/80 p-2 rounded-xl border border-slate-200 max-w-sm">
                          <img
                            src={c.attachmentUrl}
                            alt="Comment Attachment"
                            className="w-full max-h-48 object-cover rounded-lg border border-slate-200"
                          />
                          {c.attachmentName && (
                            <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                              📎 {c.attachmentName}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedSnapshotId === 'live' && (
                <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-slate-200">
                  {commentAttachmentUrl && (
                    <div className="bg-blue-50 border border-blue-200 p-2 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <img src={commentAttachmentUrl} alt="Attached" className="w-8 h-8 object-cover rounded" />
                        <span className="font-semibold text-blue-900 truncate">{commentAttachmentName || 'Attached Image'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCommentAttachmentUrl('');
                          setCommentAttachmentName('');
                        }}
                        className="text-slate-400 hover:text-red-600 transition p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 items-center">
                    <label className="cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition shrink-0" title="Attach Image or CAD snippet">
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCommentFileSelect}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="text"
                      value={newCommentInput}
                      onChange={(e) => setNewCommentInput(e.target.value)}
                      placeholder="Add drafter note, CAD explanation, or reply..."
                      className="flex-1 border border-slate-300 bg-slate-50 rounded-lg p-2 text-xs"
                    />

                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shrink-0">
                      Send Note
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB: TIME & INVOICING */}
          {activeTab === 'time' && (
            <div className="space-y-6">
              
              {/* Overview Metric Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Total Logged Time</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {formatSecondsToReadable(calculateJobTotalSeconds(job, nowTimestamp))}
                  </span>
                </div>

                {canAccessFinancials ? (
                  <>
                    <div className="bg-emerald-900 text-white p-4 rounded-xl border border-emerald-800">
                      <span className="text-[10px] font-mono uppercase text-emerald-200 block font-semibold">Total Billable Amount</span>
                      <span className="text-xl font-bold font-mono text-white">
                        ${calculateJobBillableAmount(job, nowTimestamp).toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Invoicing Rate</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold">$</span>
                        <input
                          type="number"
                          value={hourlyRateInput}
                          onChange={(e) => handleUpdateHourlyRate(parseFloat(e.target.value) || 0)}
                          className="w-20 font-mono font-bold text-sm bg-slate-50 border border-slate-300 rounded p-1 text-slate-900"
                        />
                        <span className="text-xs text-slate-500 font-medium">/ hour</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Total Sessions Logged</span>
                      <span className="text-xl font-bold font-mono text-white">
                        {(job.time_logs || []).length} drafting records
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-2 text-slate-500">
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs">Client billing rates & dollar valuations are restricted to Project Admin.</span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Controls & Invoice Export Button */}
              {canAccessFinancials && (
                <div className="space-y-4">
                  {/* Invoice Status & Auto-Archive Control */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                          Invoice & Archive Status
                        </h4>
                        {isJobArchived(job) && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                            <Archive className="w-3 h-3 text-emerald-600" />
                            <span>Paid & Archived</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Setting invoice status to <strong>"Paid"</strong> automatically archives the project, removes it from active drafter boards, and keeps it searchable by Kyle, Jason, Drew, and Ethan for notes.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <select
                        value={job.invoice_status || 'Uninvoiced'}
                        onChange={(e) => {
                          const newStatus = e.target.value as Job['invoice_status'];
                          const isPaid = newStatus === 'Paid';
                          const updated: Job = {
                            ...job,
                            invoice_status: newStatus,
                            is_archived: isPaid,
                            archived_at: isPaid ? (job.archived_at || new Date().toISOString()) : undefined,
                            archived_by: isPaid ? (job.archived_by || currentStaff?.name || 'Operations') : undefined,
                            audit_logs: [
                              {
                                id: `a-${Date.now()}`,
                                action: isPaid ? 'Project Paid & Archived' : 'Invoice Status Updated',
                                performedBy: currentStaff?.name || 'Admin',
                                timestamp: new Date().toISOString(),
                                details: isPaid
                                  ? `Marked as Paid. Project archived and removed from active drafter boards. Retrievable via search by Kyle, Jason, Drew, and Ethan.`
                                  : `Changed invoice status to "${newStatus}"`
                              },
                              ...job.audit_logs
                            ]
                          };
                          onUpdateJob(updated);
                        }}
                        className="w-full sm:w-auto bg-slate-50 border border-slate-300 font-mono font-bold text-xs rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="Uninvoiced">Uninvoiced</option>
                        <option value="Pending Invoicing">Pending Invoicing</option>
                        <option value="Invoiced">Invoiced</option>
                        <option value="Paid">Paid (Auto-Archive)</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                        <span>Invoicing Team Report</span>
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Generate an itemized CSV breakdown of all drafting hours for this specific job.
                      </p>
                    </div>

                    <button
                      onClick={() => exportInvoicingCSV([job], job.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Job Invoice CSV</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Live Timer Controls for this Job */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center justify-between">
                  <span>Live Timer Control</span>
                  {job.active_timer_start && (
                    <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-mono animate-pulse">
                      SESSION IN PROGRESS
                    </span>
                  )}
                </h4>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Current Active Task:</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {job.active_timer_task || 'CAD Drafting & Revision Work'}
                    </span>
                  </div>

                  {job.active_timer_start ? (
                    <button
                      onClick={() => onStopTimer && onStopTimer(job.id)}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Stop & Save Session</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onStartTimer && onStartTimer(job.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Start Live Timer</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Add Manual Time Log Entry Form */}
              <form onSubmit={handleAddManualTimeLog} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Add Manual Time Entry (Offline Drafting / Consult)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={manualTaskInput}
                    onChange={(e) => setManualTaskInput(e.target.value)}
                    placeholder="Task Description (e.g. Redline revisions)"
                    className="bg-white border p-2 rounded text-xs sm:col-span-2"
                    required
                  />

                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={manualHoursInput}
                    onChange={(e) => setManualHoursInput(e.target.value)}
                    placeholder="Hours (e.g. 1.5)"
                    className="bg-white border p-2 rounded text-xs font-mono font-bold"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition"
                >
                  + Add Manual Time Log
                </button>
              </form>

              {/* Complete Time Log Session History Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex justify-between items-center">
                  <span>Logged Time Sessions ({ (job.time_logs || []).length })</span>
                  {canAccessFinancials ? (
                    <span className="text-[10px] text-slate-400 font-mono">Drafter Rate: ${job.hourly_rate || 85}/hr</span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono">CAD Session Logs</span>
                  )}
                </div>

                {(!job.time_logs || job.time_logs.length === 0) ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    No completed time sessions logged for this job yet.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 uppercase text-[10px] font-mono text-slate-400 border-b">
                      <tr>
                        <th className="p-3">Drafter</th>
                        <th className="p-3">Task Description</th>
                        <th className="p-3">Logged Date</th>
                        <th className="p-3">Duration</th>
                        {canAccessFinancials && <th className="p-3 text-right">Billable Amount</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {job.time_logs.map((log) => {
                        const rate = log.hourlyRate || job.hourly_rate || 85;
                        const billableSession = (log.durationSeconds / 3600) * rate;

                        return (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800">{log.drafterName}</td>
                            <td className="p-3 text-slate-700">{log.taskDescription || 'CAD Drafting'}</td>
                            <td className="p-3 text-slate-500 text-[11px]">
                              {new Date(log.startTime).toLocaleDateString()} {new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-800">
                              {formatSecondsToReadable(log.durationSeconds)}
                            </td>
                            {canAccessFinancials && (
                              <td className="p-3 font-mono font-bold text-emerald-700 text-right">
                                ${billableSession.toFixed(2)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-2 font-mono text-xs">
              {job.audit_logs.map(log => (
                <div key={log.id} className="bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-blue-400 font-bold mb-1">
                    <span>{log.action}</span>
                    <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300">{log.details}</p>
                  <p className="text-[10px] text-slate-500 mt-1">By: {log.performedBy}</p>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Modal Footer Bar */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 text-white text-xs font-semibold px-5 py-2 rounded-xl"
          >
            Done / Close Workspace
          </button>
        </div>

      </div>

      {/* Save Version Snapshot Popup Dialog */}
      {isSnapshotModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Save Version Snapshot Checkpoint</h3>
              </div>
              <button
                onClick={() => setIsSnapshotModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSnapshot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Version Label / Revision Name
                </label>
                <input
                  type="text"
                  value={snapshotLabelInput}
                  onChange={(e) => setSnapshotLabelInput(e.target.value)}
                  placeholder={`v1.${(job.version_snapshots || []).length + 1} - ${job.current_status}`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-semibold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Revision Summary / Internal Note
                </label>
                <textarea
                  value={snapshotNoteInput}
                  onChange={(e) => setSnapshotNoteInput(e.target.value)}
                  placeholder="Describe floor plan adjustments, builder notes, or customer revision requests..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 h-20 resize-none"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span>📸 Snapshot Payload</span>
                </p>
                <ul className="list-disc list-inside text-blue-800 text-[11px] font-mono space-y-0.5">
                  <li>Phase: <strong>{job.current_status}</strong></li>
                  <li><strong>{job.comments.length}</strong> CAD pin markups & discussion notes</li>
                  <li>Author: <strong>{job.assigned_drafter.split(',')[0]}</strong></li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-2xs transition"
                >
                  Save Version Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: RESOLVE ROADBLOCK POPUP */}
      {showResolveRoadblockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Resolve Roadblock</h3>
              </div>
              <button
                onClick={() => setShowResolveRoadblockModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {job.roadblock_note && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs space-y-1">
                <span className="font-bold text-red-900 block font-mono text-[10px] uppercase">Active Roadblock Issue:</span>
                <p className="text-red-800 font-medium italic">"{job.roadblock_note}"</p>
              </div>
            )}

            <form onSubmit={handleConfirmResolveRoadblock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  How was this roadblock resolved? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={roadblockResolutionInput}
                  onChange={(e) => {
                    setRoadblockResolutionInput(e.target.value);
                    if (e.target.value.trim()) setRoadblockResolveError('');
                  }}
                  placeholder="Explain resolution details (e.g. County surveyor delivered approved septic drain field map, customer confirmed 15ft rear setback)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 h-28 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                {roadblockResolveError && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{roadblockResolveError}</span>
                  </p>
                )}
                <p className="text-[10px] text-slate-500 mt-1">
                  This comment will be permanently recorded under <strong>Messages & Notes</strong> and emailed to the client.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResolveRoadblockModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!roadblockResolutionInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Resolve Roadblock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden text-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800 mr-2">
                  {previewModalFile.category} ({previewModalFile.version})
                </span>
                <span className="font-bold text-sm text-white">{previewModalFile.title}</span>
              </div>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-black/40 min-h-[300px]">
              {previewModalFile.fileUrl ? (
                <img
                  src={previewModalFile.fileUrl}
                  alt={previewModalFile.title}
                  className="max-h-[60vh] object-contain rounded-lg border border-slate-800 shadow-xl"
                />
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-slate-500" />
                  <p className="text-sm font-semibold">{previewModalFile.fileName || 'CAD Drawing File'}</p>
                </div>
              )}

              {previewModalFile.changeNotes && (
                <div className="mt-4 bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs w-full text-slate-200">
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Drafter Notes & Rendering Changes:</span>
                  </p>
                  <p className="leading-relaxed font-medium">{previewModalFile.changeNotes}</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <a
                href={previewModalFile.fileUrl || '#'}
                download={previewModalFile.fileName || `${previewModalFile.title}.jpg`}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download High-Res Original</span>
              </a>
              <button
                onClick={() => setPreviewModalFile(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-2 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Revision Modal */}
      {revisionModalTask && (
        <RequestRevisionModal
          isOpen={Boolean(revisionModalTask)}
          task={revisionModalTask}
          job={job}
          currentStaff={currentStaff || { id: 's2', name: 'Kyle', role: 'manager', email: 'kyle@myplanstore.com' }}
          onClose={() => setRevisionModalTask(null)}
          onSubmitRevision={(jobId, taskId, feedbackNotes) => {
            if (onRequestTaskRevision) {
              onRequestTaskRevision(jobId, taskId, feedbackNotes);
            }
            setRevisionModalTask(null);
          }}
        />
      )}
    </div>
  );
};
