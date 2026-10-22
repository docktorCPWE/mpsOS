import React, { useState, useEffect, useRef } from 'react';
import { Job, JobPhase, EmailTemplate, PinnedLocation, TimeLog, JobComment, StaffUser, AppNotification, DelegatedWorkItem, ChatMessage, TimeCardShift, TimeCardBreak, GregDevProjectCard, GregDevTimeEntry, PayrollEntry, DeliverableFile } from './types';
import { getStoredJobs, saveStoredJobs, resetStoredJobs, getStoredChatMessages, saveStoredChatMessages, STAFF_USERS, INITIAL_NOTIFICATIONS, isMessageRelevantForUser, getStoredStaff, saveStoredStaff, resetStoredStaff, getStoredTimeCards, saveStoredTimeCards, resetStoredTimeCards, isStaffExemptFromClock, getStoredNotifications, saveStoredNotifications, addDismissedNotificationId, canUserCreateJob, getStoredActiveStaffId, saveStoredActiveStaffId, getStoredPayrollEntries, saveStoredPayrollEntries, resetStoredPayrollEntries, getStoredPreferredLayout, saveStoredPreferredLayout } from './data/mockData';
import { 
  isUserGregHyatt, 
  getStoredGregDevCards, 
  saveStoredGregDevCards, 
  getStoredGregDevEntries, 
  saveStoredGregDevEntries 
} from './utils/gregDevTimeService';
import { HeaderNav } from './components/HeaderNav';
import { AuthScreen } from './components/AuthScreen';
import {
  testConnection,
  subscribeToJobs,
  saveJobToFirestore,
  seedInitialJobsToFirestore,
  subscribeToStaff,
  saveStaffToFirestore,
  deleteStaffFromFirestore,
  seedStaffToFirestore,
  subscribeToChat,
  saveChatMessageToFirestore,
  deleteChatMessageFromFirestore,
  deleteMultipleChatMessagesFromFirestore,
  markChatMessagesAsReadInFirestore,
  purgeDummyDataFromFirestore,
  subscribeToAuth,
  syncAuthToStaffUser,
  logoutUser,
  purgeRemovedMockStaff,
  subscribeToDevTimeEntries,
  saveDevTimeEntryToFirestore,
  subscribeToDevProjectCards,
  saveDevProjectCardsToFirestore,
  subscribeToPayrollEntries,
  savePayrollEntryToFirestore,
  deletePayrollEntryFromFirestore,
  seedInitialPayrollEntries
} from './services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { DrafterDashboard } from './components/DrafterDashboard';
import { AdminBillingDashboard } from './components/AdminBillingDashboard';
import { CustomerPortal } from './components/CustomerPortal';
import { JobDetailModal } from './components/JobDetailModal';
import { EmailSimulatorModal } from './components/EmailSimulatorModal';
import { NewJobModal } from './components/NewJobModal';
import { DelegateWorkModal } from './components/DelegateWorkModal';
import { StartTimerModal } from './components/StartTimerModal';
import { StopTimerModal } from './components/StopTimerModal';
import { CompleteTaskModal, CompleteTaskPayload } from './components/CompleteTaskModal';
import { KyleDelegationInboxModal } from './components/KyleDelegationInboxModal';
import { GeneralChatWidget } from './components/GeneralChatWidget';
import { StaffManagementModal } from './components/StaffManagementModal';
import { TimeClockBar } from './components/TimeClockBar';
import { TimeCardModal } from './components/TimeCardModal';
import { GregDevProjectCardsSection } from './components/GregDevProjectCardsSection';
import { GregDevTimeReviewModal } from './components/GregDevTimeReviewModal';
import { getLocalDateString } from './utils/timeCardExport';
import { formatSecondsToReadable } from './utils/timeUtils';

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
  
  // Staff User, Notifications & Time Cards State
  const [staffList, setStaffList] = useState<StaffUser[]>(STAFF_USERS);
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(STAFF_USERS[0]); // Default: Greg Hyatt (Owner)
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getStoredNotifications());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [timeCards, setTimeCards] = useState<TimeCardShift[]>([]);
  const [pausedJobsNotice, setPausedJobsNotice] = useState<{ jobNumbers: string[]; type: 'paused' | 'resumed' | 'clock_out_stopped' } | null>(null);

  // Greg Hyatt Dev Project Cards & Timesheet State
  const [devCards, setDevCards] = useState<GregDevProjectCard[]>(() => getStoredGregDevCards());
  const [devEntries, setDevEntries] = useState<GregDevTimeEntry[]>(() => getStoredGregDevEntries());
  const [isDevReviewModalOpen, setIsDevReviewModalOpen] = useState(false);

  // Payroll Entries State
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>(() => getStoredPayrollEntries());

  // Firebase Authentication State
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isDemoModeBypassed, setIsDemoModeBypassed] = useState<boolean>(false);

  // Modals state
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<Job | null>(null);
  const [jobDetailInitialTab, setJobDetailInitialTab] = useState<'overview' | 'canvas' | 'deliverables' | 'comments' | 'audit' | 'time'>('overview');
  const [jobDetailHighlightCommentId, setJobDetailHighlightCommentId] = useState<string | undefined>(undefined);
  const [emailModalData, setEmailModalData] = useState<EmailTemplate | null>(null);
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [jobToDelegate, setJobToDelegate] = useState<Job | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<{ task: DelegatedWorkItem; job: Job } | null>(null);
  const [timerPromptJob, setTimerPromptJob] = useState<{ job: Job; initialNote?: string } | null>(null);
  const [stopTimerPromptJob, setStopTimerPromptJob] = useState<{ job: Job; initialNote?: string } | null>(null);
  const [isKyleInboxOpen, setIsKyleInboxOpen] = useState(false);
  const [isStaffManagementOpen, setIsStaffManagementOpen] = useState(false);
  const [isTimeCardModalOpen, setIsTimeCardModalOpen] = useState(false);
  const [timeCardModalStaffId, setTimeCardModalStaffId] = useState<string | undefined>(undefined);
  const devCardsCloudDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleOpenJobDetail = (job: Job, options?: { initialTab?: 'overview' | 'canvas' | 'deliverables' | 'comments' | 'audit' | 'time'; highlightCommentId?: string }) => {
    setSelectedJobForDetail(job);
    setJobDetailInitialTab(options?.initialTab || 'overview');
    setJobDetailHighlightCommentId(options?.highlightCommentId);
  };

  // Live ticker for active timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize jobs, staff, chat, and time cards from local storage or cloud Firestore
  useEffect(() => {
    // 1. Immediate local fallback load
    const loaded = getStoredJobs();
    setJobs(loaded);
    if (loaded.length > 0) {
      setSelectedCustomerId(loaded[0].id);
    }
    setChatMessages(getStoredChatMessages());
    const storedStaff = getStoredStaff();
    setStaffList(storedStaff);
    const activeStaffId = getStoredActiveStaffId();
    const matchingStaff = (activeStaffId && storedStaff.find(s => s.id === activeStaffId || s.name.toLowerCase() === activeStaffId.toLowerCase() || (s.name.toLowerCase().includes('kyle') && activeStaffId.toLowerCase().includes('kyle')))) ||
      storedStaff.find(s => s.id === 'staff-greg') ||
      storedStaff[0];
    if (matchingStaff) {
      const layoutPref = matchingStaff.preferredLayout || getStoredPreferredLayout(matchingStaff.id || matchingStaff.email);
      setCurrentStaff({ ...matchingStaff, preferredLayout: layoutPref });
    }
    setTimeCards(getStoredTimeCards());

    // 2. Test Firebase connection & purge dummy data from cloud
    testConnection();
    purgeDummyDataFromFirestore().catch(err => console.warn('Dummy data purge skipped/failed:', err));

    // 3. Connect real-time Firestore synchronization
    const unsubscribeJobs = subscribeToJobs(
      (cloudJobs) => {
        if (cloudJobs && cloudJobs.length > 0) {
          setJobs(cloudJobs);
          saveStoredJobs(cloudJobs);
          setSelectedCustomerId(prev => prev || cloudJobs[0].id);

          // Keep selectedJobForDetail synchronized with cloud updates if open
          setSelectedJobForDetail(prevSelected => {
            if (!prevSelected) return null;
            const updated = cloudJobs.find(j => j.id === prevSelected.id);
            return updated || prevSelected;
          });
        }
      },
      () => {
        // Database collection is currently empty; seed initial jobs
        const local = getStoredJobs();
        if (local && local.length > 0) {
          seedInitialJobsToFirestore(local);
        }
      }
    );

    const unsubscribeStaff = subscribeToStaff(
      (cloudStaff) => {
        if (cloudStaff && cloudStaff.length > 0) {
          // Ensure all core staff (Greg, Kyle, Jason, Drew, Ethan) exist in roster
          const merged = [...cloudStaff];
          for (const core of STAFF_USERS) {
            const exists = merged.some(s => s.id === core.id || s.name.toLowerCase() === core.name.toLowerCase() || (core.name.toLowerCase().includes('kyle') && s.name.toLowerCase().includes('kyle')));
            if (!exists) {
              merged.push(core);
            }
          }

          // Filter out mock staff-aaron or staff-james
          const cleanMerged = merged.filter(s => 
            s.id !== 'staff-aaron' && 
            s.id !== 'staff-james' && 
            s.email !== 'aaron@myplanstore.com' && 
            s.email !== 'james@myplanstore.com' &&
            s.name.trim().toLowerCase() !== 'aaron' &&
            s.name.trim().toLowerCase() !== 'james'
          );

          setStaffList(cleanMerged);
          saveStoredStaff(cleanMerged);

          // Update currentStaff if matching cloud record has latest edits to capabilities
          setCurrentStaff(prevCurrent => {
            const updatedMatch = cleanMerged.find(s => s.id === prevCurrent.id) ||
                                 cleanMerged.find(s => s.email && prevCurrent.email && s.email.toLowerCase() === prevCurrent.email.toLowerCase()) ||
                                 cleanMerged.find(s => s.name.toLowerCase() === prevCurrent.name.toLowerCase()) ||
                                 (prevCurrent.name.toLowerCase().includes('kyle') ? cleanMerged.find(s => s.name.toLowerCase().includes('kyle')) : undefined);
            return updatedMatch ? { ...prevCurrent, ...updatedMatch } : prevCurrent;
          });
        }
      },
      () => {
        seedStaffToFirestore(STAFF_USERS);
      }
    );

    const unsubscribeChat = subscribeToChat((cloudMsgs) => {
      if (cloudMsgs) {
        setChatMessages(cloudMsgs);
        saveStoredChatMessages(cloudMsgs);
      }
    });

    const unsubscribeDevEntries = subscribeToDevTimeEntries((entries) => {
      if (entries && entries.length > 0) {
        setDevEntries(entries);
        saveStoredGregDevEntries(entries);
      }
    });

    const unsubscribeDevCards = subscribeToDevProjectCards((cards) => {
      if (cards && cards.length > 0) {
        setDevCards((prev) => {
          return cards.map((c) => {
            const local = prev.find((p) => p.id === c.id);
            if (local) {
              return {
                ...c,
                // Preserve local notes and local running timer state
                currentNotes: local.currentNotes !== undefined ? local.currentNotes : (c.currentNotes || ''),
                isActive: local.isActive ?? c.isActive,
                activeTimerStart: local.activeTimerStart ?? c.activeTimerStart
              };
            }
            return c;
          });
        });
        saveStoredGregDevCards(cards);
      }
    });

    const unsubscribePayroll = subscribeToPayrollEntries(
      (cloudPayroll) => {
        if (cloudPayroll && cloudPayroll.length > 0) {
          setPayrollEntries(cloudPayroll);
          saveStoredPayrollEntries(cloudPayroll);
        }
      },
      () => {
        const local = getStoredPayrollEntries();
        if (local && local.length > 0) {
          seedInitialPayrollEntries(local);
        }
      }
    );

    return () => {
      unsubscribeJobs();
      unsubscribeStaff();
      unsubscribeChat();
      unsubscribeDevEntries();
      unsubscribeDevCards();
      unsubscribePayroll();
    };
  }, []);

  // Listen to Firebase Auth state & sync authenticated staff user
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuth(async (user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
      if (user && user.emailVerified) {
        try {
          const matched = await syncAuthToStaffUser(user, staffList);
          const layoutPref = matched.preferredLayout || getStoredPreferredLayout(matched.id || matched.email);
          setCurrentStaff({ ...matched, preferredLayout: layoutPref });
          saveStoredActiveStaffId(matched.id);
        } catch (err) {
          console.warn('[Auth] Staff profile sync notice:', err);
        }
      }
    });
    return () => unsubscribeAuth();
  }, [staffList]);

  const handleSignOut = async () => {
    await logoutUser();
    setAuthUser(null);
    setIsDemoModeBypassed(false);
  };

  // Sync jobs state to localStorage and Firestore whenever modified
  const updateJobsState = (newJobs: Job[], specificJobId?: string) => {
    setJobs(newJobs);
    saveStoredJobs(newJobs);

    // Sync only modified job(s) to Firestore to avoid redundant concurrent write storms
    const jobsToSync = specificJobId
      ? newJobs.filter(j => j.id === specificJobId)
      : newJobs.filter(newJob => {
          const oldJob = jobs.find(j => j.id === newJob.id);
          if (!oldJob) return true;
          return JSON.stringify(newJob) !== JSON.stringify(oldJob);
        });

    jobsToSync.forEach(job => {
      saveJobToFirestore(job).catch(err => {
        console.warn('[Firestore] Sync warning for job:', job.job_number, err);
      });
    });
    
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

    // Update stopTimerPromptJob if open
    if (stopTimerPromptJob) {
      const match = newJobs.find(j => j.id === stopTimerPromptJob.job.id);
      if (match) setStopTimerPromptJob(prev => prev ? { ...prev, job: match } : null);
    }
  };

  // Helper to update and persist notifications across page loads and sessions
  const updateNotificationsState = (updater: (prev: AppNotification[]) => AppNotification[]) => {
    setNotifications(prev => {
      const next = updater(prev);
      saveStoredNotifications(next);
      return next;
    });
  };

  // Mark notification as read and persist
  const handleMarkNotificationRead = (notificationId: string) => {
    updateNotificationsState(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  // Toggle notification read/unread and persist
  const handleToggleNotificationRead = (notificationId: string) => {
    updateNotificationsState(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: !n.read } : n))
    );
  };

  // Delete / Dismiss a single notification
  const handleDeleteNotification = (notificationId: string) => {
    addDismissedNotificationId(notificationId);
    updateNotificationsState(prev => prev.filter(n => n.id !== notificationId));
  };

  // Mark all notifications as read (optionally scoped to staff recipient)
  const handleMarkAllNotificationsRead = (recipientName?: string) => {
    updateNotificationsState(prev =>
      prev.map(n => {
        if (!recipientName) return { ...n, read: true };
        const match = n.recipientName.toLowerCase().includes(recipientName.toLowerCase()) ||
                      recipientName.toLowerCase().includes(n.recipientName.toLowerCase());
        return match ? { ...n, read: true } : n;
      })
    );
  };

  // Clear all notifications for staff recipient
  const handleClearAllNotifications = (recipientName?: string) => {
    updateNotificationsState(prev => {
      if (!recipientName) {
        prev.forEach(n => addDismissedNotificationId(n.id));
        return [];
      }
      const toRemove = prev.filter(n =>
        n.recipientName.toLowerCase().includes(recipientName.toLowerCase()) ||
        recipientName.toLowerCase().includes(n.recipientName.toLowerCase())
      );
      toRemove.forEach(n => addDismissedNotificationId(n.id));
      return prev.filter(n => !toRemove.includes(n));
    });
  };

  // Clear only read notifications for staff recipient
  const handleClearReadNotifications = (recipientName?: string) => {
    updateNotificationsState(prev => {
      const toRemove = prev.filter(n => {
        if (!n.read) return false;
        if (!recipientName) return true;
        return (
          n.recipientName.toLowerCase().includes(recipientName.toLowerCase()) ||
          recipientName.toLowerCase().includes(n.recipientName.toLowerCase())
        );
      });
      toRemove.forEach(n => addDismissedNotificationId(n.id));
      return prev.filter(n => !toRemove.includes(n));
    });
  };

  // Dispatch new app notifications and persist to storage
  const handleDispatchNotifications = (newNotifs: AppNotification[]) => {
    if (!newNotifs || newNotifs.length === 0) return;
    updateNotificationsState(prev => [...newNotifs, ...prev]);
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
          active_timer_drafter_id: currentStaff.id,
          active_timer_drafter_name: currentStaff.name,
          paused_by_break: false,
          paused_timer_task: undefined,
          paused_timer_drafter_id: undefined,
          paused_timer_drafter_name: undefined,
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

  // Confirm and execute stopping of the timer with a required work completed note
  const handleConfirmStopTimer = (jobId: string, completedWorkNote: string) => {
    const trimmed = completedWorkNote.trim();
    if (!trimmed) return;

    const updatedJobs = jobs.map(j => {
      if (j.id === jobId && (j.active_timer_start || j.paused_by_break)) {
        const startMs = j.active_timer_start ? new Date(j.active_timer_start).getTime() : Date.now();
        const endMs = Date.now();
        const durationSeconds = j.active_timer_start 
          ? Math.max(1, Math.floor((endMs - startMs) / 1000))
          : (j.paused_elapsed_seconds || 0);

        const drafterDisplayName = j.active_timer_drafter_name || currentStaff.name || j.assigned_drafter.split(',')[0];
        const durationFormatted = formatSecondsToReadable(durationSeconds);

        const newLog: TimeLog | null = durationSeconds > 0 ? {
          id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          drafterName: drafterDisplayName,
          startTime: j.active_timer_start || new Date().toISOString(),
          endTime: new Date(endMs).toISOString(),
          durationSeconds,
          taskDescription: trimmed,
          hourlyRate: j.hourly_rate || 85
        } : null;

        // Post work completed note as an item in the Messages & Notes area inside the project card
        const timerComment: JobComment = {
          id: `c-timer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          author: drafterDisplayName,
          authorId: currentStaff.id,
          role: 'drafter',
          text: `⏱️ Drafting Session Completed (${durationFormatted}):\n"${trimmed}"`,
          timestamp: new Date().toISOString()
        };

        const updatedLogs = newLog ? [...(j.time_logs || []), newLog] : (j.time_logs || []);
        const totalSec = updatedLogs.reduce((s, l) => s + (l.durationSeconds || 0), 0);
        const totalMins = Math.round(totalSec / 60);
        const totalHours = Number((totalSec / 3600).toFixed(2));

        return {
          ...j,
          active_timer_start: undefined,
          active_timer_task: undefined,
          active_timer_drafter_id: undefined,
          active_timer_drafter_name: undefined,
          paused_by_break: false,
          paused_timer_task: undefined,
          paused_timer_drafter_id: undefined,
          paused_timer_drafter_name: undefined,
          paused_elapsed_seconds: undefined,
          time_logs: updatedLogs,
          total_time_entries: updatedLogs.length,
          total_duration_minutes: totalMins,
          total_duration_hours: totalHours,
          comments: [...(j.comments || []), timerComment],
          audit_logs: [
            {
              id: `a-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              action: 'Timer Stopped & Work Logged',
              performedBy: drafterDisplayName,
              timestamp: new Date().toISOString(),
              details: durationSeconds > 0 
                ? `Logged ${durationFormatted} for: "${trimmed}" (posted to Messages & Notes)`
                : `Session stopped for: "${trimmed}"`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);
    setStopTimerPromptJob(null);
  };

  // Timer Stop Handler - prompts for mandatory note if missing
  const handleStopTimer = (jobId: string, taskNote?: string) => {
    const trimmed = taskNote ? taskNote.trim() : '';

    // If no note provided, prompt user with StopTimerModal to require work note
    if (!trimmed) {
      const target = jobs.find(j => j.id === jobId);
      if (target) {
        setStopTimerPromptJob({
          job: target,
          initialNote: target.active_timer_task || ''
        });
      }
      return;
    }

    handleConfirmStopTimer(jobId, trimmed);
  };

  // Reset demo data helper
  const handleResetData = () => {
    if (window.confirm('Reset all jobs to default sample architectural plans?')) {
      const reset = resetStoredJobs();
      setJobs(reset);
      setNotifications(INITIAL_NOTIFICATIONS);
      setChatMessages(getStoredChatMessages());
      const resetStaff = resetStoredStaff();
      setStaffList(resetStaff);
      const resetCards = resetStoredTimeCards();
      setTimeCards(resetCards);
      const resetPayroll = resetStoredPayrollEntries();
      setPayrollEntries(resetPayroll);
      if (reset.length > 0) setSelectedCustomerId(reset[0].id);
    }
  };

  // Payroll handlers
  const handleSavePayrollEntry = async (entry: PayrollEntry) => {
    const existingIdx = payrollEntries.findIndex(e => e.id === entry.id);
    let updated: PayrollEntry[];
    if (existingIdx >= 0) {
      updated = payrollEntries.map(e => e.id === entry.id ? entry : e);
    } else {
      updated = [entry, ...payrollEntries];
    }
    setPayrollEntries(updated);
    saveStoredPayrollEntries(updated);
    try {
      await savePayrollEntryToFirestore(entry);
    } catch (err) {
      console.warn('[Firestore] Error saving payroll entry:', err);
    }
  };

  const handleDeletePayrollEntry = async (entryId: string) => {
    const updated = payrollEntries.filter(e => e.id !== entryId);
    setPayrollEntries(updated);
    saveStoredPayrollEntries(updated);
    try {
      await deletePayrollEntryFromFirestore(entryId);
    } catch (err) {
      console.warn('[Firestore] Error deleting payroll entry:', err);
    }
  };

  // Time card & punch clock handlers
  const handleClockIn = (notes?: string) => {
    if (isStaffExemptFromClock(currentStaff)) {
      return;
    }
    const todayStr = getLocalDateString(new Date());
    const active = timeCards.find(s => s.staffId === currentStaff.id && (s.status === 'clocked_in' || s.status === 'on_break'));
    if (active) return;

    const newShift: TimeCardShift = {
      id: `shift-${currentStaff.id}-${Date.now()}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      date: todayStr,
      clockInTime: new Date().toISOString(),
      status: 'clocked_in',
      breaks: [],
      totalWorkSeconds: 0,
      totalBreakSeconds: 0,
      notes: notes || 'Regular Shift'
    };

    const updated = [newShift, ...timeCards];
    setTimeCards(updated);
    saveStoredTimeCards(updated);
  };

  const handleStartBreak = () => {
    if (isStaffExemptFromClock(currentStaff)) return;

    const curStaffLower = currentStaff.name.toLowerCase();
    const pausedJobNumbers: string[] = [];
    const pausedJobIds: string[] = [];

    // Helper to determine if an active timer belongs to the current staff member
    const isJobTimerForCurrentStaff = (j: Job) => {
      if (!j.active_timer_start) return false;
      if (j.active_timer_drafter_id) return j.active_timer_drafter_id === currentStaff.id;
      if (j.active_timer_drafter_name) return j.active_timer_drafter_name.toLowerCase() === curStaffLower;
      const assigned = (j.assigned_drafter || '').toLowerCase();
      if (assigned.includes(curStaffLower) || curStaffLower.includes(assigned.split(',')[0].trim())) return true;
      return false;
    };

    // Find and pause any active project timers for this employee
    const updatedJobs = jobs.map(j => {
      if (isJobTimerForCurrentStaff(j)) {
        const startMs = new Date(j.active_timer_start!).getTime();
        const endMs = Date.now();
        const durationSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
        const taskNote = j.active_timer_task || `Drafting ${j.current_status}`;

        pausedJobNumbers.push(j.job_number);
        pausedJobIds.push(j.id);

        const partialLog: TimeLog = {
          id: `tl-break-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          drafterName: currentStaff.name,
          startTime: j.active_timer_start!,
          endTime: new Date(endMs).toISOString(),
          durationSeconds,
          taskDescription: `${taskNote} (Pre-Break Segment)`,
          hourlyRate: j.hourly_rate || 85
        };

        const updatedLogs = [...(j.time_logs || []), partialLog];
        const totalSec = updatedLogs.reduce((s, l) => s + (l.durationSeconds || 0), 0);
        const totalMins = Math.round(totalSec / 60);
        const totalHours = Number((totalSec / 3600).toFixed(2));

        return {
          ...j,
          active_timer_start: undefined,
          active_timer_task: undefined,
          active_timer_drafter_id: undefined,
          active_timer_drafter_name: undefined,
          paused_by_break: true,
          paused_timer_task: taskNote,
          paused_timer_drafter_id: currentStaff.id,
          paused_timer_drafter_name: currentStaff.name,
          time_logs: updatedLogs,
          total_time_entries: updatedLogs.length,
          total_duration_minutes: totalMins,
          total_duration_hours: totalHours,
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Timer Auto-Paused (Break)',
              performedBy: currentStaff.name,
              timestamp: new Date().toISOString(),
              details: `Drafting timer on ${j.job_number} auto-paused for employee break. Logged ${Math.round(durationSeconds / 60)} mins pre-break.`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    if (pausedJobNumbers.length > 0) {
      updateJobsState(updatedJobs);
      setPausedJobsNotice({ jobNumbers: pausedJobNumbers, type: 'paused' });
    }

    // Update timecard shift status to on_break
    const existingActiveShift = timeCards.find(s => s.staffId === currentStaff.id && (s.status === 'clocked_in' || !s.clockOutTime));
    
    let updatedCards: TimeCardShift[];
    if (existingActiveShift) {
      updatedCards = timeCards.map(s => {
        if (s.id === existingActiveShift.id) {
          const newBreak: TimeCardBreak = {
            id: `brk-${Date.now()}`,
            startTime: new Date().toISOString()
          };
          return {
            ...s,
            status: 'on_break' as const,
            breaks: [...(s.breaks || []), newBreak],
            pausedProjectJobIds: pausedJobIds
          };
        }
        return s;
      });
    } else {
      // Auto-clock in and immediately start break if not already clocked in
      const todayStr = getLocalDateString(new Date());
      const newShift: TimeCardShift = {
        id: `tc-${Date.now()}`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        date: todayStr,
        clockInTime: new Date().toISOString(),
        status: 'on_break',
        breaks: [{ id: `brk-${Date.now()}`, startTime: new Date().toISOString() }],
        totalWorkSeconds: 0,
        totalBreakSeconds: 0,
        notes: 'Break started',
        pausedProjectJobIds: pausedJobIds
      };
      updatedCards = [newShift, ...timeCards];
    }

    setTimeCards(updatedCards);
    saveStoredTimeCards(updatedCards);

    // For Greg Hyatt: Pause any active Dev Project Card timers during shift break
    if (isUserGregHyatt(currentStaff)) {
      const runningCards = devCards.filter(c => c.isActive && c.activeTimerStart);
      if (runningCards.length > 0) {
        const newDevLogs: GregDevTimeEntry[] = [];
        const updatedDevCards = devCards.map(c => {
          if (c.isActive && c.activeTimerStart) {
            const startMs = new Date(c.activeTimerStart).getTime();
            const endMs = Date.now();
            const durationSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
            const hours = durationSeconds / 3600;
            const rate = currentStaff.hourlyRate || 150;
            const billableAmount = Number((hours * rate).toFixed(2));

            const log: GregDevTimeEntry = {
              id: `dev-entry-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              staffId: currentStaff.id,
              staffName: currentStaff.name,
              projectType: c.projectType,
              date: getLocalDateString(new Date()),
              startTime: c.activeTimerStart,
              endTime: new Date(endMs).toISOString(),
              durationSeconds,
              notes: `${c.currentNotes || c.projectType} (Paused for shift break)`,
              hourlyRate: rate,
              billableAmount,
              shiftId: existingActiveShift?.id,
              createdAt: new Date().toISOString()
            };
            newDevLogs.push(log);
            saveDevTimeEntryToFirestore(log);

            return {
              ...c,
              isActive: false,
              isPausedByBreak: true,
              activeTimerStart: undefined,
              todaySeconds: (c.todaySeconds || 0) + durationSeconds,
              totalSeconds: (c.totalSeconds || 0) + durationSeconds,
              lastStoppedAt: new Date(endMs).toISOString()
            };
          }
          return c;
        });

        if (newDevLogs.length > 0) {
          const allEntries = [...newDevLogs, ...devEntries];
          setDevEntries(allEntries);
          saveStoredGregDevEntries(allEntries);
        }
        setDevCards(updatedDevCards);
        saveStoredGregDevCards(updatedDevCards);
        saveDevProjectCardsToFirestore(updatedDevCards);
      }
    }
  };

  const handleResumeFromBreak = () => {
    if (isStaffExemptFromClock(currentStaff)) return;

    const curStaffLower = currentStaff.name.toLowerCase();
    const resumedJobNumbers: string[] = [];

    // Find shift to get paused jobs
    const activeShift = timeCards.find(s => s.staffId === currentStaff.id && s.status === 'on_break');
    const pausedJobIds = activeShift?.pausedProjectJobIds || [];

    // Helper to determine if a paused job belongs to this returning staff member
    const isJobPausedForCurrentStaff = (j: Job) => {
      if (!j.paused_by_break && !pausedJobIds.includes(j.id)) return false;
      if (pausedJobIds.includes(j.id)) return true;
      if (j.paused_timer_drafter_id) return j.paused_timer_drafter_id === currentStaff.id;
      if (j.paused_timer_drafter_name) return j.paused_timer_drafter_name.toLowerCase() === curStaffLower;
      const assigned = (j.assigned_drafter || '').toLowerCase();
      if (assigned.includes(curStaffLower) || curStaffLower.includes(assigned.split(',')[0].trim())) return true;
      return false;
    };

    // Automatically resume project timers
    const updatedJobs = jobs.map(j => {
      if (isJobPausedForCurrentStaff(j)) {
        resumedJobNumbers.push(j.job_number);
        const taskToResume = j.paused_timer_task || `Drafting ${j.current_status}`;
        return {
          ...j,
          paused_by_break: false,
          paused_timer_task: undefined,
          paused_timer_drafter_id: undefined,
          paused_timer_drafter_name: undefined,
          active_timer_start: new Date().toISOString(),
          active_timer_task: taskToResume,
          active_timer_drafter_id: currentStaff.id,
          active_timer_drafter_name: currentStaff.name,
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Timer Resumed from Break',
              performedBy: currentStaff.name,
              timestamp: new Date().toISOString(),
              details: `Drafting timer on ${j.job_number} automatically resumed upon returning from break (${taskToResume}).`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    if (resumedJobNumbers.length > 0) {
      updateJobsState(updatedJobs);
      setPausedJobsNotice({ jobNumbers: resumedJobNumbers, type: 'resumed' });
    }

    // Update timecard shift: close the open break and set status to clocked_in
    const updatedCards = timeCards.map(s => {
      if (s.staffId === currentStaff.id && s.status === 'on_break') {
        const closedBreaks = (s.breaks || []).map(b => {
          if (!b.endTime) {
            const endMs = Date.now();
            const startMs = new Date(b.startTime).getTime();
            return {
              ...b,
              endTime: new Date(endMs).toISOString(),
              durationSeconds: Math.max(0, Math.floor((endMs - startMs) / 1000))
            };
          }
          return b;
        });

        return {
          ...s,
          status: 'clocked_in' as const,
          breaks: closedBreaks,
          pausedProjectJobIds: []
        };
      }
      return s;
    });

    setTimeCards(updatedCards);
    saveStoredTimeCards(updatedCards);

    // For Greg Hyatt: Automatically resume Dev Project Card timers that were paused by break
    if (isUserGregHyatt(currentStaff)) {
      const pausedDevCards = devCards.filter(c => c.isPausedByBreak);
      if (pausedDevCards.length > 0) {
        const updatedDevCards = devCards.map(c => {
          if (c.isPausedByBreak) {
            return {
              ...c,
              isActive: true,
              isPausedByBreak: false,
              activeTimerStart: new Date().toISOString(),
              lastStartedAt: new Date().toISOString()
            };
          }
          return c;
        });
        setDevCards(updatedDevCards);
        saveStoredGregDevCards(updatedDevCards);
        saveDevProjectCardsToFirestore(updatedDevCards);
      }
    }
  };

  const handleClockOut = (notes?: string) => {
    if (isStaffExemptFromClock(currentStaff)) return;

    const curStaffLower = currentStaff.name.toLowerCase();
    const stoppedJobNumbers: string[] = [];

    // Helper to determine if an active or paused timer belongs to this clocking-out staff
    const isJobTimerForCurrentStaff = (j: Job) => {
      if (!j.active_timer_start && !j.paused_by_break) return false;
      if (j.active_timer_drafter_id) return j.active_timer_drafter_id === currentStaff.id;
      if (j.paused_timer_drafter_id) return j.paused_timer_drafter_id === currentStaff.id;
      if (j.active_timer_drafter_name) return j.active_timer_drafter_name.toLowerCase() === curStaffLower;
      if (j.paused_timer_drafter_name) return j.paused_timer_drafter_name.toLowerCase() === curStaffLower;
      const assigned = (j.assigned_drafter || '').toLowerCase();
      if (assigned.includes(curStaffLower) || curStaffLower.includes(assigned.split(',')[0].trim())) return true;
      return false;
    };

    // If any project timer is still running or paused for this user, stop and save it cleanly
    const updatedJobs = jobs.map(j => {
      if (isJobTimerForCurrentStaff(j)) {
        stoppedJobNumbers.push(j.job_number);
        let newLog: TimeLog | null = null;
        let durationSeconds = 0;
        const taskNote = j.active_timer_task || j.paused_timer_task || `Drafting ${j.current_status}`;

        if (j.active_timer_start) {
          const startMs = new Date(j.active_timer_start).getTime();
          const endMs = Date.now();
          durationSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
          newLog = {
            id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            drafterName: currentStaff.name,
            startTime: j.active_timer_start,
            endTime: new Date(endMs).toISOString(),
            durationSeconds,
            taskDescription: `${taskNote} (Shift End Auto-Stop)`,
            hourlyRate: j.hourly_rate || 85
          };
        }

        const updatedLogs = newLog ? [...(j.time_logs || []), newLog] : (j.time_logs || []);
        const totalSec = updatedLogs.reduce((s, l) => s + (l.durationSeconds || 0), 0);
        const totalMins = Math.round(totalSec / 60);
        const totalHours = Number((totalSec / 3600).toFixed(2));

        return {
          ...j,
          active_timer_start: undefined,
          active_timer_task: undefined,
          active_timer_drafter_id: undefined,
          active_timer_drafter_name: undefined,
          paused_by_break: false,
          paused_timer_task: undefined,
          paused_timer_drafter_id: undefined,
          paused_timer_drafter_name: undefined,
          time_logs: updatedLogs,
          total_time_entries: updatedLogs.length,
          total_duration_minutes: totalMins,
          total_duration_hours: totalHours,
          audit_logs: [
            {
              id: `a-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              action: 'Timer Stopped (Clock Out)',
              performedBy: currentStaff.name,
              timestamp: new Date().toISOString(),
              details: durationSeconds > 0 
                ? `Drafting timer on ${j.job_number} automatically stopped & finalized upon shift clock-out (${Math.round(durationSeconds / 60)} mins logged).`
                : `Drafting timer ended upon shift clock-out for "${taskNote}".`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);

    // Finalize active timecard shift
    const endMs = Date.now();
    const updatedCards = timeCards.map(s => {
      if (s.staffId === currentStaff.id && (s.status === 'clocked_in' || s.status === 'on_break')) {
        // Close open break if on break
        const finalBreaks = (s.breaks || []).map(b => {
          if (!b.endTime) {
            const bStartMs = new Date(b.startTime).getTime();
            return {
              ...b,
              endTime: new Date(endMs).toISOString(),
              durationSeconds: Math.max(0, Math.floor((endMs - bStartMs) / 1000))
            };
          }
          return b;
        });

        const totalBreakSec = finalBreaks.reduce((sum, b) => sum + (b.durationSeconds || 0), 0);
        const shiftGrossSec = Math.max(0, Math.floor((endMs - new Date(s.clockInTime).getTime()) / 1000));
        const totalWorkSec = Math.max(0, shiftGrossSec - totalBreakSec);

        return {
          ...s,
          clockOutTime: new Date(endMs).toISOString(),
          status: 'clocked_out' as const,
          breaks: finalBreaks,
          totalWorkSeconds: totalWorkSec,
          totalBreakSeconds: totalBreakSec,
          notes: notes || s.notes || 'Completed shift',
          pausedProjectJobIds: []
        };
      }
      return s;
    });

    setTimeCards(updatedCards);
    saveStoredTimeCards(updatedCards);

    // For Greg Hyatt: Stop and finalize all active or paused Dev Project Card timers upon clocking out
    if (isUserGregHyatt(currentStaff)) {
      const activeDevCards = devCards.filter(c => c.isActive && c.activeTimerStart);
      const newDevLogs: GregDevTimeEntry[] = [];
      const updatedDevCards = devCards.map(c => {
        let additionalSec = 0;
        if (c.isActive && c.activeTimerStart) {
          const startMs = new Date(c.activeTimerStart).getTime();
          const curEndMs = Date.now();
          additionalSec = Math.max(1, Math.floor((curEndMs - startMs) / 1000));
          const hours = additionalSec / 3600;
          const rate = currentStaff.hourlyRate || 150;
          const billableAmount = Number((hours * rate).toFixed(2));

          const log: GregDevTimeEntry = {
            id: `dev-entry-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            staffId: currentStaff.id,
            staffName: currentStaff.name,
            projectType: c.projectType,
            date: getLocalDateString(new Date()),
            startTime: c.activeTimerStart,
            endTime: new Date(curEndMs).toISOString(),
            durationSeconds: additionalSec,
            notes: `${c.currentNotes || c.projectType} (Shift Clock-Out Finalized)`,
            hourlyRate: rate,
            billableAmount,
            createdAt: new Date().toISOString()
          };
          newDevLogs.push(log);
          saveDevTimeEntryToFirestore(log);
        }

        return {
          ...c,
          isActive: false,
          isPausedByBreak: false,
          activeTimerStart: undefined,
          todaySeconds: (c.todaySeconds || 0) + additionalSec,
          totalSeconds: (c.totalSeconds || 0) + additionalSec,
          lastStoppedAt: additionalSec > 0 ? new Date().toISOString() : c.lastStoppedAt
        };
      });

      if (newDevLogs.length > 0) {
        const allEntries = [...newDevLogs, ...devEntries];
        setDevEntries(allEntries);
        saveStoredGregDevEntries(allEntries);
      }
      setDevCards(updatedDevCards);
      saveStoredGregDevCards(updatedDevCards);
      saveDevProjectCardsToFirestore(updatedDevCards);
    }

    if (stoppedJobNumbers.length > 0) {
      setPausedJobsNotice({ jobNumbers: stoppedJobNumbers, type: 'clock_out_stopped' });
    } else {
      setPausedJobsNotice(null);
    }
  };

  // Staff Management handlers
  const handleAddStaff = (newStaff: StaffUser) => {
    const updated = [...staffList, newStaff];
    setStaffList(updated);
    saveStoredStaff(updated);
    saveStaffToFirestore(newStaff).catch(err => console.warn('[Firestore] Error saving staff:', err));
  };

  const handleUpdateStaff = (updatedStaff: StaffUser) => {
    const updated = staffList.map(s => {
      const isMatch = s.id === updatedStaff.id ||
        (s.email && updatedStaff.email && s.email.toLowerCase() === updatedStaff.email.toLowerCase()) ||
        s.name.toLowerCase() === updatedStaff.name.toLowerCase() ||
        (updatedStaff.name.toLowerCase().includes('kyle') && s.name.toLowerCase().includes('kyle'));
      return isMatch ? updatedStaff : s;
    });
    setStaffList(updated);
    saveStoredStaff(updated);
    const isCurrentMatch = currentStaff.id === updatedStaff.id ||
      (currentStaff.email && updatedStaff.email && currentStaff.email.toLowerCase() === updatedStaff.email.toLowerCase()) ||
      currentStaff.name.toLowerCase() === updatedStaff.name.toLowerCase() ||
      (updatedStaff.name.toLowerCase().includes('kyle') && currentStaff.name.toLowerCase().includes('kyle'));
    if (isCurrentMatch) {
      setCurrentStaff(updatedStaff);
      saveStoredActiveStaffId(updatedStaff.id);
    }
    saveStaffToFirestore(updatedStaff).catch(err => console.warn('[Firestore] Error updating staff:', err));
  };

  const handleSelectStaff = (staff: StaffUser) => {
    const layoutPref = staff.preferredLayout || getStoredPreferredLayout(staff.id || staff.email);
    const staffWithPref = { ...staff, preferredLayout: layoutPref };
    setCurrentStaff(staffWithPref);
    saveStoredActiveStaffId(staff.id);
  };

  const handleUpdatePreferredLayout = (staffId: string, layout: 'board' | 'grid' | 'list' | 'table') => {
    saveStoredPreferredLayout(staffId, layout, currentStaff.email);

    setCurrentStaff(prev => {
      const isMatch = prev.id === staffId ||
        (prev.email && prev.email.toLowerCase() === staffId.toLowerCase()) ||
        prev.name.toLowerCase() === staffId.toLowerCase();
      if (isMatch) {
        const updated = { ...prev, preferredLayout: layout };
        saveStaffToFirestore(updated).catch(err => console.warn('[Firestore] Error saving layout pref:', err));
        return updated;
      }
      return prev;
    });

    setStaffList(prevList => {
      const updatedList = prevList.map(s => {
        const isMatch = s.id === staffId ||
          (s.email && s.email.toLowerCase() === staffId.toLowerCase()) ||
          s.name.toLowerCase() === staffId.toLowerCase();
        if (isMatch) {
          const updated = { ...s, preferredLayout: layout };
          saveStaffToFirestore(updated).catch(err => console.warn('[Firestore] Error saving layout pref:', err));
          return updated;
        }
        return s;
      });
      saveStoredStaff(updatedList);
      return updatedList;
    });
  };

  const handleDeleteStaff = (staffId: string) => {
    const updated = staffList.filter(s => s.id !== staffId);
    setStaffList(updated);
    saveStoredStaff(updated);
    if (currentStaff.id === staffId && updated.length > 0) {
      setCurrentStaff(updated[0]);
      saveStoredActiveStaffId(updated[0].id);
    }
    deleteStaffFromFirestore(staffId).catch(err => console.warn('[Firestore] Error deleting staff:', err));
  };

  const handleResetStaff = () => {
    const reset = resetStoredStaff();
    setStaffList(reset);
    const matching = reset.find(s => s.id === currentStaff.id) || reset[0];
    setCurrentStaff(matching);
    saveStoredActiveStaffId(matching.id);
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
    saveChatMessageToFirestore(newMsg).catch(err => console.warn('[Firestore] Error saving chat message:', err));

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
          updateNotificationsState(prev => [notif, ...prev]);
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
      updateNotificationsState(prev => [notif, ...prev]);
    }
  };

  const handleDeleteChatMessage = (messageId: string) => {
    setChatMessages(prev => {
      const updated = prev.filter(m => m.id !== messageId);
      saveStoredChatMessages(updated);
      return updated;
    });
    deleteChatMessageFromFirestore(messageId).catch(err => console.warn('[Firestore] Error deleting chat message:', err));
  };

  const handleDeleteMultipleChatMessages = (messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return;
    const idSet = new Set(messageIds);
    setChatMessages(prev => {
      const updated = prev.filter(m => !idSet.has(m.id));
      saveStoredChatMessages(updated);
      return updated;
    });
    deleteMultipleChatMessagesFromFirestore(messageIds).catch(err => console.warn('[Firestore] Error deleting multiple chat messages:', err));
  };

  const handleMarkChatRead = () => {
    setChatMessages(prev => {
      const relevantMsgs = prev.filter(m => isMessageRelevantForUser(m, currentStaff, jobs));
      const unreadIds = relevantMsgs
        .filter(m => !(m.readByStaffIds || []).includes(currentStaff.id))
        .map(m => m.id);

      if (unreadIds.length === 0) return prev;

      const updated = prev.map(m => {
        if (unreadIds.includes(m.id)) {
          return { ...m, readByStaffIds: [...(m.readByStaffIds || []), currentStaff.id] };
        }
        return m;
      });
      saveStoredChatMessages(updated);
      markChatMessagesAsReadInFirestore(unreadIds, currentStaff.id).catch(err => console.warn('[Firestore] Error syncing chat read status:', err));
      return updated;
    });
  };

  // Count unread chat messages for current staff (only counting messages relevant to their profile)
  const unreadChatCount = chatMessages.filter(
    m => isMessageRelevantForUser(m, currentStaff, jobs) && !m.readByStaffIds.includes(currentStaff.id)
  ).length;

  // 1. Update Job Status & Automatically Trigger Email
  const handleUpdateJobStatus = (jobId: string, newStatus: JobPhase) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;

    // Completed status can only be set by Kyle or Jason
    if (newStatus === 'Completed' && userRole === 'drafter') {
      const canMarkCompleted = currentStaff && (
        currentStaff.name.toLowerCase().includes('kyle') ||
        currentStaff.name.toLowerCase().includes('jason')
      );
      if (!canMarkCompleted) {
        alert('Permission Restricted: Only Kyle or Jason have the authority to mark a project as Completed.');
        return;
      }
    }

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

  // 3b. Add Specific Job Note (From Drafter Dashboard Table or Modals)
  const handleAddJobNote = (jobId: string, text: string, customTimestamp?: string) => {
    const updatedJobs = jobs.map(j => {
      if (j.id === jobId) {
        const newNote: JobComment = {
          id: `c-note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          author: currentStaff.name,
          authorId: currentStaff.id,
          role: 'drafter',
          text: text.trim(),
          timestamp: customTimestamp || new Date().toISOString(),
          isJobNote: true
        };

        return {
          ...j,
          comments: [...(j.comments || []), newNote]
        };
      }
      return j;
    });

    updateJobsState(updatedJobs);
    if (selectedJobForDetail && selectedJobForDetail.id === jobId) {
      const updatedJob = updatedJobs.find(j => j.id === jobId);
      if (updatedJob) setSelectedJobForDetail(updatedJob);
    }
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

  // 6. Create New Job Intake (Restricted strictly to Kyle or Jason Barnett)
  const handleCreateJob = (newJob: Job) => {
    if (!canUserCreateJob(currentStaff)) {
      alert('Permission Restricted: Only Kyle or Jason Barnett have authorization to create a new job.');
      return;
    }
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

    const taskDeliverables: DeliverableFile[] = (newTask.attachments || []).map((att, i) => {
      let category: DeliverableFile['category'] = 'Floor Plan';
      if (newTask.category === 'Exterior Elevations') category = 'Exterior Elevations';
      else if (newTask.category === 'Foundation Plan') category = 'Foundation Plan';
      else if (newTask.category === 'Electrical & Reflected Ceiling') category = 'Electrical & Reflected Ceiling';
      else if (newTask.category === '3D Render') category = '3D Render';
      else if (att.name.toLowerCase().endsWith('.dwg') || att.name.toLowerCase().endsWith('.dxf')) category = 'CAD / DWG File';
      else if (att.name.toLowerCase().endsWith('.pdf')) category = 'PDF Specs';

      return {
        id: `deliv-task-${Date.now()}-${i}`,
        title: `${newTask.componentTitle}: ${att.name}`,
        category,
        version: 'v1.0 (Task Reference)',
        uploadedAt: new Date().toISOString(),
        fileSize: att.size,
        previewType: (category === 'CAD / DWG File' ? 'cad_file' : (category === '3D Render' || att.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)) ? 'render_image' : 'pdf_spec') as any,
        fileUrl: att.url,
        fileName: att.name,
        changeNotes: `Attached for delegated component "${newTask.componentTitle}" (${newTask.assignedTo})`,
        authorDrafter: newTask.delegatedBy
      };
    });

    const updatedJobs = jobs.map(j => {
      if (j.id === newTask.jobId) {
        return {
          ...j,
          deliverables: [...(j.deliverables || []), ...taskDeliverables],
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

    updateJobsState(updatedJobs, newTask.jobId);

    // Create Notification for the assigned drafter
    if (notifyDrafter) {
      const assignedStaff = staffList.find(s => s.name.toLowerCase() === newTask.assignedTo.toLowerCase() || s.name.toLowerCase().includes(newTask.assignedTo.toLowerCase())) ||
                            STAFF_USERS.find(s => s.name === newTask.assignedTo);
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

      updateNotificationsState(prev => [newNotification, ...prev]);
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

    updateJobsState(updatedJobs, jobId);

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

      updateNotificationsState(prev => [completionNotif, ...prev]);
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

    updateJobsState(updatedJobs, payload.jobId);

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
      updateNotificationsState(prev => [...newNotifs, ...prev]);
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

    updateJobsState(updatedJobs, jobId);

    // Remove the delegation notification from the specific drafter, and send sign-off approval notification
    if (assignedDrafter) {
      const drafterStaff = STAFF_USERS.find(s => s.name.toLowerCase().includes(assignedDrafter.toLowerCase()));
      updateNotificationsState(prev => {
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

    updateJobsState(updatedJobs, jobId);

    // Notify drafter with clear Revision Request notification
    if (assignedDrafter) {
      const drafterStaff = STAFF_USERS.find(s => s.name.toLowerCase().includes(assignedDrafter.toLowerCase()));
      updateNotificationsState(prev => [
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

  // 12. Handle Updating Customer Contact Info (Email, Phone, Address, Name)
  const handleUpdateCustomerContact = (
    targetCustomerName: string,
    updatedContact: {
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      project_address?: string;
      updateAllPlans?: boolean;
      currentJobId?: string;
    }
  ) => {
    const nowIso = new Date().toISOString();
    const updatedJobs = jobs.map((job) => {
      const isTarget = updatedContact.updateAllPlans
        ? (job.customer_name && job.customer_name.trim().toLowerCase() === targetCustomerName.trim().toLowerCase()) ||
          (updatedContact.currentJobId && job.id === updatedContact.currentJobId)
        : (updatedContact.currentJobId ? job.id === updatedContact.currentJobId : (job.customer_name && job.customer_name.trim().toLowerCase() === targetCustomerName.trim().toLowerCase()));

      if (!isTarget) return job;

      const changeAudit: string[] = [];
      if (updatedContact.customer_name && updatedContact.customer_name !== job.customer_name) {
        changeAudit.push(`Name: "${job.customer_name}" ➔ "${updatedContact.customer_name}"`);
      }
      if (updatedContact.customer_email !== undefined && updatedContact.customer_email !== job.customer_email) {
        changeAudit.push(`Email: "${job.customer_email || 'none'}" ➔ "${updatedContact.customer_email || 'none'}"`);
      }
      if (updatedContact.customer_phone !== undefined && updatedContact.customer_phone !== job.customer_phone) {
        changeAudit.push(`Phone: "${job.customer_phone || 'none'}" ➔ "${updatedContact.customer_phone || 'none'}"`);
      }
      if (updatedContact.project_address !== undefined && updatedContact.project_address !== job.project_address) {
        changeAudit.push(`Address: "${job.project_address || 'none'}" ➔ "${updatedContact.project_address || 'none'}"`);
      }

      const updatedJob: Job = {
        ...job,
        customer_name: updatedContact.customer_name !== undefined ? updatedContact.customer_name : job.customer_name,
        customer_email: updatedContact.customer_email !== undefined ? updatedContact.customer_email : job.customer_email,
        customer_phone: updatedContact.customer_phone !== undefined ? updatedContact.customer_phone : job.customer_phone,
        project_address: updatedContact.project_address !== undefined ? updatedContact.project_address : job.project_address,
        audit_logs: [
          {
            id: `a-contact-${Date.now()}-${job.id}`,
            action: 'Customer Contact Info Updated',
            performedBy: currentStaff.name,
            timestamp: nowIso,
            details: changeAudit.length > 0 ? changeAudit.join('; ') : 'Contact information saved.'
          },
          ...job.audit_logs
        ]
      };

      return updatedJob;
    });

    updateJobsState(updatedJobs);

    // Keep selectedJobForDetail synchronized if open
    if (selectedJobForDetail) {
      const freshSelected = updatedJobs.find(j => j.id === selectedJobForDetail.id);
      if (freshSelected) {
        setSelectedJobForDetail(freshSelected);
      }
    }
  };

  // Get active selected customer job object
  const activeCustomerJob = jobs.find(j => j.id === selectedCustomerId) || jobs[0];

  // 1. Loading state while checking Firebase Auth status
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-400 rounded-full animate-spin mb-4" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold tracking-wide text-white font-sans">Connecting to My Plan Store OS...</p>
          <p className="text-xs text-slate-400 font-mono">Verifying authentication & security session</p>
        </div>
      </div>
    );
  }

  // 2. Gate access: Require user to be authenticated and have a verified email address
  const isAuthRequired = !isDemoModeBypassed && (!authUser || !authUser.emailVerified);
  if (isAuthRequired) {
    return (
      <AuthScreen
        currentUser={authUser}
        onAuthenticated={async (user) => {
          setAuthUser(user);
          setIsDemoModeBypassed(false);
          try {
            const matched = await syncAuthToStaffUser(user, staffList);
            setCurrentStaff(matched);
          } catch (err) {
            console.warn('[Auth] Staff profile sync notice:', err);
          }
        }}
        onBypassDemo={() => setIsDemoModeBypassed(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 selection:bg-blue-500 selection:text-white flex flex-col">
      
      {/* Guest Demo Mode Banner if user bypassed authentication to inspect system */}
      {isDemoModeBypassed && !authUser && (
        <div className="bg-amber-950 border-b border-amber-800 px-4 py-2 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-mono">
              Guest Preview Mode
            </span>
            <span>You are browsing the workspace in demo mode. Sign in to link your verified employee credentials.</span>
          </div>
          <button
            onClick={() => setIsDemoModeBypassed(false)}
            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg transition shadow-xs cursor-pointer"
          >
            Employee Sign In / Sign Up
          </button>
        </div>
      )}

      {/* Top OS Header Bar */}
      <HeaderNav
        userRole={userRole}
        setUserRole={setUserRole}
        currentStaff={currentStaff}
        setCurrentStaff={handleSelectStaff}
        staffList={staffList}
        selectedCustomerId={selectedCustomerId}
        setSelectedCustomerId={setSelectedCustomerId}
        jobs={jobs}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onToggleNotificationRead={handleToggleNotificationRead}
        onDeleteNotification={handleDeleteNotification}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onClearAllNotifications={handleClearAllNotifications}
        onClearReadNotifications={handleClearReadNotifications}
        onSelectJob={handleOpenJobDetail}
        onOpenNewJobModal={() => {
          if (!canUserCreateJob(currentStaff)) {
            alert('Permission Restricted: Only Kyle or Jason Barnett are authorized to create a new job.');
            return;
          }
          setIsNewJobModalOpen(true);
        }}
        onOpenStaffManagement={() => setIsStaffManagementOpen(true)}
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
        authUser={authUser}
        onSignOut={handleSignOut}
      />

      {/* Clock-In, Break & Clock-Out Bar (Accessible to all employees, with special manager view for Jason) */}
      {userRole !== 'customer' && (
        <TimeClockBar
          currentStaff={currentStaff}
          staffList={staffList}
          timeCards={timeCards}
          jobs={jobs}
          onClockIn={handleClockIn}
          onStartBreak={handleStartBreak}
          onResumeFromBreak={handleResumeFromBreak}
          onClockOut={handleClockOut}
          onOpenTimeCardModal={(staffId) => {
            setTimeCardModalStaffId(staffId || currentStaff.id);
            setIsTimeCardModalOpen(true);
          }}
          pausedJobsNotice={pausedJobsNotice}
          onClearPausedNotice={() => setPausedJobsNotice(null)}
        />
      )}

      {/* Greg Hyatt Dedicated Project Dev Time Cards (MPS OS Dev, BigX Media Dev, Sound Extraction Dev, Other Dev, FB Media Dev) */}
      {isUserGregHyatt(currentStaff) && userRole !== 'customer' && (() => {
        const activeGregShift = timeCards.find(
          s => (s.staffId === currentStaff.id || s.staffName.toLowerCase().includes('greg hyatt')) && 
               (s.status === 'clocked_in' || s.status === 'on_break')
        );
        const isClockedIn = Boolean(activeGregShift);
        const isOnBreak = activeGregShift?.status === 'on_break';

        return (
          <GregDevProjectCardsSection
            currentStaff={currentStaff}
            isClockedIn={isClockedIn}
            isOnBreak={isOnBreak}
            devCards={devCards}
            devEntries={devEntries}
            onUpdateDevCards={(updated) => {
              setDevCards(updated);
              saveStoredGregDevCards(updated);
              // Debounce saving dev cards to Firestore to prevent frequent write-snapshot feedback loops while typing
              if (devCardsCloudDebounceRef.current) {
                clearTimeout(devCardsCloudDebounceRef.current);
              }
              devCardsCloudDebounceRef.current = setTimeout(() => {
                saveDevProjectCardsToFirestore(updated).catch((err) => console.warn('Firestore dev card save error:', err));
              }, 1200);
            }}
            onUpdateDevEntries={(updated) => {
              setDevEntries(updated);
              saveStoredGregDevEntries(updated);
            }}
            onOpenReviewModal={() => setIsDevReviewModalOpen(true)}
            activeShiftId={activeGregShift?.id}
          />
        );
      })()}

      {/* Main OS View Switcher */}
      <main className="flex-1">
        {userRole === 'drafter' ? (
          <DrafterDashboard
            jobs={jobs}
            currentStaff={currentStaff}
            staffList={staffList}
            onUpdateStatus={handleUpdateJobStatus}
            onToggleRoadblock={handleToggleRoadblock}
            onSelectJob={handleOpenJobDetail}
            onOpenNewJobModal={() => setIsNewJobModalOpen(true)}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            onOpenDelegateModal={(job) => setJobToDelegate(job)}
            onOpenCompleteTaskModal={(task, job) => setTaskToComplete({ task, job })}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onApproveTaskReview={handleApproveTaskReview}
            onRequestTaskRevision={handleRequestTaskRevision}
            onOpenKyleInbox={() => setIsKyleInboxOpen(true)}
            onSaveDefaultLayout={handleUpdatePreferredLayout}
            onUpdateCustomerContact={handleUpdateCustomerContact}
            nowTimestamp={nowTimestamp}
            devCards={devCards}
            devEntries={devEntries}
            onOpenDevReviewModal={() => setIsDevReviewModalOpen(true)}
            onAddJobNote={handleAddJobNote}
          />
        ) : userRole === 'admin' ? (
          <AdminBillingDashboard
            jobs={jobs}
            currentStaff={currentStaff}
            staffList={staffList}
            onOpenStaffManagement={() => setIsStaffManagementOpen(true)}
            onUpdateStatus={handleUpdateJobStatus}
            onToggleRoadblock={handleToggleRoadblock}
            onSelectJob={handleOpenJobDetail}
            onUpdateJob={(updatedJob) => {
              const updatedList = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
              updateJobsState(updatedList);
              if (selectedJobForDetail && selectedJobForDetail.id === updatedJob.id) {
                setSelectedJobForDetail(updatedJob);
              }
            }}
            onDispatchNotifications={handleDispatchNotifications}
            nowTimestamp={nowTimestamp}
            payrollEntries={payrollEntries}
            onSavePayrollEntry={handleSavePayrollEntry}
            onDeletePayrollEntry={handleDeletePayrollEntry}
            devCards={devCards}
            devEntries={devEntries}
            onOpenDevReviewModal={() => setIsDevReviewModalOpen(true)}
          />
        ) : (
          activeCustomerJob ? (
            <CustomerPortal
              job={activeCustomerJob}
              allJobs={jobs}
              onAddComment={(text, loc) => handleAddComment(activeCustomerJob.id, text, loc)}
              onApprovePhase={() => handleApprovePhase(activeCustomerJob.id)}
              onRequestRevision={(notes) => handleRequestRevision(activeCustomerJob.id, notes)}
              onUpdateCustomerContact={handleUpdateCustomerContact}
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
          allJobs={jobs}
          onClose={() => {
            setSelectedJobForDetail(null);
            setJobDetailHighlightCommentId(undefined);
          }}
          onUpdateJob={(updatedJob) => {
            const updatedList = jobs.map(j => j.id === updatedJob.id ? updatedJob : j);
            updateJobsState(updatedList);
            setSelectedJobForDetail(updatedJob);
          }}
          onUpdateCustomerContact={handleUpdateCustomerContact}
          onDispatchNotifications={handleDispatchNotifications}
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
          staffList={staffList}
          initialTab={jobDetailInitialTab}
          initialHighlightCommentId={jobDetailHighlightCommentId}
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
        staffList={staffList}
        currentStaff={currentStaff}
      />

      {/* MODAL 4: Delegate Work Modal */}
      {jobToDelegate && (
        <DelegateWorkModal
          isOpen={!!jobToDelegate}
          onClose={() => setJobToDelegate(null)}
          job={jobToDelegate}
          currentStaff={currentStaff}
          staffList={staffList}
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

      {/* MODAL 6b: Required Note To Stop Timer Modal */}
      {stopTimerPromptJob && (
        <StopTimerModal
          isOpen={!!stopTimerPromptJob}
          onClose={() => setStopTimerPromptJob(null)}
          job={stopTimerPromptJob.job}
          currentStaff={currentStaff}
          initialNote={stopTimerPromptJob.initialNote}
          nowTimestamp={nowTimestamp}
          onConfirmStopTimer={(jobId, completedNote) => handleConfirmStopTimer(jobId, completedNote)}
        />
      )}

      {/* MODAL 7: Kyle's Delegation Return Review Inbox Modal */}
      <KyleDelegationInboxModal
        isOpen={isKyleInboxOpen}
        onClose={() => setIsKyleInboxOpen(false)}
        jobs={jobs}
        currentStaff={currentStaff}
        staffList={staffList}
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
        onDeleteMultipleMessages={handleDeleteMultipleChatMessages}
        onSelectJob={(job) => setSelectedJobForDetail(job)}
        onMarkAsRead={handleMarkChatRead}
      />

      {/* MODAL 8: Staff & Permissions Management Modal */}
      <StaffManagementModal
        isOpen={isStaffManagementOpen}
        onClose={() => setIsStaffManagementOpen(false)}
        staffList={staffList}
        currentStaff={currentStaff}
        jobs={jobs}
        onAddStaff={handleAddStaff}
        onUpdateStaff={handleUpdateStaff}
        onDeleteStaff={handleDeleteStaff}
        onResetStaff={handleResetStaff}
      />

      {/* MODAL 9: Employee Time Cards & Weekly Hours Modal (with CSV export) */}
      <TimeCardModal
        isOpen={isTimeCardModalOpen}
        onClose={() => setIsTimeCardModalOpen(false)}
        currentStaff={currentStaff}
        staffList={staffList}
        timeCards={timeCards}
        jobs={jobs}
        initialSelectedStaffId={timeCardModalStaffId}
        onUpdateTimeCards={(updated) => {
          setTimeCards(updated);
          saveStoredTimeCards(updated);
        }}
      />

      {/* MODAL 10: Greg Hyatt Dev Project Time Entries Review & CSV Export Modal */}
      <GregDevTimeReviewModal
        isOpen={isDevReviewModalOpen}
        onClose={() => setIsDevReviewModalOpen(false)}
        currentStaff={currentStaff}
        devEntries={devEntries}
        onUpdateDevEntries={(updated) => {
          setDevEntries(updated);
          saveStoredGregDevEntries(updated);
        }}
      />

    </div>
  );
}
