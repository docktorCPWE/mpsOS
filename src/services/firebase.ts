import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit,
  updateDoc,
  arrayUnion,
  deleteField
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Job, StaffUser, ChatMessage, GregDevTimeEntry, GregDevProjectCard, PayrollEntry, TimeCardShift } from '../types';
import { isTestJob, isTestDelegatedTask, isTestDeliverable, isTestComment, STAFF_USERS, isStaffDeleted, removeDeletedStaffId, sanitizeAndReconcileTimeCards } from '../data/mockData';

// Root owner accounts with master system privileges
export const ROOT_OWNER_EMAILS = ['arkcwd@gmail.com', 'greg.hyatt@myplanstore.com'];

// Session-scoped login marker so closing the browser/tab always ends the login session
// and legacy browserLocalPersistence sessions from earlier visits are cleanly signed out.
export const AUTH_SESSION_STORAGE_KEY = 'mps_auth_session_active_v1';
export const DEVICE_SESSION_ID_STORAGE_KEY = 'mps_device_session_id_v1';

// In-memory session flag guards against both async onAuthStateChanged timing races
// and environments where sessionStorage may be restricted.
let inMemoryAuthSessionActive = false;
let inMemoryDeviceSessionId: string | null = null;

export function getDeviceSessionId(): string {
  if (inMemoryDeviceSessionId) return inMemoryDeviceSessionId;
  try {
    const existing = sessionStorage.getItem(DEVICE_SESSION_ID_STORAGE_KEY);
    if (existing) {
      inMemoryDeviceSessionId = existing;
      return existing;
    }
    const fresh = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(DEVICE_SESSION_ID_STORAGE_KEY, fresh);
    inMemoryDeviceSessionId = fresh;
    return fresh;
  } catch {
    const fallback = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    inMemoryDeviceSessionId = fallback;
    return fallback;
  }
}

export function resetDeviceSessionId(): string {
  const fresh = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  inMemoryDeviceSessionId = fresh;
  try {
    sessionStorage.setItem(DEVICE_SESSION_ID_STORAGE_KEY, fresh);
  } catch {
    // ignore
  }
  return fresh;
}

export function markAuthSessionActive(uid?: string): void {
  inMemoryAuthSessionActive = true;
  getDeviceSessionId();
  try {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, uid || 'active');
  } catch {
    // ignore
  }
}

