import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AuthUser, MeterReading, UserSettings } from '../types';

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

// 5. Cloud Database Sync: Readings
export async function syncReadingsToSupabase(
  userId: string,
  readings: MeterReading[],
  roomId = 'default-room'
): Promise<boolean> {
  if (!supabase) return false;

  try {
    if (readings.length === 0) return true;

    // Ensure the room exists first to satisfy foreign key constraint
    await supabase.from('rooms').upsert(
      {
        id: roomId,
        owner_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    const payload = readings.map((r) => ({
      id: r.id,
      user_id: userId,
      room_id: roomId,
      meter_type: r.meterType,
      reading: r.reading,
      previous_reading: r.previousReading ?? null,
      units_used: r.unitsUsed ?? null,
      calculated_cost: r.calculatedCost ?? null,
      photo_url: r.photoUrl ?? null,
      notes: r.notes ?? null,
      detected_by: r.detectedBy,
      ocr_confidence: r.ocrConfidence ?? null,
      timestamp: r.timestamp,
    }));

    const { error } = await supabase
      .from('readings')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase readings sync warning:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase readings sync failed:', err);
    return false;
  }
}

// 6. Cloud Database Fetch: Readings
export async function fetchReadingsFromSupabase(
  userId?: string,
  roomId?: string
): Promise<MeterReading[] | null> {
  if (!supabase) return null;

  try {
    let query = supabase.from('readings').select('*');

    if (userId && roomId && roomId !== 'default-room') {
      query = query.or(`user_id.eq.${userId},room_id.eq.${roomId}`);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else if (roomId) {
      query = query.eq('room_id', roomId);
    }

    const { data, error } = await query.order('timestamp', { ascending: false });

    if (error || !data) {
      console.warn('Supabase fetch readings warning:', error);
      return null;
    }

    return data.map((row) => ({
      id: row.id,
      meterType: row.meter_type as 'electricity' | 'water',
      reading: Number(row.reading),
      previousReading: row.previous_reading !== null ? Number(row.previous_reading) : undefined,
      unitsUsed: row.units_used !== null ? Number(row.units_used) : undefined,
      calculatedCost: row.calculated_cost !== null ? Number(row.calculated_cost) : undefined,
      photoUrl: row.photo_url || undefined,
      notes: row.notes || undefined,
      detectedBy: row.detected_by || 'manual',
      ocrConfidence: row.ocr_confidence !== null ? Number(row.ocr_confidence) : undefined,
      timestamp: row.timestamp,
    }));
  } catch (err) {
    console.error('Supabase fetch readings failed:', err);
    return null;
  }
}

// 7. Cloud Database Sync: Room Settings
export async function syncSettingsToSupabase(
  userId: string,
  settings: UserSettings,
  roomId = 'default-room'
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('rooms')
      .upsert({
        id: roomId,
        owner_id: userId,
        dorm_name: settings.dormName,
        room_number: settings.roomNumber,
        settings: settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase settings sync warning:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase settings sync failed:', err);
    return false;
  }
}

// 8. Cloud Database Fetch: Room Settings
export async function fetchSettingsFromSupabase(
  userId?: string,
  roomId?: string
): Promise<Partial<UserSettings> | null> {
  if (!supabase) return null;

  try {
    // 1. Try provided roomId first if specific
    if (roomId && roomId !== 'default-room') {
      const { data } = await supabase
        .from('rooms')
        .select('settings, dorm_name, room_number')
        .eq('id', roomId)
        .maybeSingle();

      if (data?.settings) {
        return data.settings as Partial<UserSettings>;
      }
    }

    // 2. Fetch the latest room owned by this user
    if (userId) {
      const { data } = await supabase
        .from('rooms')
        .select('settings, dorm_name, room_number')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.settings) {
        return data.settings as Partial<UserSettings>;
      }
    }

    // 3. Fallback to default-room
    const { data } = await supabase
      .from('rooms')
      .select('settings, dorm_name, room_number')
      .eq('id', 'default-room')
      .maybeSingle();

    return (data?.settings as Partial<UserSettings>) || null;
  } catch (err) {
    console.error('Supabase fetch settings failed:', err);
    return null;
  }
}

// 9. Real-time Subscription for User and Room Across Devices
export function subscribeToUserAndRoomRealtime(
  userId: string,
  roomId: string,
  onUpdate: () => void
): () => void {
  if (!supabase) return () => {};

  const channelId = `sync_${userId || 'anon'}_${roomId || 'default'}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'readings' },
      (payload) => {
        const record = (payload.new || payload.old) as any;
        if (!record || !userId || record.user_id === userId || record.room_id === roomId) {
          onUpdate();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms' },
      (payload) => {
        const record = (payload.new || payload.old) as any;
        if (!record || !userId || record.owner_id === userId || record.id === roomId) {
          onUpdate();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Legacy Real-time Subscription
export function subscribeToRoomRealtime(
  roomId: string,
  onUpdate: () => void
): () => void {
  return subscribeToUserAndRoomRealtime('', roomId, onUpdate);
}
