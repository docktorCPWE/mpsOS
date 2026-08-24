import React, { useState, useEffect } from 'react';
import { Job, JobPhase, EmailTemplate, PinnedLocation, TimeLog, StaffUser, AppNotification, DelegatedWorkItem, ChatMessage } from './types';
import { getStoredJobs, saveStoredJobs, resetStoredJobs, getStoredChatMessages, saveStoredChatMessages, STAFF_USERS, INITIAL_NOTIFICATIONS } from './data/mockData';
import { HeaderNav } from './components/HeaderNav';
import { DrafterDashboard } from './components/DrafterDashboard';
import { AdminBillingDashboard } from './components/AdminBillingDashboard';
import { CustomerPortal } from './components/CustomerPortal';
import { JobDetailModal } from './components/JobDetailModal';
import { EmailSimulatorModal } from './components/EmailSimulatorModal';
import { NewJobModal } from './components/NewJobModal';
import { DelegateWorkModal } from './components/DelegateWorkModal';
import { StartTimerModal } from './components/StartTimerModal';
import { CompleteTaskModal, CompleteTaskPayload } from './components/CompleteTaskModal';
import { KyleDelegationInboxModal } from './components/KyleDelegationInboxModal';
import { GeneralChatWidget } from './components/GeneralChatWidget';

