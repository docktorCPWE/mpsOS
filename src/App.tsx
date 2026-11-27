import React, { useState, useEffect, useRef } from 'react';
import { Job, JobPhase, EmailTemplate, PinnedLocation, TimeLog, JobComment, StaffUser, AppNotification, DelegatedWorkItem, ChatMessage, TimeCardShift, TimeCardBreak, GregDevProjectCard, GregDevTimeEntry, PayrollEntry, DeliverableFile } from './types';
import { getStoredJobs, saveStoredJobs, resetStoredJobs, getStoredChatMessages, saveStoredChatMessages, STAFF_USERS, INITIAL_NOTIFICATIONS, isMessageRelevantForUser, getStoredStaff, saveStoredStaff, resetStoredStaff, getStoredTimeCards, saveStoredTimeCards, resetStoredTimeCards, isStaffExemptFromClock, getStoredNotifications, saveStoredNotifications, addDismissedNotificationId, canUserCreateJob, getStoredActiveStaffId, saveStoredActiveStaffId, getStoredPayrollEntries, saveStoredPayrollEntries, resetStoredPayrollEntries, getStoredPreferredLayout, saveStoredPreferredLayout, canUserDeleteDelegatedItem, isStaffDeleted, isLegacyMockStaffDoc, addDeletedStaffId, removeDeletedStaffId, canViewTeamProfiles, canSwitchStaffAccounts, canUserManageStaff, formatRelativeLastSeen } from './data/mockData';
import { 
  isUserGregHyatt, 
  getStoredGregDevCards, 
  saveStoredGregDevCards, 
  getStoredGregDevEntries, 
  saveStoredGregDevEntries,
  sanitizeAndDedupeDevProjectCards,
  getStoredDevCardTimerIntents,
  saveStoredDevCardTimerIntents,
  recordDevCardTimerIntent,
  clearDevCardTimerIntent,
  reconcileDevCardsWithTimerIntents
} from './utils/gregDevTimeService';
import { HeaderNav } from './components/HeaderNav';
import { AuthScreen } from './components/AuthScreen';
import {
  testConnection,
  subscribeToJobs,
  saveJobToFirestore,
  deleteJobFromFirestore,
  seedInitialJobsToFirestore,
  subscribeToStaff,
  saveStaffToFirestore,
  deleteStaffFromFirestore,
  deleteDelegatedTaskFromFirestore,
  seedStaffToFirestore,
  subscribeToChat,
  saveChatMessageToFirestore,
  deleteChatMessageFromFirestore,
  hideChatMessagesForStaffInFirestore,
  markChatMessagesAsReadInFirestore,
  purgeDummyDataFromFirestore,
  subscribeToAuth,
  syncAuthToStaffUser,
  logoutUser,
  getDeviceSessionId,
  triggerRemoteLogoutInFirestore,
  hasActiveAuthSession,
  markAuthSessionActive,
  updateStaffPresenceInFirestore,
  purgeRemovedMockStaff,
  subscribeToDevTimeEntries,
  saveDevTimeEntryToFirestore,
  deleteDevTimeEntryFromFirestore,
  subscribeToDevProjectCards,
  saveDevProjectCardsToFirestore,
  saveSingleDevProjectCardToFirestore,
  updateDevCardNotesInFirestore,
  deleteDevProjectCardFromFirestore,
  subscribeToPayrollEntries,
  savePayrollEntryToFirestore,
  deletePayrollEntryFromFirestore,
  seedInitialPayrollEntries,
  subscribeToTimeCards,
  saveTimeCardToFirestore,
  deleteTimeCardFromFirestore,
  seedTimeCardsToFirestore
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { getLocalDateString, isShiftForStaff, formatTimeOnly } from './utils/timeCardExport';
import {
  formatSecondsToReadable,
  formatSecondsToHHMMSS,
  getStaffActiveWork,
  isStaffOnlineWithActivity,
  getStoredJobTimerIntents,
  saveStoredJobTimerIntents,
  recordJobTimerIntent
} from './utils/timeUtils';

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
  const [staffList, setStaffList] = useState<StaffUser[]>(() => {
    const list = getStoredStaff();
    return list.filter(s => !isStaffDeleted(s));
  });
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(() => {
    const list = getStoredStaff().filter(s => !isStaffDeleted(s));
    return list[0] || STAFF_USERS[0];
  }); // Default: Greg Hyatt (Owner)
  const [notifications, setNotifications] = useState<AppNotification[]>(() => getStoredNotifications());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [syncingChatMessageIds, setSyncingChatMessageIds] = useState<string[]>([]);
  const [failedChatMessageIds, setFailedChatMessageIds] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [timeCards, setTimeCards] = useState<TimeCardShift[]>([]);
  const [pausedJobsNotice, setPausedJobsNotice] = useState<{ jobNumbers: string[]; devProjects?: string[]; remoteSignedOut?: boolean; type: 'paused' | 'resumed' | 'clock_out_stopped' } | null>(null);
  const [remoteLogoutNotice, setRemoteLogoutNotice] = useState<string | null>(null);

  // Greg Hyatt Dev Project Cards & Timesheet State
  const [devCards, setDevCards] = useState<GregDevProjectCard[]>(() => getStoredGregDevCards());
  const [devEntries, setDevEntries] = useState<GregDevTimeEntry[]>(() => getStoredGregDevEntries());
  const [isDevReviewModalOpen, setIsDevReviewModalOpen] = useState(false);

  // Payroll Entries State
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>(() => getStoredPayrollEntries());

  // Firebase Authentication State
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authEmailVerified, setAuthEmailVerified] = useState<boolean>(false);
  const [authenticatedStaff, setAuthenticatedStaff] = useState<StaffUser | null>(null);
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
  const devCardNotesDebounceMapRef = useRef<Record<string, NodeJS.Timeout>>({});
  const devCardsRef = useRef<GregDevProjectCard[]>(devCards);
  const devEntriesRef = useRef<GregDevTimeEntry[]>(devEntries);
  const jobsRef = useRef<Job[]>(jobs);
  const pendingDevCardMutationRef = useRef<Record<string, { atMs: number; card: GregDevProjectCard }>>({});
  const pendingJobTimerMutationRef = useRef<Record<string, {
    atMs: number;
    active_timer_start?: string;
    active_timer_task?: string;
    active_timer_drafter_id?: string;
    active_timer_drafter_name?: string;
    active_timer_delegated_task_id?: string;
    paused_by_break?: boolean;
    paused_timer_task?: string;
    paused_timer_drafter_id?: string;
    paused_timer_drafter_name?: string;
    paused_elapsed_seconds?: number;
  }>>({});
  const pendingJobTaskMutationRef = useRef<Record<string, Record<string, { atMs: number; task: DelegatedWorkItem; retryAttempted?: boolean }>>>({});
  const pendingJobCommentMutationRef = useRef<Record<string, Record<string, { atMs: number; comment: JobComment; retryAttempted?: boolean }>>>({});
  const pendingChatSendRef = useRef<Record<string, { atMs: number; message: ChatMessage; retryCount: number; lastRetryAtMs: number; failed?: boolean }>>({});
  const pendingChatDeleteRef = useRef<Record<string, number>>({});
  const pendingChatHideRef = useRef<Record<string, { atMs: number; staffId: string }>>({});
  const pendingChatReadRef = useRef<Record<string, { atMs: number; staffId: string }>>({});
  const pendingStaffMutationRef = useRef<Record<string, { atMs: number; staff: StaffUser }>>({});
  const authenticatedStaffRef = useRef<StaffUser | null>(authenticatedStaff);
  const healedZombieTokensRef = useRef<Set<string>>(new Set());
  const lastDevCardHealAtRef = useRef<Record<string, number>>({});
  const lastJobTimerHealAtRef = useRef<Record<string, number>>({});
  const hasActiveWorkOrShiftRef = useRef<boolean>(false);
  const hasSeededTimeCardsRef = useRef<boolean>(false);
  const staffListRef = useRef<StaffUser[]>(staffList);
  const lastActivityRef = useRef<number>(Date.now());
  const lastHeartbeatSentAtRef = useRef<number>(0);
  const sessionLoginAtRef = useRef<number>(Date.now());
  const initialForceLogoutAtRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    authenticatedStaffRef.current = authenticatedStaff;
  }, [authenticatedStaff]);

  useEffect(() => {
    staffListRef.current = staffList;
  }, [staffList]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // Automatically retry any unsynced chat messages whenever browser connectivity returns
  useEffect(() => {
    const handleOnline = () => {
      const pendingIds = Object.keys(pendingChatSendRef.current);
      if (pendingIds.length === 0) return;
      pendingIds.forEach(msgId => {
        const entry = pendingChatSendRef.current[msgId];
        if (!entry?.message) return;
        entry.failed = false;
        entry.lastRetryAtMs = Date.now();
        setFailedChatMessageIds(prev => prev.filter(id => id !== msgId));
        setSyncingChatMessageIds(prev => (prev.includes(msgId) ? prev : [...prev, msgId]));
        saveChatMessageToFirestore(entry.message)
          .then(() => {
            setSyncingChatMessageIds(prev => prev.filter(id => id !== msgId));
            setFailedChatMessageIds(prev => prev.filter(id => id !== msgId));
          })
          .catch(() => {
            entry.failed = true;
            setSyncingChatMessageIds(prev => prev.filter(id => id !== msgId));
            setFailedChatMessageIds(prev => (prev.includes(msgId) ? prev : [...prev, msgId]));
          });
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    devCardsRef.current = devCards;
  }, [devCards]);

  useEffect(() => {
    devEntriesRef.current = devEntries;
  }, [devEntries]);

  useEffect(() => {
    const me = authenticatedStaff;
    if (!me) {
      hasActiveWorkOrShiftRef.current = false;
      return;
    }
    const hasShift = timeCards.some(
      tc => isShiftForStaff(tc, me) && (tc.status === 'clocked_in' || tc.status === 'on_break')
    );
    const work = getStaffActiveWork(me, jobs, devCards, Date.now());
    const hasTimer = Boolean(work.activeItem && !work.activeItem.isPaused);
    hasActiveWorkOrShiftRef.current = hasShift || hasTimer;
  }, [authenticatedStaff, timeCards, jobs, devCards]);

  const handleOpenJobDetail = (job: Job, options?: { initialTab?: 'overview' | 'canvas' | 'deliverables' | 'comments' | 'audit' | 'time'; highlightCommentId?: string }) => {
    setSelectedJobForDetail(job);
    setJobDetailInitialTab(options?.initialTab || 'overview');
    setJobDetailHighlightCommentId(options?.highlightCommentId);
  };

  // Live ticker for active timers (snaps immediately when waking mobile / switching tabs)
  useEffect(() => {
    const syncNow = () => setNowTimestamp(Date.now());
    const timer = setInterval(syncNow, 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
      }
    };
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', syncNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 1. One-time immediate localStorage fallback hydration on mount
  useEffect(() => {
    const loaded = getStoredJobs();
    jobsRef.current = loaded;
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

    // Immediately reconcile stored Dev Project Cards with persisted running intents so local boot state is accurate
    const storedDevCards = getStoredGregDevCards();
    const storedDevEntries = getStoredGregDevEntries();
    if (storedDevCards.length > 0) {
      const { cards: bootReconciled } = reconcileDevCardsWithTimerIntents(
        storedDevCards,
        getStoredDevCardTimerIntents(),
        storedDevCards,
        storedDevEntries
      );
      devCardsRef.current = bootReconciled;
      setDevCards(bootReconciled);
    }
  }, []);

  // 2. Auth-aware real-time Firestore synchronization
  // CRITICAL: Only attach Firestore onSnapshot listeners once Firebase Auth is ready (or Demo Mode is active)
  // so unauthenticated boot or switching Firebase accounts NEVER kills listeners with PERMISSION_DENIED.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isDemoModeBypassed && (!authUser || !authUser.emailVerified)) return;

    const isAuthGreg = () =>
      isUserGregHyatt(authenticatedStaffRef.current) ||
      (authUser?.email || '').toLowerCase().trim() === 'arkcwd@gmail.com';

    // Test Firebase connection & purge dummy data from cloud
    testConnection();
    purgeDummyDataFromFirestore().catch(err => console.warn('Dummy data purge skipped/failed:', err));

    // Protect any in-flight job timer Start/Stop/Break/ClockOut, persisted running job timer intents,
    // AND delegated task status/completion writes from stale or out-of-order Firestore snapshots.
    // NEVER auto-stop a running job timer or revert a completed task from a snapshot listener!
    const protectInFlightJobMutations = (cloudJobs: Job[]): Job[] => {
      const now = Date.now();
      const jobIntents = getStoredJobTimerIntents();
      let jobIntentsChanged = false;
      const myStaffId = authenticatedStaffRef.current?.id;

      const parseMs = (iso?: string): number => {
        if (!iso) return NaN;
        const ms = new Date(iso).getTime();
        return isNaN(ms) ? NaN : ms;
      };

      const result = cloudJobs.map(job => {
        let protectedJob = job;

        // 1. Protect in-flight job timer mutations (20s immediate window)
        const pendingTimer = pendingJobTimerMutationRef.current[job.id];
        if (pendingTimer) {
          const cloudMatchesExpected =
            (job.active_timer_start || '') === (pendingTimer.active_timer_start || '') &&
            Boolean(job.paused_by_break) === Boolean(pendingTimer.paused_by_break);

          if (cloudMatchesExpected || now - pendingTimer.atMs > 20000) {
            delete pendingJobTimerMutationRef.current[job.id];
          } else {
            protectedJob = {
              ...protectedJob,
              active_timer_start: pendingTimer.active_timer_start,
              active_timer_task: pendingTimer.active_timer_task,
              active_timer_drafter_id: pendingTimer.active_timer_drafter_id,
              active_timer_drafter_name: pendingTimer.active_timer_drafter_name,
              active_timer_delegated_task_id: pendingTimer.active_timer_delegated_task_id,
              paused_by_break: pendingTimer.paused_by_break,
              paused_timer_task: pendingTimer.paused_timer_task,
              paused_timer_drafter_id: pendingTimer.paused_timer_drafter_id,
              paused_timer_drafter_name: pendingTimer.paused_timer_drafter_name,
              paused_elapsed_seconds: pendingTimer.paused_elapsed_seconds
            };
          }
        }

        // 1b. Authoritative persisted Job Timer Intent Ledger reconciliation (indefinite protection against stale snapshots)
        const intent = jobIntents[job.id];
        const cloudStartMs = parseMs(protectedJob.active_timer_start);
        const cloudHasRunningTimer = Boolean(protectedJob.active_timer_start && !isNaN(cloudStartMs));

        if (intent?.state === 'running') {
          // Only reconcile/heal a local running intent if it belongs to the currently authenticated user (or before staff finishes hydrating)
          const belongsToCurrentAuthUser =
            !myStaffId ||
            !intent.active_timer_drafter_id ||
            intent.active_timer_drafter_id === myStaffId;

          if (belongsToCurrentAuthUser) {
            const intentStartMs = parseMs(intent.active_timer_start);
            if (cloudHasRunningTimer) {
              if (!isNaN(cloudStartMs) && !isNaN(intentStartMs) && cloudStartMs > intentStartMs + 1500) {
                jobIntents[job.id] = {
                  state: 'running',
                  active_timer_start: protectedJob.active_timer_start!,
                  active_timer_task: protectedJob.active_timer_task,
                  active_timer_drafter_id: protectedJob.active_timer_drafter_id,
                  active_timer_drafter_name: protectedJob.active_timer_drafter_name,
                  active_timer_delegated_task_id: protectedJob.active_timer_delegated_task_id,
                  updatedAtMs: now
                };
                jobIntentsChanged = true;
              }
            } else {
              // Cloud says job timer is NOT running while local intent says running!
              // Accept stop ONLY if proof exists of a genuine explicit stop or finalized time_log for this session.
              const explicitStopMs = parseMs(protectedJob.timer_explicit_stop_at);
              const hasNewerExplicitStop =
                !isNaN(intentStartMs) && !isNaN(explicitStopMs) && explicitStopMs >= intentStartMs - 1500;
              const hasFinalizedTimeLog = (protectedJob.time_logs || []).some(tl => {
                const tlStartMs = parseMs(tl.startTime);
                return !isNaN(tlStartMs) && !isNaN(intentStartMs) && Math.abs(tlStartMs - intentStartMs) <= 2500;
              });

              if (hasNewerExplicitStop || Boolean(protectedJob.paused_by_break) || hasFinalizedTimeLog) {
                jobIntents[job.id] = {
                  state: 'stopped',
                  stoppedAt: protectedJob.timer_explicit_stop_at || new Date(now).toISOString(),
                  pausedByBreak: Boolean(protectedJob.paused_by_break),
                  updatedAtMs: now
                };
                jobIntentsChanged = true;
              } else {
                // Stale snapshot or non-timer overwrite cleared the timer — preserve & heal to Firestore!
                protectedJob = {
                  ...protectedJob,
                  active_timer_start: intent.active_timer_start,
                  active_timer_task: intent.active_timer_task || protectedJob.active_timer_task,
                  active_timer_drafter_id: intent.active_timer_drafter_id || protectedJob.active_timer_drafter_id,
                  active_timer_drafter_name: intent.active_timer_drafter_name || protectedJob.active_timer_drafter_name,
                  active_timer_delegated_task_id: intent.active_timer_delegated_task_id,
                  paused_by_break: false,
                  timer_explicit_stop_at: undefined
                };

                if (now - (lastJobTimerHealAtRef.current[job.id] || 0) > 5000) {
                  lastJobTimerHealAtRef.current[job.id] = now;
                  saveJobToFirestore(protectedJob).catch(err =>
                    console.warn('[Firestore] Job timer self-heal notice:', job.job_number, err)
                  );
                }
              }
            }
          }
        } else if (intent?.state === 'stopped') {
          const intentStopMs = parseMs(intent.stoppedAt);
          if (cloudHasRunningTimer) {
            if (!isNaN(cloudStartMs) && !isNaN(intentStopMs) && cloudStartMs > intentStopMs + 1500) {
              // Strictly newer timer started after our stop — adopt it if ours
              if (!myStaffId || !protectedJob.active_timer_drafter_id || protectedJob.active_timer_drafter_id === myStaffId) {
                jobIntents[job.id] = {
                  state: 'running',
                  active_timer_start: protectedJob.active_timer_start!,
                  active_timer_task: protectedJob.active_timer_task,
                  active_timer_drafter_id: protectedJob.active_timer_drafter_id,
                  active_timer_drafter_name: protectedJob.active_timer_drafter_name,
                  active_timer_delegated_task_id: protectedJob.active_timer_delegated_task_id,
                  updatedAtMs: now
                };
                jobIntentsChanged = true;
              }
            } else if (!myStaffId || !protectedJob.active_timer_drafter_id || protectedJob.active_timer_drafter_id === myStaffId) {
              // Stale pre-stop cloud echo: keep stopped and heal cloud
              protectedJob = {
                ...protectedJob,
                active_timer_start: undefined,
                active_timer_task: undefined,
                active_timer_drafter_id: undefined,
                active_timer_drafter_name: undefined,
                active_timer_delegated_task_id: undefined,
                paused_by_break: Boolean(intent.pausedByBreak),
                timer_explicit_stop_at: intent.stoppedAt
              };
              if (now - (lastJobTimerHealAtRef.current[job.id] || 0) > 5000) {
                lastJobTimerHealAtRef.current[job.id] = now;
                saveJobToFirestore(protectedJob, { allowTimerClear: true }).catch(err =>
                  console.warn('[Firestore] Job timer stop-heal notice:', job.job_number, err)
                );
              }
            }
          }
        } else if (cloudHasRunningTimer && myStaffId && protectedJob.active_timer_drafter_id === myStaffId) {
          // Record running timer started on another device so this device protects it going forward
          jobIntents[job.id] = {
            state: 'running',
            active_timer_start: protectedJob.active_timer_start!,
            active_timer_task: protectedJob.active_timer_task,
            active_timer_drafter_id: protectedJob.active_timer_drafter_id,
            active_timer_drafter_name: protectedJob.active_timer_drafter_name,
            active_timer_delegated_task_id: protectedJob.active_timer_delegated_task_id,
            updatedAtMs: now
          };
          jobIntentsChanged = true;
        }

        // 2. Protect in-flight delegated task mutations (status / completion / review / revision) for 60s
        let shouldRetryProtectedJobSave = false;
        const pendingTasksForJob = pendingJobTaskMutationRef.current[job.id];
        if (pendingTasksForJob) {
          const pendingTaskIds = Object.keys(pendingTasksForJob);
          if (pendingTaskIds.length > 0) {
            const existingTasks = [...(protectedJob.delegated_tasks || [])];
            let didOverrideTask = false;

            for (const taskId of pendingTaskIds) {
              const entry = pendingTasksForJob[taskId];
              if (!entry) continue;

              const idx = existingTasks.findIndex(t => String(t.id).trim() === String(taskId).trim());
              const cloudTask = idx >= 0 ? existingTasks[idx] : undefined;
              const expected = entry.task;

              const cloudMatchesTask = Boolean(
                cloudTask &&
                cloudTask.status === expected.status &&
                (cloudTask.completedAt || '') === (expected.completedAt || '') &&
                Boolean(cloudTask.isReviewed) === Boolean(expected.isReviewed) &&
                Boolean(cloudTask.revisionRequested) === Boolean(expected.revisionRequested) &&
                (cloudTask.assignedTo || '') === (expected.assignedTo || '') &&
                (cloudTask.completionNotes || '') === (expected.completionNotes || '')
              );

              if (cloudMatchesTask || now - entry.atMs > 60000) {
                delete pendingTasksForJob[taskId];
              } else {
                if (idx >= 0) {
                  existingTasks[idx] = expected;
                } else {
                  existingTasks.unshift(expected);
                }
                didOverrideTask = true;
                if (now - entry.atMs > 4000 && !entry.retryAttempted) {
                  entry.retryAttempted = true;
                  shouldRetryProtectedJobSave = true;
                }
              }
            }

            if (Object.keys(pendingTasksForJob).length === 0) {
              delete pendingJobTaskMutationRef.current[job.id];
            }

            if (didOverrideTask) {
              protectedJob = {
                ...protectedJob,
                delegated_tasks: existingTasks
              };
            }
          }
        }

        // 3. Protect in-flight job comments & notes so concurrent snapshots NEVER drop newly posted job messages
        const pendingCommentsForJob = pendingJobCommentMutationRef.current[job.id];
        if (pendingCommentsForJob) {
          const pendingCommentIds = Object.keys(pendingCommentsForJob);
          if (pendingCommentIds.length > 0) {
            const existingComments = [...(protectedJob.comments || [])];
            let didMergeComment = false;

            for (const commentId of pendingCommentIds) {
              const entry = pendingCommentsForJob[commentId];
              if (!entry) continue;
              const existsInCloud = existingComments.some(c => c.id === commentId);
              if (existsInCloud || now - entry.atMs > 60000) {
                delete pendingCommentsForJob[commentId];
              } else {
                existingComments.push(entry.comment);
                didMergeComment = true;
                if (now - entry.atMs > 4000 && !entry.retryAttempted) {
                  entry.retryAttempted = true;
                  shouldRetryProtectedJobSave = true;
                }
              }
            }

            if (Object.keys(pendingCommentsForJob).length === 0) {
              delete pendingJobCommentMutationRef.current[job.id];
            }

            if (didMergeComment) {
              existingComments.sort(
                (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
              );
              protectedJob = {
                ...protectedJob,
                comments: existingComments
              };
            }
          }
        }

        if (shouldRetryProtectedJobSave) {
          saveJobToFirestore(protectedJob).catch(err =>
            console.warn('[Firestore] Background retry saving protected job mutation failed:', err)
          );
        }

        return protectedJob;
      });

      if (jobIntentsChanged) {
        saveStoredJobTimerIntents(jobIntents);
      }

      return result;
    };

    // 3. Connect real-time Firestore synchronization
    const unsubscribeJobs = subscribeToJobs(
      (cloudJobs) => {
        if (cloudJobs) {
          const protectedJobs = protectInFlightJobMutations(cloudJobs);
          jobsRef.current = protectedJobs;
          setJobs(protectedJobs);
          saveStoredJobs(protectedJobs);
          setSelectedCustomerId(prev => {
            if (protectedJobs.some(j => j.id === prev)) return prev;
            return protectedJobs[0]?.id || '';
          });

          // Keep selectedJobForDetail synchronized with cloud updates if open
          setSelectedJobForDetail(prevSelected => {
            if (!prevSelected) return null;
            return protectedJobs.find(j => j.id === prevSelected.id) || null;
          });
        }
      },
      () => {
        // Only seed on initial launch if not previously initialized
        const isInit = typeof window !== 'undefined' && localStorage.getItem('my_plan_store_os_initialized_v1') === 'true';
        if (isInit) {
          console.log('[Firestore] Jobs empty but workspace already initialized. Skipping re-seed.');
          return;
        }
        const local = getStoredJobs();
        if (local && local.length > 0) {
          seedInitialJobsToFirestore(local);
        }
      }
    );

    const unsubscribeStaff = subscribeToStaff(
      (cloudStaff) => {
        if (cloudStaff && cloudStaff.length > 0) {
          const now = Date.now();
          const activeCloudStaff = cloudStaff.filter(s => !isLegacyMockStaffDoc(s));
          activeCloudStaff.forEach(s => {
            removeDeletedStaffId({ id: s.id, email: s.email });
          });

          const staffEditableFieldsMatch = (a: StaffUser, b: StaffUser): boolean => (
            a.name === b.name &&
            (a.email || '').toLowerCase().trim() === (b.email || '').toLowerCase().trim() &&
            a.title === b.title &&
            (a.phone || '') === (b.phone || '') &&
            a.role === b.role &&
            (a.department || '') === (b.department || '') &&
            Number(a.hourlyRate || 0) === Number(b.hourlyRate || 0) &&
            (a.status || 'active') === (b.status || 'active') &&
            (a.preferredLayout || 'grid') === (b.preferredLayout || 'grid') &&
            Boolean(a.canAccessFinancials) === Boolean(b.canAccessFinancials) &&
            Boolean(a.canDelegate) === Boolean(b.canDelegate) &&
            Boolean(a.canViewAllProjects) === Boolean(b.canViewAllProjects) &&
            Boolean(a.canManageStaff) === Boolean(b.canManageStaff) &&
            Boolean(a.canManageInvoices) === Boolean(b.canManageInvoices) &&
            Boolean(a.canEditJobPhases) === Boolean(b.canEditJobPhases) &&
            Boolean(a.canManageRoadblocks) === Boolean(b.canManageRoadblocks) &&
            Boolean(a.canAccessPayroll) === Boolean(b.canAccessPayroll)
          );

          // Reconcile cloud snapshot against in-flight staff profile/permission mutations
          const seenIds = new Set<string>();
          const reconciledCloud = activeCloudStaff.map(cloudItem => {
            seenIds.add(cloudItem.id);
            const pending = pendingStaffMutationRef.current[cloudItem.id];
            if (!pending) return cloudItem;

            if (staffEditableFieldsMatch(cloudItem, pending.staff) || (now - pending.atMs) > 25000) {
              delete pendingStaffMutationRef.current[cloudItem.id];
              return cloudItem;
            }

            // Preserve in-flight profile/permission edits while keeping latest cloud presence/auth fields
            return {
              ...cloudItem,
              ...pending.staff,
              id: cloudItem.id,
              authUid: cloudItem.authUid || pending.staff.authUid,
              emailVerified: cloudItem.emailVerified ?? pending.staff.emailVerified,
              isOnline: cloudItem.isOnline ?? pending.staff.isOnline,
              lastSeenAt: cloudItem.lastSeenAt || pending.staff.lastSeenAt,
              lastLoginAt: cloudItem.lastLoginAt || pending.staff.lastLoginAt,
              forceLogoutAt: cloudItem.forceLogoutAt || pending.staff.forceLogoutAt
            };
          });

          // Retain newly added staff records that are still in flight to Firestore
          const pendingEntries = Object.entries(pendingStaffMutationRef.current) as Array<[string, { atMs: number; staff: StaffUser }]>;
          for (const [pendingId, pendingEntry] of pendingEntries) {
            if (!seenIds.has(pendingId)) {
              if ((now - pendingEntry.atMs) <= 25000) {
                reconciledCloud.push(pendingEntry.staff);
                seenIds.add(pendingId);
              } else {
                delete pendingStaffMutationRef.current[pendingId];
              }
            }
          }

          // Ensure all active non-deleted core staff (Greg, Kyle, Jason, Drew, Ethan) exist in roster
          const merged = [...reconciledCloud];
          for (const core of STAFF_USERS) {
            if (isStaffDeleted(core)) continue;
            const exists = merged.some(s => s.id === core.id || s.name.toLowerCase() === core.name.toLowerCase() || (core.name.toLowerCase().includes('kyle') && s.name.toLowerCase().includes('kyle')));
            if (!exists) {
              merged.push(core);
            }
          }

          setStaffList(merged);
          saveStoredStaff(merged);

          const findMatchingStaff = (target: StaffUser) =>
            merged.find(s => s.id === target.id) ||
            merged.find(s => s.email && target.email && s.email.toLowerCase().trim() === target.email.toLowerCase().trim()) ||
            merged.find(s => s.name.toLowerCase().trim() === target.name.toLowerCase().trim()) ||
            (target.name.toLowerCase().includes('kyle') ? merged.find(s => s.name.toLowerCase().includes('kyle')) : undefined);

          // Update currentStaff if matching cloud record has latest edits to capabilities
          setCurrentStaff(prevCurrent => {
            if (isLegacyMockStaffDoc(prevCurrent)) {
              return merged[0] || STAFF_USERS[0];
            }
            const updatedMatch = findMatchingStaff(prevCurrent);
            return updatedMatch ? { ...prevCurrent, ...updatedMatch } : prevCurrent;
          });

          // Keep authenticatedStaff in sync with latest permission changes too
          setAuthenticatedStaff(prevAuth => {
            if (!prevAuth) return prevAuth;
            const updatedMatch = findMatchingStaff(prevAuth);
            return updatedMatch ? { ...prevAuth, ...updatedMatch } : prevAuth;
          });
        }
      },
      () => {
        seedStaffToFirestore(STAFF_USERS.filter(s => !isStaffDeleted(s)));
      }
    );

    const unsubscribeChat = subscribeToChat((cloudMsgs) => {
      if (!cloudMsgs) return;
      const now = Date.now();
      const cloudById = new Map<string, ChatMessage>();

      // Reconcile cloud messages against in-flight delete, hide, and read-receipt mutations
      for (const rawMsg of cloudMsgs) {
        const pendingDelAt = pendingChatDeleteRef.current[rawMsg.id];
        if (pendingDelAt) {
          if (now - pendingDelAt < 20000) {
            continue; // Still waiting for cloud delete confirmation
          }
          delete pendingChatDeleteRef.current[rawMsg.id];
        }

        let mergedMsg = rawMsg;

        const pendingHide = pendingChatHideRef.current[rawMsg.id];
        if (pendingHide) {
          const alreadyHidden = (mergedMsg.hiddenByStaffIds || []).includes(pendingHide.staffId);
          if (alreadyHidden || now - pendingHide.atMs > 20000) {
            delete pendingChatHideRef.current[rawMsg.id];
          } else {
            mergedMsg = {
              ...mergedMsg,
              hiddenByStaffIds: [...(mergedMsg.hiddenByStaffIds || []), pendingHide.staffId]
            };
          }
        }

        const pendingRead = pendingChatReadRef.current[rawMsg.id];
        if (pendingRead) {
          const alreadyRead = (mergedMsg.readByStaffIds || []).includes(pendingRead.staffId);
          if (alreadyRead || now - pendingRead.atMs > 20000) {
            delete pendingChatReadRef.current[rawMsg.id];
          } else {
            mergedMsg = {
              ...mergedMsg,
              readByStaffIds: [...(mergedMsg.readByStaffIds || []), pendingRead.staffId]
            };
          }
        }

        cloudById.set(mergedMsg.id, mergedMsg);
      }

      // Clean up confirmed pending deletes no longer in cloud
      for (const delId of Object.keys(pendingChatDeleteRef.current)) {
        if (!cloudById.has(delId)) {
          delete pendingChatDeleteRef.current[delId];
        }
      }

      // Protect newly sent in-flight messages so concurrent snapshots NEVER make them disappear.
      // NEVER silently drop an unconfirmed message after a timeout — keep it visible and retry with backoff.
      const confirmedSendIds: string[] = [];
      const newlyFailedSendIds: string[] = [];
      const retryDelaysMs = [3000, 8000, 18000, 30000];

      for (const sendId of Object.keys(pendingChatSendRef.current)) {
        const entry = pendingChatSendRef.current[sendId];
        if (!entry) continue;
        if (cloudById.has(sendId)) {
          delete pendingChatSendRef.current[sendId];
          confirmedSendIds.push(sendId);
        } else {
          // Always preserve unconfirmed sent message in the UI until Firestore confirms it
          cloudById.set(sendId, entry.message);
          const nextDelay = retryDelaysMs[Math.min(entry.retryCount, retryDelaysMs.length - 1)];
          if (entry.retryCount < retryDelaysMs.length && now - entry.lastRetryAtMs >= nextDelay) {
            entry.retryCount += 1;
            entry.lastRetryAtMs = now;
            saveChatMessageToFirestore(entry.message)
              .then(() => {
                setSyncingChatMessageIds(prev => prev.filter(id => id !== sendId));
                setFailedChatMessageIds(prev => prev.filter(id => id !== sendId));
              })
              .catch(err => {
                console.warn('[Firestore] Retry saving chat message failed:', err);
                if (entry.retryCount >= retryDelaysMs.length) {
                  entry.failed = true;
                  setSyncingChatMessageIds(prev => prev.filter(id => id !== sendId));
                  setFailedChatMessageIds(prev => (prev.includes(sendId) ? prev : [...prev, sendId]));
                }
              });
          } else if (entry.retryCount >= retryDelaysMs.length && now - entry.lastRetryAtMs >= 15000 && !entry.failed) {
            entry.failed = true;
            newlyFailedSendIds.push(sendId);
          }
        }
      }

      if (confirmedSendIds.length > 0) {
        const confirmedSet = new Set(confirmedSendIds);
        setSyncingChatMessageIds(prev => prev.filter(id => !confirmedSet.has(id)));
        setFailedChatMessageIds(prev => prev.filter(id => !confirmedSet.has(id)));
      }
      if (newlyFailedSendIds.length > 0) {
        const failedSet = new Set(newlyFailedSendIds);
        setSyncingChatMessageIds(prev => prev.filter(id => !failedSet.has(id)));
        setFailedChatMessageIds(prev => {
          const next = new Set(prev);
          newlyFailedSendIds.forEach(id => next.add(id));
          return Array.from(next);
        });
      }

      const reconciled = Array.from(cloudById.values()).sort(
        (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
      );
      setChatMessages(reconciled);
      saveStoredChatMessages(reconciled);
    });

    // Non-destructive Dev Project Cards cloud reconciliation:
    // NEVER auto-stops a running timer or writes is_active: false to Firestore from a snapshot listener.
    const applyCloudDevCards = (rawCloudCards: GregDevProjectCard[], entriesForCheck: GregDevTimeEntry[]) => {
      if (!rawCloudCards || rawCloudCards.length === 0) return;

      // 1. Protect any card whose Start/Stop/Break/ClockOut write is still in-flight (20s window)
      const now = Date.now();
      const seenIds = new Set<string>();
      const protectedCards: GregDevProjectCard[] = rawCloudCards.map(cloudCard => {
        seenIds.add(cloudCard.id);
        const pending = pendingDevCardMutationRef.current[cloudCard.id];
        if (!pending) return cloudCard;

        const cloudMatchesExpected =
          Boolean(cloudCard.isActive) === Boolean(pending.card.isActive) &&
          (cloudCard.activeTimerStart || '') === (pending.card.activeTimerStart || '');

        if (cloudMatchesExpected || now - pending.atMs > 20000) {
          delete pendingDevCardMutationRef.current[cloudCard.id];
          return cloudCard;
        }

        return {
          ...cloudCard,
          isActive: pending.card.isActive,
          isPausedByBreak: pending.card.isPausedByBreak,
          activeTimerStart: pending.card.activeTimerStart,
          lastStartedAt: pending.card.lastStartedAt,
          lastStoppedAt: pending.card.lastStoppedAt,
          explicitStopAt: pending.card.explicitStopAt,
          stoppedReason: pending.card.stoppedReason,
          todaySeconds: pending.card.todaySeconds,
          totalSeconds: pending.card.totalSeconds,
          currentNotes: pending.card.currentNotes
        };
      });

      // Preserve any newly-started or newly-added pending card that Firestore hasn't echoed yet
      Object.keys(pendingDevCardMutationRef.current).forEach((pendingId) => {
        const pending = pendingDevCardMutationRef.current[pendingId];
        if (!pending) return;
        if (now - pending.atMs > 20000) {
          delete pendingDevCardMutationRef.current[pendingId];
          return;
        }
        if (!seenIds.has(pendingId)) {
          protectedCards.push(pending.card);
        }
      });

      // 2. Authoritative persisted Dev Timer Intent Ledger reconciliation (when authenticated as Greg)
      let cardsAfterIntentCheck = protectedCards;
      if (isAuthGreg()) {
        const {
          cards: reconciledCards,
          cardsToHealToCloud,
          updatedIntents,
          intentsChanged
        } = reconcileDevCardsWithTimerIntents(
          protectedCards,
          getStoredDevCardTimerIntents(),
          devCardsRef.current,
          entriesForCheck
        );

        cardsAfterIntentCheck = reconciledCards;
        if (intentsChanged) {
          saveStoredDevCardTimerIntents(updatedIntents);
        }

        if (cardsToHealToCloud.length > 0) {
          cardsToHealToCloud.forEach(cardToHeal => {
            if (now - (lastDevCardHealAtRef.current[cardToHeal.id] || 0) > 4000) {
              lastDevCardHealAtRef.current[cardToHeal.id] = now;
              saveSingleDevProjectCardToFirestore(cardToHeal).catch(err =>
                console.warn('[Firestore] Dev card timer self-heal notice:', cardToHeal.id, err)
              );
            }
          });
        }
      }

      // 3. Deduplicate duplicate projectType docs cleanly without ever stopping a valid running timer
      const { cards: cleanCards, duplicateIdsToDelete } = sanitizeAndDedupeDevProjectCards(
        cardsAfterIntentCheck,
        entriesForCheck
      );

      // Only Greg Hyatt's own authenticated session may clean up duplicate dev_project_cards docs
      if (isAuthGreg() && duplicateIdsToDelete.length > 0) {
        duplicateIdsToDelete.forEach(dupId => {
          const token = `dev-dup:${dupId}`;
          if (!healedZombieTokensRef.current.has(token)) {
            healedZombieTokensRef.current.add(token);
            deleteDevProjectCardFromFirestore(dupId).catch(err =>
              console.warn('[Firestore] Duplicate dev card cleanup notice:', dupId, err)
            );
          }
        });
      }

      devCardsRef.current = cleanCards;
      setDevCards(cleanCards);
      saveStoredGregDevCards(cleanCards);
    };

    const unsubscribeDevEntries = subscribeToDevTimeEntries((entries) => {
      if (entries) {
        devEntriesRef.current = entries;
        setDevEntries(entries);
        saveStoredGregDevEntries(entries);
      }
    });

    const unsubscribeDevCards = subscribeToDevProjectCards((cards) => {
      if (cards && cards.length > 0) {
        applyCloudDevCards(cards, devEntriesRef.current);
      }
    });

    const unsubscribeTimeCards = subscribeToTimeCards(
      (cloudShifts) => {
        if (cloudShifts) {
          hasSeededTimeCardsRef.current = true;
          setTimeCards(cloudShifts);
          saveStoredTimeCards(cloudShifts);
        }
      },
      () => {
        if (hasSeededTimeCardsRef.current) {
          setTimeCards([]);
          saveStoredTimeCards([]);
          return;
        }
        hasSeededTimeCardsRef.current = true;
        const localShifts = getStoredTimeCards();
        if (localShifts && localShifts.length > 0) {
          seedTimeCardsToFirestore(localShifts).catch(err =>
            console.warn('[Firestore] Time cards initial seed notice:', err)
          );
        }
      }
    );

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
      unsubscribeTimeCards();
      unsubscribePayroll();
    };
  }, [isAuthLoading, authUser?.uid, authUser?.email, authEmailVerified, isDemoModeBypassed]);

  // Listen to Firebase Auth state & enforce session-scoped login (no stale cookies keeping users logged in)
  useEffect(() => {
    let isInitialBootCheck = true;

    const unsubscribeAuth = subscribeToAuth(async (user) => {
      const checkingInitialBoot = isInitialBootCheck;
      isInitialBootCheck = false;

      if (checkingInitialBoot && user && !hasActiveAuthSession()) {
        // User reopened browser/tab with a stale persistent session from an earlier visit:
        // sign them out cleanly so reopening the app requires logging back in.
        console.log('[Auth] Cleared stale previous-browser session for:', user.email);
        try {
          const staleMatch = staffListRef.current.find(
            s => (s.email || '').toLowerCase().trim() === (user.email || '').toLowerCase().trim()
          );
          await logoutUser(staleMatch?.id);
        } catch (err) {
          console.warn('[Auth] Stale session cleanup notice:', err);
        }
        setAuthUser(null);
        setAuthEmailVerified(false);
        setAuthenticatedStaff(null);
        setIsAuthLoading(false);
        return;
      }

      if (user) {
        markAuthSessionActive(user.uid);
      }

      setAuthUser(user);
      setAuthEmailVerified(Boolean(user?.emailVerified));
      setIsAuthLoading(false);

      if (!user) {
        setAuthenticatedStaff(null);
        return;
      }

      if (user && user.emailVerified) {
        try {
          const matched = await syncAuthToStaffUser(user, staffListRef.current);
          const layoutPref = matched.preferredLayout || getStoredPreferredLayout(matched.id || matched.email);
          const hydratedStaff = { ...matched, preferredLayout: layoutPref };
          sessionLoginAtRef.current = Date.now();
          initialForceLogoutAtRef.current = matched.forceLogoutAt || null;
          setAuthenticatedStaff(hydratedStaff);
          setCurrentStaff(hydratedStaff);
          saveStoredActiveStaffId(hydratedStaff.id);
          setStaffList(prev => {
            const exists = prev.some(
              s => s.id === hydratedStaff.id ||
                (s.email && hydratedStaff.email && s.email.toLowerCase().trim() === hydratedStaff.email.toLowerCase().trim())
            );
            const next = exists
              ? prev.map(s =>
                  s.id === hydratedStaff.id ||
                  (s.email && hydratedStaff.email && s.email.toLowerCase().trim() === hydratedStaff.email.toLowerCase().trim())
                    ? { ...s, ...hydratedStaff }
                    : s
                )
              : [...prev, hydratedStaff];
            saveStoredStaff(next);
            return next;
          });
        } catch (err) {
          console.warn('[Auth] Staff profile sync notice:', err);
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Cross-device remote sign-out watcher: if the signed-in user clocks out from another device (e.g. mobile),
  // automatically sign this session out cleanly so their desktop does not stay logged in.
  useEffect(() => {
    if (!authUser || !authEmailVerified || !authenticatedStaff?.id) return;

    const myEmail = (authenticatedStaff.email || '').toLowerCase().trim();
    const cloudMe = staffList.find(
      s => s.id === authenticatedStaff.id || (myEmail.length > 0 && (s.email || '').toLowerCase().trim() === myEmail)
    );
    if (!cloudMe?.forceLogoutAt) return;

    // Baseline existing forceLogoutAt when a fresh session initializes
    if (initialForceLogoutAtRef.current === undefined) {
      initialForceLogoutAtRef.current = cloudMe.forceLogoutAt;
      return;
    }

    const isNewSignal = cloudMe.forceLogoutAt !== initialForceLogoutAtRef.current;
    const isFromOtherDevice = cloudMe.forceLogoutOriginSessionId !== getDeviceSessionId();
    const forceLogoutMs = new Date(cloudMe.forceLogoutAt).getTime();
    const isAfterSessionStart = !isNaN(forceLogoutMs) && forceLogoutMs >= sessionLoginAtRef.current - 60_000;

    if (isNewSignal && isFromOtherDevice && isAfterSessionStart) {
      initialForceLogoutAtRef.current = cloudMe.forceLogoutAt;
      console.log('[Auth] Remote sign-out triggered from another device:', cloudMe.forceLogoutAt);
      logoutUser(undefined, { skipPresenceUpdate: true }).catch(() => {});
      setAuthUser(null);
      setAuthEmailVerified(false);
      setAuthenticatedStaff(null);
      setIsDemoModeBypassed(false);
      setRemoteLogoutNotice(
        'Your shift was clocked out from another device. All active timers have been stopped & saved, and this session was automatically signed out.'
      );
    }
  }, [staffList, authUser?.uid, authEmailVerified, authenticatedStaff?.id, authenticatedStaff?.email]);

  // Real-time online presence heartbeat + safe pagehide + inactivity auto-sign-out (8h)
  useEffect(() => {
    const staffId = authenticatedStaff?.id;
    if (!authUser || !authEmailVerified || !staffId) return;

    const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours of complete inactivity
    lastActivityRef.current = Date.now();

    const sendHeartbeat = () => {
      lastHeartbeatSentAtRef.current = Date.now();
      updateStaffPresenceInFirestore(staffId, true).catch(() => {});
    };

    const recordActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      // If background throttling delayed setInterval, immediately refresh presence on any interaction
      if (now - lastHeartbeatSentAtRef.current > 45 * 1000) {
        sendHeartbeat();
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(() => {
      if (!hasActiveWorkOrShiftRef.current && Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        console.log('[Auth] Signing out due to extended inactivity.');
        logoutUser(staffId).catch(() => {});
        setAuthUser(null);
        setAuthEmailVerified(false);
        setAuthenticatedStaff(null);
        return;
      }
      sendHeartbeat();
    }, 45 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!hasActiveWorkOrShiftRef.current && Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
          logoutUser(staffId).catch(() => {});
          setAuthUser(null);
          setAuthEmailVerified(false);
          setAuthenticatedStaff(null);
          return;
        }
        sendHeartbeat();
      }
    };

    const handlePageClose = (event: Event) => {
      // Never falsely flip a user offline when mobile/desktop merely backgrounds a page (bfcache)
      // or when the user is currently clocked in / actively running a timer.
      if ((event as PageTransitionEvent)?.persisted) return;
      if (hasActiveWorkOrShiftRef.current) return;
      updateStaffPresenceInFirestore(staffId, false).catch(() => {});
    };

    window.addEventListener('pointerdown', recordActivity, { passive: true });
    window.addEventListener('keydown', recordActivity, { passive: true });
    window.addEventListener('touchstart', recordActivity, { passive: true });
    window.addEventListener('focus', sendHeartbeat);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageClose);
    window.addEventListener('beforeunload', handlePageClose);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('pointerdown', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      window.removeEventListener('focus', sendHeartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageClose);
      window.removeEventListener('beforeunload', handlePageClose);
    };
  }, [authUser?.uid, authEmailVerified, authenticatedStaff?.id]);

  const handleSignOut = async () => {
    await logoutUser(authenticatedStaff?.id || currentStaff?.id);
    setAuthUser(null);
    setAuthEmailVerified(false);
    setAuthenticatedStaff(null);
    setIsDemoModeBypassed(false);
  };

  // Flexible matcher to find a job by id, job_number, or sanitized number
  const isTargetJob = (j: Job, targetId: string): boolean => {
    if (!targetId || !j) return false;
    if (j.id === targetId || j.job_number === targetId) return true;
    const cleanTarget = targetId.replace(/^[#M\-_]+/i, '').trim().toLowerCase();
    const cleanJobNum = (j.job_number || '').replace(/^[#M\-_]+/i, '').trim().toLowerCase();
    const cleanJobId = (j.id || '').replace(/^[#M\-_]+/i, '').trim().toLowerCase();
    return (
      (cleanJobNum.length > 0 && cleanJobNum === cleanTarget) ||
      (cleanJobId.length > 0 && cleanJobId === cleanTarget) ||
      (j.job_number && j.job_number.replace(/^#/, '').toLowerCase() === targetId.replace(/^#/, '').toLowerCase())
    );
  };

  // Sync jobs state to localStorage and Firestore whenever modified (synchronous ref computation avoids React 18 batching races)
  const updateJobsState = (
    newJobsOrUpdater: Job[] | ((prev: Job[]) => Job[]),
    specificJobId?: string | string[],
    options?: { allowTimerClear?: boolean }
  ): Promise<boolean> => {
    const prevJobs = jobsRef.current;
    const nextJobs = typeof newJobsOrUpdater === 'function'
      ? newJobsOrUpdater(prevJobs)
      : newJobsOrUpdater;

    jobsRef.current = nextJobs;
    setJobs(nextJobs);
    saveStoredJobs(nextJobs);

    // Sync only modified job(s) to Firestore immediately & deterministically
    const jobsToSync = Array.isArray(specificJobId)
      ? nextJobs.filter(j => specificJobId.some(id => isTargetJob(j, id)))
      : specificJobId
      ? nextJobs.filter(j => isTargetJob(j, specificJobId))
      : nextJobs.filter(newJob => {
          const oldJob = prevJobs.find(j => j.id === newJob.id);
          if (!oldJob) return true;
          return JSON.stringify(newJob) !== JSON.stringify(oldJob);
        });

    const syncPromise: Promise<boolean> = jobsToSync.length === 0
      ? Promise.resolve(true)
      : Promise.all(
          jobsToSync.map(job =>
            saveJobToFirestore(job, options).catch(err => {
              console.warn('[Firestore] Sync warning for job:', job.job_number, err);
              return false;
            })
          )
        ).then(results => results.every(Boolean));

    // Safely update detail and modal references with the fresh computed list
    setSelectedJobForDetail(prev => {
      if (!prev) return null;
      return nextJobs.find(j => j.id === prev.id) || null;
    });

    setJobToDelegate(prev => {
      if (!prev) return null;
      return nextJobs.find(j => j.id === prev.id) || null;
    });

    setTimerPromptJob(prev => {
      if (!prev) return null;
      const match = nextJobs.find(j => j.id === prev.job.id);
      return match ? { ...prev, job: match } : null;
    });

    setStopTimerPromptJob(prev => {
      if (!prev) return null;
      const match = nextJobs.find(j => j.id === prev.job.id);
      return match ? { ...prev, job: match } : null;
    });

    return syncPromise;
  };

  // Record an in-flight delegated task mutation so out-of-order Firestore snapshots cannot revert it
  const recordPendingTaskMutation = (jobId: string, task: DelegatedWorkItem) => {
    if (!pendingJobTaskMutationRef.current[jobId]) {
      pendingJobTaskMutationRef.current[jobId] = {};
    }
    pendingJobTaskMutationRef.current[jobId][task.id] = {
      atMs: Date.now(),
      task
    };
  };

  // Record an in-flight job comment/note so out-of-order Firestore snapshots cannot overwrite it
  const recordPendingCommentMutation = (jobId: string, comment: JobComment) => {
    if (!pendingJobCommentMutationRef.current[jobId]) {
      pendingJobCommentMutationRef.current[jobId] = {};
    }
    pendingJobCommentMutationRef.current[jobId][comment.id] = {
      atMs: Date.now(),
      comment
    };
  };

  // Safe direct job update handler (used by JobDetailModal & AdminBillingDashboard) that registers
  // in-flight task/comment/timer mutation guards automatically before syncing to Firestore
  const handleDirectJobUpdate = (updatedJob: Job) => {
    const prevJob = jobsRef.current.find(j => j.id === updatedJob.id);
    let safeJob = updatedJob;
    let allowTimerClear = false;

    if (prevJob) {
      // Guard any delegated task changes against stale snapshots
      const prevTasksById = new Map<string, DelegatedWorkItem>((prevJob.delegated_tasks || []).map(t => [t.id, t]));
      for (const nextTask of safeJob.delegated_tasks || []) {
        const oldTask = prevTasksById.get(nextTask.id);
        if (
          !oldTask ||
          oldTask.status !== nextTask.status ||
          (oldTask.completedAt || '') !== (nextTask.completedAt || '') ||
          Boolean(oldTask.isReviewed) !== Boolean(nextTask.isReviewed) ||
          Boolean(oldTask.revisionRequested) !== Boolean(nextTask.revisionRequested) ||
          (oldTask.completionNotes || '') !== (nextTask.completionNotes || '')
        ) {
          recordPendingTaskMutation(safeJob.id, nextTask);
        }
      }

      // Guard any newly added job comments/notes against stale snapshots
      const prevCommentIds = new Set((prevJob.comments || []).map(c => c.id));
      for (const nextComment of safeJob.comments || []) {
        if (!prevCommentIds.has(nextComment.id)) {
          recordPendingCommentMutation(safeJob.id, nextComment);
        }
      }

      // Never allow a stale non-timer modal edit to accidentally wipe an actively running job timer
      const triedToDropTimer = Boolean(prevJob.active_timer_start && !safeJob.active_timer_start);
      const isLegitTimerStop = Boolean(
        safeJob.timer_explicit_stop_at ||
        safeJob.paused_by_break ||
        (safeJob.time_logs?.length || 0) > (prevJob.time_logs?.length || 0)
      );

      if (triedToDropTimer && !isLegitTimerStop) {
        safeJob = {
          ...safeJob,
          active_timer_start: prevJob.active_timer_start,
          active_timer_task: prevJob.active_timer_task,
          active_timer_drafter_id: prevJob.active_timer_drafter_id,
          active_timer_drafter_name: prevJob.active_timer_drafter_name,
          active_timer_delegated_task_id: prevJob.active_timer_delegated_task_id
        };
      } else if (triedToDropTimer && isLegitTimerStop) {
        allowTimerClear = true;
      }

      // Guard any genuine timer state changes against stale snapshots
      if (
        (prevJob.active_timer_start || '') !== (safeJob.active_timer_start || '') ||
        Boolean(prevJob.paused_by_break) !== Boolean(safeJob.paused_by_break)
      ) {
        pendingJobTimerMutationRef.current[safeJob.id] = {
          atMs: Date.now(),
          active_timer_start: safeJob.active_timer_start,
          active_timer_task: safeJob.active_timer_task,
          active_timer_drafter_id: safeJob.active_timer_drafter_id,
          active_timer_drafter_name: safeJob.active_timer_drafter_name,
          active_timer_delegated_task_id: safeJob.active_timer_delegated_task_id,
          paused_by_break: safeJob.paused_by_break,
          paused_timer_task: safeJob.paused_timer_task,
          paused_timer_drafter_id: safeJob.paused_timer_drafter_id,
          paused_timer_drafter_name: safeJob.paused_timer_drafter_name,
          paused_elapsed_seconds: safeJob.paused_elapsed_seconds
        };
      }
    }

    updateJobsState(
      prevJobs => prevJobs.map(j => (j.id === safeJob.id ? safeJob : j)),
      safeJob.id,
      allowTimerClear ? { allowTimerClear: true } : undefined
    );
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
  const handleStartTimer = (jobId: string, taskNote?: string, delegatedTaskId?: string) => {
    const trimmed = taskNote ? taskNote.trim() : '';

    // If no note provided, open the StartTimerModal prompt
    if (!trimmed) {
      const target = jobs.find(j => isTargetJob(j, jobId));
      if (target) {
        setTimerPromptJob({ job: target, initialNote: '' });
      }
      return;
    }

    const startTimestamp = new Date().toISOString();

    updateJobsState(prevJobs =>
      prevJobs.map(j => {
        if (isTargetJob(j, jobId)) {
          // If a delegated task was selected, ONLY that specific task is started; never alter completed tasks!
          let matchedTaskId = delegatedTaskId;
          const updatedTasks = (j.delegated_tasks || []).map(t => {
            // A completed task or task waiting review can NEVER be reverted to In Progress by starting a timer!
            if (t.status === 'Completed' || t.status === 'Under Review' || Boolean(t.isReviewed) || Boolean(t.completedAt)) {
              return t;
            }

            // If a specific delegatedTaskId is given, match ONLY that exact task ID!
            // If no delegatedTaskId is given, only match if the note strictly matches an active pending task
            const isMatch = delegatedTaskId 
              ? String(t.id).trim() === String(delegatedTaskId).trim()
              : Boolean(trimmed && t.componentTitle && trimmed.trim().toLowerCase() === t.componentTitle.trim().toLowerCase());

            if (isMatch) {
              matchedTaskId = t.id;
              return { 
                ...t, 
                status: 'In Progress' as const,
                activeTimerStart: startTimestamp,
                activeTimerDrafterName: currentStaff.name
              };
            }
            return t;
          });

          pendingJobTimerMutationRef.current[j.id] = {
            atMs: Date.now(),
            active_timer_start: startTimestamp,
            active_timer_task: trimmed,
            active_timer_drafter_id: currentStaff.id,
            active_timer_drafter_name: currentStaff.name,
            active_timer_delegated_task_id: matchedTaskId,
            paused_by_break: false,
            paused_timer_task: undefined,
            paused_timer_drafter_id: undefined,
            paused_timer_drafter_name: undefined,
            paused_elapsed_seconds: undefined
          };

          recordJobTimerIntent(j.id, {
            state: 'running',
            active_timer_start: startTimestamp,
            active_timer_task: trimmed,
            active_timer_drafter_id: currentStaff.id,
            active_timer_drafter_name: currentStaff.name,
            active_timer_delegated_task_id: matchedTaskId,
            updatedAtMs: Date.now()
          });

          return {
            ...j,
            hourly_rate: j.hourly_rate || 85,
            active_timer_start: startTimestamp,
            active_timer_task: trimmed,
            active_timer_drafter_id: currentStaff.id,
            active_timer_drafter_name: currentStaff.name,
            active_timer_delegated_task_id: matchedTaskId,
            timer_explicit_stop_at: undefined,
            paused_by_break: false,
            paused_timer_task: undefined,
            paused_timer_drafter_id: undefined,
            paused_timer_drafter_name: undefined,
            paused_elapsed_seconds: undefined,
            delegated_tasks: updatedTasks,
            audit_logs: [
              {
                id: `a-${Date.now()}`,
                action: 'Timer Started',
                performedBy: currentStaff.name || j.assigned_drafter.split(',')[0],
                timestamp: startTimestamp,
                details: `Started drafting timer for: ${trimmed} (@ $${j.hourly_rate || 85}/hr)`
              },
              ...j.audit_logs
            ]
          };
        }
        return j;
      }),
      jobId
    );

    if (authenticatedStaff?.id) {
      updateStaffPresenceInFirestore(authenticatedStaff.id, true).catch(() => {});
    }

    setTimerPromptJob(null);
  };

  // Confirm and execute stopping of the timer with a required work completed note
  const handleConfirmStopTimer = (jobId: string, completedWorkNote: string, delegatedTaskId?: string) => {
    const trimmed = completedWorkNote.trim();
    if (!trimmed) return;

    updateJobsState(prevJobs =>
      prevJobs.map(j => {
        if (isTargetJob(j, jobId)) {
          const hasRunningTimer = Boolean(j.active_timer_start || j.paused_by_break);
          const startMs = j.active_timer_start ? new Date(j.active_timer_start).getTime() : Date.now();
          const endMs = Date.now();
          const durationSeconds = j.active_timer_start 
            ? Math.max(1, Math.floor((endMs - startMs) / 1000))
            : (j.paused_elapsed_seconds || 0);

          const drafterDisplayName = j.active_timer_drafter_name || currentStaff.name || j.assigned_drafter.split(',')[0];
          const durationFormatted = formatSecondsToReadable(durationSeconds);

          const effectiveTaskId = delegatedTaskId || j.active_timer_delegated_task_id;
          let matchedTaskTitle: string | undefined;

          // Add workedSeconds to the matched delegated task ONLY
          const updatedTasks = (j.delegated_tasks || []).map(t => {
            // Completed tasks must NEVER have their status reverted or changed
            if (t.status === 'Completed' || t.status === 'Under Review' || Boolean(t.isReviewed) || Boolean(t.completedAt)) {
              return { ...t, activeTimerStart: undefined, activeTimerDrafterName: undefined };
            }

            const isMatch = effectiveTaskId 
              ? String(t.id).trim() === String(effectiveTaskId).trim()
              : Boolean(t.activeTimerStart || (trimmed && t.componentTitle && trimmed.trim().toLowerCase() === t.componentTitle.trim().toLowerCase()));

            if (isMatch) {
              matchedTaskTitle = t.componentTitle;
              const curWorked = t.workedSeconds || 0;
              return {
                ...t,
                status: t.status === 'In Progress' ? 'Pending' as const : t.status,
                activeTimerStart: undefined,
                activeTimerDrafterName: undefined,
                workedSeconds: curWorked + durationSeconds
              };
            }
            if (t.activeTimerStart) {
              return { ...t, activeTimerStart: undefined, activeTimerDrafterName: undefined };
            }
            return t;
          });

          // Only add a new time log if there was an active timer session
          const effectiveRate = j.hourly_rate || 85;
          const newLog: TimeLog | null = hasRunningTimer && durationSeconds > 0 ? {
            id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            drafterName: drafterDisplayName,
            startTime: j.active_timer_start || new Date().toISOString(),
            endTime: new Date(endMs).toISOString(),
            durationSeconds,
            taskDescription: trimmed,
            hourlyRate: effectiveRate,
            billableAmount: Math.round(((durationSeconds / 3600) * effectiveRate) * 100) / 100,
            delegatedTaskId: effectiveTaskId,
            delegatedTaskTitle: matchedTaskTitle
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

          const stopIso = new Date(endMs).toISOString();

          pendingJobTimerMutationRef.current[j.id] = {
            atMs: Date.now(),
            active_timer_start: undefined,
            active_timer_task: undefined,
            active_timer_drafter_id: undefined,
            active_timer_drafter_name: undefined,
            active_timer_delegated_task_id: undefined,
            paused_by_break: false,
            paused_timer_task: undefined,
            paused_timer_drafter_id: undefined,
            paused_timer_drafter_name: undefined,
            paused_elapsed_seconds: undefined
          };

          recordJobTimerIntent(j.id, {
            state: 'stopped',
            stoppedAt: stopIso,
            updatedAtMs: endMs
          });

          return {
            ...j,
            hourly_rate: effectiveRate,
            active_timer_start: undefined,
            active_timer_task: undefined,
            active_timer_drafter_id: undefined,
            active_timer_drafter_name: undefined,
            active_timer_delegated_task_id: undefined,
            timer_explicit_stop_at: stopIso,
            paused_by_break: false,
            paused_timer_task: undefined,
            paused_timer_drafter_id: undefined,
            paused_timer_drafter_name: undefined,
            paused_elapsed_seconds: undefined,
            delegated_tasks: updatedTasks,
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
                timestamp: stopIso,
                details: durationSeconds > 0 
                  ? `Logged ${durationFormatted} for: "${trimmed}" (posted to Messages & Notes)`
                  : `Session stopped for: "${trimmed}"`
              },
              ...j.audit_logs
            ]
          };
        }
        return j;
      }),
      jobId,
      { allowTimerClear: true }
    );

    setStopTimerPromptJob(null);
  };

  // Timer Stop Handler - prompts for mandatory note if missing
  const handleStopTimer = (jobId: string, taskNote?: string, delegatedTaskId?: string) => {
    const trimmed = taskNote ? taskNote.trim() : '';

    // If no note provided, prompt user with StopTimerModal to require work note
    if (!trimmed) {
      const target = jobs.find(j => isTargetJob(j, jobId));
      if (target) {
        setStopTimerPromptJob({
          job: target,
          initialNote: target.active_timer_task || ''
        });
      }
      return;
    }

    handleConfirmStopTimer(jobId, trimmed, delegatedTaskId);
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

  // Time card & punch clock handlers (synced in real time to Firestore across desktop & mobile)
  const handleClockIn = (notes?: string) => {
    if (authenticatedStaff && currentStaff.id !== authenticatedStaff.id) return;
    if (isStaffExemptFromClock(currentStaff)) {
      return;
    }
    const todayStr = getLocalDateString(new Date());
    const active = timeCards.find(s => isShiftForStaff(s, currentStaff) && (s.status === 'clocked_in' || s.status === 'on_break'));
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
    saveTimeCardToFirestore(newShift).catch(err => console.warn('[Firestore] Clock-in sync error:', err));
    if (authenticatedStaff?.id) {
      updateStaffPresenceInFirestore(authenticatedStaff.id, true).catch(() => {});
    }
  };

  const handleStartBreak = () => {
    if (authenticatedStaff && currentStaff.id !== authenticatedStaff.id) return;
    if (isStaffExemptFromClock(currentStaff)) return;

    const curStaffLower = (currentStaff.name || '').toLowerCase().trim();
    const pausedJobNumbers: string[] = [];
    const pausedJobIds: string[] = [];

    // Helper to determine if an active timer belongs to the current staff member
    const isJobTimerForCurrentStaff = (j: Job) => {
      if (!j.active_timer_start) return false;
      if (j.active_timer_drafter_id) return j.active_timer_drafter_id === currentStaff.id;
      if (j.active_timer_drafter_name) return j.active_timer_drafter_name.toLowerCase().trim() === curStaffLower;
      const assigned = (j.assigned_drafter || '').toLowerCase().trim();
      const assignedFirst = assigned.split(',')[0].trim();
      if ((curStaffLower.length > 0 && assigned.includes(curStaffLower)) || (assignedFirst.length > 0 && curStaffLower.includes(assignedFirst))) return true;
      return false;
    };

    // Identify jobs to pause up front so we only touch & sync those specific jobs
    const targetJobsToPause = jobs.filter(isJobTimerForCurrentStaff);
    targetJobsToPause.forEach(j => {
      pausedJobNumbers.push(j.job_number);
      pausedJobIds.push(j.id);
    });

    if (pausedJobIds.length > 0) {
      const endMs = Date.now();
      updateJobsState(
        prevJobs =>
          prevJobs.map(j => {
            if (!pausedJobIds.includes(j.id) || !j.active_timer_start) return j;
            const startMs = new Date(j.active_timer_start).getTime();
            const durationSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
            const taskNote = j.active_timer_task || `Drafting ${j.current_status}`;

            const effectiveBreakRate = j.hourly_rate || 85;
            const partialLog: TimeLog = {
              id: `tl-break-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              drafterName: currentStaff.name,
              startTime: j.active_timer_start,
              endTime: new Date(endMs).toISOString(),
              durationSeconds,
              taskDescription: `${taskNote} (Pre-Break Segment)`,
              hourlyRate: effectiveBreakRate,
              billableAmount: Math.round(((durationSeconds / 3600) * effectiveBreakRate) * 100) / 100
            };

            const updatedLogs = [...(j.time_logs || []), partialLog];
            const totalSec = updatedLogs.reduce((s, l) => s + (l.durationSeconds || 0), 0);
            const totalMins = Math.round(totalSec / 60);
            const totalHours = Number((totalSec / 3600).toFixed(2));

            const breakIso = new Date(endMs).toISOString();
            pendingJobTimerMutationRef.current[j.id] = {
              atMs: Date.now(),
              active_timer_start: undefined,
              active_timer_task: undefined,
              active_timer_drafter_id: undefined,
              active_timer_drafter_name: undefined,
              active_timer_delegated_task_id: undefined,
              paused_by_break: true,
              paused_timer_task: taskNote,
              paused_timer_drafter_id: currentStaff.id,
              paused_timer_drafter_name: currentStaff.name,
              paused_elapsed_seconds: undefined
            };
            recordJobTimerIntent(j.id, {
              state: 'stopped',
              stoppedAt: breakIso,
              pausedByBreak: true,
              paused_timer_task: taskNote,
              paused_timer_drafter_id: currentStaff.id,
              paused_timer_drafter_name: currentStaff.name,
              updatedAtMs: endMs
            });

            return {
              ...j,
              hourly_rate: effectiveBreakRate,
              active_timer_start: undefined,
              active_timer_task: undefined,
              active_timer_drafter_id: undefined,
              active_timer_drafter_name: undefined,
              timer_explicit_stop_at: breakIso,
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
                  timestamp: breakIso,
                  details: `Drafting timer on ${j.job_number} auto-paused for employee break. Logged ${Math.round(durationSeconds / 60)} mins pre-break.`
                },
                ...j.audit_logs
              ]
            };
          }),
        pausedJobIds,
        { allowTimerClear: true }
      );
      setPausedJobsNotice({ jobNumbers: pausedJobNumbers, type: 'paused' });
    }

    // Update timecard shift status to on_break
    const existingActiveShift = timeCards.find(s => isShiftForStaff(s, currentStaff) && (s.status === 'clocked_in' || !s.clockOutTime));
    
    let updatedCards: TimeCardShift[];
    let modifiedShift: TimeCardShift | null = null;
    if (existingActiveShift) {
      updatedCards = timeCards.map(s => {
        if (s.id === existingActiveShift.id) {
          const newBreak: TimeCardBreak = {
            id: `brk-${Date.now()}`,
            startTime: new Date().toISOString()
          };
          modifiedShift = {
            ...s,
            status: 'on_break' as const,
            breaks: [...(s.breaks || []), newBreak],
            pausedProjectJobIds: pausedJobIds
          };
          return modifiedShift;
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
      modifiedShift = newShift;
      updatedCards = [newShift, ...timeCards];
    }

    setTimeCards(updatedCards);
    saveStoredTimeCards(updatedCards);
    if (modifiedShift) {
      saveTimeCardToFirestore(modifiedShift).catch(err => console.warn('[Firestore] Break start sync error:', err));
    }

    // For Greg Hyatt: Pause any active Dev Project Card timers during shift break
    if (isUserGregHyatt(currentStaff)) {
      const currentDevCards = devCardsRef.current;
      const runningCards = currentDevCards.filter(c => c.isActive && c.activeTimerStart);
      if (runningCards.length > 0) {
        const newDevLogs: GregDevTimeEntry[] = [];
        const pausedCardsToSave: GregDevProjectCard[] = [];
        const updatedDevCards = currentDevCards.map(c => {
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

            const endIso = new Date(endMs).toISOString();
            const pausedCard: GregDevProjectCard = {
              ...c,
              isActive: false,
              isPausedByBreak: true,
              activeTimerStart: undefined,
              todaySeconds: (c.todaySeconds || 0) + durationSeconds,
              totalSeconds: (c.totalSeconds || 0) + durationSeconds,
              lastStoppedAt: endIso,
              explicitStopAt: endIso,
              stoppedReason: 'break'
            };
            recordDevCardTimerIntent(c.id, {
              state: 'stopped',
              stoppedAt: endIso,
              updatedAtMs: endMs,
              reason: 'break'
            });
            pausedCardsToSave.push(pausedCard);
            return pausedCard;
          }
          return c;
        });

        if (newDevLogs.length > 0) {
          const allEntries = [...newDevLogs, ...devEntriesRef.current];
          devEntriesRef.current = allEntries;
          setDevEntries(allEntries);
          saveStoredGregDevEntries(allEntries);
        }
        pausedCardsToSave.forEach(card => {
          pendingDevCardMutationRef.current[card.id] = { atMs: Date.now(), card };
        });
        devCardsRef.current = updatedDevCards;
        setDevCards(updatedDevCards);
        saveStoredGregDevCards(updatedDevCards);
        pausedCardsToSave.forEach(card => {
          saveSingleDevProjectCardToFirestore(card);
        });
      }
    }
  };

  const handleResumeFromBreak = () => {
    if (authenticatedStaff && currentStaff.id !== authenticatedStaff.id) return;
    if (isStaffExemptFromClock(currentStaff)) return;

    const curStaffLower = (currentStaff.name || '').toLowerCase().trim();
    const resumedJobNumbers: string[] = [];
    const resumedJobIds: string[] = [];

    // Find shift to get paused jobs
    const activeShift = timeCards.find(s => isShiftForStaff(s, currentStaff) && s.status === 'on_break');
    const pausedJobIds = activeShift?.pausedProjectJobIds || [];

    // Helper to determine if a paused job belongs to this returning staff member
    const isJobPausedForCurrentStaff = (j: Job) => {
      if (!j.paused_by_break && !pausedJobIds.includes(j.id)) return false;
      if (pausedJobIds.includes(j.id)) return true;
      if (j.paused_timer_drafter_id) return j.paused_timer_drafter_id === currentStaff.id;
      if (j.paused_timer_drafter_name) return j.paused_timer_drafter_name.toLowerCase().trim() === curStaffLower;
      const assigned = (j.assigned_drafter || '').toLowerCase().trim();
      const assignedFirst = assigned.split(',')[0].trim();
      if ((curStaffLower.length > 0 && assigned.includes(curStaffLower)) || (assignedFirst.length > 0 && curStaffLower.includes(assignedFirst))) return true;
      return false;
    };

    jobs.filter(isJobPausedForCurrentStaff).forEach(j => {
      resumedJobNumbers.push(j.job_number);
      resumedJobIds.push(j.id);
    });

    if (resumedJobIds.length > 0) {
      const nowIso = new Date().toISOString();
      updateJobsState(
        prevJobs =>
          prevJobs.map(j => {
            if (!resumedJobIds.includes(j.id)) return j;
            const taskToResume = j.paused_timer_task || `Drafting ${j.current_status}`;
            pendingJobTimerMutationRef.current[j.id] = {
              atMs: Date.now(),
              active_timer_start: nowIso,
              active_timer_task: taskToResume,
              active_timer_drafter_id: currentStaff.id,
              active_timer_drafter_name: currentStaff.name,
              active_timer_delegated_task_id: j.active_timer_delegated_task_id,
              paused_by_break: false,
              paused_timer_task: undefined,
              paused_timer_drafter_id: undefined,
              paused_timer_drafter_name: undefined,
              paused_elapsed_seconds: undefined
            };
            recordJobTimerIntent(j.id, {
              state: 'running',
              active_timer_start: nowIso,
              active_timer_task: taskToResume,
              active_timer_drafter_id: currentStaff.id,
              active_timer_drafter_name: currentStaff.name,
              active_timer_delegated_task_id: j.active_timer_delegated_task_id,
              updatedAtMs: Date.now()
            });
            return {
              ...j,
              paused_by_break: false,
              paused_timer_task: undefined,
              paused_timer_drafter_id: undefined,
              paused_timer_drafter_name: undefined,
              active_timer_start: nowIso,
              active_timer_task: taskToResume,
              active_timer_drafter_id: currentStaff.id,
              active_timer_drafter_name: currentStaff.name,
              timer_explicit_stop_at: undefined,
              audit_logs: [
                {
                  id: `a-${Date.now()}`,
                  action: 'Timer Resumed from Break',
                  performedBy: currentStaff.name,
                  timestamp: nowIso,
                  details: `Drafting timer on ${j.job_number} automatically resumed upon returning from break (${taskToResume}).`
                },
                ...j.audit_logs
              ]
            };
          }),
        resumedJobIds
      );
      setPausedJobsNotice({ jobNumbers: resumedJobNumbers, type: 'resumed' });
    }

    // Update timecard shift: close the open break and set status to clocked_in
    const resumedShifts: TimeCardShift[] = [];
    const updatedCards = timeCards.map(s => {
      if (isShiftForStaff(s, currentStaff) && s.status === 'on_break') {
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

        const updatedShift: TimeCardShift = {
          ...s,
          status: 'clocked_in' as const,
          breaks: closedBreaks,
          pausedProjectJobIds: []
        };
        resumedShifts.push(updatedShift);
        return updatedShift;
      }
      return s;
    });

    setTimeCards(updatedCards);
    saveStoredTimeCards(updatedCards);
    resumedShifts.forEach(sh => {
      saveTimeCardToFirestore(sh).catch(err => console.warn('[Firestore] Resume break sync error:', err));
    });

    // For Greg Hyatt: Automatically resume Dev Project Card timers that were paused by break
    if (isUserGregHyatt(currentStaff)) {
      const currentDevCards = devCardsRef.current;
      const pausedDevCards = currentDevCards.filter(c => c.isPausedByBreak);
      if (pausedDevCards.length > 0) {
        const nowIso = new Date().toISOString();
        const resumedCardsToSave: GregDevProjectCard[] = [];
        const updatedDevCards = currentDevCards.map(c => {
          if (c.isPausedByBreak) {
            const resumedCard: GregDevProjectCard = {
              ...c,
              isActive: true,
              isPausedByBreak: false,
              activeTimerStart: nowIso,
              lastStartedAt: nowIso,
              lastStoppedAt: undefined,
              explicitStopAt: undefined,
              stoppedReason: undefined
            };
            recordDevCardTimerIntent(c.id, {
              state: 'running',
              activeTimerStart: nowIso,
              updatedAtMs: Date.now(),
              projectType: c.projectType,
              currentNotes: c.currentNotes
            });
            resumedCardsToSave.push(resumedCard);
            return resumedCard;
          }
          return c;
        });
        resumedCardsToSave.forEach(card => {
          pendingDevCardMutationRef.current[card.id] = { atMs: Date.now(), card };
        });
        devCardsRef.current = updatedDevCards;
        setDevCards(updatedDevCards);
        saveStoredGregDevCards(updatedDevCards);
        resumedCardsToSave.forEach(card => {
          saveSingleDevProjectCardToFirestore(card);
        });
      }
    }
  };

  const handleClockOut = (notes?: string) => {
    if (authenticatedStaff && currentStaff.id !== authenticatedStaff.id) return;
    if (isStaffExemptFromClock(currentStaff)) return;

    const curStaffLower = (currentStaff.name || '').toLowerCase().trim();
    const stoppedJobNumbers: string[] = [];
    const stoppedJobIds: string[] = [];
    const stoppedDevProjects: string[] = [];

    const isTaskTimerForCurrentStaff = (t: DelegatedWorkItem) => {
      if (!t.activeTimerStart) return false;
      const drafter = (t.activeTimerDrafterName || t.assignedTo || '').toLowerCase().trim();
      if (!drafter || !curStaffLower) return false;
      return drafter === curStaffLower || drafter.includes(curStaffLower) || curStaffLower.includes(drafter.split(' ')[0]);
    };

    // Helper to determine if an active or paused job timer (or delegated task timer) belongs to this clocking-out staff
    const isJobTimerForCurrentStaff = (j: Job) => {
      const hasTaskTimer = (j.delegated_tasks || []).some(isTaskTimerForCurrentStaff);
      if (hasTaskTimer) return true;
      if (!j.active_timer_start && !j.paused_by_break) return false;
      if (j.active_timer_drafter_id) return j.active_timer_drafter_id === currentStaff.id;
      if (j.paused_timer_drafter_id) return j.paused_timer_drafter_id === currentStaff.id;
      if (j.active_timer_drafter_name) return j.active_timer_drafter_name.toLowerCase().trim() === curStaffLower;
      if (j.paused_timer_drafter_name) return j.paused_timer_drafter_name.toLowerCase().trim() === curStaffLower;
      const assigned = (j.assigned_drafter || '').toLowerCase().trim();
      const assignedFirst = assigned.split(',')[0].trim();
      if ((curStaffLower.length > 0 && assigned.includes(curStaffLower)) || (assignedFirst.length > 0 && curStaffLower.includes(assignedFirst))) return true;
      return false;
    };

    jobs.filter(isJobTimerForCurrentStaff).forEach(j => {
      stoppedJobNumbers.push(j.job_number);
      stoppedJobIds.push(j.id);
    });

    // Stop and save ONLY the jobs that have active/paused timers for this user
    if (stoppedJobIds.length > 0) {
      const stopEndMs = Date.now();
      const stopEndIso = new Date(stopEndMs).toISOString();

      updateJobsState(
        prevJobs =>
          prevJobs.map(j => {
            if (!stoppedJobIds.includes(j.id)) return j;

            const newLogs: TimeLog[] = [];
            let durationSeconds = 0;
            const taskNote = j.active_timer_task || j.paused_timer_task || `Drafting ${j.current_status}`;

            const effectiveClockOutRate = j.hourly_rate || 85;
            if (j.active_timer_start) {
              const startMs = new Date(j.active_timer_start).getTime();
              durationSeconds = Math.max(1, Math.floor((stopEndMs - startMs) / 1000));
              newLogs.push({
                id: `tl-${stopEndMs}-${Math.random().toString(36).substr(2, 5)}`,
                drafterName: currentStaff.name,
                startTime: j.active_timer_start,
                endTime: stopEndIso,
                durationSeconds,
                taskDescription: `${taskNote} (Shift End Auto-Stop)`,
                hourlyRate: effectiveClockOutRate,
                billableAmount: Math.round(((durationSeconds / 3600) * effectiveClockOutRate) * 100) / 100,
                delegatedTaskId: j.active_timer_delegated_task_id
              });
            }

            // Also stop any delegated task timers belonging to this staff member
            const updatedTasks = (j.delegated_tasks || []).map(t => {
              // Never alter status of already Completed or Under Review tasks upon clock-out
              if (t.status === 'Completed' || t.status === 'Under Review' || Boolean(t.isReviewed) || Boolean(t.completedAt)) {
                return { ...t, activeTimerStart: undefined, activeTimerDrafterName: undefined };
              }
              if (!isTaskTimerForCurrentStaff(t)) return t;
              const tStartMs = t.activeTimerStart ? new Date(t.activeTimerStart).getTime() : stopEndMs;
              const tElapsed = t.activeTimerStart ? Math.max(1, Math.floor((stopEndMs - tStartMs) / 1000)) : 0;
              // If job-level timer wasn't already tracking this task, record its time log too
              if (tElapsed > 0 && j.active_timer_delegated_task_id !== t.id && !j.active_timer_start) {
                newLogs.push({
                  id: `tl-task-${stopEndMs}-${Math.random().toString(36).substr(2, 5)}`,
                  drafterName: currentStaff.name,
                  startTime: t.activeTimerStart || stopEndIso,
                  endTime: stopEndIso,
                  durationSeconds: tElapsed,
                  taskDescription: `Task: ${t.componentTitle} (Shift End Auto-Stop)`,
                  hourlyRate: effectiveClockOutRate,
                  billableAmount: Math.round(((tElapsed / 3600) * effectiveClockOutRate) * 100) / 100,
                  delegatedTaskId: t.id,
                  delegatedTaskTitle: t.componentTitle
                });
                durationSeconds += tElapsed;
              }
              return {
                ...t,
                status: t.status === 'In Progress' ? ('Pending' as const) : t.status,
                activeTimerStart: undefined,
                activeTimerDrafterName: undefined,
                workedSeconds: (t.workedSeconds || 0) + tElapsed
              };
            });

            const updatedLogs = newLogs.length > 0 ? [...(j.time_logs || []), ...newLogs] : (j.time_logs || []);
            const totalSec = updatedLogs.reduce((s, l) => s + (l.durationSeconds || 0), 0);
            const totalMins = Math.round(totalSec / 60);
            const totalHours = Number((totalSec / 3600).toFixed(2));

            pendingJobTimerMutationRef.current[j.id] = {
              atMs: Date.now(),
              active_timer_start: undefined,
              active_timer_task: undefined,
              active_timer_drafter_id: undefined,
              active_timer_drafter_name: undefined,
              active_timer_delegated_task_id: undefined,
              paused_by_break: false,
              paused_timer_task: undefined,
              paused_timer_drafter_id: undefined,
              paused_timer_drafter_name: undefined,
              paused_elapsed_seconds: undefined
            };

            recordJobTimerIntent(j.id, {
              state: 'stopped',
              stoppedAt: stopEndIso,
              updatedAtMs: stopEndMs
            });

            return {
              ...j,
              hourly_rate: effectiveClockOutRate,
              active_timer_start: undefined,
              active_timer_task: undefined,
              active_timer_drafter_id: undefined,
              active_timer_drafter_name: undefined,
              active_timer_delegated_task_id: undefined,
              timer_explicit_stop_at: stopEndIso,
              paused_by_break: false,
              paused_timer_task: undefined,
              paused_timer_drafter_id: undefined,
              paused_timer_drafter_name: undefined,
              paused_elapsed_seconds: undefined,
              delegated_tasks: updatedTasks,
              time_logs: updatedLogs,
              total_time_entries: updatedLogs.length,
              total_duration_minutes: totalMins,
              total_duration_hours: totalHours,
              audit_logs: [
                {
                  id: `a-${stopEndMs}-${Math.random().toString(36).substr(2, 5)}`,
                  action: 'Timer Stopped (Clock Out)',
                  performedBy: currentStaff.name,
                  timestamp: stopEndIso,
                  details: durationSeconds > 0
                    ? `Drafting timer on ${j.job_number} automatically stopped & finalized upon shift clock-out (${Math.max(1, Math.round(durationSeconds / 60))} mins logged).`
                    : `Drafting timer ended upon shift clock-out for "${taskNote}".`
                },
                ...j.audit_logs
              ]
            };
          }),
        stoppedJobIds,
        { allowTimerClear: true }
      );
    }

    // Finalize active timecard shift
    const endMs = Date.now();
    const closedShifts: TimeCardShift[] = [];
    const updatedCards = timeCards.map(s => {
      if (isShiftForStaff(s, currentStaff) && (s.status === 'clocked_in' || s.status === 'on_break')) {
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

        const finalizedShift: TimeCardShift = {
          ...s,
          clockOutTime: new Date(endMs).toISOString(),
          status: 'clocked_out' as const,
          breaks: finalBreaks,
          totalWorkSeconds: totalWorkSec,
          totalBreakSeconds: totalBreakSec,
          notes: notes || s.notes || 'Completed shift',
          pausedProjectJobIds: []
        };
        closedShifts.push(finalizedShift);
        return finalizedShift;
      }
      return s;
    });

    setTimeCards(updatedCards);
    saveStoredTimeCards(updatedCards);
    closedShifts.forEach(sh => {
      saveTimeCardToFirestore(sh).catch(err => console.warn('[Firestore] Clock-out sync error:', err));
    });

    // For Greg Hyatt: Stop and finalize ALL active or break-paused Dev Project Card timers upon clocking out
    if (isUserGregHyatt(currentStaff)) {
      const currentDevCards = devCardsRef.current;
      const newDevLogs: GregDevTimeEntry[] = [];
      const stoppedCardsToSave: GregDevProjectCard[] = [];
      const updatedDevCards = currentDevCards.map(c => {
        if (!c.isActive && !c.isPausedByBreak && !c.activeTimerStart) {
          return c;
        }
        let additionalSec = 0;
        if (c.isActive && c.activeTimerStart) {
          stoppedDevProjects.push(c.projectType);
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

        const curEndMs = Date.now();
        const curEndIso = new Date(curEndMs).toISOString();
        const stoppedCard: GregDevProjectCard = {
          ...c,
          isActive: false,
          isPausedByBreak: false,
          activeTimerStart: undefined,
          todaySeconds: (c.todaySeconds || 0) + additionalSec,
          totalSeconds: (c.totalSeconds || 0) + additionalSec,
          lastStoppedAt: additionalSec > 0 ? curEndIso : c.lastStoppedAt,
          explicitStopAt: curEndIso,
          stoppedReason: 'clock_out'
        };
        recordDevCardTimerIntent(c.id, {
          state: 'stopped',
          stoppedAt: curEndIso,
          updatedAtMs: curEndMs,
          reason: 'clock_out'
        });
        stoppedCardsToSave.push(stoppedCard);
        return stoppedCard;
      });

      if (newDevLogs.length > 0) {
        const allEntries = [...newDevLogs, ...devEntriesRef.current];
        devEntriesRef.current = allEntries;
        setDevEntries(allEntries);
        saveStoredGregDevEntries(allEntries);
      }
      if (stoppedCardsToSave.length > 0) {
        stoppedCardsToSave.forEach(card => {
          pendingDevCardMutationRef.current[card.id] = { atMs: Date.now(), card };
        });
        devCardsRef.current = updatedDevCards;
        setDevCards(updatedDevCards);
        saveStoredGregDevCards(updatedDevCards);
        stoppedCardsToSave.forEach(card => {
          saveSingleDevProjectCardToFirestore(card);
        });
      }
    }

    // Broadcast remote sign-out to all OTHER active sessions/devices for this user (e.g., desktop left open)
    const originSessionId = getDeviceSessionId();
    triggerRemoteLogoutInFirestore(currentStaff.id, originSessionId, 'clock_out')
      .then((signalIso) => {
        if (authenticatedStaff?.id === currentStaff.id) {
          initialForceLogoutAtRef.current = signalIso;
        }
      })
      .catch(err => console.warn('[Auth] Remote logout broadcast notice:', err));

    setPausedJobsNotice({
      jobNumbers: stoppedJobNumbers,
      devProjects: stoppedDevProjects,
      remoteSignedOut: true,
      type: 'clock_out_stopped'
    });
  };

  // Sync manual edits or deletions from TimeCardModal directly to Firestore
  const handleSyncTimeCards = (updated: TimeCardShift[]) => {
    const prevCards = timeCards;
    setTimeCards(updated);
    saveStoredTimeCards(updated);

    // Sync added or edited shifts
    updated.forEach(shift => {
      const existing = prevCards.find(p => p.id === shift.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(shift)) {
        saveTimeCardToFirestore(shift).catch(err => console.warn('[Firestore] Time card edit sync error:', err));
      }
    });

    // Sync deleted shifts
    prevCards.forEach(prevShift => {
      if (!updated.some(u => u.id === prevShift.id)) {
        deleteTimeCardFromFirestore(prevShift.id).catch(err => console.warn('[Firestore] Time card delete sync error:', err));
      }
    });
  };

  // Atomic single-card Greg Dev Project Card handlers
  // CRITICAL: Compute the updated card synchronously BEFORE setDevCards so React 18 batching
  // NEVER skips saveSingleDevProjectCardToFirestore!
  const handleStartDevCardTimer = (cardId: string, notesOverride?: string) => {
    // Cancel any pending notes debounce for this card so it cannot race with start
    if (devCardNotesDebounceMapRef.current[cardId]) {
      clearTimeout(devCardNotesDebounceMapRef.current[cardId]);
      delete devCardNotesDebounceMapRef.current[cardId];
    }

    const nowIso = new Date().toISOString();
    const prevCards = devCardsRef.current;
    let startedCard: GregDevProjectCard | null = null;

    const next = prevCards.map(c => {
      if (c.id !== cardId) return c;
      startedCard = {
        ...c,
        isActive: true,
        isPausedByBreak: false,
        activeTimerStart: nowIso,
        lastStartedAt: nowIso,
        lastStoppedAt: undefined,
        explicitStopAt: undefined,
        stoppedReason: undefined,
        currentNotes: notesOverride !== undefined ? notesOverride : c.currentNotes
      };
      return startedCard;
    });

    if (!startedCard) return;

    const confirmedStartedCard: GregDevProjectCard = startedCard;
    recordDevCardTimerIntent(cardId, {
      state: 'running',
      activeTimerStart: nowIso,
      updatedAtMs: Date.now(),
      projectType: confirmedStartedCard.projectType,
      currentNotes: confirmedStartedCard.currentNotes
    });

    pendingDevCardMutationRef.current[cardId] = { atMs: Date.now(), card: confirmedStartedCard };
    devCardsRef.current = next;
    setDevCards(next);
    saveStoredGregDevCards(next);
    saveSingleDevProjectCardToFirestore(confirmedStartedCard);

    if (authenticatedStaff?.id) {
      updateStaffPresenceInFirestore(authenticatedStaff.id, true).catch(() => {});
    }
  };

  const handleStopDevCardTimer = (cardId: string, notesOverride?: string, activeShiftId?: string): number => {
    if (devCardNotesDebounceMapRef.current[cardId]) {
      clearTimeout(devCardNotesDebounceMapRef.current[cardId]);
      delete devCardNotesDebounceMapRef.current[cardId];
    }

    const prevCards = devCardsRef.current;
    const currentCard = prevCards.find(c => c.id === cardId);
    if (!currentCard || (!currentCard.isActive && !currentCard.activeTimerStart)) return 0;

    const endMs = Date.now();
    const startMs = currentCard.activeTimerStart ? new Date(currentCard.activeTimerStart).getTime() : NaN;
    const hasValidStart = !isNaN(startMs);
    const noteToLog = (notesOverride !== undefined ? notesOverride : currentCard.currentNotes)?.trim() || `Dev session on ${currentCard.projectType}`;

    let durationSeconds = 0;
    let updatedEntries = devEntriesRef.current;

    if (hasValidStart && currentCard.activeTimerStart) {
      durationSeconds = Math.max(1, Math.floor((endMs - startMs) / 1000));
      const hours = durationSeconds / 3600;
      const rate = currentStaff.hourlyRate || 150;
      const billableAmount = Number((hours * rate).toFixed(2));
      const todayStr = getLocalDateString(new Date(endMs));

      const newEntry: GregDevTimeEntry = {
        id: `dev-entry-${endMs}-${Math.random().toString(36).substr(2, 4)}`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        projectType: currentCard.projectType,
        date: todayStr,
        startTime: currentCard.activeTimerStart,
        endTime: new Date(endMs).toISOString(),
        durationSeconds,
        notes: noteToLog,
        hourlyRate: rate,
        billableAmount,
        shiftId: activeShiftId,
        createdAt: new Date(endMs).toISOString()
      };

      updatedEntries = [newEntry, ...devEntriesRef.current];
      devEntriesRef.current = updatedEntries;
      setDevEntries(updatedEntries);
      saveStoredGregDevEntries(updatedEntries);
      saveDevTimeEntryToFirestore(newEntry);
    }

    const todayStr = getLocalDateString(new Date(endMs));
    const endIso = new Date(endMs).toISOString();
    let stoppedCard: GregDevProjectCard | null = null;
    const next = prevCards.map(c => {
      if (c.id !== cardId) return c;
      const normType = (c.projectType || '').trim().toLowerCase();
      const cardTodaySec = updatedEntries
        .filter(e => (e.projectType || '').trim().toLowerCase() === normType && (e.date === todayStr || (e.startTime && getLocalDateString(new Date(e.startTime)) === todayStr)))
        .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
      const cardTotalSec = updatedEntries
        .filter(e => (e.projectType || '').trim().toLowerCase() === normType)
        .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
      stoppedCard = {
        ...c,
        isActive: false,
        isPausedByBreak: false,
        activeTimerStart: undefined,
        todaySeconds: cardTodaySec,
        totalSeconds: Math.max(c.totalSeconds || 0, cardTotalSec),
        lastStoppedAt: endIso,
        explicitStopAt: endIso,
        stoppedReason: 'user_stop',
        currentNotes: noteToLog
      };
      return stoppedCard;
    });

    if (stoppedCard) {
      recordDevCardTimerIntent(cardId, {
        state: 'stopped',
        stoppedAt: endIso,
        updatedAtMs: endMs,
        reason: 'user_stop'
      });
      pendingDevCardMutationRef.current[cardId] = { atMs: Date.now(), card: stoppedCard };
      devCardsRef.current = next;
      setDevCards(next);
      saveStoredGregDevCards(next);
      saveSingleDevProjectCardToFirestore(stoppedCard);
    }

    if (authenticatedStaff?.id) {
      updateStaffPresenceInFirestore(authenticatedStaff.id, true).catch(() => {});
    }

    return durationSeconds;
  };

  const handleUpdateDevCardNotes = (cardId: string, notes: string) => {
    // Functional local update ONLY touches currentNotes — NEVER touches isActive / activeTimerStart
    setDevCards(prev => {
      const next = prev.map(c => (c.id === cardId ? { ...c, currentNotes: notes } : c));
      devCardsRef.current = next;
      saveStoredGregDevCards(next);
      return next;
    });

    if (devCardNotesDebounceMapRef.current[cardId]) {
      clearTimeout(devCardNotesDebounceMapRef.current[cardId]);
    }
    devCardNotesDebounceMapRef.current[cardId] = setTimeout(() => {
      delete devCardNotesDebounceMapRef.current[cardId];
      // Merge ONLY current_notes in Firestore so typing or blurring can NEVER stop a running timer
      updateDevCardNotesInFirestore(cardId, notes);
    }, 500);
  };

  const handleAddDevCard = (newCard: GregDevProjectCard) => {
    const prevCards = devCardsRef.current;
    const normNewType = (newCard.projectType || '').trim().toLowerCase();
    if (prevCards.some(c => c.id === newCard.id || (c.projectType || '').trim().toLowerCase() === normNewType)) {
      return;
    }
    const next = [...prevCards, newCard];
    pendingDevCardMutationRef.current[newCard.id] = { atMs: Date.now(), card: newCard };
    devCardsRef.current = next;
    setDevCards(next);
    saveStoredGregDevCards(next);
    saveSingleDevProjectCardToFirestore(newCard);
  };

  const handleDismissDevCard = (cardId: string) => {
    if (devCardNotesDebounceMapRef.current[cardId]) {
      clearTimeout(devCardNotesDebounceMapRef.current[cardId]);
      delete devCardNotesDebounceMapRef.current[cardId];
    }
    clearDevCardTimerIntent(cardId);
    const next = devCardsRef.current.filter(c => c.id !== cardId);
    devCardsRef.current = next;
    setDevCards(next);
    saveStoredGregDevCards(next);
    deleteDevProjectCardFromFirestore(cardId).catch(err => console.warn('[Firestore] Dev card delete error:', err));
  };

  // Fallback bulk sync handler for any legacy callers (writes only changed cards)
  const handleSyncDevCards = (updated: GregDevProjectCard[]) => {
    const prevCards = devCardsRef.current;
    devCardsRef.current = updated;
    setDevCards(updated);
    saveStoredGregDevCards(updated);

    const removedIds = prevCards
      .filter(p => !updated.some(u => u.id === p.id))
      .map(p => p.id);
    removedIds.forEach(cardId => {
      deleteDevProjectCardFromFirestore(cardId).catch(err => console.warn('[Firestore] Dev card delete error:', err));
    });

    const changedCards = updated.filter(u => {
      const p = prevCards.find(c => c.id === u.id);
      if (!p) return true;
      return JSON.stringify(p) !== JSON.stringify(u);
    });

    if (devCardsCloudDebounceRef.current) {
      clearTimeout(devCardsCloudDebounceRef.current);
      devCardsCloudDebounceRef.current = null;
    }

    if (changedCards.length > 0) {
      saveDevProjectCardsToFirestore(changedCards).catch(err => console.warn('Firestore dev card save error:', err));
    }
  };

  // Sync Greg Dev Time Entries (adds, edits, deletions) directly to Firestore
  const handleSyncDevEntries = (updated: GregDevTimeEntry[]) => {
    const prevEntries = devEntries;
    setDevEntries(updated);
    saveStoredGregDevEntries(updated);

    updated.forEach(entry => {
      const existing = prevEntries.find(p => p.id === entry.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(entry)) {
        saveDevTimeEntryToFirestore(entry).catch(err => console.warn('[Firestore] Dev entry save error:', err));
      }
    });

    prevEntries.forEach(prevEntry => {
      if (!updated.some(u => u.id === prevEntry.id)) {
        deleteDevTimeEntryFromFirestore(prevEntry.id).catch(err => console.warn('[Firestore] Dev entry delete error:', err));
      }
    });
  };

  // Staff Management handlers
  const handleAddStaff = async (newStaff: StaffUser): Promise<void> => {
    const cleanStaff: StaffUser = {
      ...newStaff,
      email: (newStaff.email || '').trim().toLowerCase(),
      name: (newStaff.name || '').trim()
    };
    removeDeletedStaffId({ id: cleanStaff.id, email: cleanStaff.email });
    pendingStaffMutationRef.current[cleanStaff.id] = { atMs: Date.now(), staff: cleanStaff };

    setStaffList(prev => {
      const exists = prev.some(s => s.id === cleanStaff.id);
      const updated = exists
        ? prev.map(s => (s.id === cleanStaff.id ? { ...s, ...cleanStaff } : s))
        : [...prev, cleanStaff];
      saveStoredStaff(updated);
      return updated;
    });

    try {
      await saveStaffToFirestore(cleanStaff);
    } catch (err) {
      delete pendingStaffMutationRef.current[cleanStaff.id];
      console.error('[Firestore] Error saving staff:', err);
      throw err;
    }
  };

  const handleUpdateStaff = async (updatedStaff: StaffUser): Promise<void> => {
    const normalizedEmail = (updatedStaff.email || '').trim().toLowerCase();
    const prevList = staffListRef.current;

    // Match exact document ID first, plus any duplicate doc sharing the exact same non-empty email
    // so stale duplicate docs in Firestore cannot revert permission changes.
    const docsToPersist: StaffUser[] = [];
    let matchedPrimary = false;

    const nextList = prevList.map(s => {
      const idMatch = s.id === updatedStaff.id;
      const emailMatch = Boolean(normalizedEmail) && Boolean(s.email) && s.email.trim().toLowerCase() === normalizedEmail;
      if (idMatch || emailMatch) {
        if (idMatch) matchedPrimary = true;
        const mergedRecord: StaffUser = {
          ...s,
          ...updatedStaff,
          id: s.id,
          email: normalizedEmail || s.email,
          // Never drop live account/session metadata during a profile or permission edit
          authUid: updatedStaff.authUid || s.authUid,
          emailVerified: updatedStaff.emailVerified ?? s.emailVerified,
          isOnline: updatedStaff.isOnline ?? s.isOnline,
          lastSeenAt: updatedStaff.lastSeenAt || s.lastSeenAt,
          lastLoginAt: updatedStaff.lastLoginAt || s.lastLoginAt,
          forceLogoutAt: updatedStaff.forceLogoutAt || s.forceLogoutAt,
          joinedDate: updatedStaff.joinedDate || s.joinedDate
        };
        docsToPersist.push(mergedRecord);
        return mergedRecord;
      }
      return s;
    });

    if (!matchedPrimary) {
      const fallbackRecord: StaffUser = {
        ...updatedStaff,
        email: normalizedEmail || updatedStaff.email
      };
      docsToPersist.push(fallbackRecord);
      if (!nextList.some(s => s.id === fallbackRecord.id)) {
        nextList.push(fallbackRecord);
      }
    }

    const nowMs = Date.now();
    docsToPersist.forEach(docItem => {
      removeDeletedStaffId({ id: docItem.id, email: docItem.email });
      pendingStaffMutationRef.current[docItem.id] = { atMs: nowMs, staff: docItem };
    });

    const primaryUpdated = docsToPersist.find(d => d.id === updatedStaff.id) || docsToPersist[0];

    setStaffList(nextList);
    saveStoredStaff(nextList);

    const matchesProfile = (target: StaffUser | null) => {
      if (!target) return false;
      return (
        target.id === primaryUpdated.id ||
        (Boolean(target.email) && Boolean(primaryUpdated.email) && target.email.trim().toLowerCase() === primaryUpdated.email.trim().toLowerCase()) ||
        target.name.trim().toLowerCase() === primaryUpdated.name.trim().toLowerCase()
      );
    };

    if (matchesProfile(currentStaff)) {
      setCurrentStaff(prev => ({ ...prev, ...primaryUpdated }));
      saveStoredActiveStaffId(primaryUpdated.id);
    }

    if (matchesProfile(authenticatedStaffRef.current)) {
      setAuthenticatedStaff(prev => (prev ? { ...prev, ...primaryUpdated } : prev));
    }

    try {
      await Promise.all(docsToPersist.map(docItem => saveStaffToFirestore(docItem)));
    } catch (err) {
      docsToPersist.forEach(docItem => {
        delete pendingStaffMutationRef.current[docItem.id];
      });
      console.error('[Firestore] Error updating staff:', err);
      throw err;
    }
  };

  const handleSelectStaff = (staff: StaffUser) => {
    // Only authorized leadership (Greg, Kyle, Jason, Drew) can switch into other drafters' accounts
    const realViewer = authenticatedStaff || currentStaff;
    if (staff.id !== realViewer.id && !canSwitchStaffAccounts(realViewer)) {
      return;
    }
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
    const target = staffList.find(s => s.id === staffId);
    // Only record locally if deleting a hardcoded core default so it doesn't locally re-seed;
    // for all other accounts, deleting from Firestore is authoritative and allows clean re-creation later!
    const isCoreDefault = STAFF_USERS.some(c => c.id === staffId);
    if (isCoreDefault) {
      if (target) {
        addDeletedStaffId({ id: target.id, email: target.email, name: target.name });
      } else {
        addDeletedStaffId(staffId);
      }
    }
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
    const liveJobs = jobsRef.current;

    // Collect all referenced jobs from explicit mentions, text scanning (e.g. M26-314 or #M26-314),
    // and ancestor messages in the same reply thread so Q&A threads stay linked to the job.
    const detectedJobNumberSet = new Set<string>(referencedJobNumbers || []);

    // Scan message text against all known jobs (case-insensitive, with or without leading #)
    liveJobs.forEach(j => {
      const cleanNum = (j.job_number || '').replace(/^#/, '').trim();
      if (!cleanNum) return;
      const escaped = cleanNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^A-Za-z0-9])#?${escaped}(?![A-Za-z0-9])`, 'i').test(text)) {
        detectedJobNumberSet.add(j.job_number);
      }
    });

    // Inherit job reference(s) from parent reply chain if replying to a job-tagged thread
    if (replyTarget) {
      const byId = new Map<string, ChatMessage>(chatMessages.map(m => [m.id, m]));
      const visited = new Set<string>();
      let cursor: ChatMessage | undefined = replyTarget;
      while (cursor && !visited.has(cursor.id)) {
        visited.add(cursor.id);
        (cursor.referencedJobNumbers || []).forEach(rjn => detectedJobNumberSet.add(rjn));
        cursor = cursor.replyToId ? byId.get(cursor.replyToId) : undefined;
      }
    }

    const finalReferencedJobNumbers = Array.from(detectedJobNumberSet);
    const nowIso = new Date().toISOString();
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: currentStaff.id,
      senderName: currentStaff.name,
      senderRole: currentStaff.title || '',
      text,
      timestamp: nowIso,
      ...(mentions && mentions.length > 0 ? { mentions } : {}),
      ...(finalReferencedJobNumbers.length > 0 ? { referencedJobNumbers: finalReferencedJobNumbers } : {}),
      ...(replyToId ? { replyToId } : {}),
      ...(replyTarget
        ? {
            replyToMessage: {
              id: replyTarget.id,
              senderName: replyTarget.senderName,
              text: (replyTarget.text || '').slice(0, 80)
            }
          }
        : {}),
      readByStaffIds: [currentStaff.id],
      hiddenByStaffIds: [],
      channelId: 'general'
    };

    // Guard against snapshot race conditions until Firestore confirms the write
    const sendNow = Date.now();
    pendingChatSendRef.current[newMsg.id] = {
      atMs: sendNow,
      message: newMsg,
      retryCount: 0,
      lastRetryAtMs: sendNow
    };
    setSyncingChatMessageIds(prev => (prev.includes(newMsg.id) ? prev : [...prev, newMsg.id]));

    setChatMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      const updated = [...prev, newMsg];
      saveStoredChatMessages(updated);
      return updated;
    });
    saveChatMessageToFirestore(newMsg)
      .then(() => {
        setSyncingChatMessageIds(prev => prev.filter(id => id !== newMsg.id));
        setFailedChatMessageIds(prev => prev.filter(id => id !== newMsg.id));
      })
      .catch(err => {
        console.warn('[Firestore] Error saving chat message:', err);
        const pendingEntry = pendingChatSendRef.current[newMsg.id];
        if (pendingEntry) {
          pendingEntry.failed = true;
        }
        setSyncingChatMessageIds(prev => prev.filter(id => id !== newMsg.id));
        setFailedChatMessageIds(prev => (prev.includes(newMsg.id) ? prev : [...prev, newMsg.id]));
      });

    // Cross-post job-referenced Studio Chat messages into each referenced job's "Messages & Notes"
    if (finalReferencedJobNumbers.length > 0 && liveJobs.length > 0) {
      const matchedJobs = liveJobs.filter(j => {
        const cleanJ = (j.job_number || '').replace(/^#/, '').trim().toLowerCase();
        return finalReferencedJobNumbers.some(rjn => rjn.replace(/^#/, '').trim().toLowerCase() === cleanJ);
      });

      if (matchedJobs.length > 0) {
        const matchedJobIds = matchedJobs.map(j => j.id);
        const syncedCommentId = `c-chat-${newMsg.id}`;
        const replyPrefix = replyTarget ? ` (replying to ${replyTarget.senderName})` : '';
        const syncedComment: JobComment = {
          id: syncedCommentId,
          author: currentStaff.name,
          authorId: currentStaff.id,
          role: 'drafter',
          text: `[Studio Chat${replyPrefix}] ${text}`,
          timestamp: nowIso,
          ...(mentions && mentions.length > 0 ? { taggedStaff: mentions } : {}),
          isJobNote: true
        };

        matchedJobIds.forEach(jid => recordPendingCommentMutation(jid, syncedComment));

        updateJobsState(
          prevJobs =>
            prevJobs.map(j => {
              if (!matchedJobIds.includes(j.id)) return j;
              const existingComments = j.comments || [];
              if (existingComments.some(c => c.id === syncedCommentId)) return j;
              return {
                ...j,
                comments: [...existingComments, syncedComment]
              };
            }),
          matchedJobIds
        );
      }
    }

    const lookupRoster = staffList.length > 0 ? staffList : STAFF_USERS;

    // If mentions exist, dispatch app notifications to the mentioned staff
    if (mentions && mentions.length > 0) {
      mentions.forEach(mentionedName => {
        const lowerM = mentionedName.toLowerCase().trim();
        const targetStaff = lookupRoster.find(
          s =>
            s.name.toLowerCase() === lowerM ||
            s.name.toLowerCase().split(/\s+/)[0] === lowerM
        );
        if (targetStaff && targetStaff.id !== currentStaff.id) {
          const notif: AppNotification = {
            id: `notif-chat-${Date.now()}-${targetStaff.id}`,
            recipientName: targetStaff.name,
            recipientEmail: targetStaff.email,
            title: `💬 ${currentStaff.name} mentioned you in Studio Chat`,
            message: `"${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`,
            timestamp: nowIso,
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
      const replyTargetStaff = lookupRoster.find(
        s => s.id === replyTarget.senderId || s.name.toLowerCase() === (replyTarget.senderName || '').toLowerCase()
      );
      const notif: AppNotification = {
        id: `notif-reply-${Date.now()}`,
        recipientName: replyTarget.senderName,
        recipientEmail: replyTargetStaff?.email || '',
        title: `↩️ ${currentStaff.name} replied to your message in Studio Chat`,
        message: `"${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`,
        timestamp: nowIso,
        read: false,
        type: 'comment',
        senderName: currentStaff.name
      };
      updateNotificationsState(prev => [notif, ...prev]);
    }
  };

  // Hide messages for the current staff user ONLY (never deletes shared history for senders or other team members)
  const handleHideChatMessagesForMe = (messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return;
    const now = Date.now();
    const idSet = new Set(messageIds);
    messageIds.forEach(id => {
      pendingChatHideRef.current[id] = { atMs: now, staffId: currentStaff.id };
    });

    setChatMessages(prev => {
      const updated = prev.map(m => {
        if (!idSet.has(m.id)) return m;
        const existing = m.hiddenByStaffIds || [];
        if (existing.includes(currentStaff.id)) return m;
        return { ...m, hiddenByStaffIds: [...existing, currentStaff.id] };
      });
      saveStoredChatMessages(updated);
      return updated;
    });

    hideChatMessagesForStaffInFirestore(messageIds, currentStaff.id).catch(err =>
      console.warn('[Firestore] Error hiding chat messages for staff:', err)
    );
  };

  const handleRetrySendChatMessage = (messageId: string) => {
    const pendingEntry = pendingChatSendRef.current[messageId];
    const targetMsg = pendingEntry?.message || chatMessages.find(m => m.id === messageId);
    if (!targetMsg) return;

    const now = Date.now();
    pendingChatSendRef.current[messageId] = {
      atMs: pendingEntry?.atMs || now,
      message: targetMsg,
      retryCount: 0,
      lastRetryAtMs: now,
      failed: false
    };

    setFailedChatMessageIds(prev => prev.filter(id => id !== messageId));
    setSyncingChatMessageIds(prev => (prev.includes(messageId) ? prev : [...prev, messageId]));

    saveChatMessageToFirestore(targetMsg)
      .then(() => {
        setSyncingChatMessageIds(prev => prev.filter(id => id !== messageId));
        setFailedChatMessageIds(prev => prev.filter(id => id !== messageId));
      })
      .catch(err => {
        console.warn('[Firestore] Manual retry saving chat message failed:', err);
        const entry = pendingChatSendRef.current[messageId];
        if (entry) entry.failed = true;
        setSyncingChatMessageIds(prev => prev.filter(id => id !== messageId));
        setFailedChatMessageIds(prev => (prev.includes(messageId) ? prev : [...prev, messageId]));
      });
  };

  const handleDeleteChatMessage = (messageId: string) => {
    const targetMsg = chatMessages.find(m => m.id === messageId);
    // Check the real authenticated staff member (not an impersonated switched-account view)
    // so switching into a teammate's account can never permanently delete their messages for everyone.
    const actualActor = authenticatedStaff || currentStaff;
    const isOriginalSender = Boolean(
      targetMsg &&
      actualActor &&
      (targetMsg.senderId === actualActor.id ||
        (targetMsg.senderName || '').trim().toLowerCase() === (actualActor.name || '').trim().toLowerCase())
    );

    // Only the original sender can permanently delete their own message;
    // for any other person's message, hide it from the current user's view only!
    if (!isOriginalSender) {
      handleHideChatMessagesForMe([messageId]);
      return;
    }

    pendingChatDeleteRef.current[messageId] = Date.now();
    delete pendingChatSendRef.current[messageId];
    setSyncingChatMessageIds(prev => prev.filter(id => id !== messageId));
    setFailedChatMessageIds(prev => prev.filter(id => id !== messageId));
    setChatMessages(prev => {
      const updated = prev.filter(m => m.id !== messageId);
      saveStoredChatMessages(updated);
      return updated;
    });
    deleteChatMessageFromFirestore(messageId).catch(err => console.warn('[Firestore] Error deleting chat message:', err));
  };

  const handleDeleteMultipleChatMessages = (messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return;
    // Bulk clear / "Clear Read" ALWAYS hides messages only for the current user so nobody
    // accidentally wipes out another team member's or sender's chat history!
    handleHideChatMessagesForMe(messageIds);
  };

  const handleMarkChatRead = (specificMessageIds?: string[]) => {
    const now = Date.now();
    setChatMessages(prev => {
      const targetSet = specificMessageIds && specificMessageIds.length > 0 ? new Set(specificMessageIds) : null;
      const relevantMsgs = prev.filter(m => {
        if (targetSet) return targetSet.has(m.id);
        return isMessageRelevantForUser(m, currentStaff, jobs, prev);
      });
      const unreadIds = relevantMsgs
        .filter(m => !(m.readByStaffIds || []).includes(currentStaff.id))
        .map(m => m.id);

      if (unreadIds.length === 0) return prev;

      unreadIds.forEach(id => {
        pendingChatReadRef.current[id] = { atMs: now, staffId: currentStaff.id };
      });

      const unreadSet = new Set(unreadIds);
      const updated = prev.map(m => {
        if (unreadSet.has(m.id)) {
          return { ...m, readByStaffIds: [...(m.readByStaffIds || []), currentStaff.id] };
        }
        return m;
      });
      saveStoredChatMessages(updated);
      markChatMessagesAsReadInFirestore(unreadIds, currentStaff.id).catch(err => console.warn('[Firestore] Error syncing chat read status:', err));
      return updated;
    });
  };

  // Count unread chat messages for current staff (only counting visible messages sent by someone else)
  const unreadChatCount = chatMessages.filter(m => {
    const isOwnMessage =
      m.senderId === currentStaff.id ||
      (m.senderName || '').trim().toLowerCase() === (currentStaff.name || '').trim().toLowerCase();
    return (
      !isOwnMessage &&
      isMessageRelevantForUser(m, currentStaff, jobs, chatMessages) &&
      !(m.readByStaffIds || []).includes(currentStaff.id)
    );
  }).length;

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

    updateJobsState(
      prevJobs =>
        prevJobs.map(j => {
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
        }),
      jobId
    );

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

    updateJobsState(
      prevJobs =>
        prevJobs.map(j => {
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
        }),
      jobId
    );
  };

  // 3. Add Comment / Pinned Markup Feedback
  const handleAddComment = (jobId: string, text: string, pinnedLocation?: PinnedLocation) => {
    const nowIso = new Date().toISOString();
    updateJobsState(
      prevJobs =>
        prevJobs.map(j => {
          if (j.id === jobId) {
            const authorName = userRole === 'drafter' ? currentStaff.name : j.customer_name;
            const newComment: JobComment = {
              id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              author: authorName,
              authorId: userRole === 'drafter' ? currentStaff.id : undefined,
              role: userRole,
              text,
              timestamp: nowIso,
              pinnedLocation
            };
            recordPendingCommentMutation(j.id, newComment);

            return {
              ...j,
              comments: [...(j.comments || []), newComment],
              last_customer_contact: nowIso
            };
          }
          return j;
        }),
      jobId
    );
  };

  // 3b. Add Specific Job Note (From Drafter Dashboard Table or Modals)
  const handleAddJobNote = (jobId: string, text: string, customTimestamp?: string) => {
    updateJobsState(
      prevJobs =>
        prevJobs.map(j => {
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
            recordPendingCommentMutation(j.id, newNote);

            return {
              ...j,
              comments: [...(j.comments || []), newNote]
            };
          }
          return j;
        }),
      jobId
    );
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
    updateJobsState(
      prevJobs =>
        prevJobs.map(j => {
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
        }),
      jobId
    );
  };

  // 6. Create New Job Intake (Restricted to Kyle, Jason Barnett, or Greg Hyatt)
  const handleCreateJob = (newJob: Job) => {
    if (!canUserCreateJob(currentStaff)) {
      alert('Permission Restricted: Only Kyle, Jason Barnett, or Greg Hyatt have authorization to create a new job.');
      return;
    }
    updateJobsState(prevJobs => [newJob, ...prevJobs], newJob.id);
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

    updateJobsState(
      prevJobs =>
        prevJobs.map(j => {
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
        }),
      newTask.jobId
    );

    // Create Notification for the assigned drafter
    if (notifyDrafter) {
      const targetLower = newTask.assignedTo.trim().toLowerCase();
      const assignedStaff =
        staffList.find(s => s.name.trim().toLowerCase() === targetLower) ||
        staffList.find(s => s.name.trim().toLowerCase().includes(targetLower)) ||
        STAFF_USERS.find(s => s.name.trim().toLowerCase() === targetLower);
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

  // 7b. Handle Reassigning an Existing Delegated Task to Another Drafter
  const handleReassignDelegatedTask = (jobId: string, taskId: string, newAssigneeName: string) => {
    const cleanAssignee = newAssigneeName.trim();
    if (!cleanAssignee) return;

    const targetJob = jobs.find(
      j =>
        (j.delegated_tasks && j.delegated_tasks.some(t => t.id === taskId)) ||
        (jobId && (j.id === jobId || isTargetJob(j, jobId)))
    );
    if (!targetJob) return;

    const existingTask = (targetJob.delegated_tasks || []).find(t => t.id === taskId);
    if (!existingTask || existingTask.assignedTo.trim().toLowerCase() === cleanAssignee.toLowerCase()) return;

    const targetLower = cleanAssignee.toLowerCase();
    const assignedStaff =
      staffList.find(s => s.name.trim().toLowerCase() === targetLower) ||
      staffList.find(s => s.name.trim().toLowerCase().includes(targetLower)) ||
      STAFF_USERS.find(s => s.name.trim().toLowerCase() === targetLower);

    const assignedEmail =
      assignedStaff?.email || `${cleanAssignee.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`;

    updateJobsState(
      prevJobs =>
        prevJobs.map(j => {
          if (j.id !== targetJob.id || !j.delegated_tasks) return j;
          return {
            ...j,
            delegated_tasks: j.delegated_tasks.map(t =>
              t.id === taskId
                ? { ...t, assignedTo: cleanAssignee, assignedToEmail: assignedEmail }
                : t
            ),
            audit_logs: [
              {
                id: `a-${Date.now()}`,
                action: 'Delegated Task Reassigned',
                performedBy: currentStaff.name,
                timestamp: new Date().toISOString(),
                details: `Reassigned "${existingTask.componentTitle}" from ${existingTask.assignedTo} to ${cleanAssignee}.`
              },
              ...j.audit_logs
            ]
          };
        }),
      targetJob.id
    );

    const reassignNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      recipientName: cleanAssignee,
      recipientEmail: assignedEmail,
      senderName: currentStaff.name,
      title: `Component Reassigned to You: ${existingTask.componentTitle}`,
      message: `${currentStaff.name} reassigned "${existingTask.componentTitle}" on Job #${targetJob.job_number} (${targetJob.customer_name}) to you.`,
      jobId: targetJob.id,
      jobNumber: targetJob.job_number,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'delegation'
    };
    updateNotificationsState(prev => [reassignNotif, ...prev]);
  };

  // 8. Handle Updating Delegated Task Status
  const handleUpdateTaskStatus = (jobId: string, taskId: string, newStatus: DelegatedWorkItem['status']) => {
    let completedTaskTitle = '';
    let delegatorName = '';

    const currentJobs = jobsRef.current;
    const targetJob = currentJobs.find(j =>
      (j.delegated_tasks && j.delegated_tasks.some(t => String(t.id).trim() === String(taskId).trim())) ||
      (jobId && isTargetJob(j, jobId)) ||
      (jobId && j.id === jobId)
    );
    const targetJobId = targetJob ? targetJob.id : jobId;
    const willClearJobTimer = Boolean(
      newStatus === 'Completed' &&
      targetJob &&
      (targetJob.active_timer_start || targetJob.paused_by_break) &&
      (String(targetJob.active_timer_delegated_task_id || '').trim() === String(taskId).trim() || !targetJob.active_timer_delegated_task_id)
    );

    updateJobsState(prevJobs =>
      prevJobs.map(j => {
        const isMatch = targetJob
          ? j.id === targetJob.id
          : (isTargetJob(j, jobId) || Boolean(j.delegated_tasks && j.delegated_tasks.some(t => String(t.id).trim() === String(taskId).trim())));
        if (isMatch && j.delegated_tasks) {
          let updatedTaskRef: DelegatedWorkItem | null = null;
          const updatedTasks = j.delegated_tasks.map(t => {
            if (String(t.id).trim() === String(taskId).trim()) {
              completedTaskTitle = t.componentTitle;
              delegatorName = t.delegatedBy;
              updatedTaskRef = {
                ...t,
                status: newStatus,
                completedAt: newStatus === 'Completed' ? (t.completedAt || new Date().toISOString()) : t.completedAt,
                completedBy: newStatus === 'Completed' ? (t.completedBy || currentStaff.name) : t.completedBy,
                isReviewed: newStatus === 'Completed' ? false : t.isReviewed,
                revisionRequested: newStatus === 'Completed' ? false : t.revisionRequested,
                activeTimerStart: newStatus === 'Completed' ? undefined : t.activeTimerStart,
                activeTimerDrafterName: newStatus === 'Completed' ? undefined : t.activeTimerDrafterName
              };
              return updatedTaskRef;
            }
            return t;
          });

          if (updatedTaskRef) {
            recordPendingTaskMutation(j.id, updatedTaskRef);
          }

          // Timer management for task status changes
          let activeTimerStart = j.active_timer_start;
          let activeTimerTask = j.active_timer_task;
          let activeTimerDrafterId = j.active_timer_drafter_id;
          let activeTimerDrafterName = j.active_timer_drafter_name;
          let activeTimerDelegatedTaskId = j.active_timer_delegated_task_id;
          let timerExplicitStopAt = j.timer_explicit_stop_at;
          let pausedByBreak = j.paused_by_break;
          let pausedTimerTask = j.paused_timer_task;
          let pausedTimerDrafterId = j.paused_timer_drafter_id;
          let pausedTimerDrafterName = j.paused_timer_drafter_name;
          let pausedElapsedSeconds = j.paused_elapsed_seconds;
          let timerChanged = false;

          if (newStatus === 'In Progress' && !j.active_timer_start) {
            activeTimerStart = new Date().toISOString();
            activeTimerTask = completedTaskTitle ? `Task: ${completedTaskTitle}` : (j.active_timer_task || 'Delegated Task');
            activeTimerDrafterId = currentStaff.id;
            activeTimerDrafterName = currentStaff.name;
            activeTimerDelegatedTaskId = taskId;
            timerExplicitStopAt = undefined;
            pausedByBreak = false;
            pausedTimerTask = undefined;
            pausedTimerDrafterId = undefined;
            pausedTimerDrafterName = undefined;
            pausedElapsedSeconds = undefined;
            timerChanged = true;
            recordJobTimerIntent(j.id, {
              state: 'running',
              active_timer_start: activeTimerStart,
              active_timer_task: activeTimerTask,
              active_timer_drafter_id: currentStaff.id,
              active_timer_drafter_name: currentStaff.name,
              active_timer_delegated_task_id: taskId,
              updatedAtMs: Date.now()
            });
          } else if (newStatus === 'Completed' && (String(j.active_timer_delegated_task_id || '').trim() === String(taskId).trim() || !j.active_timer_delegated_task_id)) {
            if (j.active_timer_start || j.paused_by_break) {
              const stopIso = new Date().toISOString();
              activeTimerStart = undefined;
              activeTimerTask = undefined;
              activeTimerDrafterId = undefined;
              activeTimerDrafterName = undefined;
              activeTimerDelegatedTaskId = undefined;
              timerExplicitStopAt = stopIso;
              pausedByBreak = false;
              pausedTimerTask = undefined;
              pausedTimerDrafterId = undefined;
              pausedTimerDrafterName = undefined;
              pausedElapsedSeconds = undefined;
              timerChanged = true;
              recordJobTimerIntent(j.id, {
                state: 'stopped',
                stoppedAt: stopIso,
                updatedAtMs: Date.now()
              });
            }
          }

          if (timerChanged) {
            pendingJobTimerMutationRef.current[j.id] = {
              atMs: Date.now(),
              active_timer_start: activeTimerStart,
              active_timer_task: activeTimerTask,
              active_timer_drafter_id: activeTimerDrafterId,
              active_timer_drafter_name: activeTimerDrafterName,
              active_timer_delegated_task_id: activeTimerDelegatedTaskId,
              paused_by_break: pausedByBreak,
              paused_timer_task: pausedTimerTask,
              paused_timer_drafter_id: pausedTimerDrafterId,
              paused_timer_drafter_name: pausedTimerDrafterName,
              paused_elapsed_seconds: pausedElapsedSeconds
            };
          }

          return {
            ...j,
            active_timer_start: activeTimerStart,
            active_timer_task: activeTimerTask,
            active_timer_drafter_id: activeTimerDrafterId,
            active_timer_drafter_name: activeTimerDrafterName,
            active_timer_delegated_task_id: activeTimerDelegatedTaskId,
            timer_explicit_stop_at: timerExplicitStopAt,
            paused_by_break: pausedByBreak,
            paused_timer_task: pausedTimerTask,
            paused_timer_drafter_id: pausedTimerDrafterId,
            paused_timer_drafter_name: pausedTimerDrafterName,
            paused_elapsed_seconds: pausedElapsedSeconds,
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
      }),
      targetJobId,
      willClearJobTimer ? { allowTimerClear: true } : undefined
    );

    // If marked Completed, notify delegator (Kyle / Jason / Greg)
    if (newStatus === 'Completed' && delegatorName && delegatorName !== currentStaff.name) {
      const delegatorStaff = STAFF_USERS.find(s => s.name === delegatorName);
      const completionNotif: AppNotification = {
        id: `notif-${Date.now()}`,
        recipientName: delegatorName,
        recipientEmail: delegatorStaff?.email || `${delegatorName.toLowerCase().replace(/\s+/g, '.')}@myplanstore.com`,
        senderName: currentStaff.name,
        title: `Task Completed: ${completedTaskTitle}`,
        message: `${currentStaff.name} has completed the delegated component "${completedTaskTitle}" on Job #${targetJob?.job_number || ''}.`,
        jobId: targetJobId,
        jobNumber: targetJob?.job_number || '',
        timestamp: new Date().toISOString(),
        read: false,
        type: 'status_change'
      };

      updateNotificationsState(prev => [completionNotif, ...prev]);
    }
  };

  // 9. Handle Comprehensive Task Completion Submission (Modal with Notes, Files, Time Log, and Notification)
  const handleCompleteTask = async (payload: CompleteTaskPayload): Promise<boolean> => {
    // Resilient job discovery from live jobsRef (never stale React closure!)
    const currentJobs = jobsRef.current;
    const targetJob = currentJobs.find(j =>
      (j.delegated_tasks && j.delegated_tasks.some(t => String(t.id).trim() === String(payload.taskId).trim())) ||
      (payload.jobId && isTargetJob(j, payload.jobId)) ||
      (payload.jobId && j.id === payload.jobId)
    );

    if (!targetJob) {
      console.warn('handleCompleteTask: Target job not found for payload', payload);
      return false;
    }

    const targetJobId = targetJob.id;
    let targetTaskTitle = '';
    const nowIso = payload.completedAtDate || new Date().toISOString();
    const preCheckTask = (targetJob.delegated_tasks || []).find(t => String(t.id).trim() === String(payload.taskId).trim());
    const preCheckTitle = preCheckTask ? preCheckTask.componentTitle : '';
    const willClearJobTimer = Boolean(
      (targetJob.active_timer_start || targetJob.paused_by_break) && (
        (targetJob.active_timer_delegated_task_id && String(targetJob.active_timer_delegated_task_id).trim() === String(payload.taskId).trim()) ||
        Boolean(preCheckTask?.activeTimerStart) ||
        (!targetJob.active_timer_delegated_task_id && preCheckTitle && (targetJob.active_timer_task || targetJob.paused_timer_task) && (targetJob.active_timer_task || targetJob.paused_timer_task || '').toLowerCase().includes(preCheckTitle.toLowerCase()))
      )
    );

    const saved = await updateJobsState(prevJobs =>
      prevJobs.map(j => {
        if (j.id === targetJobId && j.delegated_tasks) {
          const targetTask = j.delegated_tasks.find(t => String(t.id).trim() === String(payload.taskId).trim());
          targetTaskTitle = targetTask ? targetTask.componentTitle : '';
          const manualLoggedSec = payload.loggedHours ? Math.round(payload.loggedHours * 3600) : 0;

          // Check if an active timer was running on this job for this task
          const isTimerOnThisTask = Boolean(
            (j.active_timer_start || j.paused_by_break) && (
              (j.active_timer_delegated_task_id && String(j.active_timer_delegated_task_id).trim() === String(payload.taskId).trim()) ||
              Boolean(targetTask?.activeTimerStart) ||
              (!j.active_timer_delegated_task_id && targetTaskTitle && (j.active_timer_task || j.paused_timer_task) && (j.active_timer_task || j.paused_timer_task || '').toLowerCase().includes(targetTaskTitle.toLowerCase()))
            )
          );

          let liveTimerSec = 0;
          if (isTimerOnThisTask && j.active_timer_start) {
            const startMs = new Date(j.active_timer_start).getTime();
            liveTimerSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          } else if (isTimerOnThisTask && j.paused_elapsed_seconds) {
            liveTimerSec = Math.max(0, j.paused_elapsed_seconds);
          } else if (targetTask?.activeTimerStart) {
            const startMs = new Date(targetTask.activeTimerStart).getTime();
            liveTimerSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          }

          const effectiveWorkedSec = manualLoggedSec > 0 ? manualLoggedSec : liveTimerSec;

          let completedTaskRecord: DelegatedWorkItem | null = null;
          const updatedTasks = j.delegated_tasks.map(t => {
            if (String(t.id).trim() === String(payload.taskId).trim()) {
              targetTaskTitle = t.componentTitle;
              const existingAttachments = t.attachments || [];
              // Merge newly uploaded review attachments with full metadata
              const mergedAttachments = [...existingAttachments, ...payload.reviewFiles];
              const curWorked = t.workedSeconds || 0;

              completedTaskRecord = {
                ...t,
                status: 'Completed' as const,
                completedAt: nowIso,
                completedBy: currentStaff.name,
                completionNotes: payload.resolutionNotes,
                attachments: mergedAttachments,
                workedSeconds: curWorked + effectiveWorkedSec,
                isReviewed: false,
                revisionRequested: false,
                activeTimerStart: undefined,
                activeTimerDrafterName: undefined
              };
              return completedTaskRecord;
            }
            return t;
          });

          if (completedTaskRecord) {
            recordPendingTaskMutation(j.id, completedTaskRecord);
          }

          // If user wants deliverables added to project sheet gallery
          const updatedDeliverables = payload.addToJobDeliverables && payload.deliverableSheets.length > 0
            ? [...payload.deliverableSheets, ...(j.deliverables || [])]
            : (j.deliverables || []);

          // If user logged time spent during completion or had active timer running
          const effectiveCompRate = j.hourly_rate || 85;
          let updatedTimeLogs = j.time_logs || [];
          if (manualLoggedSec > 0) {
            const manualLog: TimeLog = {
              id: `log-comp-${Date.now()}`,
              drafterName: currentStaff.name,
              startTime: new Date(Date.now() - manualLoggedSec * 1000).toISOString(),
              endTime: nowIso,
              durationSeconds: manualLoggedSec,
              taskDescription: payload.loggedTaskDescription || `Completed task: ${targetTaskTitle}`,
              hourlyRate: effectiveCompRate,
              billableAmount: Math.round(((manualLoggedSec / 3600) * effectiveCompRate) * 100) / 100,
              delegatedTaskId: payload.taskId,
              delegatedTaskTitle: targetTaskTitle
            };
            updatedTimeLogs = [manualLog, ...updatedTimeLogs];
          } else if (liveTimerSec > 0) {
            const liveLog: TimeLog = {
              id: `log-live-${Date.now()}`,
              drafterName: currentStaff.name || j.active_timer_drafter_name || 'Kyle',
              startTime: j.active_timer_start || targetTask?.activeTimerStart || new Date(Date.now() - liveTimerSec * 1000).toISOString(),
              endTime: nowIso,
              durationSeconds: liveTimerSec,
              taskDescription: `Completed: ${targetTaskTitle}`,
              hourlyRate: effectiveCompRate,
              billableAmount: Math.round(((liveTimerSec / 3600) * effectiveCompRate) * 100) / 100,
              delegatedTaskId: payload.taskId,
              delegatedTaskTitle: targetTaskTitle
            };
            updatedTimeLogs = [liveLog, ...updatedTimeLogs];
          }

          const totalSec = updatedTimeLogs.reduce((s, l) => s + (l.durationSeconds || 0), 0);
          const totalMins = Math.round(totalSec / 60);
          const totalHours = Number((totalSec / 3600).toFixed(2));

          // If the job had an active/paused timer running on this task, clear it atomically & protect from stale snapshots
          const shouldClearJobTimer = isTimerOnThisTask;
          if (shouldClearJobTimer) {
            pendingJobTimerMutationRef.current[j.id] = {
              atMs: Date.now(),
              active_timer_start: undefined,
              active_timer_task: undefined,
              active_timer_drafter_id: undefined,
              active_timer_drafter_name: undefined,
              active_timer_delegated_task_id: undefined,
              paused_by_break: false,
              paused_timer_task: undefined,
              paused_timer_drafter_id: undefined,
              paused_timer_drafter_name: undefined,
              paused_elapsed_seconds: undefined
            };
            recordJobTimerIntent(j.id, {
              state: 'stopped',
              stoppedAt: nowIso,
              updatedAtMs: Date.now()
            });
          }

          // Add a detailed comment in the project stream for the team
          const completionComment: JobComment = {
            id: `c-task-comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            author: currentStaff.name,
            authorId: currentStaff.id,
            role: 'drafter' as const,
            text: `✅ TASK COMPLETED & SUBMITTED FOR REVIEW to ${payload.delegatorName} (CC: Jason):\n"${targetTaskTitle}"\n\nReview Notes:\n${payload.resolutionNotes}${payload.reviewFiles.length > 0 ? `\n\n📁 Attached ${payload.reviewFiles.length} file(s): ${payload.reviewFiles.map(f => f.name).join(', ')}` : ''}`,
            timestamp: nowIso
          };
          recordPendingCommentMutation(j.id, completionComment);

          return {
            ...j,
            hourly_rate: effectiveCompRate,
            active_timer_start: shouldClearJobTimer ? undefined : j.active_timer_start,
            active_timer_task: shouldClearJobTimer ? undefined : j.active_timer_task,
            active_timer_drafter_id: shouldClearJobTimer ? undefined : j.active_timer_drafter_id,
            active_timer_drafter_name: shouldClearJobTimer ? undefined : j.active_timer_drafter_name,
            active_timer_delegated_task_id: shouldClearJobTimer ? undefined : j.active_timer_delegated_task_id,
            timer_explicit_stop_at: shouldClearJobTimer ? nowIso : j.timer_explicit_stop_at,
            paused_by_break: shouldClearJobTimer ? false : j.paused_by_break,
            paused_timer_task: shouldClearJobTimer ? undefined : j.paused_timer_task,
            paused_timer_drafter_id: shouldClearJobTimer ? undefined : j.paused_timer_drafter_id,
            paused_timer_drafter_name: shouldClearJobTimer ? undefined : j.paused_timer_drafter_name,
            paused_elapsed_seconds: shouldClearJobTimer ? undefined : j.paused_elapsed_seconds,
            delegated_tasks: updatedTasks,
            deliverables: updatedDeliverables,
            time_logs: updatedTimeLogs,
            total_time_entries: updatedTimeLogs.length,
            total_duration_minutes: totalMins,
            total_duration_hours: totalHours,
            comments: [...(j.comments || []), completionComment],
            audit_logs: [
              {
                id: `a-${Date.now()}`,
                action: 'Delegated Task Completed',
                performedBy: currentStaff.name,
                timestamp: nowIso,
                details: `Marked "${targetTaskTitle}" completed with ${payload.reviewFiles.length} review file(s) submitted to ${payload.delegatorName} (CC: Jason). Notes: ${payload.resolutionNotes}`
              },
              ...(j.audit_logs || [])
            ]
          };
        }
        return j;
      }),
      targetJobId,
      willClearJobTimer ? { allowTimerClear: true } : undefined
    );

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

    if (!saved) {
      console.warn('handleCompleteTask: Cloud save did not confirm for job', targetJob.job_number);
      return false;
    }

    if (newNotifs.length > 0) {
      updateNotificationsState(prev => [...newNotifs, ...prev]);
    }

    setTaskToComplete(null);
    return true;
  };

  // 10. Handle Approving / Signing Off on a Reviewed Delegated Task
  const handleApproveTaskReview = (jobId: string, taskId: string, reviewNote?: string) => {
    const currentJobs = jobsRef.current;
    const targetJob = currentJobs.find(j =>
      (j.delegated_tasks && j.delegated_tasks.some(t => String(t.id).trim() === String(taskId).trim())) ||
      (jobId && isTargetJob(j, jobId)) ||
      (jobId && j.id === jobId)
    );
    if (!targetJob) return;
    const targetJobId = targetJob.id;
    const nowIso = new Date().toISOString();
    let assignedDrafter = '';
    let taskTitle = '';

    updateJobsState(prevJobs =>
      prevJobs.map(j => {
        if (j.id === targetJobId && j.delegated_tasks) {
          let approvedTaskRef: DelegatedWorkItem | null = null;
          const updatedTasks = j.delegated_tasks.map(t => {
            if (String(t.id).trim() === String(taskId).trim()) {
              assignedDrafter = t.assignedTo;
              taskTitle = t.componentTitle;
              approvedTaskRef = {
                ...t,
                status: 'Completed' as const,
                isReviewed: true,
                reviewedBy: currentStaff.name,
                reviewedAt: nowIso,
                reviewNotes: reviewNote || `Approved & signed off by ${currentStaff.name}`,
                revisionRequested: false
              };
              return approvedTaskRef;
            }
            return t;
          });

          if (approvedTaskRef) {
            recordPendingTaskMutation(j.id, approvedTaskRef);
          }

          return {
            ...j,
            delegated_tasks: updatedTasks,
            comments: [
              ...(j.comments || []),
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
              ...(j.audit_logs || [])
            ]
          };
        }
        return j;
      }),
      targetJobId
    );

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
    const currentJobs = jobsRef.current;
    const targetJob = currentJobs.find(j =>
      (j.delegated_tasks && j.delegated_tasks.some(t => String(t.id).trim() === String(taskId).trim())) ||
      (jobId && isTargetJob(j, jobId)) ||
      (jobId && j.id === jobId)
    );
    if (!targetJob) return;
    const targetJobId = targetJob.id;
    const nowIso = new Date().toISOString();
    let assignedDrafter = '';
    let taskTitle = '';
    let currentRevCount = 1;

    updateJobsState(prevJobs =>
      prevJobs.map(j => {
        if (j.id === targetJobId && j.delegated_tasks) {
          let revisedTaskRef: DelegatedWorkItem | null = null;
          const updatedTasks = j.delegated_tasks.map(t => {
            if (String(t.id).trim() === String(taskId).trim()) {
              assignedDrafter = t.assignedTo;
              taskTitle = t.componentTitle;
              currentRevCount = (t.revisionCount || 0) + 1;
              revisedTaskRef = {
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
              return revisedTaskRef;
            }
            return t;
          });

          if (revisedTaskRef) {
            recordPendingTaskMutation(j.id, revisedTaskRef);
          }

          return {
            ...j,
            delegated_tasks: updatedTasks,
            comments: [
              ...(j.comments || []),
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
              ...(j.audit_logs || [])
            ]
          };
        }
        return j;
      }),
      targetJobId
    );

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

  // 11b. Handle Deleting a Delegated Task and All its Attachments (Only Greg, Kyle, or Jason)
  const handleDeleteDelegatedTask = async (jobId: string, taskId: string) => {
    if (!canUserDeleteDelegatedItem(currentStaff)) {
      console.warn('Unauthorized attempt to delete delegated task by:', currentStaff.name);
      return;
    }

    const targetJob = jobs.find(j => 
      (j.delegated_tasks && j.delegated_tasks.some(t => t.id === taskId)) ||
      (jobId && isTargetJob(j, jobId)) ||
      (jobId && j.id === jobId)
    );
    if (!targetJob) return;

    const targetJobId = targetJob.id;
    const taskToDelete = (targetJob.delegated_tasks || []).find(t => t.id === taskId);
    const taskTitle = taskToDelete ? taskToDelete.componentTitle : 'Delegated Component';
    const attachmentCount = taskToDelete?.attachments?.length || 0;
    const deletedAttachmentIds = new Set((taskToDelete?.attachments || []).map(a => a.id));
    const deletedAttachmentNames = new Set((taskToDelete?.attachments || []).map(a => a.name.toLowerCase()));
    const nowIso = new Date().toISOString();

    const updatedJobs = jobs.map(j => {
      if (j.id === targetJobId) {
        const remainingTasks = (j.delegated_tasks || []).filter(t => t.id !== taskId);

        // Remove any deliverables linked to this task or its attachments
        const remainingDeliverables = (j.deliverables || []).filter(del => {
          if (Array.from(deletedAttachmentIds).some(attId => del.id === `deliv-att-${attId}` || del.id === attId)) {
            return false;
          }
          if (del.fileName && deletedAttachmentNames.has(del.fileName.toLowerCase())) {
            return false;
          }
          if (taskTitle && del.changeNotes && del.changeNotes.toLowerCase().includes(`"${taskTitle.toLowerCase()}"`)) {
            return false;
          }
          return true;
        });

        // Clear active timer if running on this delegated task
        const isTimerOnThisTask = Boolean(
          j.active_timer_start && (
            j.active_timer_delegated_task_id === taskId ||
            (taskTitle && j.active_timer_task && j.active_timer_task.toLowerCase().includes(taskTitle.toLowerCase()))
          )
        );

        if (isTimerOnThisTask) {
          pendingJobTimerMutationRef.current[j.id] = {
            atMs: Date.now(),
            active_timer_start: undefined,
            active_timer_task: undefined,
            active_timer_drafter_id: undefined,
            active_timer_drafter_name: undefined,
            active_timer_delegated_task_id: undefined,
            paused_by_break: false,
            paused_timer_task: undefined,
            paused_timer_drafter_id: undefined,
            paused_timer_drafter_name: undefined,
            paused_elapsed_seconds: undefined
          };
          recordJobTimerIntent(j.id, {
            state: 'stopped',
            stoppedAt: nowIso,
            updatedAtMs: Date.now()
          });
        }

        return {
          ...j,
          delegated_tasks: remainingTasks,
          deliverables: remainingDeliverables,
          active_timer_start: isTimerOnThisTask ? undefined : j.active_timer_start,
          active_timer_task: isTimerOnThisTask ? undefined : j.active_timer_task,
          active_timer_drafter_id: isTimerOnThisTask ? undefined : j.active_timer_drafter_id,
          active_timer_drafter_name: isTimerOnThisTask ? undefined : j.active_timer_drafter_name,
          active_timer_delegated_task_id: isTimerOnThisTask ? undefined : j.active_timer_delegated_task_id,
          timer_explicit_stop_at: isTimerOnThisTask ? nowIso : j.timer_explicit_stop_at,
          audit_logs: [
            {
              id: `a-${Date.now()}`,
              action: 'Delegated Task Deleted',
              performedBy: currentStaff.name,
              timestamp: nowIso,
              details: `Permanently deleted delegated component "${taskTitle}" and all ${attachmentCount} associated file attachments.`
            },
            ...j.audit_logs
          ]
        };
      }
      return j;
    });

    const didClearDeletedTaskTimer = Boolean(
      targetJob.active_timer_start && (
        targetJob.active_timer_delegated_task_id === taskId ||
        (taskTitle && targetJob.active_timer_task && targetJob.active_timer_task.toLowerCase().includes(taskTitle.toLowerCase()))
      )
    );
    updateJobsState(updatedJobs, targetJobId, didClearDeletedTaskTimer ? { allowTimerClear: true } : undefined);

    // Call dedicated Firestore deletion helper for instant cloud cleanup
    deleteDelegatedTaskFromFirestore(targetJobId, taskId).catch(err => {
      console.warn('[Firestore] Notice during delegated task deletion:', err);
    });

    // Keep selectedJobForDetail synchronized if currently open
    if (selectedJobForDetail && (selectedJobForDetail.id === targetJobId || isTargetJob(selectedJobForDetail, targetJobId))) {
      const freshJob = updatedJobs.find(j => j.id === targetJobId);
      if (freshJob) {
        setSelectedJobForDetail(freshJob);
      }
    }

    // Clean any lingering notifications related to this task
    updateNotificationsState(prev => prev.filter(n => {
      const isTaskNotif = n.jobId === targetJobId && n.title.toLowerCase().includes(taskTitle.toLowerCase());
      return !isTaskNotif;
    }));
  };

  // 11c. Handle Permanently Deleting a Project Plan / Job (Only Greg, Kyle, or Jason)
  const handleDeleteJob = async (jobId: string) => {
    if (!canUserDeleteDelegatedItem(currentStaff)) {
      console.warn('Unauthorized attempt to delete project by:', currentStaff.name);
      alert('Only Greg Hyatt, Kyle Edmonson, or Jason Barnett are authorized to delete projects.');
      return;
    }

    const targetJob = jobs.find(j => j.id === jobId || isTargetJob(j, jobId));
    if (!targetJob) return;

    const realJobId = targetJob.id;
    const jobNumber = targetJob.job_number;
    const customerName = targetJob.customer_name;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('my_plan_store_os_initialized_v1', 'true');
      }
    } catch {}

    // 1. Close all modals referencing this job immediately
    setSelectedJobForDetail(prev => (prev && (prev.id === realJobId || isTargetJob(prev, realJobId)) ? null : prev));
    setJobToDelegate(prev => (prev && (prev.id === realJobId || isTargetJob(prev, realJobId)) ? null : prev));
    setTimerPromptJob(prev => (prev && (prev.job.id === realJobId || isTargetJob(prev.job, realJobId)) ? null : prev));
    setStopTimerPromptJob(prev => (prev && (prev.job.id === realJobId || isTargetJob(prev.job, realJobId)) ? null : prev));

    // 2. Remove from local state
    const remainingJobs = jobs.filter(j => j.id !== realJobId && !isTargetJob(j, realJobId));
    updateJobsState(remainingJobs);

    // 3. Update customer ID if active
    setSelectedCustomerId(prev => (prev === realJobId ? (remainingJobs[0]?.id || '') : prev));

    // 4. Delete from Firestore permanently
    try {
      await deleteJobFromFirestore(realJobId);
      console.log(`[Firestore] Successfully deleted job #${jobNumber} (${realJobId}) from Firestore`);
    } catch (err) {
      console.error('[Firestore] Error deleting job from Firestore:', err);
    }

    // 5. Dispatch a system notification
    setNotifications(prev => [
      {
        id: `notif-del-${Date.now()}`,
        senderId: currentStaff.id,
        senderName: currentStaff.name,
        title: `🗑️ Project Deleted: #${jobNumber}`,
        message: `${currentStaff.name} permanently deleted project #${jobNumber} (${customerName}) and all associated files.`,
        jobId: realJobId,
        jobNumber: jobNumber,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'general'
      },
      ...prev
    ]);
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
    const matchedJobIds: string[] = [];
    jobs.forEach(job => {
      const isTarget = updatedContact.updateAllPlans
        ? (job.customer_name && job.customer_name.trim().toLowerCase() === targetCustomerName.trim().toLowerCase()) ||
          (updatedContact.currentJobId && job.id === updatedContact.currentJobId)
        : (updatedContact.currentJobId ? job.id === updatedContact.currentJobId : (job.customer_name && job.customer_name.trim().toLowerCase() === targetCustomerName.trim().toLowerCase()));
      if (isTarget) matchedJobIds.push(job.id);
    });

    if (matchedJobIds.length === 0) return;

    updateJobsState(
      prevJobs =>
        prevJobs.map((job) => {
          if (!matchedJobIds.includes(job.id)) return job;

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

          return {
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
        }),
      matchedJobIds
    );
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
  const isAuthRequired = !isDemoModeBypassed && (!authUser || !authEmailVerified);
  if (isAuthRequired) {
    return (
      <AuthScreen
        currentUser={authUser}
        remoteLogoutNotice={remoteLogoutNotice}
        onDismissRemoteLogoutNotice={() => setRemoteLogoutNotice(null)}
        onAuthenticated={async (user) => {
          markAuthSessionActive(user.uid);
          setRemoteLogoutNotice(null);
          setAuthUser(user);
          setAuthEmailVerified(true);
          setIsDemoModeBypassed(false);
          try {
            const matched = await syncAuthToStaffUser(user, staffListRef.current);
            const layoutPref = matched.preferredLayout || getStoredPreferredLayout(matched.id || matched.email);
            const hydrated = { ...matched, preferredLayout: layoutPref };
            sessionLoginAtRef.current = Date.now();
            initialForceLogoutAtRef.current = matched.forceLogoutAt || null;
            setAuthenticatedStaff(hydrated);
            setCurrentStaff(hydrated);
            saveStoredActiveStaffId(hydrated.id);
            setStaffList(prev => {
              const exists = prev.some(
                s => s.id === hydrated.id ||
                  (s.email && hydrated.email && s.email.toLowerCase().trim() === hydrated.email.toLowerCase().trim())
              );
              const next = exists
                ? prev.map(s =>
                    s.id === hydrated.id ||
                    (s.email && hydrated.email && s.email.toLowerCase().trim() === hydrated.email.toLowerCase().trim())
                      ? { ...s, ...hydrated }
                      : s
                  )
                : [...prev, hydrated];
              saveStoredStaff(next);
              return next;
            });
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
        authenticatedStaff={authenticatedStaff}
        setCurrentStaff={handleSelectStaff}
        staffList={staffList}
        timeCards={timeCards}
        devCards={devCards}
        nowTimestamp={nowTimestamp}
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
            alert('Permission Restricted: Only Kyle, Jason Barnett, or Greg Hyatt are authorized to create a new job.');
            return;
          }
          setIsNewJobModalOpen(true);
        }}
        onOpenStaffManagement={() => setIsStaffManagementOpen(true)}
        onResetData={handleResetData}
        onOpenKyleInbox={() => setIsKyleInboxOpen(true)}
        onToggleChat={() => {
          setIsChatOpen(prev => !prev);
        }}
        isChatOpen={isChatOpen}
        unreadChatCount={unreadChatCount}
        authUser={authUser}
        onSignOut={handleSignOut}
      />

      {/* Live Account Inspection Banner when Greg, Kyle, Jason, or Drew switches into another drafter's account */}
      {authenticatedStaff && currentStaff.id !== authenticatedStaff.id && canSwitchStaffAccounts(authenticatedStaff) && (() => {
        const inspectedOnline = isStaffOnlineWithActivity(currentStaff, jobs, timeCards, devCards, nowTimestamp);
        const inspectedShift = timeCards.find(
          tc => isShiftForStaff(tc, currentStaff) && (tc.status === 'clocked_in' || tc.status === 'on_break')
        );
        const inspectedWork = getStaffActiveWork(currentStaff, jobs, devCards, nowTimestamp);
        const ownWork = getStaffActiveWork(authenticatedStaff, jobs, devCards, nowTimestamp);
        const switchableStaff = staffList.filter(s => !isLegacyMockStaffDoc(s));

        return (
          <div className="bg-indigo-950 text-indigo-100 border-b border-indigo-700/80 px-4 sm:px-6 lg:px-8 py-2.5 shadow-sm">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <span className="bg-indigo-500 text-white font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0">
                  Inspecting Account
                </span>
                <span className="font-bold text-white text-sm">{currentStaff.name}</span>

                {inspectedOnline ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Logged In Now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-mono text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Offline{currentStaff.lastSeenAt ? ` • Last seen ${formatRelativeLastSeen(currentStaff.lastSeenAt, nowTimestamp)}` : ''}
                  </span>
                )}

                {inspectedShift ? (
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold border ${
                    inspectedShift.status === 'on_break'
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                      : 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                  }`}>
                    {inspectedShift.status === 'on_break'
                      ? 'On Break'
                      : `Clocked In (${formatTimeOnly(inspectedShift.clockInTime)})`}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-slate-900/70 text-slate-400 border border-slate-700/80">
                    Not Clocked In
                  </span>
                )}

                {inspectedWork.activeItem ? (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border font-medium ${
                    inspectedWork.activeItem.isPaused
                      ? 'bg-amber-950/70 border-amber-600/60 text-amber-200'
                      : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-100'
                  }`}>
                    <span>{inspectedWork.activeItem.isPaused ? '⏸ Paused:' : '▶ Working on:'}</span>
                    <strong className="text-white">{inspectedWork.activeItem.label}</strong>
                    {inspectedWork.activeItem.sublabel && (
                      <span className="text-emerald-200/80 hidden md:inline">({inspectedWork.activeItem.sublabel})</span>
                    )}
                    <span className="font-mono font-bold text-emerald-300 ml-1">
                      {formatSecondsToHHMMSS(inspectedWork.activeItem.elapsedSeconds)}
                    </span>
                  </span>
                ) : (
                  <span className="text-indigo-200/80 font-mono text-[11px]">
                    No active timer • {inspectedWork.assignedJobsCount} active {inspectedWork.assignedJobsCount === 1 ? 'plan' : 'plans'} • {inspectedWork.openTasksCount} open {inspectedWork.openTasksCount === 1 ? 'task' : 'tasks'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {ownWork.activeItem && !ownWork.activeItem.isPaused && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 font-mono text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Your Timer Running:</span>
                    <strong className="text-white font-sans">{ownWork.activeItem.label}</strong>
                    <span className="text-emerald-300 font-bold">
                      {formatSecondsToHHMMSS(ownWork.activeItem.elapsedSeconds)}
                    </span>
                  </span>
                )}

                <select
                  aria-label="Switch inspected drafter account"
                  value={currentStaff.id}
                  onChange={(e) => {
                    const next = switchableStaff.find(s => s.id === e.target.value);
                    if (next) {
                      handleSelectStaff(next);
                      if (next.id !== authenticatedStaff.id) {
                        setUserRole('drafter');
                      }
                    }
                  }}
                  className="bg-slate-900 text-white border border-indigo-500/50 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                >
                  {switchableStaff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.id === authenticatedStaff.id ? ' (My Account)' : isStaffOnlineWithActivity(s, jobs, timeCards, devCards, nowTimestamp) ? ' ● Online' : ' (Offline)'}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleSelectStaff(authenticatedStaff)}
                  className="bg-white hover:bg-indigo-50 text-indigo-950 font-bold px-3 py-1 rounded-lg transition shadow-xs cursor-pointer"
                >
                  Return to {authenticatedStaff.name.split(' ')[0]}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clock-In, Break & Clock-Out Bar (Accessible to all employees, with special manager view for Jason) */}
      {userRole !== 'customer' && (
        <TimeClockBar
          currentStaff={currentStaff}
          authenticatedStaff={authenticatedStaff}
          isInspectingOtherAccount={Boolean(authenticatedStaff && currentStaff.id !== authenticatedStaff.id)}
          staffList={staffList}
          timeCards={timeCards}
          jobs={jobs}
          devCards={devCards}
          onClockIn={handleClockIn}
          onStartBreak={handleStartBreak}
          onResumeFromBreak={handleResumeFromBreak}
          onClockOut={handleClockOut}
          onSignOutCurrentDevice={handleSignOut}
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
          s => (isShiftForStaff(s, currentStaff) || s.staffName.toLowerCase().includes('greg hyatt')) && 
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
            onUpdateDevCards={handleSyncDevCards}
            onUpdateDevEntries={handleSyncDevEntries}
            onStartDevCardTimer={handleStartDevCardTimer}
            onStopDevCardTimer={handleStopDevCardTimer}
            onUpdateDevCardNotes={handleUpdateDevCardNotes}
            onAddDevCard={handleAddDevCard}
            onDismissDevCard={handleDismissDevCard}
            onOpenReviewModal={() => setIsDevReviewModalOpen(true)}
            activeShiftId={activeGregShift?.id}
          />
        );
      })()}

      {/* Main OS View Switcher */}
      <main className="flex-1">
        <ErrorBoundary fallbackTitle="Workspace View Error">
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
              onDeleteDelegatedTask={handleDeleteDelegatedTask}
              onReassignDelegatedTask={handleReassignDelegatedTask}
              onDeleteJob={handleDeleteJob}
              onOpenKyleInbox={() => setIsKyleInboxOpen(true)}
              onSaveDefaultLayout={handleUpdatePreferredLayout}
              onUpdateCustomerContact={handleUpdateCustomerContact}
              nowTimestamp={nowTimestamp}
              devCards={devCards}
              devEntries={devEntries}
              onOpenDevReviewModal={() => setIsDevReviewModalOpen(true)}
              onAddJobNote={handleAddJobNote}
              isInspectingOtherAccount={Boolean(authenticatedStaff && currentStaff.id !== authenticatedStaff.id)}
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
              onUpdateJob={handleDirectJobUpdate}
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
        </ErrorBoundary>
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
          onUpdateJob={handleDirectJobUpdate}
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
          onDeleteDelegatedTask={handleDeleteDelegatedTask}
          onDeleteJob={handleDeleteJob}
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
        onDeleteDelegatedTask={handleDeleteDelegatedTask}
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
        staffList={staffList}
        jobs={jobs}
        onSendMessage={handleSendChatMessage}
        onDeleteMessage={handleDeleteChatMessage}
        onDeleteMultipleMessages={handleDeleteMultipleChatMessages}
        onSelectJob={(job) => setSelectedJobForDetail(job)}
        onMarkAsRead={handleMarkChatRead}
        syncingMessageIds={syncingChatMessageIds}
        failedMessageIds={failedChatMessageIds}
        onRetrySendMessage={handleRetrySendChatMessage}
      />

      {/* MODAL 8: Staff & Permissions Management Modal */}
      <StaffManagementModal
        isOpen={isStaffManagementOpen}
        onClose={() => setIsStaffManagementOpen(false)}
        staffList={staffList}
        currentStaff={currentStaff}
        jobs={jobs}
        timeCards={timeCards}
        devCards={devCards}
        nowTimestamp={nowTimestamp}
        readOnly={!canUserManageStaff(authenticatedStaff || currentStaff)}
        canSwitchAccounts={canSwitchStaffAccounts(authenticatedStaff || currentStaff)}
        onSwitchToStaff={(staff) => {
          handleSelectStaff(staff);
          if (authenticatedStaff && staff.id !== authenticatedStaff.id) {
            setUserRole('drafter');
          }
        }}
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
        onUpdateTimeCards={handleSyncTimeCards}
      />

      {/* MODAL 10: Greg Hyatt Dev Project Time Entries Review & CSV Export Modal */}
      <GregDevTimeReviewModal
        isOpen={isDevReviewModalOpen}
        onClose={() => setIsDevReviewModalOpen(false)}
        currentStaff={currentStaff}
        devEntries={devEntries}
        onUpdateDevEntries={handleSyncDevEntries}
      />

    </div>
  );
}
