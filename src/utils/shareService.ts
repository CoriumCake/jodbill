import LZString from 'lz-string';
import type { UserRole, UserSettings, MeterReading, SharePayload, RoomShareConfig } from '../types';

export function generateRoomConfig(dormName: string, roomNumber: string): RoomShareConfig {
  const cleanRoom = roomNumber.replace(/[^a-zA-Z0-9]/g, '') || 'ROOM';
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const roomId = `JOD-${cleanRoom}-${randSuffix}`;

  const editorPin = Math.floor(1000 + Math.random() * 9000).toString();
  const viewerPin = Math.floor(1000 + Math.random() * 9000).toString();

  return {
    roomId,
    editorPin,
    viewerPin,
    roomName: `${dormName || 'หอพัก'} ห้อง ${roomNumber || ''}`.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function createSharePayload(
  settings: UserSettings,
  readings: MeterReading[],
  role: UserRole
): string {
  const roomConfig = settings.roomShare || generateRoomConfig(settings.dormName, settings.roomNumber);

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
  const roomConfig = settings.roomShare || generateRoomConfig(settings.dormName, settings.roomNumber);

  const viewerPayload = createSharePayload(settings, readings, 'viewer');
  const editorPayload = createSharePayload(settings, readings, 'editor');

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
