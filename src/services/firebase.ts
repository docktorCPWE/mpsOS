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
          console.log('[Firestore] Jobs collection is empty in cloud database. Triggering seed...');
          onSeedNeeded();
        } else {
          const loaded: Job[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Job;
            loaded.push({ ...data, id: docSnap.id });
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
    }
    
    // Explicitly delete paused timer fields if job is not paused by break
    if (!job.paused_by_break) {
      cleanJob.paused_by_break = false;
      cleanJob.paused_timer_task = deleteField();
      cleanJob.paused_timer_drafter_id = deleteField();
      cleanJob.paused_timer_drafter_name = deleteField();
      cleanJob.paused_elapsed_seconds = deleteField();
    }

    // Safety guard against Firestore 1MB (1,048,576 bytes) document limit
    const jsonStr = JSON.stringify(cleanJob);
    if (jsonStr.length > 600000) {
      console.warn(`[Firestore] Document for job ${job.job_number} is large (${jsonStr.length} bytes). Optimizing base64 payload...`);
      if (Array.isArray(cleanJob.deliverables)) {
        cleanJob.deliverables = cleanJob.deliverables.map((del: any) => {
          if (del.fileUrl && del.fileUrl.length > 40000) {
            return { ...del, fileUrl: del.fileUrl.slice(0, 30000) };
          }
          return del;
        });
      }
      if (Array.isArray(cleanJob.delegated_tasks)) {
        cleanJob.delegated_tasks = cleanJob.delegated_tasks.map((task: any) => {
          if (Array.isArray(task.attachments)) {
            task.attachments = task.attachments.map((att: any) => {
              if (att.url && att.url.length > 40000) {
                return { ...att, url: att.url.slice(0, 30000) };
              }
              return att;
            });
          }
          return task;
        });
      }
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

export async function seedInitialJobsToFirestore(initialJobs: Job[]): Promise<void> {
  const path = 'jobs';
  try {
    const batch = writeBatch(db);
    for (const job of initialJobs) {
      const cleanJob = JSON.parse(JSON.stringify(job));
      batch.set(doc(db, 'jobs', job.id), cleanJob);
    }
    await batch.commit();
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
 * Clean up dummy data from Firestore (such as job-1 / M26-195 Testing Dummy,
 * lingering dummy staff-aaron / staff-james docs, dummy chat messages,
 * and sanitizing synthetic Aaron/James entries to Kyle while preserving real James Barnett records)
 */
export async function purgeDummyDataFromFirestore(): Promise<void> {
  try {
    // 1. Delete job-1 if present
    try {
      await deleteDoc(doc(db, 'jobs', 'job-1')).catch(() => {});
    } catch {
      // Ignored if already deleted
    }

    // 2. Delete synthetic dummy staff docs
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
    } catch {
      // Ignored
    }

    // 3. Scan jobs collection to delete any dummy jobs and sanitize synthetic Aaron/James logs
    try {
      const isDummyJames = (val?: string) => Boolean(val && val.trim().toLowerCase() === 'james');
      const isDummyAaron = (val?: string) => Boolean(val && val.trim().toLowerCase() === 'aaron');

      const jobsSnap = await getDocs(collection(db, 'jobs'));
      for (const d of jobsSnap.docs) {
        const j = d.data() as Job;
        if (d.id === 'job-1' || j.job_number === 'M26-195' || (j.customer_name || '').toLowerCase().includes('testing dummy')) {
          await deleteDoc(doc(db, 'jobs', d.id));
          console.log(`[Firestore] Purged dummy job doc: ${d.id}`);
          continue;
        }

        let needsUpdate = false;
        const updates: Record<string, any> = {};

        if (isDummyJames(j.assigned_drafter) || isDummyAaron(j.assigned_drafter)) {
          updates.assigned_drafter = 'Kyle';
          needsUpdate = true;
        }

        if (Array.isArray(j.time_logs) && j.time_logs.length > 0) {
          let logsChanged = false;
          const sanitizedLogs = j.time_logs.map(tl => {
            if (isDummyJames(tl.drafterName) || isDummyAaron(tl.drafterName)) {
              logsChanged = true;
              return { ...tl, drafterName: 'Kyle' };
            }
            return tl;
          });
          if (logsChanged) {
            updates.time_logs = sanitizedLogs;
            needsUpdate = true;
          }
        }

        if (Array.isArray(j.delegated_tasks) && j.delegated_tasks.length > 0) {
          let tasksChanged = false;
          const sanitizedDelegated = j.delegated_tasks.map(dt => {
            if (isDummyJames(dt.assignedTo) || isDummyAaron(dt.assignedTo)) {
              tasksChanged = true;
              return { ...dt, assignedTo: 'Kyle' };
            }
            return dt;
          });
          if (tasksChanged) {
            updates.delegated_tasks = sanitizedDelegated;
            needsUpdate = true;
          }
        }

        if (Array.isArray(j.comments) && j.comments.length > 0) {
          let commentsChanged = false;
          const sanitizedComments = j.comments.map(c => {
            if (isDummyJames(c.author) || isDummyAaron(c.author)) {
              commentsChanged = true;
              return { ...c, author: 'Kyle' };
            }
            return c;
          });
          if (commentsChanged) {
            updates.comments = sanitizedComments;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await updateDoc(doc(db, 'jobs', d.id), updates);
          console.log(`[Firestore] Sanitized dummy drafter assignments on job: ${d.id}`);
        }
      }
    } catch (e) {
      console.warn('[Firestore] Notice during jobs purge:', e);
    }

    // 4. Scan discussions to purge mock/dummy messages
    try {
      const chatSnap = await getDocs(collection(db, 'discussions'));
      const batch = writeBatch(db);
      let purgeCount = 0;
      chatSnap.forEach((d) => {
        const m = d.data() as ChatMessage;
        const text = (m.text || '').toLowerCase();
        const isDummy = d.id.startsWith('msg-ethan-') || 
                        d.id.startsWith('msg-jm-') || 
                        d.id.startsWith('msg-dr-') || 
                        ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5', 'msg-greg-resp'].includes(d.id) ||
                        text.includes('m26-195') || 
                        text.includes('testing dummy') ||
                        (m.referencedJobNumbers || []).some(j => j.includes('195'));
        if (isDummy) {
          batch.delete(doc(db, 'discussions', d.id));
          purgeCount++;
        }
      });
      if (purgeCount > 0) {
        await batch.commit();
        console.log(`[Firestore] Purged ${purgeCount} dummy chat messages from discussions.`);
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