const PHASES: JobPhase[] = [
  'Customer Inquiry',
  'Preliminary Layout',
  'Customer Review',
  'Revisions',
  'Exterior Elevations',
  'Construction Prints',
  'Completed',
];

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userRole, setUserRole] = useState<'drafter' | 'admin' | 'customer'>('drafter');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  
  // Staff User and Notifications State
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(STAFF_USERS[0]); // Default: Greg Hyatt (Owner)
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Modals state
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<Job | null>(null);
  const [emailModalData, setEmailModalData] = useState<EmailTemplate | null>(null);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [jobToDelegate, setJobToDelegate] = useState<Job | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<{ task: DelegatedWorkItem; job: Job } | null>(null);
  const [timerPromptJob, setTimerPromptJob] = useState<{ job: Job; initialNote?: string } | null>(null);
  const [isKyleInboxOpen, setIsKyleInboxOpen] = useState(false);

  // Live ticker for active timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize jobs and chat from local storage or mock dataset
  useEffect(() => {
    const loaded = getStoredJobs();
    setJobs(loaded);
    if (loaded.length > 0) {
      setSelectedCustomerId(loaded[0].id);
    }
    setChatMessages(getStoredChatMessages());
  }, []);

  // Sync jobs state to localStorage whenever modified
  const updateJobsState = (newJobs: Job[]) => {
    setJobs(newJobs);
    saveStoredJobs(newJobs);
    
    // Update selected detail job reference if open
    if (selectedJobForDetail) {
      const match = newJobs.find(j => j.id === selectedJobForDetail.id);
      if (match) setSelectedJobForDetail(match);
    }

    // Update jobToDelegate if open
    if (jobToDelegate) {
      const match = newJobs.find(j => j.id === jobToDelegate.id);
      if (match) setJobToDelegate(match);
    }

    // Update timerPromptJob if open
    if (timerPromptJob) {
      const match = newJobs.find(j => j.id === timerPromptJob.job.id);
      if (match) setTimerPromptJob(prev => prev ? { ...prev, job: match } : null);
    }
  };

  // Mark notification as read
  const handleMarkNotificationRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  // Timer Start Handler (prompts for required note if not provided)
  const handleStartTimer = (jobId: string, taskNote?: string) => {
    const trimmed = taskNote ? taskNote.trim() : '';

    // If no note provided, open the StartTimerModal prompt
    if (!trimmed) {
      const target = jobs.find(j => j.id === jobId);
      if (target) {
        setTimerPromptJob({ job: target, initialNote: '' });
      }
      return;
    }

    const updatedJobs = jobs.map(j => {
      if (j.id === jobId) {
        return {
          ...j,
          active_timer_start: new Date().toISOString(),
          active_timer_task: trimmed,
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Timer Started',
              performedBy: currentStaff.name || j.assigned_drafter.split(',')[0],
              timestamp: new Date().toISOString(),
              details: `Started drafting timer for: ${trimmed}`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);
    setTimerPromptJob(null);
  };

  // Timer Stop Handler
  const handleStopTimer = (jobId: string, taskNote?: string) => {
    const updatedJobs = jobs.map(j => {
      if (j.id === jobId && j.active_timer_start) {
        const startMs = new Date(j.active_timer_start).getTime();
        const endMs = Date.now();
        const durationSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
        const finalTaskNote = taskNote || j.active_timer_task || `Drafting ${j.current_status}`;

        const newLog: TimeLog = {
          id: `tl-${Date.now()}`,
          drafterName: currentStaff.name || j.assigned_drafter.split(',')[0],
          startTime: j.active_timer_start,
          endTime: new Date(endMs).toISOString(),
          durationSeconds,
          taskDescription: finalTaskNote,
          hourlyRate: j.hourly_rate || 85
        };

        return {
          ...j,
          active_timer_start: undefined,
          active_timer_task: undefined,
          time_logs: [...(j.time_logs || []), newLog],
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Timer Stopped',
              performedBy: currentStaff.name || j.assigned_drafter.split(',')[0],
              timestamp: new Date().toISOString(),
              details: `Logged ${Math.round(durationSeconds / 60)} mins for "${finalTaskNote}"`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);
  };

  // Reset demo data helper
  const handleResetData = () => {
    if (window.confirm('Reset all jobs to default sample architectural plans?')) {
      const reset = resetStoredJobs();
      setJobs(reset);
      setNotifications(INITIAL_NOTIFICATIONS);
      setChatMessages(getStoredChatMessages());
      if (reset.length > 0) setSelectedCustomerId(reset[0].id);
    }
  };

  // Chat message handlers
  const handleSendChatMessage = (
    text: string,
    mentions?: string[],
    referencedJobNumbers?: string[],
    replyToId?: string
  ) => {
    const replyTarget = replyToId ? chatMessages.find(m => m.id === replyToId) : undefined;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentStaff.id,
      senderName: currentStaff.name,
      senderRole: currentStaff.title,
      text,
      timestamp: new Date().toISOString(),
      mentions,
      referencedJobNumbers,
      replyToId,
      replyToMessage: replyTarget ? {
        id: replyTarget.id,
        senderName: replyTarget.senderName,
        text: replyTarget.text.slice(0, 80)
      } : undefined,
      readByStaffIds: [currentStaff.id],
      channelId: 'general'
    };

    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    saveStoredChatMessages(updated);

    // If mentions exist, dispatch app notifications to the mentioned staff
    if (mentions && mentions.length > 0) {
      mentions.forEach(mentionedName => {
        const targetStaff = STAFF_USERS.find(s => s.name.toLowerCase() === mentionedName.toLowerCase());
        if (targetStaff && targetStaff.id !== currentStaff.id) {
          const notif: AppNotification = {
            id: `notif-chat-${Date.now()}-${targetStaff.id}`,
            recipientName: targetStaff.name,
            recipientEmail: targetStaff.email,
            title: `💬 ${currentStaff.name} mentioned you in Studio Chat`,
            message: `"${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'comment',
            senderName: currentStaff.name
          };
          setNotifications(prev => [notif, ...prev]);
        }
      });
    }

    // If replying to someone else's message, notify them
    if (replyTarget && replyTarget.senderId !== currentStaff.id) {
      const notif: AppNotification = {
        id: `notif-reply-${Date.now()}`,
        recipientName: replyTarget.senderName,
        recipientEmail: '',
        title: `↩️ ${currentStaff.name} replied to your message in Studio Chat`,
        message: `"${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'comment',
        senderName: currentStaff.name
      };
      setNotifications(prev => [notif, ...prev]);
    }
  };

  const handleDeleteChatMessage = (messageId: string) => {
    setChatMessages(prev => {
      const updated = prev.filter(m => m.id !== messageId);
      saveStoredChatMessages(updated);
      return updated;
    });
  };

  const handleMarkChatRead = () => {
    setChatMessages(prev => {
      const hasUnread = prev.some(m => !m.readByStaffIds.includes(currentStaff.id));
      if (!hasUnread) return prev;
      const updated = prev.map(m => {
        if (!m.readByStaffIds.includes(currentStaff.id)) {
          return { ...m, readByStaffIds: [...m.readByStaffIds, currentStaff.id] };
        }
        return m;
      });
      saveStoredChatMessages(updated);
      return updated;
    });
  };

  // Count unread chat messages for current staff
  const unreadChatCount = chatMessages.filter(m => !m.readByStaffIds.includes(currentStaff.id)).length;

  // 1. Update Job Status & Automatically Trigger Email
  const handleUpdateJobStatus = (jobId: string, newStatus: JobPhase) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;

    const nextPhaseIndex = Math.min(PHASES.length - 1, PHASES.indexOf(newStatus) + 1);
    const calculatedNextStep = PHASES[nextPhaseIndex]
      ? `Preparing drawings & sheets for ${PHASES[nextPhaseIndex]}`
      : 'Final construction print package complete.';

    const updatedJobs = jobs.map(j => {
      if (j.id === jobId) {
        return {
          ...j,
          current_status: newStatus,
          next_step: calculatedNextStep,
          last_customer_contact: new Date().toISOString(),
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Status Updated',
              performedBy: userRole === 'drafter' ? currentStaff.name : j.customer_name,
              timestamp: new Date().toISOString(),
              details: `Phase changed to ${newStatus}`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);

    // Create Email Simulator Notification
    setEmailModalData({
      recipientEmail: targetJob.customer_email,
      recipientName: targetJob.customer_name,
      subject: `Phase Updated: Job #${targetJob.job_number} is now ${newStatus}`,
      body: `Hi ${targetJob.customer_name},\n\nGreat news! Your house plan project (#${targetJob.job_number}) has transitioned to the ${newStatus} phase.\n\nAssigned Drafter: ${targetJob.assigned_drafter}\nNext Focus: ${calculatedNextStep}\n\nPlease visit your Plan Store customer portal to review updated drawing sheets.\n\nBest regards,\nMy Plan Store OS Team`,
      timestamp: new Date().toISOString(),
      jobId: targetJob.id,
      jobNumber: targetJob.job_number
    });
  };

  // 2. Toggle Roadblock
  const handleToggleRoadblock = (jobId: string, resolutionCommentText?: string) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;

    const newRoadblockState = !targetJob.roadblock;

    const updatedJobs = jobs.map(j => {
      if (j.id === jobId) {
        const note = newRoadblockState
          ? j.roadblock_note || 'Awaiting customer site survey input'
          : '';

        const commentToAdd = newRoadblockState
          ? {
              id: `c-rb-${Date.now()}`,
              author: currentStaff.name || j.assigned_drafter.split(',')[0] || 'Drafter Workspace',
              role: 'drafter' as const,
              text: `🚨 ROADBLOCK FLAGGED: ${note}`,
              timestamp: new Date().toISOString()
            }
          : {
              id: `c-rb-res-${Date.now()}`,
              author: currentStaff.name || j.assigned_drafter.split(',')[0] || 'Drafter Workspace',
              role: 'drafter' as const,
              text: `✅ ROADBLOCK RESOLVED: ${resolutionCommentText || 'Roadblock cleared and project work resumed.'}`,
              timestamp: new Date().toISOString()
            };

        return {
          ...j,
          roadblock: newRoadblockState,
          roadblock_note: note,
          comments: [...j.comments, commentToAdd],
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: newRoadblockState ? 'Roadblock Activated' : 'Roadblock Resolved',
              performedBy: currentStaff.name || 'Drafter Workspace',
              timestamp: new Date().toISOString(),
              details: newRoadblockState ? `Flagged roadblock: ${note}` : `Cleared roadblock: ${resolutionCommentText || 'Resolved'}`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);
  };

  // 3. Add Comment / Pinned Markup Feedback
  const handleAddComment = (jobId: string, text: string, pinnedLocation?: PinnedLocation) => {
    const updatedJobs = jobs.map(j => {
      if (j.id === jobId) {
        const authorName = userRole === 'drafter' ? currentStaff.name : j.customer_name;
        const newComment = {
          id: `c-${Date.now()}`,
          author: authorName,
          role: userRole,
          text,
          timestamp: new Date().toISOString(),
          pinnedLocation
        };

        return {
          ...j,
          comments: [...j.comments, newComment],
          last_customer_contact: new Date().toISOString()
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);
  };

  // 4. Customer Formal Approval
  const handleApprovePhase = (jobId: string) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;

    const currentIndex = PHASES.indexOf(targetJob.current_status);
    const nextPhase = PHASES[Math.min(PHASES.length - 1, currentIndex + 1)];

    handleUpdateJobStatus(jobId, nextPhase);
  };

  // 5. Customer Request Revision
  const handleRequestRevision = (jobId: string, notes: string) => {
    const updatedJobs = jobs.map(j => {
      if (j.id === jobId) {
        const newReviewCount = j.layout_reviews_count + 1;
        const revisionComment = {
          id: `c-${Date.now()}`,
          author: j.customer_name,
          role: 'customer' as const,
          text: `[REVISION REQUEST #${newReviewCount}] ${notes}`,
          timestamp: new Date().toISOString()
        };

        return {
          ...j,
          current_status: 'Revisions' as JobPhase,
          layout_reviews_count: newReviewCount,
          comments: [...j.comments, revisionComment],
          last_customer_contact: new Date().toISOString(),
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: `Revision Requested (#${newReviewCount})`,
              performedBy: j.customer_name,
              timestamp: new Date().toISOString(),
              details: notes
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);
  };

  // 6. Create New Job Intake
  const handleCreateJob = (newJob: Job) => {
    const updated = [newJob, ...jobs];
    updateJobsState(updated);
    setSelectedCustomerId(newJob.id);
  };

  // 7. Handle Delegated Task Creation
  const handleDelegateTask = (newTask: DelegatedWorkItem, notifyDrafter: boolean) => {
    const targetJob = jobs.find(j => j.id === newTask.jobId);
    if (!targetJob) return;

    const delegationComment = {
      id: `c-del-${Date.now()}`,
      author: newTask.delegatedBy,
      role: 'drafter' as const,
      text: `📋 WORK COMPONENT DELEGATED to ${newTask.assignedTo}: "${newTask.componentTitle}" (${newTask.priority} priority). Notes: ${newTask.notes || 'None'}`,
      timestamp: new Date().toISOString()
    };

    const updatedJobs = jobs.map(j => {
      if (j.id === newTask.jobId) {
        return {
          ...j,
          delegated_tasks: [newTask, ...(j.delegated_tasks || [])],
          comments: [...j.comments, delegationComment],
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Task Delegated',
              performedBy: newTask.delegatedBy,
              timestamp: new Date().toISOString(),
              details: `Delegated "${newTask.componentTitle}" to ${newTask.assignedTo} with ${(newTask.attachments || []).length} attachments.`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);

    // Create Notification for the assigned drafter
    if (notifyDrafter) {
      const assignedStaff = STAFF_USERS.find(s => s.name === newTask.assignedTo);
      const newNotification: AppNotification = {
        id: `notif-${Date.now()}`,
        recipientName: newTask.assignedTo,
        recipientEmail: assignedStaff?.email || `${newTask.assignedTo.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
        senderName: newTask.delegatedBy,
        title: `New Component Delegated: ${newTask.componentTitle}`,
        message: `${newTask.delegatedBy} assigned you "${newTask.componentTitle}" on Job #${targetJob.job_number} (${targetJob.customer_name}). ${(newTask.attachments || []).length > 0 ? `Includes ${(newTask.attachments || []).length} reference file(s).` : ''}`,
        jobId: targetJob.id,
        jobNumber: targetJob.job_number,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'delegation'
      };

      setNotifications(prev => [newNotification, ...prev]);
    }

    setJobToDelegate(null);
  };

  // 8. Handle Updating Delegated Task Status
  const handleUpdateTaskStatus = (jobId: string, taskId: string, newStatus: DelegatedWorkItem['status']) => {
    let completedTaskTitle = '';
    let delegatorName = '';

    const updatedJobs = jobs.map(j => {
      if (j.id === jobId && j.delegated_tasks) {
        const updatedTasks = j.delegated_tasks.map(t => {
          if (t.id === taskId) {
            completedTaskTitle = t.componentTitle;
            delegatorName = t.delegatedBy;
            return { 
              ...t, 
              status: newStatus,
              completedAt: newStatus === 'Completed' ? new Date().toISOString() : t.completedAt,
              completedBy: newStatus === 'Completed' ? currentStaff.name : t.completedBy
            };
          }
          return t;
        });

        return {
          ...j,
          delegated_tasks: updatedTasks,
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Delegated Task Updated',
              performedBy: currentStaff.name,
              timestamp: new Date().toISOString(),
              details: `Updated status of task "${completedTaskTitle}" to "${newStatus}"`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);

    // If marked Completed, notify delegator (Kyle / Jason / Greg)
    if (newStatus === 'Completed' && delegatorName && delegatorName !== currentStaff.name) {
      const targetJob = jobs.find(j => j.id === jobId);
      const delegatorStaff = STAFF_USERS.find(s => s.name === delegatorName);
      const completionNotif: AppNotification = {
        id: `notif-${Date.now()}`,
        recipientName: delegatorName,
        recipientEmail: delegatorStaff?.email || `${delegatorName.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
        senderName: currentStaff.name,
        title: `Task Completed: ${completedTaskTitle}`,
        message: `${currentStaff.name} has completed the delegated component "${completedTaskTitle}" on Job #${targetJob?.job_number || ''}.`,
        jobId: jobId,
        jobNumber: targetJob?.job_number || '',
        timestamp: new Date().toISOString(),
        read: false,
        type: 'status_change'
      };

      setNotifications(prev => [completionNotif, ...prev]);
    }
  };

  // 9. Handle Comprehensive Task Completion Submission (Modal with Notes, Files, Time Log, and Notification)
  const handleCompleteTask = (payload: CompleteTaskPayload) => {
    const targetJob = jobs.find(j => j.id === payload.jobId);
    if (!targetJob) return;

    let targetTaskTitle = '';
    const nowIso = new Date().toISOString();

    const updatedJobs = jobs.map(j => {
      if (j.id === payload.jobId && j.delegated_tasks) {
        const updatedTasks = j.delegated_tasks.map(t => {
          if (t.id === payload.taskId) {
            targetTaskTitle = t.componentTitle;
            const existingAttachments = t.attachments || [];
            // Merge newly uploaded review attachments
            const mergedAttachments = [...existingAttachments, ...payload.reviewFiles];
            
            return {
              ...t,
              status: 'Completed' as const,
              completedAt: nowIso,
              completedBy: currentStaff.name,
              completionNotes: payload.resolutionNotes,
              attachments: mergedAttachments
            };
          }
          return t;
        });

        // If user wants deliverables added to project sheet gallery
        const updatedDeliverables = payload.addToJobDeliverables && payload.deliverableSheets.length > 0
          ? [...payload.deliverableSheets, ...j.deliverables]
          : j.deliverables;

        // If user logged time spent during completion
        const updatedTimeLogs = payload.loggedHours && payload.loggedHours > 0
          ? [
              {
                id: `log-comp-${Date.now()}`,
                drafterName: currentStaff.name,
                startTime: new Date(Date.now() - payload.loggedHours * 3600 * 1000).toISOString(),
                endTime: nowIso,
                durationSeconds: Math.round(payload.loggedHours * 3600),
                taskDescription: payload.loggedTaskDescription || `Completed task: ${targetTaskTitle}`,
                hourlyRate: 85,
                billableAmount: Math.round(payload.loggedHours * 85),
                isBilled: false,
                isApproved: false
              },
              ...j.time_logs
            ]
          : j.time_logs;

        // Add a detailed comment in the project stream for the team
        const completionComment = {
          id: `c-task-comp-${Date.now()}`,
          author: currentStaff.name,
          role: 'drafter' as const,
          text: `✅ TASK COMPLETED & SUBMITTED FOR REVIEW to ${payload.delegatorName} (CC: Jason):\n"${targetTaskTitle}"\n\nReview Notes:\n${payload.resolutionNotes}${payload.reviewFiles.length > 0 ? `\n\n📁 Attached ${payload.reviewFiles.length} file(s): ${payload.reviewFiles.map(f => f.name).join(', ')}` : ''}`,
          timestamp: nowIso
        };

        return {
          ...j,
          delegated_tasks: updatedTasks,
          deliverables: updatedDeliverables,
          time_logs: updatedTimeLogs,
          comments: [...j.comments, completionComment],
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Delegated Task Completed',
              performedBy: currentStaff.name,
              timestamp: nowIso,
              details: `Marked "${targetTaskTitle}" completed with ${payload.reviewFiles.length} review file(s) submitted to ${payload.delegatorName} (CC: Jason). Notes: ${payload.resolutionNotes}`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);

    const newNotifs: AppNotification[] = [];

    // 1. Send Notification to delegator (Kyle / Jason / Greg)
    if (payload.notifyDelegator && payload.delegatorName) {
      const delegatorStaff = STAFF_USERS.find(s => s.name.toLowerCase().includes(payload.delegatorName.toLowerCase()));
      const newCompletionNotif: AppNotification = {
        id: `notif-${Date.now()}`,
        recipientName: payload.delegatorName,
        recipientEmail: payload.delegatorEmail || delegatorStaff?.email || `${payload.delegatorName.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
        senderName: currentStaff.name,
        title: `Task Completed for Review: ${targetTaskTitle}`,
        message: `${currentStaff.name} completed "${targetTaskTitle}" on Job #${targetJob.job_number} (${targetJob.customer_name}) and submitted ${payload.reviewFiles.length} file(s) for your review. Notes: "${payload.resolutionNotes}"`,
        jobId: targetJob.id,
        jobNumber: targetJob.job_number,
        timestamp: nowIso,
        read: false,
        type: 'status_change'
      };
      newNotifs.push(newCompletionNotif);
    }

    // 2. Always CC Jason on completed delegated tasks
    const jasonStaff = STAFF_USERS.find(s => s.name.toLowerCase().includes('jason'));
    const isAlreadyJason = payload.delegatorName.toLowerCase().includes('jason');
    if (!isAlreadyJason) {
      const ccJasonNotif: AppNotification = {
        id: `notif-cc-jason-${Date.now()}`,
        recipientName: 'Jason',
        recipientEmail: jasonStaff?.email || 'jason@myplanstore.com',
        senderName: currentStaff.name,
        title: `[CC] Task Completed for Review: ${targetTaskTitle}`,
        message: `${currentStaff.name} completed "${targetTaskTitle}" on Job #${targetJob.job_number} (${targetJob.customer_name}) and submitted review deliverables to ${payload.delegatorName}.\n\nReview Notes:\n"${payload.resolutionNotes}"`,
        jobId: targetJob.id,
        jobNumber: targetJob.job_number,
        timestamp: nowIso,
        read: false,
        type: 'status_change'
      };
      newNotifs.push(ccJasonNotif);
    }

    if (newNotifs.length > 0) {
      setNotifications(prev => [...newNotifs, ...prev]);
    }

    setTaskToComplete(null);
  };

  // 10. Handle Approving / Signing Off on a Reviewed Delegated Task
  const handleApproveTaskReview = (jobId: string, taskId: string, reviewNote?: string) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;
    const nowIso = new Date().toISOString();
    let assignedDrafter = '';
    let taskTitle = '';

    const updatedJobs = jobs.map(j => {
      if (j.id === jobId && j.delegated_tasks) {
        const updatedTasks = j.delegated_tasks.map(t => {
          if (t.id === taskId) {
            assignedDrafter = t.assignedTo;
            taskTitle = t.componentTitle;
            return {
              ...t,
              status: 'Completed' as const,
              isReviewed: true,
              reviewedBy: currentStaff.name,
              reviewedAt: nowIso,
              reviewNotes: reviewNote || `Approved & signed off by ${currentStaff.name}`,
              revisionRequested: false
            };
          }
          return t;
        });

        return {
          ...j,
          delegated_tasks: updatedTasks,
          comments: [
            ...j.comments,
            {
              id: `c-appr-${Date.now()}`,
              author: currentStaff.name,
              role: 'drafter' as const,
              text: `✅ TASK SIGNED OFF & APPROVED: "${taskTitle}" completed by ${assignedDrafter}. ${reviewNote ? `Notes: ${reviewNote}` : `Approved by ${currentStaff.name}`}`,
              timestamp: nowIso
            }
          ],
          audit_logs: [
            {
              id: `a-rev-${Date.now()}`,
              action: 'Task Reviewed & Approved',
              performedBy: currentStaff.name,
              timestamp: nowIso,
              details: `Signed off on "${taskTitle}" completed by ${assignedDrafter}. ${reviewNote ? `Notes: ${reviewNote}` : 'All drawings & deliverables verified.'}`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);

    // Remove the delegation notification from the specific drafter, and send sign-off approval notification
    if (assignedDrafter) {
      const drafterStaff = STAFF_USERS.find(s => s.name.toLowerCase().includes(assignedDrafter.toLowerCase()));
      setNotifications(prev => {
        const filtered = prev.filter(n => {
          const isDrafterDelegationNotif = n.jobId === targetJob.id && 
            n.recipientName.toLowerCase() === assignedDrafter.toLowerCase() &&
            (n.type === 'delegation' || n.title.toLowerCase().includes(taskTitle.toLowerCase()));
          return !isDrafterDelegationNotif;
        });

        return [
          {
            id: `notif-appr-${Date.now()}`,
            recipientName: assignedDrafter,
            recipientEmail: drafterStaff?.email || `${assignedDrafter.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
            senderName: currentStaff.name,
            title: `✓ Signed Off & Approved: ${taskTitle}`,
            message: `${currentStaff.name} has reviewed and signed off on your completed work for "${taskTitle}" on Job #${targetJob.job_number} (${targetJob.customer_name}). ${reviewNote ? `Notes: "${reviewNote}"` : ''}`,
            jobId: targetJob.id,
            jobNumber: targetJob.job_number,
            timestamp: nowIso,
            read: false,
            type: 'status_change'
          },
          ...filtered
        ];
      });
    }
  };

  // 11. Handle Requesting Revisions on a Delegated Task
  const handleRequestTaskRevision = (jobId: string, taskId: string, feedbackNote: string) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;
    const nowIso = new Date().toISOString();
    let assignedDrafter = '';
    let taskTitle = '';
    let currentRevCount = 1;

    const updatedJobs = jobs.map(j => {
      if (j.id === jobId && j.delegated_tasks) {
        const updatedTasks = j.delegated_tasks.map(t => {
          if (t.id === taskId) {
            assignedDrafter = t.assignedTo;
            taskTitle = t.componentTitle;
            currentRevCount = (t.revisionCount || 0) + 1;
            return {
              ...t,
              status: 'Revision Requested' as const,
              isReviewed: false,
              revisionRequested: true,
              revisionRequestedBy: currentStaff.name,
              revisionRequestedAt: nowIso,
              revisionNotes: feedbackNote,
              revisionCount: currentRevCount,
              notes: `${t.notes ? `${t.notes} | ` : ''}Revision Request #${currentRevCount} (${currentStaff.name}): ${feedbackNote}`
            };
          }
          return t;
        });

        return {
          ...j,
          delegated_tasks: updatedTasks,
          comments: [
            ...j.comments,
            {
              id: `c-rev-req-${Date.now()}`,
              author: currentStaff.name,
              role: 'drafter' as const,
              text: `🔄 REVISION REQUESTED on "${taskTitle}" (Rev #${currentRevCount}): ${feedbackNote}`,
              timestamp: nowIso
            }
          ],
          audit_logs: [
            {
              id: `a-rev-req-${Date.now()}`,
              action: `Task Revision Requested (#${currentRevCount})`,
              performedBy: currentStaff.name,
              timestamp: nowIso,
              details: `Requested revisions on "${taskTitle}" from ${assignedDrafter}: "${feedbackNote}"`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);

    // Notify drafter with clear Revision Request notification
    if (assignedDrafter) {
      const drafterStaff = STAFF_USERS.find(s => s.name.toLowerCase().includes(assignedDrafter.toLowerCase()));
      setNotifications(prev => [
        {
          id: `notif-rev-${Date.now()}`,
          recipientName: assignedDrafter,
          recipientEmail: drafterStaff?.email || `${assignedDrafter.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
          senderName: currentStaff.name,
          title: `⚠️ Revision Requested (Rev #${currentRevCount}): ${taskTitle}`,
          message: `${currentStaff.name} reviewed your submission for "${taskTitle}" on Job #${targetJob.job_number} and requested modifications: "${feedbackNote}"`,
          jobId: targetJob.id,
          jobNumber: targetJob.job_number,
          timestamp: nowIso,
          read: false,
          type: 'status_change'
        },
        ...prev
      ]);
    }
  };

  // Get active selected customer job object
  const activeCustomerJob = jobs.find(j => j.id === selectedCustomerId) || jobs[0];

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-blue-500 selection:text-white flex flex-col">
      
      {/* Top OS Header Bar */}
      <HeaderNav
        userRole={userRole}
        setUserRole={setUserRole}
        currentStaff={currentStaff}
        setCurrentStaff={setCurrentStaff}
        selectedCustomerId={selectedCustomerId}
        setSelectedCustomerId={setSelectedCustomerId}
        jobs={jobs}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onSelectJob={(job) => setSelectedJobForDetail(job)}
        onOpenNewJobModal={() => setIsNewJobModalOpen(true)}
        onResetData={handleResetData}
        onOpenKyleInbox={() => setIsKyleInboxOpen(true)}
        onToggleChat={() => {
          setIsChatOpen(prev => !prev);
          if (!isChatOpen) {
            handleMarkChatRead();
          }
        }}
        isChatOpen={isChatOpen}
        unreadChatCount={unreadChatCount}
      />

      {/* Main OS View Switcher */}
      <main className="flex-1">
        {userRole === 'drafter' ? (
          <DrafterDashboard
            jobs={jobs}
            currentStaff={currentStaff}
            onUpdateStatus={handleUpdateJobStatus}
            onToggleRoadblock={handleToggleRoadblock}
            onSelectJob={(job) => setSelectedJobForDetail(job)}
            onOpenNewJobModal={() => setIsNewJobModalOpen(true)}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            onOpenDelegateModal={(job) => setJobToDelegate(job)}
            onOpenCompleteTaskModal={(task, job) => setTaskToComplete({ task, job })}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onApproveTaskReview={handleApproveTaskReview}
            onRequestTaskRevision={handleRequestTaskRevision}
            onOpenKyleInbox={() => setIsKyleInboxOpen(true)}
            nowTimestamp={nowTimestamp}
          />
        ) : userRole === 'admin' ? (
          <AdminBillingDashboard
            jobs={jobs}
            currentStaff={currentStaff}
            onUpdateStatus={handleUpdateJobStatus}
            onToggleRoadblock={handleToggleRoadblock}
            onSelectJob={(job) => setSelectedJobForDetail(job)}
            onUpdateJob={(updatedJob) => {
              const updatedList = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
              updateJobsState(updatedList);
            }}
            nowTimestamp={nowTimestamp}
          />
        ) : (
          activeCustomerJob ? (
            <CustomerPortal
              job={activeCustomerJob}
              onAddComment={(text, loc) => handleAddComment(activeCustomerJob.id, text, loc)}
              onApprovePhase={() => handleApprovePhase(activeCustomerJob.id)}
              onRequestRevision={(notes) => handleRequestRevision(activeCustomerJob.id, notes)}
            />
          ) : (
            <div className="p-12 text-center text-slate-500">No active customer jobs found.</div>
          )
        )}
      </main>

      {/* MODAL 1: Drafter Job Detail & Control Workspace */}
      {selectedJobForDetail && (
        <JobDetailModal
          job={selectedJobForDetail}
          onClose={() => setSelectedJobForDetail(null)}
          onUpdateJob={(updatedJob) => {
            const updatedList = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
            updateJobsState(updatedList);
          }}
          onTriggerEmail={(email) => setEmailModalData(email)}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
          canAccessFinancials={currentStaff.canAccessFinancials}
          canDelegate={currentStaff.canDelegate}
          onOpenDelegateModal={(job) => setJobToDelegate(job)}
          onOpenCompleteTaskModal={(task, job) => setTaskToComplete({ task, job })}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onApproveTaskReview={handleApproveTaskReview}
          onRequestTaskRevision={handleRequestTaskRevision}
          currentStaff={currentStaff}
          nowTimestamp={nowTimestamp}
        />
      )}

      {/* MODAL 2: Automated Email Simulator Modal */}
      <EmailSimulatorModal
        email={emailModalData}
        onClose={() => setEmailModalData(null)}
        onSend={() => {
          alert(`Automated notification email successfully sent to ${emailModalData?.recipientEmail}!`);
          setEmailModalData(null);
        }}
      />

      {/* MODAL 3: New Job Intake Modal */}
      <NewJobModal
        isOpen={isNewJobModalOpen}
        onClose={() => setIsNewJobModalOpen(false)}
        onCreateJob={handleCreateJob}
      />

      {/* MODAL 4: Delegate Work Modal */}
      {jobToDelegate && (
        <DelegateWorkModal
          isOpen={!!jobToDelegate}
          onClose={() => setJobToDelegate(null)}
          job={jobToDelegate}
          currentStaff={currentStaff}
          onDelegateTask={handleDelegateTask}
        />
      )}

      {/* MODAL 5: Mark Task Completed & Submit for Review Modal */}
      {taskToComplete && (
        <CompleteTaskModal
          isOpen={!!taskToComplete}
          onClose={() => setTaskToComplete(null)}
          task={taskToComplete.task}
          job={taskToComplete.job}
          currentStaff={currentStaff}
          onCompleteTask={handleCompleteTask}
        />
      )}

      {/* MODAL 6: Prompt Required Note To Start Timer Modal */}
      {timerPromptJob && (
        <StartTimerModal
          isOpen={!!timerPromptJob}
          onClose={() => setTimerPromptJob(null)}
          job={timerPromptJob.job}
          currentStaff={currentStaff}
          initialNote={timerPromptJob.initialNote}
          onConfirmStartTimer={(jobId, taskNote) => handleStartTimer(jobId, taskNote)}
        />
      )}

      {/* MODAL 7: Kyle's Delegation Return Review Inbox Modal */}
      <KyleDelegationInboxModal
        isOpen={isKyleInboxOpen}
        onClose={() => setIsKyleInboxOpen(false)}
        jobs={jobs}
        currentStaff={currentStaff}
        onSelectJob={(job) => {
          setSelectedJobForDetail(job);
          setIsKyleInboxOpen(false);
        }}
        onApproveTaskReview={handleApproveTaskReview}
        onRequestTaskRevision={handleRequestTaskRevision}
        onOpenRevisionModal={(task, job) => {
          if (job) {
            setSelectedJobForDetail(job);
            setIsKyleInboxOpen(false);
          }
        }}
      />

      {/* WIDGET: General Studio Team Chat Widget */}
      <GeneralChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        currentStaff={currentStaff}
        jobs={jobs}
        onSendMessage={handleSendChatMessage}
        onDeleteMessage={handleDeleteChatMessage}
        onSelectJob={(job) => setSelectedJobForDetail(job)}
        onMarkAsRead={handleMarkChatRead}
      />

    </div>
  );
}