export function hasActiveAuthSession(): boolean {
  if (inMemoryAuthSessionActive) return true;
  try {
    return Boolean(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function clearAuthSessionMarker(): void {
  inMemoryAuthSessionActive = false;
  try {
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem('my_plan_store_os_active_staff_id_v1');
  } catch {
    // ignore
  }
}

// Initialize Firebase App & Firestore with strict databaseId
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Default Firebase Auth to browserSessionPersistence (clears when tab/browser closes)
setPersistence(auth, browserSessionPersistence).catch((err) => {
  console.warn('[Auth] Session persistence setup notice:', err);
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Successfully verified connection to cloud database.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('[Firestore] Client is offline or database is unreachable. Check Firebase configuration.');
      return false;
    }
    // Any other error (e.g. doc doesn't exist) still proves the database endpoint responded
    console.log('[Firestore] Database endpoint is reachable.');
    return true;
  }
}

// ----------------------------------------------------
// JOBS SYNCHRONIZATION
// ----------------------------------------------------

export function subscribeToJobs(
  onUpdate: (jobs: Job[]) => void,
  onSeedNeeded: () => void
): () => void {
  const path = 'jobs';
  try {
    const unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (snapshot.empty) {
          // Always notify subscribers that jobs is empty so UI clears deleted cards
          onUpdate([]);
          const isInitialized = typeof window !== 'undefined' && localStorage.getItem('my_plan_store_os_initialized_v1') === 'true';
          if (!isInitialized && onSeedNeeded) {
            console.log('[Firestore] Jobs collection is empty on first boot. Triggering initial seed...');
            onSeedNeeded();
          } else {
            console.log('[Firestore] Jobs collection is currently empty (cards purged/deleted by user).');
          }
        } else {
          const loaded: Job[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Job;
            const jobItem = { ...data, id: docSnap.id };
            if (!isTestJob(jobItem)) {
              if (jobItem.delegated_tasks && jobItem.delegated_tasks.length > 0) {
                jobItem.delegated_tasks = jobItem.delegated_tasks.filter(t => !isTestDelegatedTask(t));
              }
              if (jobItem.deliverables && jobItem.deliverables.length > 0) {
                jobItem.deliverables = jobItem.deliverables.filter(d => !isTestDeliverable(d));
              }
              if (jobItem.comments && jobItem.comments.length > 0) {
                jobItem.comments = jobItem.comments.filter(c => !isTestComment(c));
              }
              loaded.push(jobItem);
            }
          });
          onUpdate(loaded);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return unsub;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export async function saveJobToFirestore(job: Job): Promise<void> {
  const path = `jobs/${job.id}`;
  try {
    const cleanJob: Record<string, any> = JSON.parse(JSON.stringify(job));
    
    // Explicitly delete timer fields from Firestore if timer is not currently running
    if (!job.active_timer_start) {
      cleanJob.active_timer_start = deleteField();
      cleanJob.active_timer_task = deleteField();
      cleanJob.active_timer_drafter_id = deleteField();
      cleanJob.active_timer_drafter_name = deleteField();
      cleanJob.active_timer_delegated_task_id = deleteField();
    }
    
    // Explicitly delete paused timer fields if job is not paused by break
    if (!job.paused_by_break) {
      cleanJob.paused_by_break = false;
      cleanJob.paused_timer_task = deleteField();
      cleanJob.paused_timer_drafter_id = deleteField();
      cleanJob.paused_timer_drafter_name = deleteField();
      cleanJob.paused_elapsed_seconds = deleteField();
    }

    // Log document size warnings if approaching Firestore 1MB document limit
    const jsonStr = JSON.stringify(cleanJob);
    if (jsonStr.length > 800000) {
      console.warn(`[Firestore] Document for job ${job.job_number} is large (${jsonStr.length} bytes). Use file deletion if needed.`);
    }

    await setDoc(doc(db, 'jobs', job.id), cleanJob, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteJobFromFirestore(jobId: string): Promise<void> {
  const path = `jobs/${jobId}`;
  try {
    await deleteDoc(doc(db, 'jobs', jobId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Permanently deletes an attachment or deliverable from a job in Firestore to reduce document size.
 */
export async function deleteFileFromJobInFirestore(
  jobId: string,
  options: {
    type: 'task_attachment' | 'deliverable';
    taskId?: string;
    fileId: string;
  }
): Promise<void> {
  const path = `jobs/${jobId}`;
  try {
    const jobDocRef = doc(db, 'jobs', jobId);
    const snap = await getDoc(jobDocRef);
    if (!snap.exists()) return;

    const currentJob = snap.data() as Job;

    if (options.type === 'task_attachment' && options.taskId) {
      const updatedTasks = (currentJob.delegated_tasks || []).map(task => {
        if (task.id === options.taskId) {
          return {
            ...task,
            attachments: (task.attachments || []).filter(att => att.id !== options.fileId)
          };
        }
        return task;
      });

      await updateDoc(jobDocRef, {
        delegated_tasks: updatedTasks
      });
      console.log(`[Firestore] Deleted attachment ${options.fileId} from task ${options.taskId} in job ${jobId}. Document size reduced.`);
    } else if (options.type === 'deliverable') {
      const updatedDeliverables = (currentJob.deliverables || []).filter(del => del.id !== options.fileId);
      await updateDoc(jobDocRef, {
        deliverables: updatedDeliverables
      });
      console.log(`[Firestore] Deleted deliverable ${options.fileId} from job ${jobId}. Document size reduced.`);
    }
  } catch (err) {
    console.error('[Firestore] Failed to delete file from Firestore:', err);
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Permanently deletes a delegated work item and all of its attached files/deliverables
 * from a job document in Firestore to minimize document payload size.
 */
export async function deleteDelegatedTaskFromFirestore(
  jobId: string,
  taskId: string
): Promise<void> {
  const path = `jobs/${jobId}`;
  try {
    const jobDocRef = doc(db, 'jobs', jobId);
    const snap = await getDoc(jobDocRef);
    if (!snap.exists()) return;

    const currentJob = snap.data() as Job;
    const taskToDelete = (currentJob.delegated_tasks || []).find(t => t.id === taskId);
    if (!taskToDelete) return;

    const taskTitle = taskToDelete.componentTitle;
    const deletedAttachmentIds = new Set((taskToDelete.attachments || []).map(a => a.id));
    const deletedAttachmentNames = new Set((taskToDelete.attachments || []).map(a => a.name.toLowerCase()));

    const updatedTasks = (currentJob.delegated_tasks || []).filter(t => t.id !== taskId);

    const updatedDeliverables = (currentJob.deliverables || []).filter(del => {
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

    const isTimerOnThisTask = Boolean(
      currentJob.active_timer_start && (
        currentJob.active_timer_delegated_task_id === taskId ||
        (taskTitle && currentJob.active_timer_task && currentJob.active_timer_task.toLowerCase().includes(taskTitle.toLowerCase()))
      )
    );

    const updates: Record<string, any> = {
      delegated_tasks: updatedTasks,
      deliverables: updatedDeliverables
    };

    if (isTimerOnThisTask) {
      updates.active_timer_start = deleteField();
      updates.active_timer_task = deleteField();
      updates.active_timer_drafter_id = deleteField();
      updates.active_timer_drafter_name = deleteField();
      updates.active_timer_delegated_task_id = deleteField();
    }

    await updateDoc(jobDocRef, updates);
    console.log(`[Firestore] Deleted delegated task ${taskId} ("${taskTitle}") and all attachments from job ${jobId}. Document size reduced.`);
  } catch (err) {
    console.error('[Firestore] Failed to delete delegated task from Firestore:', err);
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function seedInitialJobsToFirestore(initialJobs: Job[]): Promise<void> {
  const path = 'jobs';
  try {
    const batch = writeBatch(db);
    for (const job of initialJobs) {
      const cleanJob = JSON.parse(JSON.stringify(job));
      batch.set(doc(db, 'jobs', job.id), cleanJob);
    }
    await batch.commit();
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('my_plan_store_os_initialized_v1', 'true');
      }
    } catch {}
    console.log(`[Firestore] Successfully seeded ${initialJobs.length} projects to cloud database.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// ----------------------------------------------------
// STAFF SYNCHRONIZATION
// ----------------------------------------------------

export function subscribeToStaff(
  onUpdate: (staff: StaffUser[]) => void,
  onSeedNeeded: () => void
): () => void {
  const path = 'staff';
  try {
    const unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (snapshot.empty) {
          onSeedNeeded();
        } else {
          const staff: StaffUser[] = [];
          snapshot.forEach((docSnap) => {
            staff.push({ ...(docSnap.data() as StaffUser), id: docSnap.id });
          });
          onUpdate(staff);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return unsub;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export async function saveStaffToFirestore(staffUser: StaffUser): Promise<void> {
  const path = `staff/${staffUser.id}`;
  try {
    await setDoc(doc(db, 'staff', staffUser.id), staffUser, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function seedStaffToFirestore(staffList: StaffUser[]): Promise<void> {
  const path = 'staff';
  try {
    const batch = writeBatch(db);
    for (const staff of staffList) {
      batch.set(doc(db, 'staff', staff.id), staff);
    }
    await batch.commit();
    console.log(`[Firestore] Successfully seeded ${staffList.length} staff users to cloud database.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteStaffFromFirestore(staffId: string): Promise<void> {
  const path = `staff/${staffId}`;
  try {
    await deleteDoc(doc(db, 'staff', staffId));
    console.log(`[Firestore] Deleted staff doc: ${staffId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateStaffPresenceInFirestore(
  staffId: string,
  isOnline: boolean,
  options?: { markLogin?: boolean }
): Promise<void> {
  if (!db || !staffId) return;
  try {
    const nowIso = new Date().toISOString();
    const payload: Record<string, any> = {
      isOnline,
      lastSeenAt: nowIso
    };
    if (options?.markLogin) {
      payload.lastLoginAt = nowIso;
    }
    await setDoc(doc(db, 'staff', staffId), payload, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Presence update notice:', err);
  }
}

export async function purgeRemovedMockStaff(): Promise<void> {
  // Purge ONLY deprecated mock placeholder staff documents (staff-aaron, staff-james, staff-james-barnett)
  // that have never authenticated. NEVER delete real accounts by email!
  try {
    const legacyIds = ['staff-aaron', 'staff-james', 'staff-james-barnett'];
    for (const legacyId of legacyIds) {
      const snap = await getDoc(doc(db, 'staff', legacyId)).catch(() => null);
      if (snap && snap.exists() && !snap.data()?.lastLoginAt) {
        await deleteDoc(doc(db, 'staff', legacyId)).catch(() => {});
        console.log(`[Firestore] Purged obsolete mock staff doc: ${legacyId}`);
      }
    }
  } catch (err) {
    console.warn('[Firestore] Notice during mock staff purge:', err);
  }
}

// ----------------------------------------------------
// DISCUSSIONS / CHAT SYNCHRONIZATION
// ----------------------------------------------------

export function subscribeToChat(
  onUpdate: (messages: ChatMessage[]) => void
): () => void {
  const path = 'discussions';
  try {
    const unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          const rawTs = data.timestamp;
          const normalizedTs =
            rawTs && typeof rawTs === 'object' && typeof rawTs.toDate === 'function'
              ? rawTs.toDate().toISOString()
              : typeof rawTs === 'string' && rawTs
              ? rawTs
              : new Date(0).toISOString();

          msgs.push({
            ...(data as ChatMessage),
            id: docSnap.id,
            senderId: typeof data.senderId === 'string' ? data.senderId : '',
            senderName: typeof data.senderName === 'string' && data.senderName.trim() ? data.senderName : 'Team Member',
            text: typeof data.text === 'string' ? data.text : '',
            timestamp: normalizedTs,
            mentions: Array.isArray(data.mentions) ? data.mentions : undefined,
            referencedJobNumbers: Array.isArray(data.referencedJobNumbers) ? data.referencedJobNumbers : undefined,
            readByStaffIds: Array.isArray(data.readByStaffIds) ? data.readByStaffIds : []
          });
        });
        msgs.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
        onUpdate(msgs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
    return unsub;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export async function saveChatMessageToFirestore(message: ChatMessage): Promise<void> {
  const path = `discussions/${message.id}`;
  try {
    // Strip all undefined fields so Firestore setDoc never rejects optional fields (mentions, replyToId, etc.)
    const sanitized = JSON.parse(
      JSON.stringify({
        ...message,
        readByStaffIds: Array.isArray(message.readByStaffIds) ? message.readByStaffIds : []
      })
    );
    await setDoc(doc(db, 'discussions', message.id), sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteChatMessageFromFirestore(messageId: string): Promise<void> {
  const path = `discussions/${messageId}`;
  try {
    await deleteDoc(doc(db, 'discussions', messageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function deleteMultipleChatMessagesFromFirestore(messageIds: string[]): Promise<void> {
  if (!messageIds || messageIds.length === 0) return;
  const path = 'discussions';
  try {
    const batch = writeBatch(db);
    for (const id of messageIds) {
      batch.delete(doc(db, 'discussions', id));
    }
    await batch.commit();
    console.log(`[Firestore] Batch deleted ${messageIds.length} messages from discussions.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function markChatMessagesAsReadInFirestore(messageIds: string[], staffId: string): Promise<void> {
  if (!messageIds || messageIds.length === 0 || !staffId) return;
  try {
    const batch = writeBatch(db);
    for (const id of messageIds) {
      batch.update(doc(db, 'discussions', id), {
        readByStaffIds: arrayUnion(staffId)
      });
    }
    await batch.commit();
  } catch (err) {
    console.warn('[Firestore] Notice while syncing message read states:', err);
  }
}

/**
 * Clean up testing cards, test jobs, and test data from Firestore
 * (such as M26-1000 Smiley McSmileypants, M26-8800, M26-300 Chelsey O'Thompson test cards,
 * M26-195 Testing Dummy, test delegated tasks, test attachments, and test dev entries)
 * while leaving real drafters and users strictly intact.
 */
export async function purgeDummyDataFromFirestore(): Promise<void> {
  if (!db) return;
  try {
    // 1. Delete explicit known testing job IDs if present
    const explicitTestIds = ['job-1', 'job-m26-1000', 'job-m26-8800', 'job-m26-300', 'job-m26-195'];
    for (const testId of explicitTestIds) {
      try {
        await deleteDoc(doc(db, 'jobs', testId)).catch(() => {});
      } catch {
        // Ignored
      }
    }

    // 2. Preserve and verify real staff users (core + all real authenticated accounts)
    try {
      // Purge ONLY obsolete legacy placeholder docs (staff-aaron, staff-james, staff-james-barnett)
      // that have never authenticated. NEVER delete real accounts by email!
      const legacyIds = ['staff-aaron', 'staff-james', 'staff-james-barnett'];
      for (const legacyId of legacyIds) {
        const snap = await getDoc(doc(db, 'staff', legacyId)).catch(() => null);
        if (snap && snap.exists() && !snap.data()?.lastLoginAt) {
          await deleteDoc(doc(db, 'staff', legacyId)).catch(() => {});
          console.log(`[Firestore] Purged obsolete mock staff doc: ${legacyId}`);
        }
      }

      // Ensure valid active core staff exist in Firestore if needed
      for (const core of STAFF_USERS) {
        if (isStaffDeleted(core)) continue;
        const staffRef = doc(db, 'staff', core.id);
        const snap = await getDoc(staffRef).catch(() => null);
        if (!snap || !snap.exists()) {
          await setDoc(staffRef, core, { merge: true }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Firestore] Notice during staff verification:', err);
    }

    // 3. Scan jobs collection: delete all test jobs and remove test cards/deliverables from real jobs
    try {
      const jobsSnap = await getDocs(collection(db, 'jobs'));
      for (const d of jobsSnap.docs) {
        const j = d.data() as Job;
        if (isTestJob(j) || explicitTestIds.includes(d.id)) {
          await deleteDoc(doc(db, 'jobs', d.id));
          console.log(`[Firestore] Purged testing job doc: ${d.id} (${j.job_number || ''})`);
          continue;
        }

        let needsUpdate = false;
        const updates: Record<string, any> = {};

        // Clean out any testing delegated cards
        if (Array.isArray(j.delegated_tasks) && j.delegated_tasks.length > 0) {
          const originalLen = j.delegated_tasks.length;
          const cleanTasks = j.delegated_tasks.filter(dt => !isTestDelegatedTask(dt));
          if (cleanTasks.length !== originalLen) {
            updates.delegated_tasks = cleanTasks;
            needsUpdate = true;
            console.log(`[Firestore] Removed ${originalLen - cleanTasks.length} test cards from job: ${d.id}`);
          }
        }

        // Clean out testing deliverables/attachments
        if (Array.isArray(j.deliverables) && j.deliverables.length > 0) {
          const originalLen = j.deliverables.length;
          const cleanDeliverables = j.deliverables.filter(del => !isTestDeliverable(del));
          if (cleanDeliverables.length !== originalLen) {
            updates.deliverables = cleanDeliverables;
            needsUpdate = true;
            console.log(`[Firestore] Removed ${originalLen - cleanDeliverables.length} test deliverables from job: ${d.id}`);
          }
        }

        // Clean out testing comments
        if (Array.isArray(j.comments) && j.comments.length > 0) {
          const originalLen = j.comments.length;
          const cleanComments = j.comments.filter(c => !isTestComment(c));
          if (cleanComments.length !== originalLen) {
            updates.comments = cleanComments;
            needsUpdate = true;
          }
        }

        // Never stop active timers on real jobs during startup cleanup (test jobs are already deleted above)

        if (needsUpdate) {
          await updateDoc(doc(db, 'jobs', d.id), updates);
          console.log(`[Firestore] Cleaned and saved job doc: ${d.id}`);
        }
      }
    } catch (e) {
      console.warn('[Firestore] Notice during jobs purge:', e);
    }

    // 4. Scan dev_project_cards & clean ONLY explicit test notes (NEVER stop active running timers!)
    try {
      const devCardsSnap = await getDocs(collection(db, 'dev_project_cards'));
      for (const d of devCardsSnap.docs) {
        const card = d.data();
        const notes = (card.current_notes || card.currentNotes || '').toLowerCase();
        if (notes.includes('dsp testing')) {
          await updateDoc(doc(db, 'dev_project_cards', d.id), {
            current_notes: 'Stem separation & frequency DSP processing'
          });
        }
      }
    } catch (e) {
      console.warn('[Firestore] Notice during dev_project_cards cleanup:', e);
    }

    // 5. Scan dev_time_entries & delete any testing dev entries
    try {
      const devEntriesSnap = await getDocs(collection(db, 'dev_time_entries'));
      for (const d of devEntriesSnap.docs) {
        const entry = d.data();
        const text = (entry.notes || '').toLowerCase();
        if (
          text.includes('dsp testing') ||
          text.includes('test card') ||
          text.includes('dummy') ||
          text.includes('m26-1000') ||
          text.includes('m26-300') ||
          text.includes('m26-8800')
        ) {
          await deleteDoc(doc(db, 'dev_time_entries', d.id));
          console.log(`[Firestore] Purged test dev time entry: ${d.id}`);
        }
      }
    } catch (e) {
      console.warn('[Firestore] Notice during dev_time_entries cleanup:', e);
    }

    // 6. Scan discussions to purge testing messages
    try {
      const chatSnap = await getDocs(collection(db, 'discussions'));
      const batch = writeBatch(db);
      let purgeCount = 0;
      chatSnap.forEach((d) => {
        const m = d.data() as ChatMessage;
        const text = (m.text || '').toLowerCase();
        const hasTestJob = (m.referencedJobNumbers || []).some(j => {
          const clean = String(j || '').replace(/^#/, '').trim().toUpperCase();
          return ['M26-195', '195', 'M26-1000', '1000', 'M26-8800', '8800', 'M26-300', '300'].includes(clean);
        });
        const isTestMessage = 
          hasTestJob ||
          /\bm26-195\b/i.test(text) || 
          /\bm26-1000\b/i.test(text) || 
          /\bm26-8800\b/i.test(text) || 
          /\bm26-300\b/i.test(text) || 
          text.includes('smiley') ||
          text.includes('chelsey') ||
          text.includes('testing dummy') ||
          text.includes('draw prelim based on customer plan') ||
          text.includes('make changes per customer notes') ||
          text.includes('create prelim based on sketch') ||
          d.id.startsWith('msg-ethan-') || 
          d.id.startsWith('msg-jm-') || 
          d.id.startsWith('msg-dr-') || 
          ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5', 'msg-greg-resp'].includes(d.id);

        if (isTestMessage) {
          batch.delete(doc(db, 'discussions', d.id));
          purgeCount++;
        }
      });
      if (purgeCount > 0) {
        await batch.commit();
        console.log(`[Firestore] Purged ${purgeCount} test chat messages from discussions.`);
      }
    } catch (e) {
      console.warn('[Firestore] Notice during chat purge:', e);
    }
  } catch (err) {
    console.warn('[Firestore] General notice during dummy data cleanup:', err);
  }
}

// ----------------------------------------------------
// AUTHENTICATION & EMAIL VERIFICATION
// ----------------------------------------------------

export function subscribeToAuth(
  onUserChanged: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    onUserChanged(user);
  });
}

const PENDING_SIGNUP_NAME_PREFIX = 'mps_pending_signup_name_';

export function savePendingSignupName(email: string, fullName: string): void {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  if (!cleanEmail || !cleanName) return;
  try {
    sessionStorage.setItem(`${PENDING_SIGNUP_NAME_PREFIX}${cleanEmail}`, cleanName);
  } catch {
    // ignore
  }
}

export function getPendingSignupName(email: string): string | null {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    return sessionStorage.getItem(`${PENDING_SIGNUP_NAME_PREFIX}${cleanEmail}`);
  } catch {
    return null;
  }
}

export function clearPendingSignupName(email: string): void {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    sessionStorage.removeItem(`${PENDING_SIGNUP_NAME_PREFIX}${cleanEmail}`);
  } catch {
    // ignore
  }
}

export interface RegisterEmailResult {
  user: User;
  reactivated: boolean;
  needsVerification: boolean;
}

export async function registerWithEmail(
  email: string,
  pass: string,
  fullName: string
): Promise<RegisterEmailResult> {
  const cleanEmail = email.trim();
  const cleanName = fullName.trim();
  // Mark active BEFORE calling Firebase Auth so onAuthStateChanged never treats this fresh sign-up as stale
  markAuthSessionActive('pending');
  try {
    await setPersistence(auth, browserSessionPersistence);
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const user = userCredential.user;
    markAuthSessionActive(user.uid);
    removeDeletedStaffId({ id: `staff-${user.uid.slice(0, 8)}`, email: cleanEmail });

    // Set profile display name
    if (cleanName) {
      await updateProfile(user, { displayName: cleanName });
    }

    // Send email verification link
    await sendEmailVerification(user);
    console.log('[Auth] Verification email sent to:', user.email);

    return { user, reactivated: false, needsVerification: true };
  } catch (err: any) {
    // If the email already exists in Firebase Auth (e.g. from staging after their staff profile was deleted),
    // automatically reactivate their account if the password matches, or guide them to a 1-click password reset!
    if (err?.code === 'auth/email-already-in-use') {
      if (cleanName) {
        savePendingSignupName(cleanEmail, cleanName);
      }
      try {
        await setPersistence(auth, browserSessionPersistence);
        const existingCred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        const existingUser = existingCred.user;
        markAuthSessionActive(existingUser.uid);
        removeDeletedStaffId({ id: `staff-${existingUser.uid.slice(0, 8)}`, email: cleanEmail });

        if (cleanName && existingUser.displayName !== cleanName) {
          await updateProfile(existingUser, { displayName: cleanName }).catch(() => {});
        }

        if (!existingUser.emailVerified) {
          try {
            await sendEmailVerification(existingUser);
            console.log('[Auth] Sent fresh verification email for reactivated account:', existingUser.email);
          } catch (verifyErr) {
            console.warn('[Auth] Verification email notice for reactivated account:', verifyErr);
          }
          return { user: existingUser, reactivated: true, needsVerification: true };
        }

        return { user: existingUser, reactivated: true, needsVerification: false };
      } catch (signInErr: any) {
        clearAuthSessionMarker();
        const recoveryErr: any = new Error(
          'This email already has a saved login from an earlier or staging session. Reset your password to choose a new password and automatically re-create your staff profile.'
        );
        recoveryErr.code = 'auth/existing-account-needs-reset';
        recoveryErr.originalCode = signInErr?.code || 'auth/email-already-in-use';
        throw recoveryErr;
      }
    }

    clearAuthSessionMarker();
    throw err;
  }
}

export async function loginWithEmail(
  email: string,
  pass: string
): Promise<User> {
  // Mark active BEFORE calling Firebase Auth because onAuthStateChanged fires before the promise resolves
  markAuthSessionActive('pending');
  try {
    await setPersistence(auth, browserSessionPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
    markAuthSessionActive(userCredential.user.uid);
    return userCredential.user;
  } catch (err) {
    clearAuthSessionMarker();
    throw err;
  }
}

export async function logoutUser(
  staffId?: string,
  options?: { skipPresenceUpdate?: boolean }
): Promise<void> {
  if (staffId && !options?.skipPresenceUpdate) {
    await updateStaffPresenceInFirestore(staffId, false).catch(() => {});
  }
  clearAuthSessionMarker();
  await signOut(auth);
}

/**
 * Broadcasts a remote sign-out signal to all other active sessions/devices for this staff member
 * (for example when clocking out from mobile after forgetting to clock out on desktop).
 */
export async function triggerRemoteLogoutInFirestore(
  staffId: string,
  originSessionId: string,
  reason: string = 'clock_out'
): Promise<string> {
  const nowIso = new Date().toISOString();
  if (!db || !staffId) return nowIso;
  try {
    await setDoc(
      doc(db, 'staff', staffId),
      {
        forceLogoutAt: nowIso,
        forceLogoutOriginSessionId: originSessionId,
        forceLogoutReason: reason
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] Remote logout broadcast notice:', err);
  }
  return nowIso;
}

export async function resendVerificationEmail(): Promise<void> {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
    console.log('[Auth] Resent verification email to:', auth.currentUser.email);
  } else {
    throw new Error('No user is currently signed in.');
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function checkEmailVerified(): Promise<boolean> {
  if (!auth.currentUser) return false;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    markAuthSessionActive(auth.currentUser.uid);
  }
  return auth.currentUser.emailVerified;
}

// Maps authenticated Firebase user to a StaffUser record in the OS and updates live presence
export async function syncAuthToStaffUser(
  user: User,
  existingStaffList: StaffUser[]
): Promise<StaffUser> {
  const userEmail = (user.email || '').toLowerCase().trim();
  const pendingName = getPendingSignupName(userEmail);
  const resolvedDisplayName = (pendingName || user.displayName || '').trim();
  const userName = resolvedDisplayName.toLowerCase();
  const isOwnerEmail = ROOT_OWNER_EMAILS.map(e => e.toLowerCase()).includes(userEmail);
  const isKyle = userEmail.includes('kyle') || userName.includes('kyle');
  const isJason = userEmail.includes('jason') || userName.includes('jason');
  const isDrew = userEmail.includes('drew') || userName.includes('drew');
  const isEthan = userEmail === 'ethanp.dwg@gmail.com' || userEmail.includes('ethan') || userName.includes('ethan');
  const nowIso = new Date().toISOString();

  // If the user provided a fresh name during reactivation/sign-up, sync it to Firebase Auth profile too
  if (pendingName && user.displayName !== pendingName) {
    await updateProfile(user, { displayName: pendingName }).catch(() => {});
  }

  let matched: StaffUser | undefined;
  let checkedFirestore = false;

  // 1. Check Firestore directly first so deleted staff profiles are accurately detected and re-created fresh
  if (db) {
    try {
      const directDocRef = doc(db, 'staff', `staff-${user.uid.slice(0, 8)}`);
      const directSnap = await getDoc(directDocRef);
      if (directSnap.exists()) {
        matched = { ...(directSnap.data() as StaffUser), id: directSnap.id };
      } else {
        const staffSnap = await getDocs(collection(db, 'staff'));
        staffSnap.forEach((d) => {
          const s = { ...(d.data() as StaffUser), id: d.id };
          if (s.email && s.email.toLowerCase().trim() === userEmail) {
            matched = s;
          } else if (!matched && isOwnerEmail && (s.name.toLowerCase().includes('greg hyatt') || (s.role === 'admin' && s.canManageStaff === true))) {
            matched = s;
          } else if (!matched && isKyle && (s.name.toLowerCase().includes('kyle') || s.id === 'staff-kyle')) {
            matched = s;
          } else if (!matched && isJason && (s.name.toLowerCase().includes('jason') || s.id === 'staff-jason')) {
            matched = s;
          } else if (!matched && isDrew && (s.name.toLowerCase().includes('drew') || s.id === 'staff-drew')) {
            matched = s;
          } else if (!matched && isEthan && (s.name.toLowerCase().includes('ethan') || s.id === 'staff-ethan')) {
            matched = s;
          }
        });
      }
      checkedFirestore = true;
    } catch (err) {
      console.warn('[Firestore] Error looking up staff for auth user:', err);
    }
  }

  // 2. Fall back to in-memory staff list only if Firestore lookup was unavailable
  if (!matched && !checkedFirestore) {
    matched = existingStaffList.find(s => (s.email || '').toLowerCase().trim() === userEmail);

    if (!matched && isOwnerEmail) {
      matched = existingStaffList.find(s => s.name.toLowerCase().includes('greg hyatt')) ||
                existingStaffList.find(s => s.role === 'admin' && s.canManageStaff === true);
    }
    if (!matched && isKyle) {
      matched = existingStaffList.find(s => s.name.toLowerCase().includes('kyle') || s.id === 'staff-kyle');
    }
    if (!matched && isJason) {
      matched = existingStaffList.find(s => s.name.toLowerCase().includes('jason') || s.id === 'staff-jason');
    }
    if (!matched && isDrew) {
      matched = existingStaffList.find(s => s.name.toLowerCase().includes('drew') || s.id === 'staff-drew');
    }
    if (!matched && isEthan) {
      matched = existingStaffList.find(s => s.name.toLowerCase().includes('ethan') || s.id === 'staff-ethan');
    }
  }

  if (matched) {
    // Ensure a real signed-in account is never locally marked deleted
    removeDeletedStaffId({ id: matched.id, email: userEmail });
    clearPendingSignupName(userEmail);

    // If user is owner, ensure superadmin privileges
    if (isOwnerEmail) {
      const updated: StaffUser = {
        ...matched,
        email: userEmail,
        role: 'admin',
        title: matched.title || 'Owner & Principal Architect',
        status: 'active',
        canAccessFinancials: true,
        canDelegate: true,
        canViewAllProjects: true,
        canManageStaff: true,
        canManageInvoices: true,
        canEditJobPhases: true,
        canManageRoadblocks: true,
        canAccessPayroll: true,
        isOnline: true,
        lastSeenAt: nowIso,
        lastLoginAt: nowIso
      };
      await saveStaffToFirestore(updated);
      return updated;
    }
    // If user is Kyle, ensure Lead PM capabilities are preserved and never downgraded
    if (isKyle) {
      const updatedKyle: StaffUser = {
        ...matched,
        email: matched.email || userEmail,
        name: matched.name || resolvedDisplayName || 'Kyle Edmonson',
        title: matched.title || 'Lead Project Manager & Senior Drafter',
        role: matched.role || 'drafter_lead',
        status: 'active',
        canAccessFinancials: matched.canAccessFinancials !== undefined ? matched.canAccessFinancials : true,
        canDelegate: matched.canDelegate !== undefined ? matched.canDelegate : true,
        canViewAllProjects: matched.canViewAllProjects !== undefined ? matched.canViewAllProjects : true,
        canManageStaff: matched.canManageStaff !== undefined ? matched.canManageStaff : true,
        canManageInvoices: matched.canManageInvoices !== undefined ? matched.canManageInvoices : true,
        canEditJobPhases: matched.canEditJobPhases !== undefined ? matched.canEditJobPhases : true,
        canManageRoadblocks: matched.canManageRoadblocks !== undefined ? matched.canManageRoadblocks : true,
        isOnline: true,
        lastSeenAt: nowIso,
        lastLoginAt: nowIso
      };
      await saveStaffToFirestore(updatedKyle);
      return updatedKyle;
    }
    // For Ethan, Drew, Jason, and all other staff: preserve capabilities & update live presence
    const updatedMatched: StaffUser = {
      ...matched,
      name: pendingName || matched.name || resolvedDisplayName || user.email?.split('@')[0] || 'Staff Member',
      email: matched.email || userEmail,
      canViewAllProjects: (isJason || isDrew || isEthan) ? true : matched.canViewAllProjects,
      isOnline: true,
      lastSeenAt: nowIso,
      lastLoginAt: nowIso
    };
    await saveStaffToFirestore(updatedMatched);
    return updatedMatched;
  }

  // Create fresh active staff profile for verified user (covers both brand-new signups & previously deleted accounts re-registering)
  const newStaff: StaffUser = {
    id: isKyle ? 'staff-kyle' : isJason ? 'staff-jason' : isDrew ? 'staff-drew' : isEthan ? 'staff-ethan' : `staff-${user.uid.slice(0, 8)}`,
    name: resolvedDisplayName || (isKyle ? 'Kyle Edmonson' : isJason ? 'Jason Barnett' : isDrew ? 'Drew Lupkey' : isEthan ? 'Ethan Pierce' : user.email?.split('@')[0] || 'Staff Member'),
    email: userEmail,
    title: isOwnerEmail ? 'System Owner & Principal' : isKyle ? 'Lead Project Manager & Senior Drafter' : isJason ? 'Project Manager & Operations' : isDrew ? 'Admin & Billing Specialist' : isEthan ? 'Junior Drafter & CAD Specialist' : 'Architectural Drafter',
    role: isOwnerEmail || isJason || isDrew ? 'admin' : isKyle ? 'drafter_lead' : 'drafter',
    department: isOwnerEmail || isKyle ? 'Management' : isJason ? 'Operations' : isDrew ? 'Finance' : 'Drafting',
    hourlyRate: isOwnerEmail ? 150 : isJason ? 120 : isKyle ? 110 : isDrew ? 90 : 75,
    status: 'active',
    joinedDate: new Date().toISOString().split('T')[0],
    canAccessFinancials: isOwnerEmail || isKyle || isJason || isDrew || isEthan,
    canDelegate: isOwnerEmail || isKyle || isJason,
    canViewAllProjects: isOwnerEmail || isKyle || isJason || isDrew || isEthan,
    canManageStaff: isOwnerEmail || isKyle || isJason,
    canManageInvoices: isOwnerEmail || isKyle || isJason || isDrew || isEthan,
    canEditJobPhases: isOwnerEmail || isKyle || isJason,
    canManageRoadblocks: isOwnerEmail || isKyle || isJason,
    isOnline: true,
    lastSeenAt: nowIso,
    lastLoginAt: nowIso
  };

  removeDeletedStaffId({ id: newStaff.id, email: newStaff.email });
  clearPendingSignupName(userEmail);
  await saveStaffToFirestore(newStaff);
  return newStaff;
}

// -------------------------------------------------------------
// Greg Hyatt Dev Project Time Entries & Cards (Firestore Sync)
// -------------------------------------------------------------

export function subscribeToDevTimeEntries(callback: (entries: GregDevTimeEntry[]) => void): () => void {
  if (!db) {
    return () => {};
  }
  try {
    const q = query(collection(db, 'dev_time_entries'), orderBy('created_at', 'desc'), limit(200));
    return onSnapshot(q, (snapshot) => {
      const items: GregDevTimeEntry[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({
          id: doc.id,
          staffId: d.staff_id || d.staffId || 'staff-greg',
          staffName: d.staff_name || d.staffName || 'Greg Hyatt',
          projectType: d.project_type || d.projectType || 'MPS OS Dev',
          date: d.date || new Date().toISOString().split('T')[0],
          startTime: d.start_time || d.startTime || new Date().toISOString(),
          endTime: d.end_time || d.endTime || new Date().toISOString(),
          durationSeconds: d.duration_seconds || d.durationSeconds || 0,
          notes: d.notes || '',
          hourlyRate: d.hourly_rate || d.hourlyRate || 150,
          billableAmount: d.billable_amount || d.billableAmount || 0,
          shiftId: d.shift_id || d.shiftId,
          createdAt: d.created_at || d.createdAt || new Date().toISOString()
        });
      });
      callback(items);
    }, (err) => {
      console.warn('[Firestore] dev_time_entries subscription error:', err);
    });
  } catch (err) {
    console.warn('[Firestore] failed to subscribe to dev_time_entries:', err);
    return () => {};
  }
}

export async function saveDevTimeEntryToFirestore(entry: GregDevTimeEntry): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'dev_time_entries', entry.id);
    await setDoc(docRef, {
      id: entry.id,
      staff_id: entry.staffId,
      staff_name: entry.staffName,
      project_type: entry.projectType,
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      duration_seconds: entry.durationSeconds,
      notes: entry.notes || '',
      hourly_rate: entry.hourlyRate,
      billable_amount: entry.billableAmount,
      shift_id: entry.shiftId || '',
      created_at: entry.createdAt
    }, { merge: true });
  } catch (err) {
    console.warn('[Firestore] error saving dev time entry:', err);
  }
}

export async function deleteDevTimeEntryFromFirestore(entryId: string): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'dev_time_entries', entryId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[Firestore] error deleting dev time entry:', err);
  }
}

export function subscribeToDevProjectCards(callback: (cards: GregDevProjectCard[]) => void): () => void {
  if (!db) return () => {};
  try {
    const colRef = collection(db, 'dev_project_cards');
    return onSnapshot(colRef, (snapshot) => {
      const items: GregDevProjectCard[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        // Prefer canonical snake_case fields; only fall back to legacy camelCase when snake_case is undefined
        const rawStart = d.active_timer_start !== undefined ? d.active_timer_start : d.activeTimerStart;
        const rawIsActive = d.is_active !== undefined ? d.is_active : d.isActive;
        const rawIsPaused = d.is_paused_by_break !== undefined ? d.is_paused_by_break : d.isPausedByBreak;
        items.push({
          id: docSnap.id,
          projectType: d.project_type || d.projectType || 'Other Dev',
          colorTheme: d.color_theme || d.colorTheme || 'indigo',
          isActive: Boolean(rawIsActive),
          isPausedByBreak: Boolean(rawIsPaused),
          activeTimerStart: rawStart ? String(rawStart) : undefined,
          todaySeconds: Number(d.today_seconds ?? d.todaySeconds ?? 0) || 0,
          totalSeconds: Number(d.total_seconds ?? d.totalSeconds ?? 0) || 0,
          currentNotes: typeof (d.current_notes ?? d.currentNotes) === 'string' ? (d.current_notes ?? d.currentNotes) : '',
          lastStartedAt: (d.last_started_at ?? d.lastStartedAt) || undefined,
          lastStoppedAt: (d.last_stopped_at ?? d.lastStoppedAt) || undefined
        });
      });
      if (items.length > 0) {
        callback(items);
      }
    }, (err) => {
      console.warn('[Firestore] dev_project_cards subscription error:', err);
    });
  } catch (err) {
    console.warn('[Firestore] failed to subscribe to dev_project_cards:', err);
    return () => {};
  }
}

function buildSanitizedDevCardPayload(card: GregDevProjectCard): Record<string, any> {
  const active = Boolean(card.isActive && card.activeTimerStart);
  return {
    id: card.id,
    project_type: card.projectType || 'Other Dev',
    color_theme: card.colorTheme || 'indigo',
    is_active: active,
    is_paused_by_break: Boolean(card.isPausedByBreak),
    active_timer_start: active && card.activeTimerStart ? String(card.activeTimerStart) : null,
    today_seconds: typeof card.todaySeconds === 'number' && !isNaN(card.todaySeconds) ? card.todaySeconds : 0,
    total_seconds: typeof card.totalSeconds === 'number' && !isNaN(card.totalSeconds) ? card.totalSeconds : 0,
    current_notes: typeof card.currentNotes === 'string' ? card.currentNotes : '',
    last_started_at: card.lastStartedAt ? String(card.lastStartedAt) : null,
    last_stopped_at: active ? null : (card.lastStoppedAt ? String(card.lastStoppedAt) : null),
    // Clear any legacy camelCase ghost fields so snake_case is the sole source of truth
    isActive: deleteField(),
    isPausedByBreak: deleteField(),
    activeTimerStart: deleteField()
  };
}

/**
 * Saves a single dev project card document cleanly without touching any other card's running timer.
 * Retries once automatically on transient network glitches so timer start/stop writes never silently drop.
 */
export async function saveSingleDevProjectCardToFirestore(card: GregDevProjectCard): Promise<void> {
  if (!db || !card?.id) return;
  const docRef = doc(db, 'dev_project_cards', card.id);
  const payload = buildSanitizedDevCardPayload(card);
  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Retrying single dev project card save after transient error:', card.id, err);
    try {
      await new Promise(resolve => setTimeout(resolve, 650));
      await setDoc(docRef, payload, { merge: true });
    } catch (retryErr) {
      console.error('[Firestore] error saving single dev project card after retry:', card.id, retryErr);
    }
  }
}

/**
 * Updates ONLY the notes text of a dev project card — NEVER touches is_active or active_timer_start,
 * preventing blur/debounce races from ever stopping a running timer.
 */
export async function updateDevCardNotesInFirestore(cardId: string, notes: string): Promise<void> {
  if (!db || !cardId) return;
  try {
    const docRef = doc(db, 'dev_project_cards', cardId);
    await setDoc(
      docRef,
      {
        id: cardId,
        current_notes: typeof notes === 'string' ? notes : ''
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] error saving dev card notes:', cardId, err);
  }
}

export async function saveDevProjectCardsToFirestore(cards: GregDevProjectCard[]): Promise<void> {
  if (!db || !Array.isArray(cards) || cards.length === 0) return;
  try {
    await Promise.all(
      cards
        .filter(card => Boolean(card?.id))
        .map(card => saveSingleDevProjectCardToFirestore(card))
    );
  } catch (err) {
    console.error('[Firestore] error saving dev project cards:', err);
  }
}

export async function deleteDevProjectCardFromFirestore(cardId: string): Promise<void> {
  if (!db) return;
  const path = `dev_project_cards/${cardId}`;
  try {
    await deleteDoc(doc(db, 'dev_project_cards', cardId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Payroll Entries Sync & Persistence
// ---------------------------------------------------------------------------

export function subscribeToPayrollEntries(
  callback: (entries: PayrollEntry[]) => void,
  onEmptyOrErrorFallback?: () => void
): () => void {
  if (!db) {
    onEmptyOrErrorFallback?.();
    return () => {};
  }
  try {
    const colRef = collection(db, 'payroll_entries');
    return onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        onEmptyOrErrorFallback?.();
        return;
      }
      const entries: PayrollEntry[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        entries.push({
          id: d.id,
          employeeId: data.employee_id || data.employeeId || '',
          employeeName: data.employee_name || data.employeeName || '',
          employeeEmail: data.employee_email || data.employeeEmail || '',
          employeeTitle: data.employee_title || data.employeeTitle || '',
          periodStart: data.period_start || data.periodStart || '',
          periodEnd: data.period_end || data.periodEnd || '',
          paymentDate: data.payment_date || data.paymentDate || '',
          amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || '0'),
          checkNumber: String(data.check_number || data.checkNumber || ''),
          notes: data.notes || '',
          createdAt: data.created_at || data.createdAt || new Date().toISOString(),
          recordedBy: data.recorded_by || data.recordedBy || '',
          recordedById: data.recorded_by_id || data.recordedById || ''
        });
      });
      // Sort newest payment date or created date first
      entries.sort((a, b) => new Date(b.paymentDate || b.createdAt).getTime() - new Date(a.paymentDate || a.createdAt).getTime());
      callback(entries);
    }, (err) => {
      console.warn('[Firestore] payroll_entries subscription warning:', err);
      onEmptyOrErrorFallback?.();
    });
  } catch (err) {
    console.warn('[Firestore] failed to subscribe to payroll_entries:', err);
    onEmptyOrErrorFallback?.();
    return () => {};
  }
}

export async function savePayrollEntryToFirestore(entry: PayrollEntry): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'payroll_entries', entry.id);
    await setDoc(docRef, {
      id: entry.id,
      employee_id: entry.employeeId,
      employee_name: entry.employeeName,
      employee_email: entry.employeeEmail || '',
      employee_title: entry.employeeTitle || '',
      period_start: entry.periodStart,
      period_end: entry.periodEnd,
      payment_date: entry.paymentDate,
      amount: entry.amount,
      check_number: entry.checkNumber,
      notes: entry.notes || '',
      created_at: entry.createdAt,
      recorded_by: entry.recordedBy || '',
      recorded_by_id: entry.recordedById || ''
    });
  } catch (err) {
    console.warn('[Firestore] error saving payroll entry to Firestore:', err);
  }
}

export async function deletePayrollEntryFromFirestore(entryId: string): Promise<void> {
  if (!db) return;
  try {
    const docRef = doc(db, 'payroll_entries', entryId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[Firestore] error deleting payroll entry from Firestore:', err);
  }
}

export async function seedInitialPayrollEntries(entries: PayrollEntry[]): Promise<void> {
  if (!db) return;
  try {
    for (const entry of entries) {
      const docRef = doc(db, 'payroll_entries', entry.id);
      await setDoc(docRef, {
        id: entry.id,
        employee_id: entry.employeeId,
        employee_name: entry.employeeName,
        employee_email: entry.employeeEmail || '',
        employee_title: entry.employeeTitle || '',
        period_start: entry.periodStart,
        period_end: entry.periodEnd,
        payment_date: entry.paymentDate,
        amount: entry.amount,
        check_number: entry.checkNumber,
        notes: entry.notes || '',
        created_at: entry.createdAt,
        recorded_by: entry.recordedBy || '',
        recorded_by_id: entry.recordedById || ''
      }, { merge: true });
    }
  } catch (err) {
    console.warn('[Firestore] error seeding payroll entries:', err);
  }
}

// ---------------------------------------------------------------------------
// Employee Shift Time Cards (Clock-In, Break, Clock-Out Real-Time Cloud Sync)
// ---------------------------------------------------------------------------

export function subscribeToTimeCards(
  onUpdate: (shifts: TimeCardShift[]) => void,
  onEmptyFallback?: () => void
): () => void {
  const path = 'time_cards';
  if (!db) {
    onEmptyFallback?.();
    return () => {};
  }
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (snapshot.empty) {
          onEmptyFallback?.();
          return;
        }
        const loaded: TimeCardShift[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as TimeCardShift;
          loaded.push({
            id: docSnap.id,
            staffId: d.staffId || '',
            staffName: d.staffName || '',
            date: d.date || '',
            clockInTime: d.clockInTime || '',
            clockOutTime: d.clockOutTime || undefined,
            status: d.status || 'clocked_out',
            breaks: Array.isArray(d.breaks) ? d.breaks : [],
            totalWorkSeconds: typeof d.totalWorkSeconds === 'number' ? d.totalWorkSeconds : 0,
            totalBreakSeconds: typeof d.totalBreakSeconds === 'number' ? d.totalBreakSeconds : 0,
            notes: d.notes || '',
            pausedProjectJobIds: Array.isArray(d.pausedProjectJobIds) ? d.pausedProjectJobIds : [],
            missedClockOut: Boolean(d.missedClockOut)
          });
        });

        const { shifts: reconciled } = sanitizeAndReconcileTimeCards(loaded);
        reconciled.sort((a, b) => {
          const timeA = a.clockInTime ? new Date(a.clockInTime).getTime() : 0;
          const timeB = b.clockInTime ? new Date(b.clockInTime).getTime() : 0;
          return timeB - timeA;
        });
        onUpdate(reconciled);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export async function saveTimeCardToFirestore(shift: TimeCardShift): Promise<void> {
  if (!db || !shift?.id) return;
  const path = `time_cards/${shift.id}`;
  try {
    const cleanShift: Record<string, any> = JSON.parse(JSON.stringify(shift));
    if (shift.status === 'clocked_in' || shift.status === 'on_break' || !shift.clockOutTime) {
      cleanShift.clockOutTime = deleteField();
    }
    if (shift.totalWorkSeconds === undefined) {
      cleanShift.totalWorkSeconds = 0;
    }
    if (shift.totalBreakSeconds === undefined) {
      cleanShift.totalBreakSeconds = 0;
    }
    if (!Array.isArray(cleanShift.breaks)) {
      cleanShift.breaks = [];
    }
    await setDoc(doc(db, 'time_cards', shift.id), cleanShift, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteTimeCardFromFirestore(shiftId: string): Promise<void> {
  if (!db || !shiftId) return;
  const path = `time_cards/${shiftId}`;
  try {
    await deleteDoc(doc(db, 'time_cards', shiftId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedTimeCardsToFirestore(shifts: TimeCardShift[]): Promise<void> {
  if (!db || !shifts || shifts.length === 0) return;
  const path = 'time_cards';
  try {
    const batch = writeBatch(db);
    for (const shift of shifts) {
      if (!shift?.id) continue;
      const cleanShift: Record<string, any> = JSON.parse(JSON.stringify(shift));
      if (shift.status === 'clocked_in' || shift.status === 'on_break' || !shift.clockOutTime) {
        delete cleanShift.clockOutTime;
      }
      batch.set(doc(db, 'time_cards', shift.id), cleanShift, { merge: true });
    }
    await batch.commit();
    console.log(`[Firestore] Successfully seeded ${shifts.length} time card shifts to cloud database.`);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}


