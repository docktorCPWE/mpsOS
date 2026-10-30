import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, CheckCircle2, Clock, FileText, Send, Plus, Trash2, Mail, ShieldAlert, Layers, User, Phone, MapPin, DollarSign, Calendar, RefreshCw, Play, Square, Download, FileSpreadsheet, History, Image, Upload, Paperclip, Sparkles, Maximize2, ExternalLink, FileCode, Edit3, Share2, ListTodo, Lock, RotateCcw, CheckCircle, Archive, Coffee, Receipt, AtSign, Reply, Bell, Users, CornerDownRight, MessageSquare, ChevronDown, Check, Tag, Building, Eye } from 'lucide-react';
import { Job, JobPhase, DeliverableFile, EmailTemplate, TimeLog, JobVersionSnapshot, JobComment, DelegatedWorkItem, StaffUser, AdditionalBillingCategory, InvoiceStatus, AppNotification } from '../types';
import { BlueprintCanvas } from './BlueprintCanvas';
import { calculateJobTotalSeconds, calculateJobBillableAmount, calculateAdditionalBillableHours, calculateJobDepositAmount, calculateJobNetInvoiceAmount, formatSecondsToReadable, formatSecondsToHHMMSS, exportInvoicingCSV, calculateDelegatedTaskWorkedSeconds } from '../utils/timeUtils';
import { RequestRevisionModal } from './RequestRevisionModal';
import { isJobArchived, STAFF_USERS } from '../data/mockData';
import { applyInvoiceStatusTransition, isJasonApproved, canUserApproveAsJason, canGenerateInvoice } from '../utils/invoiceWorkflow';
import { OfficialInvoiceModal } from './OfficialInvoiceModal';
import { deleteFileFromJobInFirestore } from '../services/firebase';
import { downloadFileFromUrl, createBlobUrlFromDataUrl, openFileInNewTab } from '../utils/attachmentUtils';
import { UniversalFileViewerModal } from './UniversalFileViewerModal';

interface FileToDeleteInfo {
  type: 'task_attachment' | 'deliverable';
  taskId?: string;
  taskTitle?: string;
  fileId: string;
  fileName: string;
  fileSize?: string;
}

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onUpdateJob: (updatedJob: Job) => void;
  onDispatchNotifications?: (notifs: AppNotification[]) => void;
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
  staffList?: StaffUser[];
  initialTab?: 'overview' | 'canvas' | 'deliverables' | 'comments' | 'audit' | 'time';
  initialHighlightCommentId?: string;
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

