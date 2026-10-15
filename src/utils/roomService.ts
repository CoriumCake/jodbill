import { supabase } from './supabase';
import type { MeterReading, UserSettings, RoomRole, RoomSummary, RoomMember, RoomInvite } from '../types';

const ACTIVE_ROOM_KEY = 'jodbill_active_room_id';
const PENDING_INVITE_KEY = 'jodbill_pending_invite_token';

// Personal (per-device) preferences that must never be shared with other room members
const PERSONAL_SETTING_KEYS = ['geminiApiKey', 'preferredOcrProvider', 'soundEnabled', 'theme'] as const;

type SharedSettings = Omit<UserSettings, (typeof PERSONAL_SETTING_KEYS)[number]>;

// JSON with sorted keys, so values compare equal regardless of key order (jsonb reorders keys)
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v
  );
}

// Identity of a reading as stored in the database (ignores client-only fields and timestamp formatting)
export function readingFingerprint(r: MeterReading): string {
  return JSON.stringify([
    r.id,
    r.meterType,
    r.reading,
    r.previousReading ?? null,
    r.unitsUsed ?? null,
    r.calculatedCost ?? null,
    r.photoUrl ?? null,
    r.notes ?? null,
    r.detectedBy,
    r.ocrConfidence ?? null,
    new Date(r.timestamp).getTime(),
  ]);
}

