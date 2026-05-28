import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  getFirestore 
} from 'firebase/firestore';
import { db, auth } from './auth';
import { Deal } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

// 1. Subscribe to real-time additions, updates, and removals of deals in the pipeline
export const subscribeToDeals = (
  onSuccess: (deals: Deal[]) => void,
  onFailure: (error: Error) => void
) => {
  const dealsPath = 'deals';
  const unsubscribe = onSnapshot(
    collection(db, dealsPath),
    (snapshot) => {
      const deals: Deal[] = [];
      snapshot.forEach((docSnap) => {
        deals.push(docSnap.data() as Deal);
      });
      onSuccess(deals);
    },
    (error) => {
      onFailure(error);
      handleFirestoreError(error, OperationType.GET, dealsPath);
    }
  );
  return unsubscribe;
};

// 2. Add opportunity deal to Firestore
export const addDealToFirestore = async (deal: Deal) => {
  const path = `deals/${deal.id}`;
  try {
    const freshDeal = {
      ...deal,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'deals', deal.id), freshDeal);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// 3. Update opportunity deal in Firestore
export const updateDealInFirestore = async (deal: Deal) => {
  const path = `deals/${deal.id}`;
  try {
    const updatedDeal = {
      ...deal,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'deals', deal.id), updatedDeal);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// 4. Delete opportunity deal from Firestore
export const deleteDealFromFirestore = async (id: string) => {
  const path = `deals/${id}`;
  try {
    await deleteDoc(doc(db, 'deals', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
