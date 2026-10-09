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
const GOOGLE_CLIENT_ID_STORAGE_KEY = 'jodbill_google_client_id';
const CURRENT_USER_STORAGE_KEY = 'jodbill_active_auth_user';
const SAVED_ACCOUNTS_STORAGE_KEY = 'jodbill_saved_accounts';

// Google Client ID
export function getGoogleClientId(): string | null {
  const custom = localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
  if (custom && custom.trim()) return custom.trim();
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
}

export function saveGoogleClientId(clientId: string | null): void {
  if (!clientId || !clientId.trim()) {
    localStorage.removeItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
  } else {
    localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, clientId.trim());
  }
}

// Read Firebase config from env or localStorage
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

// Saved Accounts List
export function getSavedAccounts(): AuthUser[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function addSavedAccount(account: AuthUser): void {
  const accounts = getSavedAccounts().filter((a) => a.uid !== account.uid && a.email !== account.email);
  const updated = [account, ...accounts];
  localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(updated.slice(0, 5)));
}

export function removeSavedAccount(uid: string): void {
  const accounts = getSavedAccounts().filter((a) => a.uid !== uid);
  localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
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
        const formatted = formatFirebaseUser(user);
        addSavedAccount(formatted);
        callback(formatted);
      } else {
        const localUserStr = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
        if (localUserStr) {
          try {
            callback(JSON.parse(localUserStr));
            return;
          } catch {
            // ignore
          }
        }
        callback(null);
      }
    });
  }

  // Fallback to active local stored session
  const localUserStr = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  if (localUserStr) {
    try {
      callback(JSON.parse(localUserStr));
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }

  return () => {};
}

// Global window declaration for Google Identity Services (GIS)
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

// Real Google GIS OAuth2 Login
export async function loginWithGoogleGIS(clientId: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services script not loaded.'));
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        callback: async (response) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          if (response.access_token) {
            try {
              // Fetch user info from Google's UserInfo API
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              const data = await res.json();
              const authUser: AuthUser = {
                uid: data.sub || `google-${data.email}`,
                displayName: data.name || data.email?.split('@')[0] || 'Google User',
                email: data.email,
                photoURL: data.picture || null,
                provider: 'google',
              };
              localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(authUser));
              addSavedAccount(authUser);
              resolve(authUser);
            } catch (err) {
              reject(err);
            }
          }
        },
        error_callback: (err) => {
          reject(err);
        },
      });

      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
}

// Firebase Google Sign-In
export async function loginWithFirebaseGoogle(): Promise<AuthUser> {
  const fb = initFirebase();
  if (!fb || !fb.auth) {
    throw new Error('Firebase is not configured');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(fb.auth, provider);
  const user = formatFirebaseUser(result.user);
  localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  addSavedAccount(user);
  return user;
}

// Custom / Manual Account Login (e.g. Choose Gmail address)
export function loginWithCustomAccount(email: string, displayName?: string, photoURL?: string): AuthUser {
  const cleanEmail = email.trim().toLowerCase();
  const name = displayName?.trim() || cleanEmail.split('@')[0];
  const user: AuthUser = {
    uid: `acc-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
    displayName: name,
    email: cleanEmail,
    photoURL: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
    provider: 'demo',
  };

  localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  addSavedAccount(user);
  return user;
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
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
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

  // Store in cloud store simulation for this specific user
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

  // Fallback: Read from cloud store simulation
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
