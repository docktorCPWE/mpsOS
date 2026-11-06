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
import { Job, StaffUser, ChatMessage, GregDevTimeEntry, GregDevProjectCard, PayrollEntry } from '../types';
import { isTestJob, isTestDelegatedTask, isTestDeliverable, isTestComment, STAFF_USERS } from '../data/mockData';

// Root owner accounts with master system privileges
export const ROOT_OWNER_EMAILS = ['arkcwd@gmail.com', 'greg.hyatt@myplanstore.com'];

// Initialize Firebase App & Firestore with strict databaseId
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

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

export async function purgeRemovedMockStaff(): Promise<void> {
  // Purge deprecated mock staff documents (staff-aaron, staff-james) if lingering in Firestore
  try {
    await deleteDoc(doc(db, 'staff', 'staff-aaron')).catch(() => {});
    await deleteDoc(doc(db, 'staff', 'staff-james')).catch(() => {});
    const staffSnap = await getDocs(collection(db, 'staff')).catch(() => null);
    if (staffSnap) {
      for (const d of staffSnap.docs) {
        const s = d.data();
        const emailLower = (s.email || '').trim().toLowerCase();
        const nameLower = (s.name || '').trim().toLowerCase();
        if (
          d.id === 'staff-aaron' ||
          d.id === 'staff-james' ||
          emailLower === 'aaron@myplanstore.com' ||
          emailLower === 'james@myplanstore.com' ||
          nameLower === 'aaron' ||
          nameLower === 'james'
        ) {
          await deleteDoc(doc(db, 'staff', d.id)).catch(() => {});
          console.log(`[Firestore] Purged mock staff doc: ${d.id}`);
        }
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
          msgs.push({ ...(docSnap.data() as ChatMessage), id: docSnap.id });
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
    await setDoc(doc(db, 'discussions', message.id), message, { merge: true });
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

    // 2. Preserve and verify all real staff users (Greg, Kyle, Jason, Drew, Ethan, James Barnett)
    try {
      // Purge only obsolete mock placeholder docs (staff-aaron, legacy staff-james without -barnett)
      await deleteDoc(doc(db, 'staff', 'staff-aaron')).catch(() => {});
      await deleteDoc(doc(db, 'staff', 'staff-james')).catch(() => {});
      const staffSnap = await getDocs(collection(db, 'staff')).catch(() => null);
      if (staffSnap) {
        for (const d of staffSnap.docs) {
          const s = d.data();
          const emailLower = (s.email || '').trim().toLowerCase();
          const nameLower = (s.name || '').trim().toLowerCase();
          if (
            d.id === 'staff-aaron' ||
            (d.id === 'staff-james' && !d.id.includes('barnett')) ||
            emailLower === 'aaron@myplanstore.com' ||
            (nameLower === 'aaron')
          ) {
            await deleteDoc(doc(db, 'staff', d.id)).catch(() => {});
            console.log(`[Firestore] Purged obsolete placeholder staff doc: ${d.id}`);
          }
        }
      }

      // Ensure all 6 core staff exist in Firestore
      for (const core of STAFF_USERS) {
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
      const isDummyJames = (val?: string) => Boolean(val && val.trim().toLowerCase() === 'james' && !val.toLowerCase().includes('barnett'));
      const isDummyAaron = (val?: string) => Boolean(val && val.trim().toLowerCase() === 'aaron');

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

        if (isDummyJames(j.assigned_drafter) || isDummyAaron(j.assigned_drafter)) {
          updates.assigned_drafter = 'Kyle';
          needsUpdate = true;
        }

        // Clean out any testing delegated cards
        if (Array.isArray(j.delegated_tasks) && j.delegated_tasks.length > 0) {
          const originalLen = j.delegated_tasks.length;
          const cleanTasks = j.delegated_tasks
            .filter(dt => !isTestDelegatedTask(dt))
            .map(dt => {
              if (isDummyJames(dt.assignedTo) || isDummyAaron(dt.assignedTo)) {
                return { ...dt, assignedTo: 'Kyle' };
              }
              return dt;
            });
          if (cleanTasks.length !== originalLen || cleanTasks.some((t, i) => t.assignedTo !== j.delegated_tasks![i].assignedTo)) {
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

        // Reset dangling active timers stuck running from test executions
        if (j.active_timer_start) {
          const isTaskTimerTest = isTestDelegatedTask({ neededWorkDescription: j.active_timer_task });
          if (isTaskTimerTest) {
            updates.active_timer_start = deleteField();
            updates.active_timer_task = deleteField();
            updates.active_timer_drafter_id = deleteField();
            updates.active_timer_drafter_name = deleteField();
            updates.active_timer_delegated_task_id = deleteField();
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await updateDoc(doc(db, 'jobs', d.id), updates);
          console.log(`[Firestore] Cleaned and saved job doc: ${d.id}`);
        }
      }
    } catch (e) {
      console.warn('[Firestore] Notice during jobs purge:', e);
    }

    // 4. Scan dev_project_cards & reset any active test timers
    try {
      const devCardsSnap = await getDocs(collection(db, 'dev_project_cards'));
      for (const d of devCardsSnap.docs) {
        const card = d.data();
        let cardNeedsUpdate = false;
        const updates: Record<string, any> = {};

        if (card.is_active || card.active_timer_start) {
          updates.is_active = false;
          updates.active_timer_start = null;
          cardNeedsUpdate = true;
        }

        const notes = (card.current_notes || card.currentNotes || '').toLowerCase();
        if (notes.includes('dsp testing') || notes.includes('testing')) {
          updates.current_notes = 'Stem separation & frequency DSP processing';
          cardNeedsUpdate = true;
        }

        if (cardNeedsUpdate) {
          await updateDoc(doc(db, 'dev_project_cards', d.id), updates);
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
        const hasTestJob = (m.referencedJobNumbers || []).some(j => 
          j.includes('195') || j.includes('1000') || j.includes('8800') || j.includes('300')
        );
        const isTestMessage = 
          hasTestJob ||
          text.includes('m26-195') || 
          text.includes('m26-1000') || 
          text.includes('m26-8800') || 
          text.includes('m26-300') || 
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

export async function registerWithEmail(
  email: string,
  pass: string,
  fullName: string
): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const user = userCredential.user;

  // Set profile display name
  if (fullName.trim()) {
    await updateProfile(user, { displayName: fullName.trim() });
  }

  // Send email verification link
  await sendEmailVerification(user);
  console.log('[Auth] Verification email sent to:', user.email);

  return user;
}

export async function loginWithEmail(
  email: string,
  pass: string
): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return userCredential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
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
  return auth.currentUser.emailVerified;
}

// Maps authenticated Firebase user to a StaffUser record in the OS
export async function syncAuthToStaffUser(
  user: User,
  existingStaffList: StaffUser[]
): Promise<StaffUser> {
  const userEmail = (user.email || '').toLowerCase().trim();
  const userName = (user.displayName || '').toLowerCase().trim();
  const isOwnerEmail = ROOT_OWNER_EMAILS.map(e => e.toLowerCase()).includes(userEmail);
  const isKyle = userEmail.includes('kyle') || userName.includes('kyle');
  const isJason = userEmail.includes('jason') || userName.includes('jason');
  const isDrew = userEmail.includes('drew') || userName.includes('drew');

  // 1. Check if staff member already exists in memory with this email or name
  let matched = existingStaffList.find(s => (s.email || '').toLowerCase().trim() === userEmail);

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

  // 2. If not found in memory, try to look up in Firestore directly
  if (!matched && db) {
    try {
      const directDocRef = doc(db, 'staff', `staff-${user.uid.slice(0, 8)}`);
      const directSnap = await getDoc(directDocRef);
      if (directSnap.exists()) {
        matched = directSnap.data() as StaffUser;
      } else {
        const staffSnap = await getDocs(collection(db, 'staff'));
        staffSnap.forEach((d) => {
          const s = d.data() as StaffUser;
          if (s.email && s.email.toLowerCase().trim() === userEmail) {
            matched = s;
          } else if (isKyle && s.name.toLowerCase().includes('kyle')) {
            matched = s;
          } else if (isJason && s.name.toLowerCase().includes('jason')) {
            matched = s;
          } else if (isDrew && s.name.toLowerCase().includes('drew')) {
            matched = s;
          }
        });
      }
    } catch (err) {
      console.warn('[Firestore] Error looking up staff for auth user:', err);
    }
  }

  if (matched) {
    // If user is owner, ensure superadmin privileges
    if (isOwnerEmail && (!matched.canManageStaff || matched.role !== 'admin')) {
      const updated: StaffUser = {
        ...matched,
        email: userEmail,
        role: 'admin',
        title: 'System Owner & Principal',
        canAccessFinancials: true,
        canDelegate: true,
        canViewAllProjects: true,
        canManageStaff: true,
        canManageInvoices: true,
        canEditJobPhases: true,
        canManageRoadblocks: true
      };
      await saveStaffToFirestore(updated);
      return updated;
    }
    // If user is Kyle, ensure Lead PM capabilities are preserved and never downgraded
    if (isKyle) {
      const updatedKyle: StaffUser = {
        ...matched,
        email: matched.email || userEmail,
        name: matched.name || user.displayName || 'Kyle Edmonson',
        title: matched.title || 'Lead Project Manager & Senior Drafter',
        role: matched.role || 'drafter_lead',
        canAccessFinancials: matched.canAccessFinancials !== undefined ? matched.canAccessFinancials : true,
        canDelegate: matched.canDelegate !== undefined ? matched.canDelegate : true,
        canViewAllProjects: matched.canViewAllProjects !== undefined ? matched.canViewAllProjects : true,
        canManageStaff: matched.canManageStaff !== undefined ? matched.canManageStaff : true,
        canManageInvoices: matched.canManageInvoices !== undefined ? matched.canManageInvoices : true,
        canEditJobPhases: matched.canEditJobPhases !== undefined ? matched.canEditJobPhases : true,
        canManageRoadblocks: matched.canManageRoadblocks !== undefined ? matched.canManageRoadblocks : true
      };
      if (userEmail && (!matched.email || matched.email !== userEmail)) {
        await saveStaffToFirestore(updatedKyle);
      }
      return updatedKyle;
    }
    // For other staff, preserve their existing capabilities completely
    return matched;
  }

  // Create new staff profile for verified user only if not found at all
  const newStaff: StaffUser = {
    id: isKyle ? 'staff-kyle' : isJason ? 'staff-jason' : isDrew ? 'staff-drew' : `staff-${user.uid.slice(0, 8)}`,
    name: user.displayName || (isKyle ? 'Kyle Edmonson' : isJason ? 'Jason Barnett' : isDrew ? 'Drew Lupkey' : user.email?.split('@')[0] || 'Staff Member'),
    email: userEmail,
    title: isOwnerEmail ? 'System Owner & Principal' : isKyle ? 'Lead Project Manager & Senior Drafter' : isJason ? 'Project Manager & Operations' : isDrew ? 'Admin & Billing Specialist' : 'Architectural Drafter',
    role: isOwnerEmail || isJason || isDrew ? 'admin' : isKyle ? 'drafter_lead' : 'drafter',
    department: isOwnerEmail || isKyle ? 'Management' : isJason ? 'Operations' : isDrew ? 'Finance' : 'Drafting',
    hourlyRate: isOwnerEmail ? 150 : isJason ? 120 : isKyle ? 110 : isDrew ? 90 : 75,
    status: 'active',
    joinedDate: new Date().toISOString().split('T')[0],
    canAccessFinancials: isOwnerEmail || isKyle || isJason || isDrew,
    canDelegate: isOwnerEmail || isKyle || isJason,
    canViewAllProjects: isOwnerEmail || isKyle || isJason || isDrew,
    canManageStaff: isOwnerEmail || isKyle || isJason,
    canManageInvoices: isOwnerEmail || isKyle || isJason || isDrew,
    canEditJobPhases: isOwnerEmail || isKyle || isJason,
    canManageRoadblocks: isOwnerEmail || isKyle || isJason
  };

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
      if (items.length > 0) {
        callback(items);
      }
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
    });
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
      snapshot.forEach((doc) => {
        const d = doc.data();
        items.push({
          id: doc.id,
          projectType: d.project_type || d.projectType,
          colorTheme: d.color_theme || d.colorTheme || 'indigo',
          isActive: Boolean(d.is_active ?? d.isActive),
          isPausedByBreak: Boolean(d.is_paused_by_break ?? d.isPausedByBreak),
          activeTimerStart: d.active_timer_start || d.activeTimerStart,
          todaySeconds: d.today_seconds || d.todaySeconds || 0,
          totalSeconds: d.total_seconds || d.totalSeconds || 0,
          currentNotes: d.current_notes || d.currentNotes || ''
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

export async function saveDevProjectCardsToFirestore(cards: GregDevProjectCard[]): Promise<void> {
  if (!db) return;
  try {
    for (const card of cards) {
      const docRef = doc(db, 'dev_project_cards', card.id);
      await setDoc(docRef, {
        id: card.id,
        project_type: card.projectType,
        color_theme: card.colorTheme,
        is_active: card.isActive,
        is_paused_by_break: card.isPausedByBreak,
        active_timer_start: card.activeTimerStart || null,
        today_seconds: card.todaySeconds,
        total_seconds: card.totalSeconds,
        current_notes: card.currentNotes || ''
      });
    }
  } catch (err) {
    console.warn('[Firestore] error saving dev project cards:', err);
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

