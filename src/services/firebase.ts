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
  arrayUnion
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Job, StaffUser, ChatMessage, GregDevTimeEntry, GregDevProjectCard } from '../types';

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
    const cleanJob = JSON.parse(JSON.stringify(job));
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
  const oldMockDocIds = ['staff-jason', 'staff-drew', 'staff-kyle', 'staff-james', 'staff-aaron', 'staff-ethan'];
  try {
    const snap = await getDocs(collection(db, 'staff'));
    const batch = writeBatch(db);
    let count = 0;
    snap.forEach((d) => {
      const data = d.data() as StaffUser;
      const isOldId = oldMockDocIds.includes(d.id);
      const isOldName = ['jason', 'drew lupkey', 'kyle', 'james', 'aaron', 'ethan'].some(
        n => (data.name || '').toLowerCase() === n
      );
      const isNotOwner = !(data.name || '').toLowerCase().includes('greg hyatt') && 
                         (data.email || '').toLowerCase() !== 'arkcwd@gmail.com' &&
                         (data.email || '').toLowerCase() !== 'greg.hyatt@myplanstore.com';
      if ((isOldId || isOldName) && isNotOwner) {
        batch.delete(doc(db, 'staff', d.id));
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
      console.log(`[Firestore] Purged ${count} legacy mock users from Firestore.`);
    }
  } catch (err) {
    console.warn('[Firestore] Notice during staff purge:', err);
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
 * any dummy chat messages, and removing James from drafting assignments)
 */
export async function purgeDummyDataFromFirestore(): Promise<void> {
  try {
    // 1. Delete job-1 if present
    try {
      await deleteDoc(doc(db, 'jobs', 'job-1'));
    } catch {
      // Ignored if already deleted
    }

    // 2. Scan jobs collection to delete any remaining dummy job and remove James from jobs
    try {
      const jobsSnap = await getDocs(collection(db, 'jobs'));
      for (const d of jobsSnap.docs) {
        const j = d.data() as Job;
        if (d.id === 'job-1' || j.job_number === 'M26-195' || (j.customer_name || '').toLowerCase().includes('testing dummy')) {
          await deleteDoc(doc(db, 'jobs', d.id));
          console.log(`[Firestore] Purged dummy job doc: ${d.id}`);
        } else if ((j.assigned_drafter || '').toLowerCase().includes('james')) {
          const sanitizedLogs = (j.time_logs || []).map(tl => 
            (tl.drafterName || '').toLowerCase().includes('james') ? { ...tl, drafterName: 'Kyle' } : tl
          );
          const sanitizedDelegated = (j.delegated_tasks || []).filter(
            dt => !(dt.assignedTo || '').toLowerCase().includes('james')
          );
          await updateDoc(doc(db, 'jobs', d.id), {
            assigned_drafter: 'Kyle',
            time_logs: sanitizedLogs,
            delegated_tasks: sanitizedDelegated
          });
          console.log(`[Firestore] Purged James assignment on job: ${d.id}`);
        }
      }
    } catch (e) {
      console.warn('[Firestore] Notice during jobs purge:', e);
    }

    // 3. Scan discussions to purge mock/dummy messages
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
  const isOwnerEmail = ROOT_OWNER_EMAILS.map(e => e.toLowerCase()).includes(userEmail);

  // Check if staff member already exists with this email or name
  let matched = existingStaffList.find(s => (s.email || '').toLowerCase().trim() === userEmail);

  if (!matched && isOwnerEmail) {
    // Match to Greg Hyatt (Owner & Founder)
    matched = existingStaffList.find(s => s.name.toLowerCase().includes('greg hyatt')) ||
              existingStaffList.find(s => s.role === 'admin' && s.canManageStaff === true);
  }

  if (matched) {
    // If user is owner email, ensure Owner/Superadmin privileges
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
    return matched;
  }

  // Create new staff profile for verified user
  const newStaff: StaffUser = {
    id: `staff-${user.uid.slice(0, 8)}`,
    name: user.displayName || user.email?.split('@')[0] || 'Drafter User',
    email: userEmail,
    title: isOwnerEmail ? 'System Owner & Principal' : 'Architectural Drafter',
    role: isOwnerEmail ? 'admin' : 'drafter',
    department: isOwnerEmail ? 'Management' : 'Drafting',
    hourlyRate: isOwnerEmail ? 150 : 75,
    status: 'active',
    joinedDate: new Date().toISOString().split('T')[0],
    canAccessFinancials: isOwnerEmail,
    canDelegate: isOwnerEmail,
    canViewAllProjects: isOwnerEmail,
    canManageStaff: isOwnerEmail,
    canManageInvoices: isOwnerEmail,
    canEditJobPhases: isOwnerEmail,
    canManageRoadblocks: isOwnerEmail
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