export function sharedSettingsKey(settings: UserSettings): string {
  return stableStringify(toSharedSettings(settings));
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export function toSharedSettings(settings: UserSettings): SharedSettings {
  const shared: Record<string, unknown> = { ...settings };
  for (const key of PERSONAL_SETTING_KEYS) delete shared[key];
  // Legacy fields from the old link-based sharing
  delete shared.roomShare;
  delete shared.currentRole;
  return shared as SharedSettings;
}

// Merge a room's shared settings over the user's personal preferences
export function mergeRoomSettings(local: UserSettings, remote: Partial<UserSettings> | null): UserSettings {
  if (!remote) return local;
  const shared = toSharedSettings({ ...local, ...remote } as UserSettings);
  const personal: Partial<UserSettings> = {};
  for (const key of PERSONAL_SETTING_KEYS) {
    (personal as Record<string, unknown>)[key] = local[key];
  }
  return { ...(shared as UserSettings), ...personal };
}

// ---------- Active room & pending invite (per device) ----------
export function getStoredActiveRoomId(): string | null {
  try {
    const stored = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (stored) return stored;
    // Fall back to the room id saved by the old link-based sharing
    const legacy = localStorage.getItem('jodbill_persistent_room_share');
    return legacy ? (JSON.parse(legacy)?.roomId ?? null) : null;
  } catch {
    return null;
  }
}

export function storeActiveRoomId(roomId: string | null): void {
  try {
    if (roomId) localStorage.setItem(ACTIVE_ROOM_KEY, roomId);
    else localStorage.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    // ignore storage errors
  }
}

// Reads ?invite=TOKEN from the URL and keeps it across the OAuth redirect
export function captureInviteTokenFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('invite');
    if (token) {
      localStorage.setItem(PENDING_INVITE_KEY, token);
      url.searchParams.delete('invite');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
    return token || localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInviteToken(): void {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/?invite=${token}`;
}

// ---------- Rooms ----------
export async function listMyRooms(userId: string): Promise<RoomSummary[]> {
  const db = requireClient();
  const { data, error } = await db
    .from('room_members')
    .select('role, created_at, rooms(id, dorm_name, room_number, owner_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || [])
    .filter((row) => row.rooms)
    .map((row) => {
      const room = row.rooms as unknown as { id: string; dorm_name: string | null; room_number: string | null };
      return {
        id: room.id,
        dormName: room.dorm_name || '',
        roomNumber: room.room_number || '',
        role: row.role as RoomRole,
      };
    });
}

function generateRoomId(roomNumber: string): string {
  const cleanRoom = roomNumber.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'ROOM';
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `JOD-${cleanRoom}-${rand}`;
}

export async function createRoom(userId: string, settings: UserSettings): Promise<string> {
  const db = requireClient();
  const roomId = generateRoomId(settings.roomNumber);
  const { error } = await db.from('rooms').insert({
    id: roomId,
    owner_id: userId,
    dorm_name: settings.dormName,
    room_number: settings.roomNumber,
    settings: toSharedSettings(settings),
  });
  if (error) throw error;
  return roomId;
}

export async function deleteRoom(roomId: string): Promise<void> {
  const db = requireClient();
  const { error } = await db.from('rooms').delete().eq('id', roomId);
  if (error) throw error;
}

export async function fetchRoomSettings(roomId: string): Promise<Partial<UserSettings> | null> {
  const db = requireClient();
  const { data, error } = await db.from('rooms').select('settings').eq('id', roomId).maybeSingle();
  if (error) throw error;
  return (data?.settings as Partial<UserSettings>) || null;
}

export async function saveRoomSettings(roomId: string, settings: UserSettings): Promise<void> {
  const db = requireClient();
  const { error } = await db
    .from('rooms')
    .update({
      dorm_name: settings.dormName,
      room_number: settings.roomNumber,
      settings: toSharedSettings(settings),
    })
    .eq('id', roomId);
  if (error) throw error;
}

// ---------- Readings ----------
type ReadingRow = {
  id: string;
  meter_type: string;
  reading: number;
  previous_reading: number | null;
  units_used: number | null;
  calculated_cost: number | null;
  photo_url: string | null;
  notes: string | null;
  detected_by: string | null;
  ocr_confidence: number | null;
  timestamp: string;
};

function rowToReading(row: ReadingRow): MeterReading {
  return {
    id: row.id,
    meterType: row.meter_type as MeterReading['meterType'],
    reading: Number(row.reading),
    previousReading: row.previous_reading !== null ? Number(row.previous_reading) : undefined,
    unitsUsed: row.units_used !== null ? Number(row.units_used) : undefined,
    calculatedCost: row.calculated_cost !== null ? Number(row.calculated_cost) : undefined,
    photoUrl: row.photo_url || undefined,
    notes: row.notes || undefined,
    detectedBy: (row.detected_by || 'manual') as MeterReading['detectedBy'],
    ocrConfidence: row.ocr_confidence !== null ? Number(row.ocr_confidence) : undefined,
    timestamp: new Date(row.timestamp).toISOString(),
  };
}

export async function fetchRoomReadings(roomId: string): Promise<MeterReading[]> {
  const db = requireClient();
  const { data, error } = await db
    .from('readings')
    .select('id, meter_type, reading, previous_reading, units_used, calculated_cost, photo_url, notes, detected_by, ocr_confidence, timestamp')
    .eq('room_id', roomId)
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return (data as ReadingRow[]).map(rowToReading);
}

// Pushes only what changed since the last known server state
export async function syncRoomReadings(
  roomId: string,
  readings: MeterReading[],
  previous: MeterReading[]
): Promise<void> {
  const db = requireClient();
  const prevById = new Map(previous.map((r) => [r.id, readingFingerprint(r)]));
  const nextIds = new Set(readings.map((r) => r.id));

  const changed = readings.filter((r) => prevById.get(r.id) !== readingFingerprint(r));
  const removedIds = previous.filter((r) => !nextIds.has(r.id)).map((r) => r.id);

  if (changed.length > 0) {
    // user_id is omitted so the DB default (auth.uid()) applies on insert and authorship is kept on update
    const { error } = await db.from('readings').upsert(
      changed.map((r) => ({
        id: r.id,
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
      })),
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  if (removedIds.length > 0) {
    const { error } = await db.from('readings').delete().eq('room_id', roomId).in('id', removedIds);
    if (error) throw error;
  }
}

// ---------- Members & invites ----------
export async function listRoomMembers(roomId: string): Promise<RoomMember[]> {
  const db = requireClient();
  const { data, error } = await db.rpc('get_room_members', { p_room_id: roomId });
  if (error) throw error;
  return (data || []).map((m: Record<string, unknown>) => ({
    userId: m.user_id as string,
    role: m.role as RoomRole,
    email: (m.email as string) || null,
    displayName: (m.display_name as string) || null,
    avatarUrl: (m.avatar_url as string) || null,
    joinedAt: m.joined_at as string,
  }));
}

export async function removeRoomMember(roomId: string, userId: string): Promise<void> {
  const db = requireClient();
  const { error } = await db.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  if (error) throw error;
}

export async function listPendingInvites(roomId: string): Promise<RoomInvite[]> {
  const db = requireClient();
  const { data, error } = await db
    .from('room_invites')
    .select('id, email, token, created_at, expires_at')
    .eq('room_id', roomId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((i) => ({
    id: i.id,
    email: i.email,
    token: i.token,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
  }));
}

export async function createInvite(roomId: string, email: string, invitedBy: string): Promise<RoomInvite> {
  const db = requireClient();
  const normalized = email.trim().toLowerCase();

  // Replace any earlier pending invite for the same email so the link is always fresh
  await db.from('room_invites').delete().eq('room_id', roomId).ilike('email', normalized).is('accepted_at', null);

  const { data, error } = await db
    .from('room_invites')
    .insert({ room_id: roomId, email: normalized, invited_by: invitedBy })
    .select('id, email, token, created_at, expires_at')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    email: data.email,
    token: data.token,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const db = requireClient();
  const { error } = await db.from('room_invites').delete().eq('id', inviteId);
  if (error) throw error;
}

export async function acceptInvite(token: string): Promise<string> {
  const db = requireClient();
  const { data, error } = await db.rpc('accept_room_invite', { p_token: token });
  if (error) throw error;
  return data as string;
}

export async function claimMyInvites(): Promise<string[]> {
  const db = requireClient();
  const { data, error } = await db.rpc('claim_my_room_invites');
  if (error) throw error;
  return (data as string[]) || [];
}

export function describeInviteError(err: unknown): string {
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  if (message.includes('invite_email_mismatch')) return 'ลิงก์เชิญนี้ออกให้อีเมลอื่น กรุณาเข้าสู่ระบบด้วยอีเมลที่ได้รับเชิญ';
  if (message.includes('invite_expired')) return 'ลิงก์เชิญหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากเจ้าของห้อง';
  if (message.includes('invite_used')) return 'ลิงก์เชิญนี้ถูกใช้ไปแล้ว';
  if (message.includes('invite_not_found')) return 'ไม่พบลิงก์เชิญ หรือถูกยกเลิกแล้ว';
  return 'ไม่สามารถเข้าร่วมห้องได้ กรุณาลองใหม่';
}

// ---------- Realtime ----------
// Fires when anything in the given room changes (readings or room settings)
export function subscribeToRoom(
  roomId: string,
  isKnownReadingId: (id: string) => boolean,
  onChange: () => void
): () => void {
  if (!supabase) return () => {};
  const db = supabase;

  const channel = db
    .channel(`room_${roomId}_${crypto.randomUUID().slice(0, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'readings', filter: `room_id=eq.${roomId}` }, onChange)
    // DELETE events can't be filtered under RLS; only the primary key is sent
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'readings' }, (payload) => {
      const id = (payload.old as { id?: string })?.id;
      if (id && isKnownReadingId(id)) onChange();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
    .subscribe();

  return () => {
    db.removeChannel(channel);
  };
}

// Fires when the user gains or loses access to any room
export function subscribeToMyMemberships(userId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const db = supabase;

  const channel = db
    .channel(`members_${userId}_${crypto.randomUUID().slice(0, 8)}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_members', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_members' }, onChange)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms' }, onChange)
    .subscribe();

  return () => {
    db.removeChannel(channel);
  };
}