const JobDetailModalContent: React.FC<JobDetailModalProps & { job: Job }> = ({
  job,
  onClose,
  onUpdateJob,
  onDispatchNotifications,
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
  staffList = [],
  initialTab = 'overview',
  initialHighlightCommentId,
  nowTimestamp,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'canvas' | 'deliverables' | 'comments' | 'audit' | 'time'>(initialTab);
  const [roadblockNoteInput, setRoadblockNoteInput] = useState(job.roadblock_note || '');
  const [newCommentInput, setNewCommentInput] = useState('');
  const [notesFilter, setNotesFilter] = useState<'job_notes' | 'all'>('job_notes');

  // Helper to determine if a comment is an automated duplicate of an audit log entry
  const isAuditLogDuplicate = (c: JobComment) => {
    return (
      c.text.includes('⏱️ Drafting Session Completed') ||
      c.text.includes('⏱️ Drafting Time Logged') ||
      c.text.startsWith('⏱️') ||
      c.text.includes('ROADBLOCK FLAGGED') ||
      c.text.includes('ROADBLOCK ACTIVATED') ||
      c.text.startsWith('🚨') ||
      c.text.includes('ROADBLOCK RESOLVED') ||
      c.text.startsWith('✅ ROADBLOCK') ||
      c.text.startsWith('Revision Requested (#')
    );
  };

  // Tagging & Mentions State
  const [selectedTaggedStaff, setSelectedTaggedStaff] = useState<StaffUser[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<JobComment | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(initialHighlightCommentId || null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState<number | null>(null);

  const availableStaff = staffList && staffList.length > 0 ? staffList : STAFF_USERS;
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentListEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted comment if opened from notification
  useEffect(() => {
    if (initialHighlightCommentId) {
      setHighlightedCommentId(initialHighlightCommentId);
      setActiveTab('comments');
      const timer = setTimeout(() => {
        const el = document.getElementById(`comment-${initialHighlightCommentId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [initialHighlightCommentId]);

  // Resolve Roadblock Modal State
  const [showResolveRoadblockModal, setShowResolveRoadblockModal] = useState(false);
  const [roadblockResolutionInput, setRoadblockResolutionInput] = useState('');
  const [roadblockResolveError, setRoadblockResolveError] = useState('');
  
  // Delegated Task Revision Modal State
  const [revisionModalTask, setRevisionModalTask] = useState<DelegatedWorkItem | null>(null);

  // File Deletion State (Permanent removal from local state & Firestore database)
  const [fileToDelete, setFileToDelete] = useState<FileToDeleteInfo | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [deleteFileFeedback, setDeleteFileFeedback] = useState<string | null>(null);

  // Delegated Task Date & Time Editing States & Handlers
  const [editingCompletionTaskId, setEditingCompletionTaskId] = useState<string | null>(null);
  const [editingDelegatedTaskId, setEditingDelegatedTaskId] = useState<string | null>(null);
  const [editingTaskTimeId, setEditingTaskTimeId] = useState<string | null>(null);
  const [taskHoursInput, setTaskHoursInput] = useState<string>('');
  const [taskMinutesInput, setTaskMinutesInput] = useState<string>('');

  const handleMarkTaskCompleteWithDate = (taskId: string, completedDateIso?: string) => {
    if (!job || !job.delegated_tasks) return;
    const nowIso = completedDateIso || new Date().toISOString();
    
    // Check if active timer was running on this task
    let timerElapsedSec = 0;
    if (job.active_timer_start && (job.active_timer_delegated_task_id === taskId || (job.active_timer_task && job.active_timer_task.toLowerCase().includes(taskId.toLowerCase())))) {
      timerElapsedSec = Math.max(0, Math.floor((Date.now() - new Date(job.active_timer_start).getTime()) / 1000));
    }

    const updatedTasks = job.delegated_tasks.map(t => {
      if (t.id === taskId) {
        const curWorked = t.workedSeconds || 0;
        let taskTimerSec = 0;
        if (t.activeTimerStart) {
          taskTimerSec = Math.max(0, Math.floor((Date.now() - new Date(t.activeTimerStart).getTime()) / 1000));
        }
        return {
          ...t,
          status: 'Completed' as const,
          completedAt: nowIso,
          completedBy: t.completedBy || currentStaff?.name || 'Staff User',
          workedSeconds: curWorked + timerElapsedSec + taskTimerSec,
          activeTimerStart: undefined,
          activeTimerDrafterName: undefined
        };
      }
      return t;
    });

    const shouldStopJobTimer = Boolean(job.active_timer_delegated_task_id === taskId);

    const updatedJob: Job = {
      ...job,
      active_timer_start: shouldStopJobTimer ? undefined : job.active_timer_start,
      active_timer_task: shouldStopJobTimer ? undefined : job.active_timer_task,
      active_timer_delegated_task_id: shouldStopJobTimer ? undefined : job.active_timer_delegated_task_id,
      delegated_tasks: updatedTasks,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Task Marked Completed',
          details: `Task completed on ${new Date(nowIso).toLocaleDateString()} by ${currentStaff?.name || 'Staff User'}`,
          timestamp: new Date().toISOString(),
          drafter_name: currentStaff?.name || 'Staff User'
        },
        ...(job.audit_logs || [])
      ]
    };

    onUpdateJob(updatedJob);
    if (onUpdateTaskStatus) {
      onUpdateTaskStatus(job.id, taskId, 'Completed');
    }
  };

  const handleUpdateTaskCompletionDate = (taskId: string, newDateStr: string) => {
    if (!job || !job.delegated_tasks || !newDateStr) return;
    const isoDate = new Date(newDateStr + 'T12:00:00').toISOString();
    const updatedTasks = job.delegated_tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          completedAt: isoDate,
          status: t.status === 'Completed' || t.status === 'Under Review' ? t.status : 'Completed'
        };
      }
      return t;
    });

    const updatedJob: Job = {
      ...job,
      delegated_tasks: updatedTasks,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Task Completion Date Updated',
          details: `Completion date changed to ${new Date(isoDate).toLocaleDateString()} by ${currentStaff?.name || 'Staff User'}`,
          timestamp: new Date().toISOString(),
          drafter_name: currentStaff?.name || 'Staff User'
        },
        ...(job.audit_logs || [])
      ]
    };

    onUpdateJob(updatedJob);
  };

  const handleUpdateTaskDelegatedDate = (taskId: string, newDateStr: string) => {
    if (!job || !job.delegated_tasks || !newDateStr) return;
    const isoDate = new Date(newDateStr + 'T12:00:00').toISOString();
    const updatedTasks = job.delegated_tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          delegatedAt: isoDate
        };
      }
      return t;
    });

    const updatedJob: Job = {
      ...job,
      delegated_tasks: updatedTasks,
    };

    onUpdateJob(updatedJob);
  };

  const handleSaveTaskTime = (taskId: string, hours: number, minutes: number) => {
    if (!job || !job.delegated_tasks) return;
    const totalSec = Math.max(0, Math.round(hours * 3600 + minutes * 60));
    const targetTask = job.delegated_tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const updatedTasks = job.delegated_tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          workedSeconds: totalSec
        };
      }
      return t;
    });

    // Check if we need to add or update TimeLog for billing/reporting
    let updatedLogs = [...(job.time_logs || [])];
    const existingLogIdx = updatedLogs.findIndex(tl => tl.delegatedTaskId === taskId);
    const drafterName = targetTask.assignedTo || currentStaff?.name || 'Drafter';

    if (existingLogIdx >= 0) {
      updatedLogs[existingLogIdx] = {
        ...updatedLogs[existingLogIdx],
        durationSeconds: totalSec,
        billableHours: Number((totalSec / 3600).toFixed(2)),
        billableAmount: Math.round((totalSec / 3600) * (job.hourly_rate || 85))
      };
    } else if (totalSec > 0) {
      updatedLogs.push({
        id: `tl-task-${Date.now()}`,
        drafterName,
        startTime: targetTask.delegatedAt || new Date().toISOString(),
        endTime: targetTask.completedAt || new Date().toISOString(),
        durationSeconds: totalSec,
        taskDescription: `Task: ${targetTask.componentTitle}`,
        hourlyRate: job.hourly_rate || 85,
        billableHours: Number((totalSec / 3600).toFixed(2)),
        billableAmount: Math.round((totalSec / 3600) * (job.hourly_rate || 85)),
        delegatedTaskId: taskId,
        delegatedTaskTitle: targetTask.componentTitle
      });
    }

    const totalDurationSec = updatedLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);

    const updatedJob: Job = {
      ...job,
      delegated_tasks: updatedTasks,
      time_logs: updatedLogs,
      total_time_entries: updatedLogs.length,
      total_duration_minutes: Math.round(totalDurationSec / 60),
      total_duration_hours: Number((totalDurationSec / 3600).toFixed(2)),
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Task Time Updated',
          details: `Updated worked time for "${targetTask.componentTitle}" to ${formatSecondsToReadable(totalSec)} by ${currentStaff?.name || 'Staff User'}`,
          timestamp: new Date().toISOString(),
          drafter_name: currentStaff?.name || 'Staff User'
        },
        ...(job.audit_logs || [])
      ]
    };

    onUpdateJob(updatedJob);
    setEditingTaskTimeId(null);
  };

  const handleToggleTaskTimer = (task: DelegatedWorkItem) => {
    if (!job) return;
    const isTaskRunning = Boolean(
      task.activeTimerStart ||
      (job.active_timer_start && (job.active_timer_delegated_task_id === task.id || (job.active_timer_task && job.active_timer_task.toLowerCase().includes(task.componentTitle.toLowerCase()))))
    );

    if (isTaskRunning) {
      // Stop timer for this task
      let elapsedSeconds = 0;
      if (task.activeTimerStart) {
        elapsedSeconds = Math.max(1, Math.floor((Date.now() - new Date(task.activeTimerStart).getTime()) / 1000));
      } else if (job.active_timer_start) {
        elapsedSeconds = Math.max(1, Math.floor((Date.now() - new Date(job.active_timer_start).getTime()) / 1000));
      }

      const curWorked = task.workedSeconds || 0;
      const newWorked = curWorked + elapsedSeconds;

      const newLog: TimeLog = {
        id: `tl-task-${Date.now()}`,
        drafterName: currentStaff?.name || task.assignedTo || 'Drafter',
        startTime: task.activeTimerStart || job.active_timer_start || new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: elapsedSeconds,
        taskDescription: `Worked on task: ${task.componentTitle}`,
        hourlyRate: job.hourly_rate || 85,
        delegatedTaskId: task.id,
        delegatedTaskTitle: task.componentTitle
      };

      const updatedTasks = (job.delegated_tasks || []).map(t => {
        if (t.id === task.id) {
          return {
            ...t,
            activeTimerStart: undefined,
            activeTimerDrafterName: undefined,
            workedSeconds: newWorked
          };
        }
        return t;
      });

      const updatedLogs = [...(job.time_logs || []), newLog];
      const totalDurationSec = updatedLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);

      const updatedJob: Job = {
        ...job,
        active_timer_start: job.active_timer_delegated_task_id === task.id ? undefined : job.active_timer_start,
        active_timer_task: job.active_timer_delegated_task_id === task.id ? undefined : job.active_timer_task,
        active_timer_delegated_task_id: job.active_timer_delegated_task_id === task.id ? undefined : job.active_timer_delegated_task_id,
        delegated_tasks: updatedTasks,
        time_logs: updatedLogs,
        total_time_entries: updatedLogs.length,
        total_duration_minutes: Math.round(totalDurationSec / 60),
        total_duration_hours: Number((totalDurationSec / 3600).toFixed(2)),
        audit_logs: [
          {
            id: `a-${Date.now()}`,
            action: 'Task Timer Stopped',
            details: `Logged ${formatSecondsToReadable(elapsedSeconds)} for "${task.componentTitle}"`,
            timestamp: new Date().toISOString(),
            drafter_name: currentStaff?.name || 'Staff User'
          },
          ...(job.audit_logs || [])
        ]
      };

      onUpdateJob(updatedJob);
    } else {
      // Start timer on this task
      const startIso = new Date().toISOString();
      const updatedTasks = (job.delegated_tasks || []).map(t => {
        if (t.id === task.id) {
          return {
            ...t,
            status: t.status === 'Completed' ? t.status : ('In Progress' as const),
            activeTimerStart: startIso,
            activeTimerDrafterName: currentStaff?.name || 'Drafter'
          };
        }
        return t;
      });

      const updatedJob: Job = {
        ...job,
        active_timer_start: startIso,
        active_timer_task: `Task: ${task.componentTitle}`,
        active_timer_drafter_id: currentStaff?.id,
        active_timer_drafter_name: currentStaff?.name || 'Drafter',
        active_timer_delegated_task_id: task.id,
        delegated_tasks: updatedTasks,
        audit_logs: [
          {
            id: `a-${Date.now()}`,
            action: 'Task Timer Started',
            details: `Started drafting timer for delegated task "${task.componentTitle}"`,
            timestamp: startIso,
            drafter_name: currentStaff?.name || 'Staff User'
          },
          ...(job.audit_logs || [])
        ]
      };

      onUpdateJob(updatedJob);
    }
  };

  // Official Invoice Generator Modal State
  const [isOfficialInvoiceModalOpen, setIsOfficialInvoiceModalOpen] = useState(false);

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
  const [previewModalBlobUrl, setPreviewModalBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (previewModalFile?.fileUrl) {
      const res = createBlobUrlFromDataUrl(previewModalFile.fileUrl);
      if (res) {
        setPreviewModalBlobUrl(res.blobUrl);
        return () => res.revoke();
      } else {
        setPreviewModalBlobUrl(previewModalFile.fileUrl);
      }
    } else {
      setPreviewModalBlobUrl(null);
    }
  }, [previewModalFile]);

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

  // Customer Contact & Site Information Editing State
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(job.customer_email || '');

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(job.customer_phone || '');

  const [isEditingLotDetails, setIsEditingLotDetails] = useState(false);
  const [lotDetailsInput, setLotDetailsInput] = useState(job.lot_details || '');

  // Full Customer & Site Information Edit Modal State
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [custModalName, setCustModalName] = useState(job.customer_name || '');
  const [custModalEmail, setCustModalEmail] = useState(job.customer_email || '');
  const [custModalPhone, setCustModalPhone] = useState(job.customer_phone || '');
  const [custModalAddress, setCustModalAddress] = useState(job.project_address || '');
  const [custModalBuilder, setCustModalBuilder] = useState(job.builder || '');
  const [custModalLotDetails, setCustModalLotDetails] = useState(job.lot_details || '');
  const [customerUpdateFeedback, setCustomerUpdateFeedback] = useState<string | null>(null);

  // Synchronize inputs when job changes
  React.useEffect(() => {
    setEmailInput(job.customer_email || '');
    setPhoneInput(job.customer_phone || '');
    setLotDetailsInput(job.lot_details || '');
    setCustModalName(job.customer_name || '');
    setCustModalEmail(job.customer_email || '');
    setCustModalPhone(job.customer_phone || '');
    setCustModalAddress(job.project_address || '');
    setCustModalBuilder(job.builder || '');
    setCustModalLotDetails(job.lot_details || '');
  }, [job.id, job.customer_name, job.customer_email, job.customer_phone, job.project_address, job.builder, job.lot_details]);

  const handleSaveEmail = () => {
    const trimmed = emailInput.trim();
    if (trimmed === (job.customer_email || '')) {
      setIsEditingEmail(false);
      return;
    }
    const performer = currentStaff?.name || job.assigned_drafter.split(',')[0] || 'Staff';
    const oldEmail = job.customer_email || 'None';
    const updated: Job = {
      ...job,
      customer_email: trimmed,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Customer Email Updated',
          performedBy: performer,
          timestamp: new Date().toISOString(),
          details: `Updated customer email from "${oldEmail}" to "${trimmed || 'None'}"`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updated);
    setIsEditingEmail(false);
    setCustomerUpdateFeedback('Customer email updated');
    setTimeout(() => setCustomerUpdateFeedback(null), 3500);
  };

  const handleSavePhone = () => {
    const trimmed = phoneInput.trim();
    if (trimmed === (job.customer_phone || '')) {
      setIsEditingPhone(false);
      return;
    }
    const performer = currentStaff?.name || job.assigned_drafter.split(',')[0] || 'Staff';
    const oldPhone = job.customer_phone || 'None';
    const updated: Job = {
      ...job,
      customer_phone: trimmed,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Customer Phone Updated',
          performedBy: performer,
          timestamp: new Date().toISOString(),
          details: `Updated customer phone from "${oldPhone}" to "${trimmed || 'None'}"`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updated);
    setIsEditingPhone(false);
    setCustomerUpdateFeedback('Customer phone updated');
    setTimeout(() => setCustomerUpdateFeedback(null), 3500);
  };

  const handleSaveLotDetails = () => {
    const trimmed = lotDetailsInput.trim();
    if (trimmed === (job.lot_details || '')) {
      setIsEditingLotDetails(false);
      return;
    }
    const performer = currentStaff?.name || job.assigned_drafter.split(',')[0] || 'Staff';
    const updated: Job = {
      ...job,
      lot_details: trimmed,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Lot & Site Details Updated',
          performedBy: performer,
          timestamp: new Date().toISOString(),
          details: `Updated lot and site setback/slope notes.`
        },
        ...job.audit_logs
      ]
    };
    onUpdateJob(updated);
    setIsEditingLotDetails(false);
    setCustomerUpdateFeedback('Lot details updated');
    setTimeout(() => setCustomerUpdateFeedback(null), 3500);
  };

  const handleOpenCustomerModal = () => {
    setCustModalName(job.customer_name || '');
    setCustModalEmail(job.customer_email || '');
    setCustModalPhone(job.customer_phone || '');
    setCustModalAddress(job.project_address || '');
    setCustModalBuilder(job.builder || '');
    setCustModalLotDetails(job.lot_details || '');
    setIsEditCustomerModalOpen(true);
  };

  const handleSaveFullCustomerModal = (e: React.FormEvent) => {
    e.preventDefault();
    const performer = currentStaff?.name || job.assigned_drafter.split(',')[0] || 'Staff';
    const changes: string[] = [];

    const newName = custModalName.trim() || job.customer_name;
    const newEmail = custModalEmail.trim();
    const newPhone = custModalPhone.trim();
    const newAddress = custModalAddress.trim();
    const newBuilder = custModalBuilder.trim();
    const newLotDetails = custModalLotDetails.trim() || job.lot_details;

    if (newName !== job.customer_name) changes.push(`Name from "${job.customer_name}" to "${newName}"`);
    if (newEmail !== (job.customer_email || '')) changes.push(`Email from "${job.customer_email || 'None'}" to "${newEmail || 'None'}"`);
    if (newPhone !== (job.customer_phone || '')) changes.push(`Phone from "${job.customer_phone || 'None'}" to "${newPhone || 'None'}"`);
    if (newAddress !== (job.project_address || '')) changes.push(`Site Address from "${job.project_address || 'None'}" to "${newAddress || 'None'}"`);
    if (newBuilder !== (job.builder || '')) changes.push(`Builder from "${job.builder || 'None'}" to "${newBuilder || 'None'}"`);
    if (newLotDetails !== (job.lot_details || '')) changes.push(`Lot Details updated`);

    if (changes.length === 0) {
      setIsEditCustomerModalOpen(false);
      return;
    }

    const updated: Job = {
      ...job,
      customer_name: newName,
      customer_email: newEmail,
      customer_phone: newPhone,
      project_address: newAddress || undefined,
      builder: newBuilder || undefined,
      lot_details: newLotDetails,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Customer & Site Info Updated',
          performedBy: performer,
          timestamp: new Date().toISOString(),
          details: `Updated customer information: ${changes.join(', ')}`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);
    setIsEditCustomerModalOpen(false);
    setCustomerUpdateFeedback('Customer details updated');
    setTimeout(() => setCustomerUpdateFeedback(null), 3500);
  };

  // Manual Time Log / Additional Billing Form State
  const [billingCategory, setBillingCategory] = useState<AdditionalBillingCategory>('Revisions Exceeded Plan Scope');
  const [manualTaskInput, setManualTaskInput] = useState('');
  const [manualHoursInput, setManualHoursInput] = useState('1.5');
  const [manualRateInput, setManualRateInput] = useState<string>(String(job.hourly_rate || 85));
  const [hourlyRateInput, setHourlyRateInput] = useState<number>(job.hourly_rate || 85);

  // Upfront Deposit & Retainer Collection State
  const [isEditingDeposit, setIsEditingDeposit] = useState(false);
  const [depositCollectedInput, setDepositCollectedInput] = useState<boolean>(job.deposit_collected || false);
  const [depositAmountInput, setDepositAmountInput] = useState<string>(
    job.deposit_amount !== undefined && job.deposit_amount !== null ? String(job.deposit_amount) : ''
  );
  const [depositDateInput, setDepositDateInput] = useState<string>(
    job.deposit_date || new Date().toISOString().split('T')[0]
  );
  const [depositNotesInput, setDepositNotesInput] = useState<string>(job.deposit_notes || '');

  const handleSaveDepositInfo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmt = Number(depositAmountInput) || 0;
    const isCollected = depositCollectedInput && numAmt > 0;

    const updatedJob: Job = {
      ...job,
      deposit_collected: isCollected,
      deposit_amount: isCollected ? numAmt : 0,
      deposit_date: isCollected ? depositDateInput : undefined,
      deposit_notes: isCollected ? (depositNotesInput.trim() || 'Upfront retainer deposit') : undefined,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Deposit Info Updated',
          performedBy: currentStaff?.name || job.assigned_drafter.split(',')[0] || 'Billing Admin',
          timestamp: new Date().toISOString(),
          details: isCollected
            ? `Updated deposit to $${numAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Ref: ${depositNotesInput || 'Retainer'}, Date: ${depositDateInput})`
            : `Cleared upfront deposit on project #${job.job_number}.`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updatedJob);
    setIsEditingDeposit(false);
  };

  // Admin Adjust Total Time / Overcharge Correction Modal State
  const [isAdjustTotalTimeModalOpen, setIsAdjustTotalTimeModalOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'set_total' | 'subtract_hours'>('set_total');
  const [newTotalHoursInput, setNewTotalHoursInput] = useState('');
  const [hoursToSubtractInput, setHoursToSubtractInput] = useState('4.0');
  const [adjustReasonCategory, setAdjustReasonCategory] = useState('Drafter Left Timer Running Overnight');
  const [adjustCustomNotes, setAdjustCustomNotes] = useState('');
  const [adjustMethod, setAdjustMethod] = useState<'trim_runaway_session' | 'add_correction_line'>('trim_runaway_session');

  // Edit Individual Time Log Session Modal State
  const [editingTimeLog, setEditingTimeLog] = useState<TimeLog | null>(null);
  const [editLogDrafter, setEditLogDrafter] = useState('');
  const [editLogTaskDesc, setEditLogTaskDesc] = useState('');
  const [editLogBillingCategory, setEditLogBillingCategory] = useState<AdditionalBillingCategory | ''>('');
  const [editLogHours, setEditLogHours] = useState('');
  const [editLogRate, setEditLogRate] = useState('');

  // Delete Individual Time Log Confirmation State
  const [deletingTimeLogId, setDeletingTimeLogId] = useState<string | null>(null);

  const handleOpenAdjustTotalTime = () => {
    const totalSecs = calculateJobTotalSeconds(job, nowTimestamp);
    const totalHrs = (totalSecs / 3600).toFixed(2);
    setNewTotalHoursInput(totalHrs);
    setHoursToSubtractInput('4.0');
    setAdjustMode('set_total');
    setAdjustReasonCategory('Drafter Left Timer Running Overnight');
    setAdjustCustomNotes('');
    setAdjustMethod('trim_runaway_session');
    setIsAdjustTotalTimeModalOpen(true);
  };

  const handleApplyAdjustTotalTime = (e: React.FormEvent) => {
    e.preventDefault();
    const currentTotalSecs = calculateJobTotalSeconds(job, nowTimestamp);
    const currentTotalHours = currentTotalSecs / 3600;

    let targetTotalHours = 0;
    if (adjustMode === 'set_total') {
      targetTotalHours = Math.max(0, parseFloat(newTotalHoursInput) || 0);
    } else {
      const sub = Math.max(0, parseFloat(hoursToSubtractInput) || 0);
      targetTotalHours = Math.max(0, currentTotalHours - sub);
    }

    const deltaHours = targetTotalHours - currentTotalHours;
    if (Math.abs(deltaHours) < 0.001) {
      setIsAdjustTotalTimeModalOpen(false);
      return;
    }

    const adminName = currentStaff?.name || 'Admin';
    const rate = job.hourly_rate || 85;
    const existingLogs = [...(job.time_logs || [])];

    let updatedLogs: TimeLog[] = [];

    if (adjustMethod === 'trim_runaway_session' && existingLogs.length > 0) {
      // Find the largest duration session to trim from (or latest)
      let maxIdx = 0;
      let maxDuration = existingLogs[0].durationSeconds;
      for (let i = 1; i < existingLogs.length; i++) {
        if (existingLogs[i].durationSeconds > maxDuration) {
          maxDuration = existingLogs[i].durationSeconds;
          maxIdx = i;
        }
      }

      const targetLog = { ...existingLogs[maxIdx] };
      const newDurationSec = Math.max(0, Math.round(targetLog.durationSeconds + deltaHours * 3600));
      const newBillableHours = Math.max(0, Number((newDurationSec / 3600).toFixed(2)));
      const logRate = targetLog.hourlyRate || rate;

      targetLog.durationSeconds = newDurationSec;
      targetLog.billableHours = newBillableHours;
      targetLog.billableAmount = Math.max(0, Math.round(newBillableHours * logRate * 100) / 100);
      targetLog.taskDescription = `${targetLog.taskDescription || 'CAD Drafting'} (Adjusted by Admin: ${adjustReasonCategory}${adjustCustomNotes ? ` - ${adjustCustomNotes}` : ''})`;

      updatedLogs = existingLogs.map((l, idx) => idx === maxIdx ? targetLog : l);
    } else {
      // Add explicit correction line item
      const deltaSec = Math.round(deltaHours * 3600);
      const correctionLog: TimeLog = {
        id: `tl-adj-${Date.now()}`,
        drafterName: adminName,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: deltaSec,
        taskDescription: `Admin Time Adjustment: ${adjustReasonCategory}${adjustCustomNotes ? ` - ${adjustCustomNotes}` : ''}`,
        billingCategory: 'Other Additional Work',
        hourlyRate: rate,
        billableHours: Number(deltaHours.toFixed(2)),
        billableAmount: Math.round(deltaHours * rate * 100) / 100,
        rawInputHours: Number(deltaHours.toFixed(2))
      };
      updatedLogs = [...existingLogs, correctionLog];
    }

    const updatedJob: Job = {
      ...job,
      time_logs: updatedLogs,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Total Time & Billing Adjusted',
          performedBy: adminName,
          timestamp: new Date().toISOString(),
          details: `Admin adjusted total logged time from ${currentTotalHours.toFixed(2)} hrs to ${targetTotalHours.toFixed(2)} hrs (${deltaHours >= 0 ? '+' : ''}${deltaHours.toFixed(2)} hrs). Reason: ${adjustReasonCategory}${adjustCustomNotes ? ` (${adjustCustomNotes})` : ''}. Method: ${adjustMethod === 'trim_runaway_session' ? 'Trimmed longest session' : 'Itemized adjustment entry'}.`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updatedJob);
    setIsAdjustTotalTimeModalOpen(false);
  };

  const handleStartEditTimeLog = (log: TimeLog) => {
    const hours = typeof log.billableHours === 'number' 
      ? log.billableHours 
      : log.durationSeconds / 3600;
    const rate = log.hourlyRate || job.hourly_rate || 85;

    setEditingTimeLog(log);
    setEditLogDrafter(log.drafterName);
    setEditLogTaskDesc(log.taskDescription || '');
    setEditLogBillingCategory((log.billingCategory as AdditionalBillingCategory) || '');
    setEditLogHours(String(hours));
    setEditLogRate(String(rate));
  };

  const handleSaveEditTimeLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimeLog) return;

    const newHours = Math.max(0, parseFloat(editLogHours) || 0);
    const newRate = Math.max(0, parseFloat(editLogRate) || job.hourly_rate || 85);
    const newDurationSeconds = Math.round(newHours * 3600);
    const newBillableAmount = Math.round(newHours * newRate * 100) / 100;
    const adminName = currentStaff?.name || 'Admin';

    const oldHours = typeof editingTimeLog.billableHours === 'number'
      ? editingTimeLog.billableHours
      : (editingTimeLog.durationSeconds / 3600);

    const updatedLog: TimeLog = {
      ...editingTimeLog,
      drafterName: editLogDrafter.trim() || editingTimeLog.drafterName,
      taskDescription: editLogTaskDesc.trim() || editingTimeLog.taskDescription,
      billingCategory: (editLogBillingCategory as AdditionalBillingCategory) || editingTimeLog.billingCategory,
      durationSeconds: newDurationSeconds,
      hourlyRate: newRate,
      billableHours: newHours,
      billableAmount: newBillableAmount,
      rawInputHours: newHours
    };

    const updatedLogs = (job.time_logs || []).map(l => l.id === editingTimeLog.id ? updatedLog : l);

    const updatedJob: Job = {
      ...job,
      time_logs: updatedLogs,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Time Session Modified',
          performedBy: adminName,
          timestamp: new Date().toISOString(),
          details: `Modified time session by ${updatedLog.drafterName}: changed from ${oldHours.toFixed(2)} hrs to ${newHours.toFixed(2)} hrs @ $${newRate}/hr ($${newBillableAmount.toFixed(2)}).`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updatedJob);
    setEditingTimeLog(null);
  };

  const handleConfirmDeleteTimeLog = (logId: string) => {
    const targetLog = (job.time_logs || []).find(l => l.id === logId);
    if (!targetLog) return;

    const adminName = currentStaff?.name || 'Admin';
    const hours = typeof targetLog.billableHours === 'number'
      ? targetLog.billableHours
      : (targetLog.durationSeconds / 3600);
    const rate = targetLog.hourlyRate || job.hourly_rate || 85;
    const amount = typeof targetLog.billableAmount === 'number' ? targetLog.billableAmount : hours * rate;

    const updatedLogs = (job.time_logs || []).filter(l => l.id !== logId);

    const updatedJob: Job = {
      ...job,
      time_logs: updatedLogs,
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Time Session Deleted',
          performedBy: adminName,
          timestamp: new Date().toISOString(),
          details: `Deleted time session of ${hours.toFixed(2)} hrs ($${amount.toFixed(2)}) by ${targetLog.drafterName} ("${targetLog.taskDescription || targetLog.billingCategory || 'CAD Drafting'}").`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updatedJob);
    setDeletingTimeLogId(null);
  };

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
    const rawHours = parseFloat(manualHoursInput);
    if (!rawHours || rawHours <= 0) return;

    const rate = parseFloat(manualRateInput) || job.hourly_rate || 85;
    const billableHours = calculateAdditionalBillableHours(rawHours);
    const totalBillableAmount = Math.round(billableHours * rate * 100) / 100;
    const rawDurationSeconds = Math.round(rawHours * 3600);

    const drafterName = (currentStaff?.name) || job.assigned_drafter.split(',')[0];
    const taskDesc = manualTaskInput.trim() 
      ? `${billingCategory}: ${manualTaskInput.trim()}`
      : billingCategory;

    const newLog: TimeLog = {
      id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      drafterName,
      startTime: new Date(Date.now() - rawDurationSeconds * 1000).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: rawDurationSeconds,
      taskDescription: taskDesc,
      billingCategory,
      hourlyRate: rate,
      billableHours,
      billableAmount: totalBillableAmount,
      rawInputHours: rawHours
    };

    const updated: Job = {
      ...job,
      time_logs: [...(job.time_logs || []), newLog],
      audit_logs: [
        {
          id: `a-${Date.now()}`,
          action: 'Additional Billing Logged',
          performedBy: drafterName,
          timestamp: new Date().toISOString(),
          details: `Logged ${billableHours} hrs for "${taskDesc}" @ $${rate}/hr (Total: $${totalBillableAmount.toFixed(2)}${rawHours < 1.0 ? ' - 1.0h min applied' : ''})`
        },
        ...job.audit_logs
      ]
    };

    onUpdateJob(updated);
    setManualTaskInput('');
    setManualHoursInput('1.5');
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

  // Helper to toggle tagged staff member
  const handleToggleTagStaff = (staff: StaffUser) => {
    const isAlreadyTagged = selectedTaggedStaff.some(s => s.id === staff.id);
    if (isAlreadyTagged) {
      setSelectedTaggedStaff(prev => prev.filter(s => s.id !== staff.id));
    } else {
      setSelectedTaggedStaff(prev => [...prev, staff]);
      const shortName = staff.name.split(' ')[0];
      if (!newCommentInput.includes(`@${shortName}`) && !newCommentInput.includes(`@${staff.name}`)) {
        setNewCommentInput(prev => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} @${shortName} ` : `@${shortName} `;
        });
      }
    }
  };

  // Handle comment input changes with inline @mention autocomplete detection
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || value.length;
    setNewCommentInput(value);

    // Look for @word pattern before current cursor
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionCursorPos(cursorPos);
    } else {
      setMentionQuery(null);
      setMentionCursorPos(null);
    }
  };

  // Select mention suggestion from floating autocomplete popover
  const handleSelectMentionSuggestion = (staff: StaffUser) => {
    const cursorPos = mentionCursorPos || newCommentInput.length;
    const textBeforeCursor = newCommentInput.slice(0, cursorPos);
    const textAfterCursor = newCommentInput.slice(cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    const shortName = staff.name.split(' ')[0];
    if (lastAtIdx !== -1) {
      const updated = textBeforeCursor.slice(0, lastAtIdx) + `@${shortName} ` + textAfterCursor;
      setNewCommentInput(updated);
    } else {
      setNewCommentInput(prev => `${prev.trim()} @${shortName} `);
    }

    if (!selectedTaggedStaff.some(s => s.id === staff.id)) {
      setSelectedTaggedStaff(prev => [...prev, staff]);
    }
    setMentionQuery(null);
    setMentionCursorPos(null);
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  // Add Comment with Tagging & Notification Dispatch
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentInput.trim() && !commentAttachmentUrl) return;

    const senderName = currentStaff?.name || job.assigned_drafter.split(',')[0] || 'Drafter Studio';
    const commentText = newCommentInput.trim() || (commentAttachmentName ? `Attached file: ${commentAttachmentName}` : 'Attached image');

    // 1. Gather all tagged staff (from selectedTaggedStaff AND @Name regex in text)
    const taggedStaffList: StaffUser[] = [...selectedTaggedStaff];
    
    // Parse @Name tokens from comment text
    const words = commentText.split(/\s+/);
    words.forEach(w => {
      if (w.startsWith('@')) {
        const cleanName = w.replace(/^@/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (cleanName) {
          const match = availableStaff.find(s => 
            s.name.toLowerCase() === cleanName ||
            s.name.toLowerCase().startsWith(cleanName) ||
            s.name.split(' ')[0].toLowerCase() === cleanName
          );
          if (match && !taggedStaffList.some(s => s.id === match.id)) {
            taggedStaffList.push(match);
          }
        }
      }
    });

    // If replying to someone, also ensure the original author is included
    let originalAuthorStaff: StaffUser | undefined = undefined;
    if (replyingToComment && replyingToComment.author) {
      originalAuthorStaff = availableStaff.find(s => 
        s.name.toLowerCase().includes(replyingToComment.author.toLowerCase()) ||
        replyingToComment.author.toLowerCase().includes(s.name.toLowerCase()) ||
        s.name.split(' ')[0].toLowerCase() === replyingToComment.author.split(' ')[0].toLowerCase()
      );
      if (originalAuthorStaff && !taggedStaffList.some(s => s.id === originalAuthorStaff?.id)) {
        taggedStaffList.push(originalAuthorStaff);
      }
    }

    const uniqueTaggedNames = Array.from(new Set(taggedStaffList.map(s => s.name)));
    const newCommentId = `c-${Date.now()}`;

    const newComment: JobComment = {
      id: newCommentId,
      author: senderName,
      authorId: currentStaff?.id,
      role: 'drafter' as const,
      text: commentText,
      timestamp: new Date().toISOString(),
      attachmentUrl: commentAttachmentUrl || undefined,
      attachmentName: commentAttachmentName || undefined,
      taggedStaff: uniqueTaggedNames.length > 0 ? uniqueTaggedNames : undefined,
      replyToCommentId: replyingToComment?.id,
      replyToAuthor: replyingToComment?.author,
      replyToText: replyingToComment ? replyingToComment.text.slice(0, 120) : undefined,
      isJobNote: true
    };

    // Specific job note added to project notes - not duplicated into audit_logs
    const updated: Job = {
      ...job,
      comments: [...job.comments, newComment]
    };

    onUpdateJob(updated);

    // 2. Dispatch rich AppNotifications to tagged individuals so they can click and open project
    if (onDispatchNotifications && taggedStaffList.length > 0) {
      const notifs: AppNotification[] = [];

      taggedStaffList.forEach(staffUser => {
        // Do not notify self
        if (currentStaff && staffUser.id === currentStaff.id) return;

        const isReply = replyingToComment && (
          staffUser.name.toLowerCase().includes(replyingToComment.author.toLowerCase()) ||
          replyingToComment.author.toLowerCase().includes(staffUser.name.toLowerCase()) ||
          staffUser.name.split(' ')[0].toLowerCase() === replyingToComment.author.split(' ')[0].toLowerCase()
        );

        const notifTitle = isReply
          ? `↩️ Follow-Up Reply on #${job.job_number} from ${senderName}`
          : `📢 Tagged in Job #${job.job_number} by ${senderName}`;

        const notifMessage = isReply
          ? `Re: "${replyingToComment.text.slice(0, 60)}..." → "${commentText}"`
          : `"${commentText}" • Project: ${job.customer_name} (${job.style || 'Custom Plan'}, ${job.current_status})`;

        notifs.push({
          id: `notif-tag-${Date.now()}-${staffUser.id}-${Math.random().toString(36).substr(2, 4)}`,
          recipientName: staffUser.name,
          recipientEmail: staffUser.email,
          title: notifTitle,
          message: notifMessage,
          timestamp: new Date().toISOString(),
          read: false,
          type: isReply ? 'tag_reply' : 'tag_mention',
          jobId: job.id,
          jobNumber: job.job_number,
          commentId: newCommentId,
          senderName: senderName,
          projectDetails: {
            customerName: job.customer_name,
            style: job.style,
            phase: job.current_status,
            sqFt: job.square_footage
          }
        });
      });

      if (notifs.length > 0) {
        onDispatchNotifications(notifs);
      }
    }

    // Reset input state
    setNewCommentInput('');
    setCommentAttachmentUrl('');
    setCommentAttachmentName('');
    setSelectedTaggedStaff([]);
    setReplyingToComment(null);
    setMentionQuery(null);
    setMentionCursorPos(null);
    setShowTagDropdown(false);
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

  // Delete Deliverable helper to trigger confirmation modal
  const handleDeleteDeliverable = (deliverableId: string) => {
    const del = job.deliverables.find(d => d.id === deliverableId);
    setFileToDelete({
      type: 'deliverable',
      fileId: deliverableId,
      fileName: del?.fileName || del?.title || 'Deliverable Sheet',
      fileSize: del?.fileSize
    });
  };

  // Permanently delete file from local job state, localStorage, and Firestore cloud database
  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsDeletingFile(true);
    try {
      const actorName = currentStaff?.name || job.assigned_drafter.split(',')[0] || 'Staff User';
      let updatedJob: Job = { ...job };

      if (fileToDelete.type === 'task_attachment' && fileToDelete.taskId) {
        const updatedTasks = (job.delegated_tasks || []).map(t => {
          if (t.id === fileToDelete.taskId) {
            return {
              ...t,
              attachments: (t.attachments || []).filter(a => a.id !== fileToDelete.fileId)
            };
          }
          return t;
        });
        updatedJob = {
          ...job,
          delegated_tasks: updatedTasks,
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Task Attachment Deleted',
              performedBy: actorName,
              timestamp: new Date().toISOString(),
              details: `Permanently deleted attachment "${fileToDelete.fileName}" from delegated task "${fileToDelete.taskTitle || fileToDelete.taskId}". File purged from database.`
            },
            ...(job.audit_logs || [])
          ]
        };
      } else if (fileToDelete.type === 'deliverable') {
        updatedJob = {
          ...job,
          deliverables: (job.deliverables || []).filter(d => d.id !== fileToDelete.fileId),
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Deliverable Sheet Deleted',
              performedBy: actorName,
              timestamp: new Date().toISOString(),
              details: `Permanently deleted deliverable "${fileToDelete.fileName}" from project. File purged from database.`
            },
            ...(job.audit_logs || [])
          ]
        };
      }

      // 1. Update React state & localStorage
      onUpdateJob(updatedJob);

      // 2. If open in preview modal, close preview
      if (previewModalFile && previewModalFile.id === fileToDelete.fileId) {
        setPreviewModalFile(null);
      }

      // 3. Immediately purge from Cloud Firestore database to reclaim document size
      await deleteFileFromJobInFirestore(job.id, {
        type: fileToDelete.type,
        taskId: fileToDelete.taskId,
        fileId: fileToDelete.fileId
      });

      const deletedName = fileToDelete.fileName;
      setFileToDelete(null);
      setDeleteFileFeedback(`"${deletedName}" was permanently deleted from project & cloud database.`);
      setTimeout(() => {
        setDeleteFileFeedback(null);
      }, 4500);
    } catch (error) {
      console.error('Failed to permanently delete file:', error);
    } finally {
      setIsDeletingFile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-mono font-black bg-black text-white px-3 py-1 rounded-md border border-slate-800 flex items-center shadow-xs tracking-wide">
                <span>#{job.job_number.replace(/^#/, '')}</span>
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
            Messages & Notes ({displayedJob.comments.filter(c => !isAuditLogDuplicate(c)).length})
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

        {/* Quick Note & CAD Feedback Bar (Moved to be just below the navigation tabs) */}
        {selectedSnapshotId === 'live' && (
          <div className="bg-slate-50/90 border-b border-slate-200 px-6 py-2.5">
            <form onSubmit={handleAddComment} className="space-y-2 relative">
              {/* Floating @Mention Autocomplete Dropdown Popover */}
              {mentionQuery !== null && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-2 z-50 space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1 font-bold text-blue-400">
                      <AtSign className="w-3 h-3" /> Tag Team Member
                    </span>
                    <span>Filtering "@{mentionQuery}"</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {availableStaff
                      .filter(s => 
                        !mentionQuery || 
                        s.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
                        s.role.toLowerCase().includes(mentionQuery.toLowerCase())
                      )
                      .map(staff => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => handleSelectMentionSuggestion(staff)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-600 text-xs transition flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-700 group-hover:bg-blue-500 text-[10px] flex items-center justify-center font-bold">
                              {staff.name.charAt(0)}
                            </span>
                            <span className="font-bold text-white group-hover:text-white">{staff.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-200 uppercase">
                            {staff.role}
                          </span>
                        </button>
                      ))}
                    {availableStaff.filter(s => !mentionQuery || s.name.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                      <div className="p-2 text-center text-xs text-slate-400 italic">No matching drafter or admin found.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Replying Banner */}
              {replyingToComment && (
                <div className="bg-blue-50 border border-blue-200 p-2 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2 truncate">
                    <CornerDownRight className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-blue-950">
                        Replying & Following up with <strong>{replyingToComment.author}</strong>:
                      </span>
                      <span className="text-blue-700 ml-1.5 italic truncate">
                        "{replyingToComment.text.slice(0, 60)}..."
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingToComment(null)}
                    className="text-slate-400 hover:text-red-600 p-1 transition shrink-0 cursor-pointer"
                    title="Cancel reply"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Active Tagged Staff Recipients Pill Bar */}
              {selectedTaggedStaff.length > 0 && (
                <div className="bg-slate-100 border border-slate-200 p-1.5 rounded-xl flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 shrink-0">
                    <Bell className="w-3.5 h-3.5 text-blue-600" />
                    <span>Carrying details & notification to:</span>
                  </span>
                  {selectedTaggedStaff.map(staff => (
                    <span
                      key={staff.id}
                      className="inline-flex items-center gap-1 bg-blue-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full shadow-2xs"
                    >
                      <span>@{staff.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTaggedStaff(prev => prev.filter(s => s.id !== staff.id))}
                        className="hover:text-red-200 transition p-0.5 cursor-pointer"
                        title="Remove tag"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedTaggedStaff([])}
                    className="text-[10px] text-slate-500 hover:text-red-600 font-semibold underline ml-auto cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Quick Tag Shortcuts Bar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                  <AtSign className="w-3 h-3 text-blue-500" /> Tag:
                </span>

                {/* Prominent Quick-Tag Buttons for Primary Leads + Drafters */}
                {availableStaff.slice(0, 5).map(staff => {
                  const isSelected = selectedTaggedStaff.some(s => s.id === staff.id);
                  return (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => handleToggleTagStaff(staff)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition border flex items-center gap-1 shadow-2xs cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
                      }`}
                    >
                      <span>@{staff.name.split(' ')[0]}</span>
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}

                {/* Tag Team Member Dropdown for remaining staff */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <span>+ More Staff...</span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </button>

                  {showTagDropdown && (
                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 space-y-0.5">
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        Select Drafter / Lead to Tag
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {availableStaff.map(staff => {
                          const isSelected = selectedTaggedStaff.some(s => s.id === staff.id);
                          return (
                            <button
                              key={staff.id}
                              type="button"
                              onClick={() => {
                                handleToggleTagStaff(staff);
                                setShowTagDropdown(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                                isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>{staff.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{staff.role}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                    className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer"
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
                  ref={commentInputRef}
                  id="new-drafter-comment-input"
                  type="text"
                  value={newCommentInput}
                  onChange={handleCommentInputChange}
                  placeholder="Add specific job note, CAD feedback, or type @ to tag Jason, Drew, Kyle, or another drafter..."
                  className="flex-1 border border-slate-300 bg-white rounded-lg p-2.5 text-xs focus:bg-white focus:border-blue-500 focus:outline-hidden transition shadow-2xs"
                />

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Add specific note to project"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Job Note</span>
                </button>
              </div>
            </form>
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
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Customer & Site Details
                    </h4>
                    {customerUpdateFeedback && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 animate-in fade-in">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {customerUpdateFeedback}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenCustomerModal}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs"
                      title="Edit all customer contact, address & lot details"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Customer Details</span>
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      Project Identifier
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Field 1: Job Number */}
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-300">
                    <span className="text-[10px] text-slate-700 font-bold uppercase block font-mono">Job Number:</span>
                    {isEditingMpsNumber ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={mpsNumberInput}
                          onChange={(e) => setMpsNumberInput(e.target.value)}
                          className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
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
                          title="Edit Job Number"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Field 2: Email (with inline edit) */}
                  <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 block font-semibold">Email:</span>
                      {!isEditingEmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailInput(job.customer_email || '');
                            setIsEditingEmail(true);
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-0.5"
                          title="Edit Customer Email"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                    {isEditingEmail ? (
                      <div className="mt-1 space-y-1">
                        <input
                          type="text"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="client@example.com"
                          className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleSaveEmail}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEmailInput(job.customer_email || '');
                              setIsEditingEmail(false);
                            }}
                            className="text-slate-500 hover:text-slate-800 px-1 py-0.5 text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        {job.customer_email ? (
                          <a
                            href={`mailto:${job.customer_email.split(';')[0].trim()}`}
                            className="font-medium text-slate-800 hover:text-blue-600 break-all block"
                            title={`Send email to ${job.customer_email}`}
                          >
                            {job.customer_email}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Not specified</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Field 3: Phone (with inline edit) */}
                  <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 block font-semibold">Phone:</span>
                      {!isEditingPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneInput(job.customer_phone || '');
                            setIsEditingPhone(true);
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-0.5"
                          title="Edit Customer Phone"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                    {isEditingPhone ? (
                      <div className="mt-1 space-y-1">
                        <input
                          type="text"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="(555) 234-5678"
                          className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleSavePhone}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneInput(job.customer_phone || '');
                              setIsEditingPhone(false);
                            }}
                            className="text-slate-500 hover:text-slate-800 px-1 py-0.5 text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        {job.customer_phone ? (
                          <a
                            href={`tel:${job.customer_phone.split(';')[0].replace(/[^0-9+]/g, '')}`}
                            className="font-medium text-slate-800 hover:text-blue-600 block"
                            title={`Call ${job.customer_phone}`}
                          >
                            {job.customer_phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Not specified</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Field 4: Estimated Fee / Square Footage */}
                  <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block font-semibold">
                      {canAccessFinancials ? 'Estimated Fee:' : 'Square Footage:'}
                    </span>
                    <span className="font-medium text-slate-800 block mt-1">
                      {canAccessFinancials ? `$${job.estimated_cost}` : `${job.sq_ft} sq ft`}
                    </span>
                  </div>
                </div>

                {/* Optional Site Address & Builder row */}
                {(job.project_address || job.builder) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    {job.project_address && (
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px]">Site Address:</span>
                          <span className="font-medium text-slate-800">{job.project_address}</span>
                        </div>
                      </div>
                    )}
                    {job.builder && (
                      <div className="flex items-start gap-1.5 text-xs">
                        <Building className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px]">Builder / Contractor:</span>
                          <span className="font-medium text-slate-800">{job.builder}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Field 5: Lot & Site Details (with inline edit) */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 block font-semibold">Lot & Site Details:</span>
                    {!isEditingLotDetails && (
                      <button
                        type="button"
                        onClick={() => {
                          setLotDetailsInput(job.lot_details || '');
                          setIsEditingLotDetails(true);
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-0.5"
                        title="Edit Lot & Site Details"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  {isEditingLotDetails ? (
                    <div className="mt-1.5 space-y-1.5">
                      <textarea
                        rows={3}
                        value={lotDetailsInput}
                        onChange={(e) => setLotDetailsInput(e.target.value)}
                        className="w-full bg-white border border-blue-400 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Sloped lot, setbacks, easements, orientation..."
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSaveLotDetails}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-[11px] font-bold shadow-2xs"
                        >
                          Save Lot Details
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLotDetailsInput(job.lot_details || '');
                            setIsEditingLotDetails(false);
                          }}
                          className="text-slate-500 hover:text-slate-800 px-1.5 py-0.5 text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-700 mt-0.5 leading-relaxed">
                      {job.lot_details || <span className="text-slate-400 italic">No lot details specified.</span>}
                    </p>
                  )}
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

                      const taskWorkedSec = calculateDelegatedTaskWorkedSeconds(task, job, nowTimestamp);
                      const isTaskTimerRunning = Boolean(
                        task.activeTimerStart ||
                        (job.active_timer_start && (job.active_timer_delegated_task_id === task.id || (job.active_timer_task && job.active_timer_task.toLowerCase().includes((task.componentTitle || '').toLowerCase()))))
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

                              {task.neededWorkDescription && (
                                <p className="text-xs text-slate-700 mt-1.5 bg-white p-2 rounded border border-slate-200/80">
                                  {task.neededWorkDescription}
                                </p>
                              )}

                              {task.notes && (
                                <p className="text-[11px] text-slate-500 italic mt-1">
                                  <strong>Note from {task.delegatedBy}:</strong> {task.notes}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-slate-600 font-mono mt-2 pt-2 border-t border-slate-200/70">
                                <span>Assigned to: <strong className="text-slate-800">{task.assignedTo}</strong></span>
                                <span>• Delegated by: <strong className="text-slate-800">{task.delegatedBy}</strong></span>

                                {/* 1. DATE TASK WAS DELEGATED (Box 1 in screenshot) */}
                                <span className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[10px] transition">
                                  <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span>Delegated:</span>
                                  <strong className="text-slate-900 font-bold">
                                    {task.delegatedAt ? new Date(task.delegatedAt).toLocaleDateString() : 'N/A'}
                                  </strong>
                                  <button
                                    type="button"
                                    onClick={() => setEditingDelegatedTaskId(editingDelegatedTaskId === task.id ? null : task.id)}
                                    className="text-slate-400 hover:text-indigo-600 transition cursor-pointer ml-0.5"
                                    title="Edit delegation date"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                  </button>
                                </span>

                                {editingDelegatedTaskId === task.id && (
                                  <div className="inline-flex items-center gap-1 bg-white border border-indigo-300 rounded px-1.5 py-0.5 shadow-xs">
                                    <span className="text-[10px] text-slate-400">Set:</span>
                                    <input
                                      type="date"
                                      defaultValue={task.delegatedAt ? new Date(task.delegatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleUpdateTaskDelegatedDate(task.id, e.target.value);
                                          setEditingDelegatedTaskId(null);
                                        }
                                      }}
                                      className="text-[10px] font-mono text-slate-800 focus:outline-none cursor-pointer"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setEditingDelegatedTaskId(null)}
                                      className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}

                                {task.dueDate && <span>• Due: <strong className="text-slate-700">{task.dueDate}</strong></span>}
                              </div>

                              {/* Attached Reference / Working CAD Files (Always visible for all statuses) */}
                              {task.attachments && task.attachments.length > 0 && (
                                <div className="mt-2.5 bg-blue-50/70 border border-blue-200/80 p-2.5 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Attached Component & Reference Files ({task.attachments.length})</span>
                                    </span>
                                    <span className="text-[10px] text-blue-600 font-medium">Click to view or download</span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {task.attachments.map((att) => (
                                      <div key={att.id} className="bg-white p-2 rounded-lg border border-blue-200 flex items-center justify-between gap-2 shadow-2xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                          <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate" title={att.name}>{att.name}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{att.size}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {att.url && (
                                            <button
                                              type="button"
                                              onClick={() => setPreviewModalFile({
                                                id: att.id,
                                                title: `${task.componentTitle}: ${att.name}`,
                                                category: 'CAD / DWG File',
                                                version: 'v1.0 (Reference)',
                                                uploadedAt: task.delegatedAt,
                                                fileSize: att.size,
                                                previewType: att.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/) ? 'render_image' : 'cad_file',
                                                fileUrl: att.url,
                                                fileName: att.name,
                                                changeNotes: `Attached for delegated component "${task.componentTitle}". Delegated by ${task.delegatedBy} to ${task.assignedTo}.`,
                                                authorDrafter: task.delegatedBy
                                              })}
                                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer border border-blue-200"
                                            >
                                              <Eye className="w-3 h-3" />
                                              <span>View</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => downloadFileFromUrl(att.url, att.name)}
                                            className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer border border-slate-200"
                                            title="Download file"
                                          >
                                            <Download className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setFileToDelete({
                                              type: 'task_attachment',
                                              taskId: task.id,
                                              taskTitle: task.componentTitle,
                                              fileId: att.id,
                                              fileName: att.name,
                                              fileSize: att.size
                                            })}
                                            className="text-[11px] font-semibold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer border border-red-200 group/trash"
                                            title="Delete file permanently from project & database"
                                          >
                                            <Trash2 className="w-3 h-3 transition group-hover/trash:scale-110" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

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
                              {(task.status === 'Completed' || task.status === 'Under Review' || Boolean(task.completedAt)) && (
                                <div className="mt-2.5 bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-300 text-xs text-emerald-950 space-y-2">
                                  <div className="flex items-center justify-between font-semibold flex-wrap gap-2">
                                    <span className="flex items-center gap-1.5 text-emerald-800">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="font-bold">
                                        {isApproved
                                          ? `Approved & Signed Off by ${task.reviewedBy || delegatorName}`
                                          : `Completed & Submitted for Review to ${delegatorName}`
                                        }
                                      </span>
                                    </span>

                                    {/* 3. AMOUNT OF TIME THIS TASK WAS WORKED ON (Box 3 in screenshot) */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="inline-flex items-center gap-1.5 bg-white border border-emerald-300 px-2.5 py-1 rounded-md text-[11px] font-bold text-emerald-950 shadow-2xs">
                                        <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                        <span>Time Worked:</span>
                                        <span className="font-mono text-emerald-900 font-extrabold bg-emerald-100/70 px-1.5 py-0.5 rounded">
                                          {formatSecondsToReadable(taskWorkedSec)}
                                        </span>
                                        {taskWorkedSec > 0 && (
                                          <span className="text-[10px] text-emerald-700 font-normal">
                                            ({Math.round(taskWorkedSec / 60)} min)
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (editingTaskTimeId === task.id) {
                                              setEditingTaskTimeId(null);
                                            } else {
                                              setEditingTaskTimeId(task.id);
                                              const hrs = Math.floor(taskWorkedSec / 3600);
                                              const mins = Math.floor((taskWorkedSec % 3600) / 60);
                                              setTaskHoursInput(hrs > 0 ? hrs.toString() : '');
                                              setTaskMinutesInput(mins > 0 ? mins.toString() : '');
                                            }
                                          }}
                                          className="text-emerald-700 hover:text-emerald-950 p-0.5 hover:bg-emerald-100 rounded transition cursor-pointer ml-0.5"
                                          title="Edit or adjust time worked on this task"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                      </div>

                                      {task.completedAt && (
                                        <span className="text-[10px] text-emerald-800 font-mono font-bold bg-white/80 border border-emerald-300 px-2 py-1 rounded-md shadow-2xs">
                                          {new Date(task.completedAt).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
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

                              {/* Task Time Tracking & Quick Timer Bar */}
                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-100/70 p-2.5 rounded-xl">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                    isTaskTimerRunning
                                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 animate-pulse'
                                      : taskWorkedSec > 0
                                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}>
                                    <Clock className={`w-3.5 h-3.5 ${isTaskTimerRunning ? 'text-emerald-600 animate-spin' : 'text-indigo-600'}`} />
                                    <span>Time Worked:</span>
                                    <span className="font-mono font-extrabold text-slate-900">
                                      {isTaskTimerRunning ? formatSecondsToHHMMSS(taskWorkedSec) : formatSecondsToReadable(taskWorkedSec)}
                                    </span>
                                  </div>

                                  {/* Quick timer toggle button */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTaskTimer(task)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                      isTaskTimerRunning
                                        ? 'bg-red-600 hover:bg-red-700 text-white active:scale-95'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                                    }`}
                                    title={isTaskTimerRunning ? "Stop active timer and log time for this task" : "Start timer to track work on this specific component"}
                                  >
                                    {isTaskTimerRunning ? (
                                      <>
                                        <Square className="w-3 h-3 fill-current" />
                                        <span>Stop & Log Time</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3 h-3 fill-current" />
                                        <span>Track Time</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Manual Time Edit / Adjust button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingTaskTimeId === task.id) {
                                        setEditingTaskTimeId(null);
                                      } else {
                                        setEditingTaskTimeId(task.id);
                                        const hrs = Math.floor(taskWorkedSec / 3600);
                                        const mins = Math.floor((taskWorkedSec % 3600) / 60);
                                        setTaskHoursInput(hrs > 0 ? hrs.toString() : '');
                                        setTaskMinutesInput(mins > 0 ? mins.toString() : '');
                                      }
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="Edit or log manual hours/minutes for this item"
                                  >
                                    <Edit3 className="w-3 h-3 text-slate-500" />
                                    <span>Edit / Log Time</span>
                                  </button>
                                </div>

                                {taskWorkedSec > 0 && (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {(taskWorkedSec / 3600).toFixed(2)} hrs billable
                                  </span>
                                )}
                              </div>

                              {/* Inline Time Editor if toggled */}
                              {editingTaskTimeId === task.id && (
                                <div className="mt-2 p-2.5 bg-white border border-indigo-200 rounded-lg shadow-sm flex flex-wrap items-center gap-3 text-xs">
                                  <span className="font-bold text-slate-800 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Adjust Logged Time for "{task.componentTitle}":</span>
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={taskHoursInput}
                                      onChange={(e) => setTaskHoursInput(e.target.value)}
                                      className="w-14 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <span className="text-slate-500">hrs</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="59"
                                      placeholder="0"
                                      value={taskMinutesInput}
                                      onChange={(e) => setTaskMinutesInput(e.target.value)}
                                      className="w-14 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <span className="text-slate-500">mins</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const h = parseFloat(taskHoursInput) || 0;
                                        const m = parseFloat(taskMinutesInput) || 0;
                                        handleSaveTaskTime(task.id, h, m);
                                      }}
                                      className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition cursor-pointer"
                                    >
                                      Save Time
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingTaskTimeId(null)}
                                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0 mt-2 sm:mt-0">
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

                              {/* 2. DATE TASK WAS COMPLETED (Box 2 in screenshot: Directly under the status dropdown) */}
                              {task.status === 'Completed' || task.status === 'Under Review' || Boolean(task.completedAt) ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300 font-bold text-[10px] shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Completed:</span>
                                    <span className="font-mono text-emerald-950 font-bold">
                                      {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Yes'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingCompletionTaskId(editingCompletionTaskId === task.id ? null : task.id)}
                                      className="text-emerald-600 hover:text-emerald-900 transition cursor-pointer ml-0.5"
                                      title="Change or edit completion date"
                                    >
                                      <Edit3 className="w-2.5 h-2.5" />
                                    </button>
                                  </span>

                                  {editingCompletionTaskId === task.id && (
                                    <div className="inline-flex items-center gap-1 bg-white border border-emerald-300 rounded px-1.5 py-0.5 shadow-xs">
                                      <span className="text-[10px] text-slate-400">Date:</span>
                                      <input
                                        type="date"
                                        defaultValue={task.completedAt ? new Date(task.completedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleUpdateTaskCompletionDate(task.id, e.target.value);
                                            setEditingCompletionTaskId(null);
                                          }
                                        }}
                                        className="text-[10px] font-mono text-slate-800 focus:outline-none cursor-pointer"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setEditingCompletionTaskId(null)}
                                        className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkTaskCompleteWithDate(task.id, new Date().toISOString())}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded shadow-2xs transition active:scale-95 cursor-pointer"
                                    title="Mark this task as completed today"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Mark Completed</span>
                                  </button>

                                  <div className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                    <input
                                      type="date"
                                      defaultValue={new Date().toISOString().split('T')[0]}
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const customDate = new Date(e.target.value + 'T12:00:00').toISOString();
                                          handleMarkTaskCompleteWithDate(task.id, customDate);
                                        }
                                      }}
                                      className="text-[10px] font-mono px-1 py-0.5 bg-white border border-slate-300 rounded text-slate-700 cursor-pointer hover:border-emerald-500 focus:outline-none"
                                      title="Pick specific date to mark this task completed"
                                    />
                                  </div>
                                </div>
                              )}
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
                          <button
                            type="button"
                            onClick={() => downloadFileFromUrl(file.fileUrl, file.fileName || `${file.title}.pdf`)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition border border-blue-200 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Asset</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeliverable(file.id)}
                            className="bg-red-50 hover:bg-red-600 text-red-700 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition border border-red-200 flex items-center gap-1.5 cursor-pointer group/trashdel"
                            title="Delete deliverable permanently from project & database"
                          >
                            <Trash2 className="w-3.5 h-3.5 transition group-hover/trashdel:scale-110" />
                            <span>Delete</span>
                          </button>
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

                {/* Delegated Sub-Task & Working Reference Files Section */}
                {job.delegated_tasks && job.delegated_tasks.some(t => t.attachments && t.attachments.length > 0) && (
                  <div className="space-y-3 pt-6 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-blue-600" />
                        <span>Delegated Component & Working Attachments</span>
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {job.delegated_tasks
                        .filter(t => t.attachments && t.attachments.length > 0)
                        .flatMap(task =>
                          (task.attachments || []).map(att => ({
                            task,
                            att
                          }))
                        )
                        .map(({ task, att }) => (
                          <div
                            key={`${task.id}-${att.id}`}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 shadow-2xs transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs truncate" title={att.name}>
                                  {att.name}
                                </p>
                                <p className="text-[10px] text-slate-500 flex items-center gap-1.5 truncate">
                                  <span>{att.size}</span>
                                  <span>•</span>
                                  <span className="text-blue-700 font-medium">Task: {task.componentTitle}</span>
                                  <span>({task.assignedTo})</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {att.url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalFile({
                                    id: att.id,
                                    title: `${task.componentTitle}: ${att.name}`,
                                    category: 'CAD / DWG File',
                                    version: 'v1.0 (Task Reference)',
                                    uploadedAt: task.delegatedAt,
                                    fileSize: att.size,
                                    previewType: att.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/) ? 'render_image' : 'cad_file',
                                    fileUrl: att.url,
                                    fileName: att.name,
                                    changeNotes: `Attached for delegated component "${task.componentTitle}". Assigned to ${task.assignedTo}.`,
                                    authorDrafter: task.delegatedBy
                                  })}
                                  className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => downloadFileFromUrl(att.url, att.name)}
                                className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                                title="Download file"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFileToDelete({
                                  type: 'task_attachment',
                                  taskId: task.id,
                                  taskTitle: task.componentTitle,
                                  fileId: att.id,
                                  fileName: att.name,
                                  fileSize: att.size
                                })}
                                className="text-[11px] font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 px-2 py-1 rounded-lg border border-red-200 transition flex items-center gap-1 cursor-pointer group/trash"
                                title="Delete file permanently from project & database"
                              >
                                <Trash2 className="w-3.5 h-3.5 transition group-hover/trash:scale-110" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
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

              {/* Note Filter & View Control */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/90 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotesFilter('job_notes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      notesFilter === 'job_notes'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Specific Job Notes ({displayedJob.comments.filter(c => !isAuditLogDuplicate(c)).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotesFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      notesFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>All Activity ({displayedJob.comments.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1 bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-2xs font-mono">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span>Newest First</span>
                  </span>
                  {notesFilter === 'job_notes' ? (
                    <span className="flex items-center gap-1 text-slate-600">
                      <Check className="w-3 h-3 text-emerald-600" /> Filtered to specific job notes (audit trail in Audit Log tab)
                    </span>
                  ) : (
                    <span>Displaying all notes alongside automated system logs</span>
                  )}
                </div>
              </div>

              {/* Empty state if no specific job notes */}
              {displayedJob.comments.filter(c => notesFilter === 'all' || !isAuditLogDuplicate(c)).length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">No Specific Job Notes Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Use the "Add Job Note" button above to record CAD feedback, client communication, or instructions for the project.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {[...displayedJob.comments]
                  .map((comment, origIndex) => ({ comment, origIndex }))
                  .sort((a, b) => {
                    const timeA = new Date(a.comment.timestamp).getTime();
                    const timeB = new Date(b.comment.timestamp).getTime();
                    if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
                      return timeB - timeA;
                    }
                    return b.origIndex - a.origIndex;
                  })
                  .filter(({ comment: c }) => notesFilter === 'all' || !isAuditLogDuplicate(c))
                  .map(({ comment: c }) => {
                  const isRoadblockFlag = c.text.includes('ROADBLOCK FLAGGED') || c.text.includes('ROADBLOCK ACTIVATED') || c.text.startsWith('🚨');
                  const isRoadblockResolved = c.text.includes('ROADBLOCK RESOLVED') || c.text.startsWith('✅ ROADBLOCK');
                  const isTimerLog = c.text.includes('⏱️ Drafting Session Completed') || c.text.includes('⏱️ Drafting Time Logged') || c.text.startsWith('⏱️');
                  const isHighlighted = highlightedCommentId === c.id;

                  // Render text with highlighted @mentions
                  const renderTextWithMentions = (text: string) => {
                    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
                    return parts.map((part, idx) => {
                      if (part.startsWith('@')) {
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center font-bold text-blue-700 bg-blue-100/90 border border-blue-200 px-1.5 py-0.5 rounded text-[11px] font-mono mx-0.5"
                          >
                            {part}
                          </span>
                        );
                      }
                      return part;
                    });
                  };

                  return (
                    <div
                      key={c.id}
                      id={`comment-${c.id}`}
                      className={`p-3.5 rounded-xl border text-xs shadow-2xs transition space-y-2.5 ${
                        isHighlighted
                          ? 'ring-2 ring-blue-500 bg-blue-50/90 border-blue-300 text-blue-950 shadow-md'
                          : isRoadblockFlag
                          ? 'bg-red-50/90 border-red-300 text-red-950'
                          : isRoadblockResolved
                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                          : isTimerLog
                          ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      {/* Header with author, badges, timestamp */}
                      <div className="flex justify-between items-start font-bold gap-2">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-900 font-bold">{c.author}</span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded uppercase ${
                            isRoadblockFlag
                              ? 'bg-red-200 text-red-900 font-bold'
                              : isRoadblockResolved
                              ? 'bg-emerald-200 text-emerald-900 font-bold'
                              : isTimerLog
                              ? 'bg-emerald-100 text-emerald-800 font-semibold'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {c.role}
                          </span>

                          {(c.isJobNote || (!isRoadblockFlag && !isRoadblockResolved && !isTimerLog)) && (
                            <span className="bg-blue-100 text-blue-800 border border-blue-200 font-mono text-[10px] px-2 py-0.2 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                              <FileText className="w-2.5 h-2.5 text-blue-600" />
                              <span>JOB NOTE</span>
                            </span>
                          )}

                          {isHighlighted && (
                            <span className="bg-blue-600 text-white font-mono text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs animate-pulse">
                              <Bell className="w-3 h-3" />
                              <span>TARGET NOTE FROM NOTIFICATION</span>
                            </span>
                          )}

                          {isTimerLog && (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                              <Clock className="w-3 h-3 text-emerald-600" />
                              <span>DRAFTING TIME LOG</span>
                            </span>
                          )}

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
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{new Date(c.timestamp).toLocaleString()}</span>
                      </div>

                      {/* Replying quote box if this was a follow-up reply */}
                      {c.replyToAuthor && (
                        <div className="bg-slate-100/90 border-l-3 border-blue-500 p-2 rounded-r-lg text-[11px] text-slate-700 italic space-y-0.5">
                          <div className="font-bold text-slate-900 not-italic flex items-center gap-1 text-[11px]">
                            <CornerDownRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>In reply to <strong>{c.replyToAuthor}</strong>:</span>
                          </div>
                          {c.replyToText && (
                            <p className="line-clamp-2 text-slate-600 pl-4 text-[11px]">
                              "{c.replyToText}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Main Comment Text */}
                      <p className={`whitespace-pre-wrap leading-relaxed ${
                        isRoadblockFlag ? 'font-medium text-red-900' : isRoadblockResolved ? 'font-medium text-emerald-900' : 'text-slate-800'
                      }`}>
                        {renderTextWithMentions(c.text)}
                      </p>

                      {/* Tagged Staff Pills */}
                      {c.taggedStaff && c.taggedStaff.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <AtSign className="w-3 h-3 text-blue-600" />
                            <span>Notified Staff:</span>
                          </span>
                          {c.taggedStaff.map((tagName, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs"
                            >
                              <span>@{tagName}</span>
                            </span>
                          ))}
                        </div>
                      )}

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

                      {/* Action Bar: Reply & Follow-up or Tag Author */}
                      {selectedSnapshotId === 'live' && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToComment(c);
                              const authorStaff = availableStaff.find(s => 
                                s.name.toLowerCase().includes(c.author.toLowerCase()) ||
                                c.author.toLowerCase().includes(s.name.toLowerCase()) ||
                                s.name.split(' ')[0].toLowerCase() === c.author.split(' ')[0].toLowerCase()
                              );
                              if (authorStaff && !selectedTaggedStaff.some(s => s.id === authorStaff.id)) {
                                setSelectedTaggedStaff(prev => [...prev, authorStaff]);
                              }
                              if (commentInputRef.current) {
                                commentInputRef.current.focus();
                              }
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-blue-600 transition px-2 py-1 rounded-md hover:bg-blue-50 border border-transparent hover:border-blue-200"
                            title="Reply and notify the original drafter/author"
                          >
                            <Reply className="w-3 h-3 text-blue-600" />
                            <span>Reply & Follow-up</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const authorStaff = availableStaff.find(s => 
                                s.name.toLowerCase().includes(c.author.toLowerCase()) ||
                                c.author.toLowerCase().includes(s.name.toLowerCase()) ||
                                s.name.split(' ')[0].toLowerCase() === c.author.split(' ')[0].toLowerCase()
                              );
                              if (authorStaff) {
                                handleToggleTagStaff(authorStaff);
                              } else {
                                const clean = c.author.split(' ')[0];
                                setNewCommentInput(prev => prev.trim() ? `${prev.trim()} @${clean} ` : `@${clean} `);
                              }
                              if (commentInputRef.current) {
                                commentInputRef.current.focus();
                              }
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-indigo-600 transition px-2 py-1 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-200"
                            title={`Tag @${c.author.split(' ')[0]} in note`}
                          >
                            <AtSign className="w-3 h-3 text-indigo-600" />
                            <span>Tag @{c.author.split(' ')[0]}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Empty state when no comments exist */}
              {displayedJob.comments.length === 0 && (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 space-y-1">
                  <p className="font-semibold text-xs text-slate-700">No project notes or comments recorded yet.</p>
                  <p className="text-[11px] text-slate-400">Use the note box directly below the tabs above to post CAD notes, feedback, or tag team members.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: TIME & INVOICING */}
          {activeTab === 'time' && (
            <div className="space-y-6">
              
              {/* Overview Metric Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Logged Time */}
                <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Total Logged Time</span>
                    {canAccessFinancials && (
                      <button
                        type="button"
                        onClick={handleOpenAdjustTotalTime}
                        className="flex items-center gap-1 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white text-[10px] font-mono font-bold px-2 py-1 rounded-md border border-slate-700 hover:border-blue-500 transition shadow-2xs"
                        title="Adjust total hours & recalculate billable amount (e.g. correct runaway timer)"
                      >
                        <Edit3 className="w-3 h-3 text-blue-400 group-hover:text-white" />
                        <span>Adjust Hours</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-2">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {Boolean(job.active_timer_start)
                        ? formatSecondsToHHMMSS(calculateJobTotalSeconds(job, nowTimestamp))
                        : formatSecondsToReadable(calculateJobTotalSeconds(job, nowTimestamp))}
                    </span>
                    {canAccessFinancials && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {((calculateJobTotalSeconds(job, nowTimestamp)) / 3600).toFixed(2)} hrs total
                      </span>
                    )}
                  </div>
                </div>

                {canAccessFinancials ? (
                  <>
                    {/* 2. Gross Billable Amount */}
                    <div className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-slate-300 block font-semibold">Gross Billable Total</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          @ ${hourlyRateInput}/hr
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-2">
                        <span className="text-xl font-bold font-mono text-white">
                          ${calculateJobBillableAmount(job, nowTimestamp).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            value={hourlyRateInput}
                            onChange={(e) => handleUpdateHourlyRate(parseFloat(e.target.value) || 0)}
                            className="w-14 font-mono font-bold text-xs bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-white"
                            title="Hourly rate"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. Deposit Collected */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                      job.deposit_collected && (job.deposit_amount || 0) > 0
                        ? 'bg-emerald-950 text-white border-emerald-800'
                        : 'bg-slate-100 text-slate-800 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono uppercase font-semibold block ${
                          job.deposit_collected && (job.deposit_amount || 0) > 0 ? 'text-emerald-300' : 'text-slate-500'
                        }`}>
                          Deposit Collected
                        </span>
                        {job.deposit_collected && (job.deposit_amount || 0) > 0 ? (
                          <span className="text-[9px] bg-emerald-500/30 text-emerald-200 font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-400/40">
                            Upfront Paid
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-200 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded">
                            $0 Deposit
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-2">
                        <span className={`text-xl font-bold font-mono ${
                          job.deposit_collected && (job.deposit_amount || 0) > 0 ? 'text-emerald-300' : 'text-slate-600'
                        }`}>
                          {job.deposit_collected && (job.deposit_amount || 0) > 0
                            ? `-$${calculateJobDepositAmount(job).toFixed(2)}`
                            : '$0.00'}
                        </span>
                        {job.deposit_date && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {job.deposit_date}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4. Net Amount Due to Invoice */}
                    <div className="bg-emerald-900 text-white p-4 rounded-xl border border-emerald-700 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-emerald-200 block font-bold">
                          Net Amount to Invoice
                        </span>
                        <span className="text-[9px] bg-emerald-800 text-emerald-100 font-mono font-bold px-1.5 py-0.5 rounded">
                          Total - Deposit
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-2">
                        <span className="text-2xl font-black font-mono text-white tracking-tight">
                          ${calculateJobNetInvoiceAmount(job, nowTimestamp).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-200 font-mono">
                          Balance Due
                        </span>
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
                  {/* Upfront Deposit & Retainer Management Panel */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                              Deposit & Upfront Retainer
                            </h4>
                            {job.deposit_collected && (job.deposit_amount || 0) > 0 ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>${calculateJobDepositAmount(job).toFixed(2)} Collected</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded">
                                No Deposit Collected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Any upfront deposit collected is automatically subtracted from the gross billable amount to calculate the net balance due for invoicing.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDepositCollectedInput(job.deposit_collected || false);
                          setDepositAmountInput(job.deposit_amount ? String(job.deposit_amount) : '');
                          setDepositDateInput(job.deposit_date || new Date().toISOString().split('T')[0]);
                          setDepositNotesInput(job.deposit_notes || '');
                          setIsEditingDeposit(!isEditingDeposit);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-slate-300 flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        <span>{isEditingDeposit ? 'Cancel Editing' : 'Edit Deposit Info'}</span>
                      </button>
                    </div>

                    {/* Live Calculation Formula Banner */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                        <span className="text-slate-500 font-medium">Gross Billable:</span>
                        <strong className="font-mono text-slate-900">${calculateJobBillableAmount(job, nowTimestamp).toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between sm:justify-start sm:gap-2 text-emerald-700">
                        <span className="text-slate-500 font-medium">Less Deposit:</span>
                        <strong className="font-mono">-${calculateJobDepositAmount(job).toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between sm:justify-start sm:gap-2 text-emerald-900 font-bold bg-emerald-100/60 px-2 py-1 rounded border border-emerald-200">
                        <span>Net Invoice Amount:</span>
                        <strong className="font-mono text-sm">${calculateJobNetInvoiceAmount(job, nowTimestamp).toFixed(2)}</strong>
                      </div>
                    </div>

                    {/* Inline Deposit Editor Form */}
                    {isEditingDeposit && (
                      <form onSubmit={handleSaveDepositInfo} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="modal_deposit_collected"
                            checked={depositCollectedInput}
                            onChange={(e) => setDepositCollectedInput(e.target.checked)}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                          <label htmlFor="modal_deposit_collected" className="text-xs font-bold text-slate-900 cursor-pointer">
                            Deposit / Upfront Retainer has been collected for this project
                          </label>
                        </div>

                        {depositCollectedInput && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Deposit Amount ($) *
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={depositAmountInput}
                                  onChange={(e) => setDepositAmountInput(e.target.value)}
                                  className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  required={depositCollectedInput}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Date Collected
                              </label>
                              <input
                                type="date"
                                value={depositDateInput}
                                onChange={(e) => setDepositDateInput(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Payment Ref / Notes
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Check #1042, Stripe 50% retainer"
                                value={depositNotesInput}
                                onChange={(e) => setDepositNotesInput(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200">
                          <button
                            type="button"
                            onClick={() => setIsEditingDeposit(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Save Deposit Info</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                  {/* Invoice Status & Auto-Archive Control */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                            Invoice & Approval Status
                          </h4>
                          {isJobArchived(job) && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                              <Archive className="w-3 h-3 text-emerald-600" />
                              <span>Paid & Archived</span>
                            </span>
                          )}
                          {isJasonApproved(job) && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Jason Approved</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Items set to <strong>"Pending Invoicing"</strong> are routed to Jason for approval. Once Jason approves (<strong>"✓ Jason Approved"</strong>), Ethan and Drew are automatically notified to begin invoicing.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <select
                          value={job.invoice_status || 'Uninvoiced'}
                          onChange={(e) => {
                            const newStatus = e.target.value as InvoiceStatus;
                            const { updatedJob, newNotifications } = applyInvoiceStatusTransition(job, newStatus, currentStaff);
                            onUpdateJob(updatedJob);
                            if (onDispatchNotifications && newNotifications.length > 0) {
                              onDispatchNotifications(newNotifications);
                            }
                          }}
                          className={`w-full sm:w-auto border font-mono font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition ${
                            job.invoice_status === 'Paid' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                            job.invoice_status === 'Invoiced' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                            job.invoice_status === 'Jason Approved' ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold' :
                            job.invoice_status === 'Pending Invoicing' ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' :
                            'bg-slate-50 text-slate-900 border-slate-300'
                          }`}
                        >
                          <option value="Uninvoiced">Uninvoiced</option>
                          <option value="Pending Invoicing">Pending Invoicing</option>
                          <option value="Jason Approved">
                            {isJasonApproved(job) ? '✓ Jason Approved' : 'Jason Approved'}
                          </option>
                          <option value="Invoiced">Invoiced</option>
                          <option value="Paid">Paid (Auto-Archive)</option>
                        </select>
                      </div>
                    </div>

                    {/* Dynamic Approval Alert Banner: Awaiting Jason */}
                    {job.invoice_status === 'Pending Invoicing' && !isJasonApproved(job) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                            <Clock className="w-4 h-4 text-amber-700" />
                          </div>
                          <div>
                            <span className="font-bold text-amber-950 block">
                              Awaiting Jason's Invoicing Sign-Off
                            </span>
                            <span className="text-[11px] text-amber-800 block">
                              This project is queued for Jason. When approved, Ethan and Drew will receive alerts to start invoicing.
                            </span>
                          </div>
                        </div>

                        {canUserApproveAsJason(currentStaff) && (
                          <button
                            type="button"
                            onClick={() => {
                              const { updatedJob, newNotifications } = applyInvoiceStatusTransition(job, 'Jason Approved', currentStaff);
                              onUpdateJob(updatedJob);
                              if (onDispatchNotifications && newNotifications.length > 0) {
                                onDispatchNotifications(newNotifications);
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition shrink-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve for Invoicing</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Dynamic Approval Banner: Jason Approved */}
                    {isJasonApproved(job) && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div>
                            <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                              <span>✓ Jason Approved for Invoicing</span>
                              {job.jason_approved_at && (
                                <span className="text-[10px] text-emerald-700 font-mono font-normal">
                                  ({new Date(job.jason_approved_at).toLocaleDateString()}{job.jason_approved_by ? ` by ${job.jason_approved_by}` : ''})
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-emerald-800 block">
                              Sign-off confirmed. Automated alerts dispatched to Ethan and Drew to begin invoicing.
                            </span>
                          </div>
                        </div>

                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold px-2.5 py-1 rounded-md shrink-0">
                          Invoicing Active (Ethan & Drew)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                        <span>Official Invoicing & Client Reporting</span>
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Generate official My Plan Store branded PDF invoices (Net 7 days / Online payment link) or download itemized CSV reports.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canGenerateInvoice(currentStaff) && (
                        <button
                          type="button"
                          onClick={() => setIsOfficialInvoiceModalOpen(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Generate Official Invoice</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => exportInvoicingCSV([job], job.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Job Invoice CSV</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Timer Controls for this Job */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                job.paused_by_break 
                  ? 'bg-amber-50/60 border-amber-300' 
                  : job.active_timer_start 
                  ? 'bg-emerald-50/60 border-emerald-300' 
                  : 'bg-white border-slate-200'
              }`}>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className={`w-4 h-4 ${
                      job.active_timer_start ? 'text-emerald-600 animate-spin' : job.paused_by_break ? 'text-amber-600' : 'text-slate-500'
                    }`} />
                    <span>Live Timer Control</span>
                  </span>
                  {job.active_timer_start && (
                    <span className="bg-emerald-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-mono animate-pulse font-bold">
                      SESSION IN PROGRESS
                    </span>
                  )}
                  {job.paused_by_break && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold animate-pulse flex items-center gap-1">
                      <Coffee className="w-3 h-3 text-slate-950" />
                      PAUSED (EMPLOYEE ON BREAK)
                    </span>
                  )}
                </h4>

                <div className={`flex items-center justify-between p-3 rounded-lg border ${
                  job.paused_by_break ? 'bg-amber-100/70 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">
                      {job.paused_by_break ? 'Paused Active Task:' : 'Current Active Task:'}
                    </span>
                    <span className="font-bold text-slate-800 text-xs">
                      {job.paused_timer_task || job.active_timer_task || 'CAD Drafting & Revision Work'}
                    </span>
                    {job.paused_by_break && (
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Timer paused while on break. It will automatically resume when you click &quot;Return From Break&quot;.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {job.active_timer_start ? (
                      <button
                        onClick={() => onStopTimer && onStopTimer(job.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>Stop & Save Session</span>
                      </button>
                    ) : job.paused_by_break ? (
                      <>
                        <button
                          onClick={() => onStartTimer && onStartTimer(job.id, job.paused_timer_task)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Resume Timer</span>
                        </button>
                        <button
                          onClick={() => onStopTimer && onStopTimer(job.id)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs cursor-pointer"
                        >
                          <span>Clear</span>
                        </button>
                      </>
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
              </div>

              {/* Add Manual Time & Additional Billing Entry Form */}
              <form onSubmit={handleAddManualTimeLog} className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2.5">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Add Manual Time / Additional Billing Entry</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Log revisions exceeding plan scope, 1-on-1 consultations, or offline CAD time with custom rates and automatic quarter-hour billing calculation.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full self-start sm:self-auto shrink-0">
                    1.0h Min • 0.25h Increments
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Category Dropdown */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono mb-1">
                      Billing Reason / Category
                    </label>
                    <select
                      value={billingCategory}
                      onChange={(e) => {
                        const newCat = e.target.value as AdditionalBillingCategory;
                        setBillingCategory(newCat);
                        if (newCat.includes('Kyle') || newCat.includes('Jason')) {
                          if (manualRateInput === '85' || !manualRateInput) {
                            setManualRateInput('125');
                          }
                        }
                      }}
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="Revisions Exceeded Plan Scope">Revisions Exceeded Plan Scope (Client Extra Changes)</option>
                      <option value="1-on-1 Consultation with Jason">1-on-1 Consultation with Jason (Architecture & Operations)</option>
                      <option value="1-on-1 Consultation with Kyle">1-on-1 Consultation with Kyle (Executive / Planning Review)</option>
                      <option value="Out-of-Scope Custom Work">Out-of-Scope Custom Work (Structural / Specialty)</option>
                      <option value="Standard Offline CAD Drafting">Standard Offline CAD Drafting (Redlines & Sheet Drafting)</option>
                      <option value="Other Additional Work">Other Additional Work (Miscellaneous Consult / Research)</option>
                    </select>
                  </div>

                  {/* Hourly Rate Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono mb-1">
                      Hourly Rate ($/hr)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-mono font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={manualRateInput}
                        onChange={(e) => setManualRateInput(e.target.value)}
                        placeholder="85"
                        className="w-full bg-white border border-slate-300 p-2 pl-6 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Rate Presets */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400 font-mono">Rate Presets:</span>
                  {[
                    { label: '$85/hr (Standard)', rate: '85' },
                    { label: '$95/hr', rate: '95' },
                    { label: '$125/hr (1-on-1 Consult)', rate: '125' },
                    { label: '$150/hr', rate: '150' }
                  ].map((preset) => (
                    <button
                      key={preset.rate}
                      type="button"
                      onClick={() => setManualRateInput(preset.rate)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                        manualRateInput === preset.rate
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Task Notes / Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono mb-1">
                      Task Description / Meeting Notes
                    </label>
                    <input
                      type="text"
                      value={manualTaskInput}
                      onChange={(e) => setManualTaskInput(e.target.value)}
                      placeholder="e.g. Master bath layout redesign & plumbing relocated via Zoom session"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Hours Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono mb-1">
                      Hours Worked (e.g. 1.5)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={manualHoursInput}
                        onChange={(e) => setManualHoursInput(e.target.value)}
                        placeholder="1.5"
                        className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Hours Increment Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400 font-mono">Quick Select:</span>
                  {['1.0', '1.25', '1.5', '1.75', '2.0', '2.5', '3.0', '4.0'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setManualHoursInput(h)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                        manualHoursInput === h
                          ? 'bg-blue-600 text-white border-blue-600 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {h === '1.0' ? '1.0 hr (Min)' : `${h} hrs`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(manualHoursInput) || 1.0;
                      const next = (cur + 0.25).toFixed(2);
                      setManualHoursInput(next.endsWith('.00') ? next.slice(0, -3) : next);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 font-semibold"
                  >
                    +0.25 hr
                  </button>
                </div>

                {/* Live Billing Calculation Summary Box */}
                {(() => {
                  const rawH = parseFloat(manualHoursInput) || 0;
                  const billableH = calculateAdditionalBillableHours(rawH);
                  const curRate = parseFloat(manualRateInput) || job.hourly_rate || 85;
                  const total = billableH * curRate;

                  return (
                    <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-800 flex items-center gap-2">
                          <span className="text-slate-500">Calculation:</span>
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                            {billableH.toFixed(2)} hrs × ${curRate.toFixed(2)}/hr = <strong className="text-emerald-700">${total.toFixed(2)}</strong>
                          </span>
                        </div>

                        {rawH > 0 && rawH < 1.0 && (
                          <p className="text-[11px] text-amber-700 font-medium">
                            • 1.0 hr minimum threshold applied ({rawH}h entered → billed as 1.00 hr).
                          </p>
                        )}
                        {rawH > 1.0 && (rawH % 0.25 !== 0) && (
                          <p className="text-[11px] text-blue-700 font-medium">
                            • Quarter-hour increment applied ({rawH}h entered → rounded to {billableH.toFixed(2)} hrs).
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shrink-0 shadow-xs flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log Additional Billing (${total.toFixed(2)})</span>
                      </button>
                    </div>
                  );
                })()}
              </form>

              {/* Complete Time Log Session History Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex justify-between items-center">
                  <span>Logged Time & Billing Sessions ({ (job.time_logs || []).length })</span>
                  {canAccessFinancials ? (
                    <span className="text-[10px] text-slate-400 font-mono">Standard Drafter Rate: ${job.hourly_rate || 85}/hr</span>
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
                        <th className="p-3">Drafter / Staff</th>
                        <th className="p-3">Category & Details</th>
                        <th className="p-3">Logged Date</th>
                        <th className="p-3">Duration & Billable Hrs</th>
                        {canAccessFinancials && <th className="p-3 text-right">Billable Amount</th>}
                        {canAccessFinancials && <th className="p-3 text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {job.time_logs.map((log) => {
                        const rate = log.hourlyRate || job.hourly_rate || 85;
                        const rawHours = log.durationSeconds / 3600;
                        const billableHrs = typeof log.billableHours === 'number' ? log.billableHours : rawHours;
                        const billableSession = typeof log.billableAmount === 'number' 
                          ? log.billableAmount 
                          : billableHrs * rate;

                        const isKyleOrJason = (log.billingCategory || '').includes('Jason') || (log.billingCategory || '').includes('Kyle');
                        const isRevisions = (log.billingCategory || '').includes('Revisions');
                        const isOutOfScope = (log.billingCategory || '').includes('Out-of-Scope');

                        return (
                          <tr key={log.id} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                              {log.drafterName}
                            </td>
                            <td className="p-3 text-slate-700">
                              {log.billingCategory ? (
                                <div className="space-y-0.5">
                                  <span className={`inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                                    isKyleOrJason 
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : isRevisions
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : isOutOfScope
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}>
                                    {log.billingCategory}
                                  </span>
                                  {log.taskDescription && log.taskDescription !== log.billingCategory && (
                                    <p className="text-xs text-slate-600 mt-0.5">{log.taskDescription.replace(`${log.billingCategory}: `, '')}</p>
                                  )}
                                </div>
                              ) : (
                                <span>{log.taskDescription || 'CAD Drafting'}</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500 text-[11px] whitespace-nowrap">
                              {new Date(log.startTime).toLocaleDateString()} {new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 font-mono text-slate-800 whitespace-nowrap">
                              <div className="font-bold text-xs">
                                {typeof log.billableHours === 'number' ? `${log.billableHours.toFixed(2)} hrs billable` : formatSecondsToReadable(log.durationSeconds)}
                              </div>
                              {typeof log.rawInputHours === 'number' && log.rawInputHours !== log.billableHours && (
                                <div className="text-[10px] text-slate-400 font-normal">
                                  (raw: {log.rawInputHours}h)
                                </div>
                              )}
                            </td>
                            {canAccessFinancials && (
                              <td className="p-3 font-mono text-right whitespace-nowrap">
                                <div className="font-bold text-emerald-700">${billableSession.toFixed(2)}</div>
                                <div className="text-[10px] text-slate-400">@${rate.toFixed(2)}/hr</div>
                              </td>
                            )}
                            {canAccessFinancials && (
                              <td className="p-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditTimeLog(log)}
                                    className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-lg transition"
                                    title="Edit this time session (hours, rate, description)"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTimeLogId(log.id)}
                                    className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg transition"
                                    title="Delete this time session"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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

      {/* Universal High-Definition File & PDF Canvas Viewer Modal */}
      {previewModalFile && (() => {
        const matchingTask = (job.delegated_tasks || []).find(t => 
          (t.attachments || []).some(a => a.id === previewModalFile.id)
        );
        const sub = matchingTask 
          ? `Attached to Task: ${matchingTask.componentTitle} • Assigned to ${matchingTask.assignedTo}` 
          : previewModalFile.category ? `${previewModalFile.category} • ${previewModalFile.version}` : undefined;

        const cleanNotes = previewModalFile.changeNotes && !previewModalFile.changeNotes.startsWith('Attached for delegated component')
          ? previewModalFile.changeNotes
          : undefined;

        return (
          <UniversalFileViewerModal
            file={{
              id: previewModalFile.id,
              name: previewModalFile.fileName || previewModalFile.title,
              url: previewModalFile.fileUrl,
              size: previewModalFile.fileSize,
              title: previewModalFile.title,
              category: previewModalFile.category,
              version: previewModalFile.version,
              uploadedAt: previewModalFile.uploadedAt,
              authorDrafter: previewModalFile.authorDrafter,
              notes: cleanNotes
            }}
            subtitle={sub}
            onClose={() => setPreviewModalFile(null)}
            onDelete={(f) => {
              if (matchingTask) {
                setFileToDelete({
                  type: 'task_attachment',
                  taskId: matchingTask.id,
                  taskTitle: matchingTask.componentTitle,
                  fileId: f.id,
                  fileName: f.name,
                  fileSize: f.size
                });
              } else {
                setFileToDelete({
                  type: 'deliverable',
                  fileId: f.id,
                  fileName: f.name,
                  fileSize: f.size
                });
              }
            }}
          />
        );
      })()}

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

      {/* MODAL: ADJUST TOTAL TIME & OVERCHARGE CORRECTION */}
      {isAdjustTotalTimeModalOpen && (() => {
        const currentTotalSecs = calculateJobTotalSeconds(job, nowTimestamp);
        const currentTotalHrs = currentTotalSecs / 3600;
        const currentBillable = calculateJobBillableAmount(job, nowTimestamp);
        const rate = job.hourly_rate || 85;

        let targetTotalHrs = 0;
        if (adjustMode === 'set_total') {
          targetTotalHrs = Math.max(0, parseFloat(newTotalHoursInput) || 0);
        } else {
          const sub = Math.max(0, parseFloat(hoursToSubtractInput) || 0);
          targetTotalHrs = Math.max(0, currentTotalHrs - sub);
        }

        const deltaHrs = targetTotalHrs - currentTotalHrs;
        const recalculatedBillable = Math.max(0, currentBillable + deltaHrs * rate);
        const deltaBillable = recalculatedBillable - currentBillable;

        return (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl max-w-lg w-full space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Adjust Total Logged Time</h3>
                    <p className="text-xs text-slate-500">Correct overcharged hours or runaway timers and recalculate billing</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustTotalTimeModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current Job Status Header */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold block">Current Total Time</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {formatSecondsToReadable(currentTotalSecs)}
                  </span>
                  <span className="text-[11px] text-slate-500 block font-mono">
                    ({currentTotalHrs.toFixed(2)} hrs raw)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold block">Current Billable</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ${currentBillable.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-slate-500 block font-mono">
                    @ ${rate.toFixed(2)}/hr rate
                  </span>
                </div>
              </div>

              <form onSubmit={handleApplyAdjustTotalTime} className="space-y-4">
                {/* Mode Selector Tabs */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-mono uppercase">
                    Adjustment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setAdjustMode('set_total')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition ${
                        adjustMode === 'set_total'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Set Exact Total Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustMode('subtract_hours')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition ${
                        adjustMode === 'subtract_hours'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Deduct Runaway Hours
                    </button>
                  </div>
                </div>

                {/* Input Fields according to Mode */}
                {adjustMode === 'set_total' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      New Corrected Total Hours (hrs)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newTotalHoursInput}
                      onChange={(e) => setNewTotalHoursInput(e.target.value)}
                      placeholder="e.g. 20.0"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Enter the exact total number of billable hours this project should have.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Hours to Deduct / Subtract (hrs)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={hoursToSubtractInput}
                      onChange={(e) => setHoursToSubtractInput(e.target.value)}
                      placeholder="e.g. 4.0"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                    {/* Quick Preset Deductions */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="text-slate-400 font-mono">Quick Deduct:</span>
                      {[
                        { label: '-1.0 hr', val: '1.0' },
                        { label: '-2.0 hrs', val: '2.0' },
                        { label: '-4.0 hrs', val: '4.0' },
                        { label: '-8.0 hrs (Overnight)', val: '8.0' },
                        { label: '-12.0 hrs', val: '12.0' },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setHoursToSubtractInput(preset.val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                            hoursToSubtractInput === preset.val
                              ? 'bg-rose-600 text-white border-rose-600 font-bold'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reason Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Reason for Adjustment / Overcharge Correction
                  </label>
                  <select
                    value={adjustReasonCategory}
                    onChange={(e) => setAdjustReasonCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Drafter Left Timer Running Overnight">Drafter Left Timer Running Overnight / Overcharged</option>
                    <option value="Drafter Forgot to Stop Timer on Break/Lunch">Drafter Forgot to Stop Timer on Break/Lunch</option>
                    <option value="Client Courtesy / Revision Scope Adjustment">Client Courtesy / Revision Scope Adjustment</option>
                    <option value="Admin Invoicing Audit Correction">Admin Invoicing Audit Correction</option>
                    <option value="Duplicate Timer Session Logged">Duplicate Timer Session Logged</option>
                    <option value="Other Manual Time Correction">Other Manual Time Correction</option>
                  </select>
                </div>

                {/* Optional Custom Notes */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={adjustCustomNotes}
                    onChange={(e) => setAdjustCustomNotes(e.target.value)}
                    placeholder="e.g. Drafter forgot to pause CAD timer at 6 PM, corrected down to 2.5 hrs"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Application Method */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase font-mono">
                    How should this be applied?
                  </label>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="adjustMethod"
                        checked={adjustMethod === 'trim_runaway_session'}
                        onChange={() => setAdjustMethod('trim_runaway_session')}
                        className="text-blue-600"
                      />
                      <span><strong>Trim Longest / Runaway Session</strong> (Updates drafter's excessive log to match true hours)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="adjustMethod"
                        checked={adjustMethod === 'add_correction_line'}
                        onChange={() => setAdjustMethod('add_correction_line')}
                        className="text-blue-600"
                      />
                      <span><strong>Add Itemized Audit Adjustment Line</strong> (Keeps existing records and inserts dedicated correction line)</span>
                    </label>
                  </div>
                </div>

                {/* Real-time Recalculation Impact Preview */}
                <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-blue-950 flex items-center justify-between">
                    <span>Recalculation Preview:</span>
                    <span className="font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px] font-bold">
                      {deltaHrs <= 0 ? `${deltaHrs.toFixed(2)} hrs` : `+${deltaHrs.toFixed(2)} hrs`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">New Total Hours</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {targetTotalHrs.toFixed(2)} hrs
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-500 font-mono uppercase block">New Billable Total</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        ${recalculatedBillable.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        ({deltaBillable >= 0 ? '+' : ''}${deltaBillable.toFixed(2)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAdjustTotalTimeModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Adjusted Hours & Recalculate</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: EDIT INDIVIDUAL TIME LOG SESSION */}
      {editingTimeLog && (() => {
        const rawH = parseFloat(editLogHours) || 0;
        const rate = parseFloat(editLogRate) || job.hourly_rate || 85;
        const total = rawH * rate;

        return (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-base text-slate-900">Edit Time Session</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTimeLog(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditTimeLog} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Drafter / Staff Name
                  </label>
                  <input
                    type="text"
                    value={editLogDrafter}
                    onChange={(e) => setEditLogDrafter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Billing Reason / Category
                  </label>
                  <select
                    value={editLogBillingCategory}
                    onChange={(e) => setEditLogBillingCategory(e.target.value as AdditionalBillingCategory)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Standard CAD Drafting</option>
                    <option value="Revisions Exceeded Plan Scope">Revisions Exceeded Plan Scope (Client Extra Changes)</option>
                    <option value="1-on-1 Consultation with Jason">1-on-1 Consultation with Jason (Architecture & Operations)</option>
                    <option value="1-on-1 Consultation with Kyle">1-on-1 Consultation with Kyle (Executive / Planning Review)</option>
                    <option value="Out-of-Scope Custom Work">Out-of-Scope Custom Work (Structural / Specialty)</option>
                    <option value="Standard Offline CAD Drafting">Standard Offline CAD Drafting (Redlines & Sheet Drafting)</option>
                    <option value="Other Additional Work">Other Additional Work (Miscellaneous Consult / Research)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Task Description / Notes
                  </label>
                  <input
                    type="text"
                    value={editLogTaskDesc}
                    onChange={(e) => setEditLogTaskDesc(e.target.value)}
                    placeholder="e.g. Floor plan wall adjustments"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Duration / Hours (hrs)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editLogHours}
                      onChange={(e) => setEditLogHours(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hourly Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={editLogRate}
                      onChange={(e) => setEditLogRate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Session Calculation Summary */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                  <span className="text-slate-500">Recalculated Session:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {rawH.toFixed(2)} hrs × ${rate.toFixed(2)}/hr = ${total.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingTimeLog(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow-xs"
                  >
                    Save & Recalculate
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: DELETE TIME LOG CONFIRMATION */}
      {deletingTimeLogId && (() => {
        const targetLog = (job.time_logs || []).find(l => l.id === deletingTimeLogId);
        if (!targetLog) return null;

        const hours = typeof targetLog.billableHours === 'number'
          ? targetLog.billableHours
          : (targetLog.durationSeconds / 3600);
        const rate = targetLog.hourlyRate || job.hourly_rate || 85;
        const amount = typeof targetLog.billableAmount === 'number' ? targetLog.billableAmount : hours * rate;

        return (
          <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-rose-600 border-b pb-3">
                <div className="p-2 bg-rose-50 rounded-xl">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Delete Time Session?</h3>
                  <p className="text-xs text-slate-500">This will remove this entry and recalculate project billings</p>
                </div>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 p-3 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Drafter / Staff:</span>
                  <span className="font-bold text-slate-900">{targetLog.drafterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Task / Category:</span>
                  <span className="font-medium text-slate-800">{targetLog.taskDescription || targetLog.billingCategory || 'CAD Drafting'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Logged Duration:</span>
                  <span className="font-mono font-bold text-slate-900">{hours.toFixed(2)} hrs ({formatSecondsToReadable(targetLog.durationSeconds)})</span>
                </div>
                <div className="flex justify-between border-t border-rose-200/80 pt-1">
                  <span className="text-slate-600">Billable Amount to Deduct:</span>
                  <span className="font-mono font-bold text-rose-700">-${amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingTimeLogId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDeleteTimeLog(deletingTimeLogId)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete & Recalculate</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Comprehensive Edit Customer & Site Details Modal */}
      {isEditCustomerModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Edit Customer & Site Information</h3>
                  <p className="text-[11px] text-slate-400">Job #{job.job_number} • {job.customer_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCustomerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFullCustomerModal} className="p-5 space-y-4 text-xs">
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900">
                Update customer contact details whenever the client provides new emails or phone numbers. All automated notifications, customer portal records, and official invoices will reflect these changes.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer / Client Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    value={custModalName}
                    onChange={(e) => setCustModalName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. Ceci McFee"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address(es)</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={custModalEmail}
                      onChange={(e) => setCustModalEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                      placeholder="client@example.com (or ; for multiple)"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Separate multiple emails with semicolons</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number(s)</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={custModalPhone}
                      onChange={(e) => setCustModalPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                      placeholder="(555) 234-5678"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Client mobile, home, or office line</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Site / Project Address</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={custModalAddress}
                      onChange={(e) => setCustModalAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                      placeholder="e.g. 203 Tom Miller Lane, Bismarck"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Builder / General Contractor</label>
                  <div className="relative">
                    <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={custModalBuilder}
                      onChange={(e) => setCustModalBuilder(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                      placeholder="e.g. Zach Ritter, CCI"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lot & Site Details / Setbacks</label>
                <textarea
                  rows={3}
                  value={custModalLotDetails}
                  onChange={(e) => setCustModalLotDetails(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  placeholder="Sloped 0.75 acre lot with north rear orientation, 35ft setback requirement..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Deletion Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-70 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-slate-900">Delete File Permanently?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This will remove the file from this project and permanently delete its payload from the database.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold text-slate-500">File Name:</span>
                <span className="font-mono font-bold text-slate-900 truncate max-w-[210px]" title={fileToDelete.fileName}>
                  {fileToDelete.fileName}
                </span>
              </div>
              {fileToDelete.fileSize && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-semibold text-slate-500">File Size:</span>
                  <span className="font-mono text-slate-700">{fileToDelete.fileSize}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold text-slate-500">Location:</span>
                <span className="text-slate-800 font-medium">
                  {fileToDelete.type === 'task_attachment' 
                    ? `Task: ${fileToDelete.taskTitle || 'Delegated Attachment'}` 
                    : 'Deliverable Sheet'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p>
                <strong>Database Purge:</strong> Removing this file immediately shrinks the Firestore document size and cleans storage. This action cannot be reversed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingFile}
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingFile}
                onClick={handleConfirmDeleteFile}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeletingFile ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting & Purging...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete & Free Storage</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback Banner */}
      {deleteFileFeedback && (
        <div className="fixed bottom-6 right-6 z-80 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-3 duration-200 font-sans">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{deleteFileFeedback}</span>
        </div>
      )}

      {/* Official Invoice Modal */}
      {isOfficialInvoiceModalOpen && (
        <OfficialInvoiceModal
          job={job}
          isOpen={isOfficialInvoiceModalOpen}
          onClose={() => setIsOfficialInvoiceModalOpen(false)}
          onUpdateJob={onUpdateJob}
          onTriggerEmail={onTriggerEmail}
          onDispatchNotifications={onDispatchNotifications}
          currentStaff={currentStaff}
          nowTimestamp={nowTimestamp}
        />
      )}
    </div>
  );
};

export const JobDetailModal: React.FC<JobDetailModalProps> = (props) => {
  if (!props.job) return null;
  return <JobDetailModalContent {...props} job={props.job} />;
};
