import LZString from 'lz-string';
import type { UserRole, UserSettings, MeterReading, SharePayload, RoomShareConfig } from '../types';

const PERSISTENT_ROOM_SHARE_KEY = 'jodbill_persistent_room_share';

export function generateRoomConfig(dormName: string, roomNumber: string): RoomShareConfig {
  const cleanRoom = roomNumber.replace(/[^a-zA-Z0-9]/g, '') || '101';
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const roomId = `JOD-${cleanRoom}-${randSuffix}`;

  const editorPin = Math.floor(1000 + Math.random() * 9000).toString();
  const viewerPin = Math.floor(1000 + Math.random() * 9000).toString();

  return {
    roomId,
    editorPin,
    viewerPin,
    roomName: `${dormName || 'หอพัก'} ห้อง ${roomNumber || '101'}`.trim(),
    createdAt: new Date().toISOString(),
  };
}

// Guarantees room code is STABLE and NEVER re-generates randomly on re-renders
export function getOrInitRoomConfig(settings: UserSettings): RoomShareConfig {
  if (settings.roomShare?.roomId) {
    return settings.roomShare;
  }

  try {
    const cached = localStorage.getItem(PERSISTENT_ROOM_SHARE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as RoomShareConfig;
      if (parsed?.roomId) {
        settings.roomShare = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore json error
  }

  // Generate once and persist forever in localStorage
  const newConfig = generateRoomConfig(settings.dormName, settings.roomNumber);
  try {
    localStorage.setItem(PERSISTENT_ROOM_SHARE_KEY, JSON.stringify(newConfig));
  } catch {
    // ignore quota error
  }
  settings.roomShare = newConfig;
  return newConfig;
}

export function createSharePayload(
  settings: UserSettings,
  readings: MeterReading[],
  role: UserRole,
  forcedRoomConfig?: RoomShareConfig
): string {
  const roomConfig = forcedRoomConfig || getOrInitRoomConfig(settings);

  // Strip sensitive local API keys when sharing with viewers or co-tenants
  const cleanSettings: Partial<UserSettings> = {
    dormName: settings.dormName,
    roomNumber: settings.roomNumber,
    monthlyRent: settings.monthlyRent,
    billingCutoffDay: settings.billingCutoffDay,
    budgetElectricity: settings.budgetElectricity,
    budgetWater: settings.budgetWater,
    rateConfig: settings.rateConfig,
    soundEnabled: settings.soundEnabled,
    theme: settings.theme,
    roomShare: roomConfig,
    currentRole: role,
  };

  // Strip large photo base64 strings to keep URL link super lightweight & fast if needed
  const lightReadings: MeterReading[] = readings.slice(-50).map((r) => ({
    ...r,
    photoUrl: undefined, // keep URL short for chat/QR scanning
  }));

  const payload: SharePayload = {
    version: 2,
    roomId: roomConfig.roomId,
    role,
    settings: cleanSettings,
    readings: lightReadings,
    exportedAt: new Date().toISOString(),
    editorPin: role === 'editor' ? roomConfig.editorPin : undefined,
  };

  const json = JSON.stringify(payload);
  return LZString.compressToEncodedURIComponent(json);
}

export function parseSharePayload(compressedData: string): SharePayload | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressedData);
    if (!json) return null;
    const payload = JSON.parse(json) as SharePayload;
    if (!payload.roomId || !payload.settings) return null;
    return payload;
  } catch (err) {
    console.error('Failed to parse share payload:', err);
    return null;
  }
}

export function generateShareLinks(
  settings: UserSettings,
  readings: MeterReading[]
): { viewerUrl: string; editorUrl: string; roomId: string; editorPin: string } {
  const baseUrl = window.location.origin + window.location.pathname;
  const roomConfig = getOrInitRoomConfig(settings);

  const viewerPayload = createSharePayload(settings, readings, 'viewer', roomConfig);
  const editorPayload = createSharePayload(settings, readings, 'editor', roomConfig);

  const viewerUrl = `${baseUrl}?share=${viewerPayload}&role=viewer`;
  const editorUrl = `${baseUrl}?share=${editorPayload}&role=editor`;

  return {
    viewerUrl,
    editorUrl,
    roomId: roomConfig.roomId,
    editorPin: roomConfig.editorPin,
  };
}

export function checkUrlForShare(): SharePayload | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    if (!shareParam) return null;

    const parsed = parseSharePayload(shareParam);
    if (parsed) {
      const explicitRole = urlParams.get('role') as UserRole;
      if (explicitRole === 'viewer' || explicitRole === 'editor') {
        parsed.role = explicitRole;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearShareUrlParams(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    url.searchParams.delete('role');
    window.history.replaceState({}, document.title, url.pathname);
  } catch (e) {
    console.warn('Could not clear URL parameters:', e);
  }
}
