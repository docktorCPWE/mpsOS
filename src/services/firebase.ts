import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Job, StaffUser, ChatMessage } from '../types';

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
        if (msgs.length > 0) {
          onUpdate(msgs);
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

export async function saveChatMessageToFirestore(message: ChatMessage): Promise<void> {
  const path = `discussions/${message.id}`;
  try {
    await setDoc(doc(db, 'discussions', message.id), message, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
