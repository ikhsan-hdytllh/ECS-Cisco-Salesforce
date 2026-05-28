import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  updateProfile, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  mfaEnabled: boolean;
  mfaSecret: string;
  createdAt: string;
}

// 1. Generate standard deterministic 6-digit TOTP secret for our virtual and standard MFA app
export const generateMfaSecret = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateTOTP = (secret: string): string => {
  if (!secret) return '';
  const step = Math.floor(Date.now() / 30000);
  let hash = 0;
  const str = secret + step;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const code = Math.abs(hash) % 1000000;
  return code.toString().padStart(6, '0');
};

export const verifyTOTP = (secret: string, code: string): boolean => {
  if (!secret || !code) return false;
  const step = Math.floor(Date.now() / 30000);
  
  // check current step, previous step (-1), and next step (+1) for clock drift tolerance
  for (let drift = -1; drift <= 1; drift++) {
    let hash = 0;
    const str = secret + (step + drift);
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const derived = (Math.abs(hash) % 1000000).toString().padStart(6, '0');
    if (derived === code.trim()) return true;
  }
  return false;
};

// 2. Load custom user profile from Firestore to fetch stored MFA secrets
export const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

// 3. User setup profile on registration
export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  await setDoc(doc(db, 'users', profile.uid), profile);
};

// 4. Update user MFA settings in database
export const updateUserMfaSettings = async (uid: string, enabled: boolean, secret: string) => {
  await setDoc(doc(db, 'users', uid), {
    mfaEnabled: enabled,
    mfaSecret: secret
  }, { merge: true });
};
