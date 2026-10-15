import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AuthUser } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://uuonhglhoagbcbmfhtsy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1b25oZ2xob2FnYmNibWZodHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MTg2MzYsImV4cCI6MjEwNzE5NDYzNn0.ZQR3x4EDrcfUGpOUZREDGEZrJKGp2NMl_svlUeha15s';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create Supabase Client instance (or null if not configured)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Format Supabase User to AuthUser
export function formatSupabaseUser(user: User): AuthUser {
  return {
    uid: user.id,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'ผู้ใช้งาน',
    email: user.email || null,
    photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    provider: 'google',
  };
}

// 1. Google OAuth Sign-In via Supabase
export async function signInWithGoogleSupabase(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data?.url) {
    window.location.href = data.url;
  }
}

// 2. Sign Out
export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
  }
}

// 3. Email & Password Sign-In
export async function signInWithEmailSupabase(email: string, password: string): Promise<AuthUser> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
  }

  return formatSupabaseUser(data.user);
}

// 4. Email & Password Sign-Up
export async function signUpWithEmailSupabase(
  email: string, 
  password: string, 
  displayName?: string
): Promise<AuthUser | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: displayName?.trim() || email.split('@')[0],
      },
    },
  });

  if (error) {
    throw error;
  }

  return data.user ? formatSupabaseUser(data.user) : null;
}

// 5. Get Current User Session
export async function getCurrentSupabaseUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ? formatSupabaseUser(session.user) : null;
}

// 4. Subscribe to Auth State Changes
export function subscribeToSupabaseAuth(callback: (user: AuthUser | null) => void): () => void {
  if (!supabase) {
    callback(null);
    return () => {};
  }

  // Initial check
  getCurrentSupabaseUser().then(callback);

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? formatSupabaseUser(session.user) : null);
  });

  return () => {
    subscription.unsubscribe();
  };
}
