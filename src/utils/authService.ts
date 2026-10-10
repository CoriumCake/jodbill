import type { AuthUser, MeterReading, UserSettings } from '../types';
import { 
  supabase, 
  isSupabaseConfigured, 
  signInWithGoogleSupabase, 
  signOutSupabase, 
  subscribeToSupabaseAuth,
  syncReadingsToSupabase,
  syncSettingsToSupabase,
  fetchReadingsFromSupabase,
  fetchSettingsFromSupabase
} from './supabase';

const CURRENT_USER_STORAGE_KEY = 'jodbill_active_auth_user';

// Get Google Client ID from environment variables (.env)
export function getGoogleClientId(): string | null {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || null;
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

// Auth State Subscriber (Listens to Supabase or local storage)
export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  // Purge any stale legacy demo user
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider === 'demo' || parsed.displayName?.includes('Dev Mode')) {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      }
    }
  } catch {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  }

  // 1. If Supabase is configured, use official Supabase Auth Listener
  if (isSupabaseConfigured && supabase) {
    return subscribeToSupabaseAuth((user) => {
      if (user) {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      }
      callback(user);
    });
  }

  // 2. Fallback to active local stored session (only if real user)
  const localUserStr = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  if (localUserStr) {
    try {
      const parsed = JSON.parse(localUserStr);
      if (parsed.provider !== 'demo') {
        callback(parsed);
        return () => {};
      }
    } catch {
      callback(null);
    }
  }

  callback(null);
  return () => {};
}

// Google GIS OAuth2 Login Fallback
async function loginWithGoogleGIS(clientId: string): Promise<AuthUser> {
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

// Unified Google Login
export async function loginWithGoogle(): Promise<AuthUser | void> {
  // 1. Supabase Auth (Primary)
  if (isSupabaseConfigured && supabase) {
    return await signInWithGoogleSupabase();
  }

  // 2. Google GIS Fallback
  const googleClientId = getGoogleClientId();
  if (googleClientId) {
    return loginWithGoogleGIS(googleClientId);
  }

  throw new Error('ระบบ Supabase ยังไม่พร้อมใช้งาน กรุณาตรวจสอบการตั้งค่า');
}

// Sign Out
export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await signOutSupabase();
  }
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}

// Cloud Sync: Push state to Supabase Cloud
export async function pushUserDataToCloud(
  uid: string,
  data: { readings: MeterReading[]; settings: UserSettings }
): Promise<boolean> {
  // 1. Supabase Postgres Sync (Primary)
  if (isSupabaseConfigured && supabase) {
    const roomId = data.settings.roomShare?.roomId || 'default-room';
    const okReadings = await syncReadingsToSupabase(uid, data.readings, roomId);
    const okSettings = await syncSettingsToSupabase(uid, data.settings, roomId);
    return okReadings && okSettings;
  }

  // 2. Fallback local cloud simulator
  const mockCloudKey = `jodbill_cloud_db_${uid}`;
  localStorage.setItem(mockCloudKey, JSON.stringify({
    settings: data.settings,
    readings: data.readings,
    updatedAt: new Date().toISOString(),
  }));
  return true;
}

// Cloud Sync: Pull state from Supabase Cloud
export async function fetchUserDataFromCloud(
  uid: string
): Promise<{ readings?: MeterReading[]; settings?: Partial<UserSettings>; updatedAt?: string } | null> {
  // 1. Supabase Postgres Fetch (Primary)
  if (isSupabaseConfigured && supabase) {
    const roomId = 'default-room';
    const [readings, settings] = await Promise.all([
      fetchReadingsFromSupabase(uid, roomId),
      fetchSettingsFromSupabase(uid, roomId),
    ]);

    if (!readings && !settings) return null;
    return {
      readings: readings || undefined,
      settings: settings || undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  // 2. Fallback local cloud simulator
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
