import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  type Auth,
  type User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  type Firestore 
} from 'firebase/firestore';
import type { AuthUser, MeterReading, UserSettings } from '../types';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const FIREBASE_CONFIG_STORAGE_KEY = 'jodbill_custom_firebase_config';
const MOCK_USER_STORAGE_KEY = 'jodbill_mock_auth_user';

// Read config from env or localStorage
export function getFirebaseConfig(): FirebaseConfig | null {
  const customStr = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
  if (customStr) {
    try {
      const parsed = JSON.parse(customStr);
      if (parsed.apiKey && parsed.projectId) {
        return parsed as FirebaseConfig;
      }
    } catch {
      // ignore
    }
  }

  // Fallback to Vite env variables
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig | null): void {
  if (!config) {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
  } else {
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

// Lazy Firebase initialization
let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function initFirebase() {
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    if (!getApps().length) {
      appInstance = initializeApp(config);
    } else {
      appInstance = getApps()[0];
    }
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    return { app: appInstance, auth: authInstance, db: dbInstance };
  } catch (err) {
    console.warn('Failed to initialize Firebase:', err);
    return null;
  }
}

// Convert Firebase User to AuthUser
function formatFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    provider: 'google',
  };
}

// Auth State Subscriber
export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  const fb = initFirebase();

  // If real Firebase is available
  if (fb && fb.auth) {
    return onAuthStateChanged(fb.auth, (user) => {
      if (user) {
        callback(formatFirebaseUser(user));
      } else {
        // Check if there is a mock session
        const mockUserStr = localStorage.getItem(MOCK_USER_STORAGE_KEY);
        if (mockUserStr) {
          try {
            callback(JSON.parse(mockUserStr));
            return;
          } catch {
            // ignore
          }
        }
        callback(null);
      }
    });
  }

  // Fallback to local stored session (mock / simulated Google user)
  const mockUserStr = localStorage.getItem(MOCK_USER_STORAGE_KEY);
  if (mockUserStr) {
    try {
      callback(JSON.parse(mockUserStr));
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }

  // Return unsubscribe dummy
  return () => {};
}

// Google Sign-In
export async function loginWithGoogle(): Promise<AuthUser> {
  const fb = initFirebase();

  if (fb && fb.auth) {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(fb.auth, provider);
      const user = formatFirebaseUser(result.user);
      localStorage.removeItem(MOCK_USER_STORAGE_KEY);
      return user;
    } catch (err: unknown) {
      console.error('Google Sign-in Error:', err);
      throw err;
    }
  }

  // Fallback: Instant Simulated Google Auth (allows immediate cross-browser test / zero config demo)
  const simulatedUser: AuthUser = {
    uid: `google-user-${Date.now()}`,
    displayName: 'ผู้ใช้งาน Google (Cloud Sync)',
    email: 'user.jodbill@gmail.com',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop&crop=face',
    provider: 'demo',
  };
  localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(simulatedUser));
  return simulatedUser;
}

// Sign Out
export async function logoutUser(): Promise<void> {
  const fb = initFirebase();
  if (fb && fb.auth) {
    try {
      await signOut(fb.auth);
    } catch (err) {
      console.warn('Signout error:', err);
    }
  }
  localStorage.removeItem(MOCK_USER_STORAGE_KEY);
}

// Cloud Sync: Push state to Cloud
export async function pushUserDataToCloud(
  uid: string,
  data: { readings: MeterReading[]; settings: UserSettings }
): Promise<boolean> {
  const fb = initFirebase();
  if (fb && fb.db) {
    try {
      const userDoc = doc(fb.db, 'users', uid);
      await setDoc(userDoc, {
        settings: data.settings,
        readings: data.readings,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Push to Firestore failed:', err);
      return false;
    }
  }

  // Fallback: Store in mock cloud store (browser localStorage cloud simulation)
  const mockCloudKey = `jodbill_cloud_db_${uid}`;
  localStorage.setItem(mockCloudKey, JSON.stringify({
    settings: data.settings,
    readings: data.readings,
    updatedAt: new Date().toISOString(),
  }));
  return true;
}

// Cloud Sync: Pull state from Cloud
export async function fetchUserDataFromCloud(
  uid: string
): Promise<{ readings?: MeterReading[]; settings?: Partial<UserSettings>; updatedAt?: string } | null> {
  const fb = initFirebase();
  if (fb && fb.db) {
    try {
      const userDoc = doc(fb.db, 'users', uid);
      const snapshot = await getDoc(userDoc);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          readings: data.readings,
          settings: data.settings,
          updatedAt: data.updatedAt,
        };
      }
      return null;
    } catch (err) {
      console.error('Fetch from Firestore failed:', err);
      return null;
    }
  }

  // Fallback: Read from mock cloud store
  const mockCloudKey = `jodbill_cloud_db_${uid}`;
  const raw = localStorage.getItem(mockCloudKey);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}
