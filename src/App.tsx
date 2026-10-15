import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import type { MeterReading, UserSettings, MeterType, UserRole, AuthUser, SyncStatus, RoomSummary } from './types';
import { 
  loadReadings, 
  loadReadingsAsync,
  saveReadings, 
  loadSettings, 
  loadSettingsAsync,
  saveSettings, 
  exportToCSV, 
  generateSampleData,
  isTourCompleted,
  DEFAULT_SETTINGS 
} from './utils/storage';
import { calculateCycleSummary } from './utils/projection';
import { startProductTour } from './utils/tour';
import { preloadOCRWorker } from './utils/ocrService';
import { subscribeToAuth, logoutUser } from './utils/authService';
import {
  listMyRooms,
  createRoom,
  fetchRoomReadings,
  fetchRoomSettings,
  saveRoomSettings,
  syncRoomReadings,
  subscribeToRoom,
  subscribeToMyMemberships,
  acceptInvite,
  claimMyInvites,
  describeInviteError,
  captureInviteTokenFromUrl,
  clearPendingInviteToken,
  getStoredActiveRoomId,
  storeActiveRoomId,
  mergeRoomSettings,
  readingFingerprint,
  sharedSettingsKey,
} from './utils/roomService';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HeroRealtimeCards } from './components/HeroRealtimeCards';
import { HistoryTable } from './components/HistoryTable';
import { ApplianceSimulator } from './components/ApplianceSimulator';
import { RecordMeterModal } from './components/RecordMeterModal';
import { SettingsModal } from './components/SettingsModal';
import { BillSlipModal } from './components/BillSlipModal';
import { ShareModal } from './components/ShareModal';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';

// Re-applies local, not-yet-pushed edits on top of fresh server readings
const readingsKey = (list: MeterReading[]) => list.map(readingFingerprint).join('\n');

function rebaseReadings(local: MeterReading[], synced: MeterReading[], remote: MeterReading[]): MeterReading[] {
  const syncedById = new Map(synced.map((r) => [r.id, readingFingerprint(r)]));
  const localById = new Map(local.map((r) => [r.id, r]));

  const added = local.filter((r) => !syncedById.has(r.id));
  const merged = remote
    .filter((r) => !(syncedById.has(r.id) && !localById.has(r.id)))
    .map((r) => {
      const mine = localById.get(r.id);
      return mine && readingFingerprint(mine) !== syncedById.get(r.id) ? mine : r;
    });
  const remoteIds = new Set(merged.map((r) => r.id));
  return [...added.filter((r) => !remoteIds.has(r.id)), ...merged];
}

export function App() {
  const [readings, setReadings] = useState<MeterReading[]>(() => loadReadings());
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'simulator'>('dashboard');

  // Theme state ('light' | 'dark')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jodbill_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('jodbill_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      showToast(next === 'dark' ? '🌙 เปลี่ยนเป็นโหมดมืด (Dark Mode)' : '☀️ เปลี่ยนเป็นโหมดสว่าง (Light Mode)');
      return next;
    });
  };

  // Cloud Auth & Sync state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unauthenticated');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'app' | 'login'>('app');
  const userId = user?.uid ?? null;

  // Rooms the user owns or administers
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [hasPendingInvite] = useState(() => Boolean(captureInviteTokenFromUrl()));
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const currentRole: UserRole = activeRoom?.role ?? 'owner';

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordDefaultType, setRecordDefaultType] = useState<MeterType>('electricity');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillSlipOpen, setIsBillSlipOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Last known server state of the loaded room; local state is diffed against it before pushing
  const loadedRoomIdRef = useRef<string | null>(null);
  const syncedReadingsRef = useRef<MeterReading[]>([]);
  const syncedSettingsJsonRef = useRef('');
  const readingsRef = useRef(readings);
  readingsRef.current = readings;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const applyRemoteRoom = useCallback(
    (roomId: string, remoteReadings: MeterReading[], remoteSettings: Partial<UserSettings> | null) => {
      const isSameRoom = loadedRoomIdRef.current === roomId;
      const nextReadings = isSameRoom
        ? rebaseReadings(readingsRef.current, syncedReadingsRef.current, remoteReadings)
        : remoteReadings;

      const remoteMerged = mergeRoomSettings(settingsRef.current, remoteSettings);
      const hasLocalSettingsEdits =
        isSameRoom && sharedSettingsKey(settingsRef.current) !== syncedSettingsJsonRef.current;
      const nextSettings = hasLocalSettingsEdits ? settingsRef.current : remoteMerged;

      syncedReadingsRef.current = remoteReadings;
      syncedSettingsJsonRef.current = sharedSettingsKey(remoteMerged);
      loadedRoomIdRef.current = roomId;
      setReadings(nextReadings);
      setSettings(nextSettings);
    },
    []
  );

  const pushRoomChanges = useCallback(async (roomId: string, nextReadings: MeterReading[], nextSettings: UserSettings) => {
    const sharedJson = sharedSettingsKey(nextSettings);
    if (nextReadings !== syncedReadingsRef.current) {
      await syncRoomReadings(roomId, nextReadings, syncedReadingsRef.current);
      syncedReadingsRef.current = nextReadings;
    }
    if (sharedJson !== syncedSettingsJsonRef.current) {
      await saveRoomSettings(roomId, nextSettings);
      syncedSettingsJsonRef.current = sharedJson;
    }
  }, []);

  // Persist locally on every change, then push the diff to the active room (debounced)
  useEffect(() => {
    saveReadings(readings);
    saveSettings(settings);

    const roomId = loadedRoomIdRef.current;
    if (!userId || !roomId) return;

    const readingsChanged = readings !== syncedReadingsRef.current;
    const settingsChanged = sharedSettingsKey(settings) !== syncedSettingsJsonRef.current;
    if (!readingsChanged && !settingsChanged) return;

    const timer = setTimeout(() => {
      if (loadedRoomIdRef.current !== roomId) return;
      setSyncStatus('syncing');
      pushRoomChanges(roomId, readings, settings)
        .then(() => {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        })
        .catch(() => setSyncStatus('error'));
    }, 600);

    return () => clearTimeout(timer);
  }, [readings, settings, userId, pushRoomChanges]);

  // Track auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthResolved(true);
      if (currentUser) {
        setCurrentView('app');
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        setSyncStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  // Opening an invite link while logged out sends the user to log in first
  useEffect(() => {
    if (authResolved && !userId && hasPendingInvite) {
      setCurrentView('login');
      showToast('📩 เข้าสู่ระบบด้วยอีเมลที่ได้รับเชิญ เพื่อเข้าร่วมห้อง');
    }
  }, [authResolved, userId, hasPendingInvite, showToast]);

  // Picks a room the user still has access to, creating one if they have none
  const selectRoom = useCallback(
    async (uid: string, list: RoomSummary[], preferredIds: (string | null)[], uploadLocalData: boolean) => {
      let nextList = list;
      if (nextList.length === 0) {
        const base = uploadLocalData ? settingsRef.current : mergeRoomSettings(settingsRef.current, DEFAULT_SETTINGS);
        const newId = await createRoom(uid, base);
        if (uploadLocalData && readingsRef.current.length > 0) {
          await syncRoomReadings(newId, readingsRef.current, []);
        }
        nextList = await listMyRooms(uid);
      }
      setRooms(nextList);
      const target = preferredIds.find((id) => id && nextList.some((r) => r.id === id)) ?? nextList[0]?.id ?? null;
      setActiveRoomId(target);
      return target;
    },
    []
  );

  // On login: accept invites, load the room list and choose the active room
  useEffect(() => {
    if (!userId) {
      setRooms([]);
      setActiveRoomId(null);
      loadedRoomIdRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      setSyncStatus('syncing');

      let joinedRoomId: string | null = null;
      const token = captureInviteTokenFromUrl();
      if (token) {
        try {
          joinedRoomId = await acceptInvite(token);
          showToast('🎉 เข้าร่วมห้องสำเร็จ คุณเป็นผู้ดูแลห้องนี้แล้ว');
        } catch (err) {
          showToast(describeInviteError(err));
        }
        clearPendingInviteToken();
      }

      try {
        const claimed = await claimMyInvites();
        if (claimed.length > 0 && !joinedRoomId) {
          joinedRoomId = claimed[0];
          showToast(`🎉 คุณได้รับสิทธิ์ผู้ดูแล ${claimed.length} ห้องใหม่`);
        }
      } catch {
        // invites are optional; ignore failures
      }

      const list = await listMyRooms(userId);
      if (cancelled) return;
      await selectRoom(userId, list, [joinedRoomId, getStoredActiveRoomId()], true);
    })().catch(() => setSyncStatus('error'));

    return () => {
      cancelled = true;
    };
  }, [userId, selectRoom, showToast]);

  // Live room list: react to being added to / removed from rooms
  useEffect(() => {
    if (!userId) return;
    return subscribeToMyMemberships(userId, () => {
      listMyRooms(userId)
        .then((list) => {
          setRooms(list);
          const current = loadedRoomIdRef.current;
          if (current && !list.some((r) => r.id === current)) {
            showToast('ห้องนี้ถูกลบ หรือคุณถูกนำออกจากผู้ดูแลแล้ว');
            loadedRoomIdRef.current = null;
            return selectRoom(userId, list, [], false);
          }
        })
        .catch(() => {});
    });
  }, [userId, selectRoom, showToast]);

  // Load the active room and keep it in sync in real time
  useEffect(() => {
    if (!userId || !activeRoomId) return;
    const roomId = activeRoomId;
    storeActiveRoomId(roomId);

    let cancelled = false;
    const load = async (isRemoteUpdate: boolean) => {
      const [remoteReadings, remoteSettings] = await Promise.all([
        fetchRoomReadings(roomId),
        fetchRoomSettings(roomId),
      ]);
      if (cancelled) return;

      const changed =
        loadedRoomIdRef.current !== roomId ||
        readingsKey(remoteReadings) !== readingsKey(syncedReadingsRef.current) ||
        sharedSettingsKey(mergeRoomSettings(settingsRef.current, remoteSettings)) !== syncedSettingsJsonRef.current;

      if (changed) {
        applyRemoteRoom(roomId, remoteReadings, remoteSettings);
        if (isRemoteUpdate) showToast('⚡ ข้อมูลห้องอัปเดตจากผู้ดูแลคนอื่นแบบ Real-time');
      }
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    };

    setSyncStatus('syncing');
    load(false).catch(() => setSyncStatus('error'));

    const unsubscribe = subscribeToRoom(
      roomId,
      (id) => syncedReadingsRef.current.some((r) => r.id === id),
      () => {
        if (loadedRoomIdRef.current !== roomId) return;
        load(true).catch(() => {});
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, activeRoomId, applyRemoteRoom, showToast]);

  // Async IndexedDB hydration (guarantees no data loss even after heavy sessions)
  useEffect(() => {
    loadReadingsAsync().then((idbReadings) => {
      // Once a cloud room is loaded it is the source of truth
      if (loadedRoomIdRef.current) return;
      if (idbReadings && idbReadings.length > 0) {
        setReadings((prev) => {
          if (prev.length === 0) return idbReadings;
          const existingIds = new Set(prev.map((r) => r.id));
          const missing = idbReadings.filter((r) => !existingIds.has(r.id));
          return missing.length > 0 ? [...prev, ...missing] : prev;
        });
      }
    });

    loadSettingsAsync().then((idbSettings) => {
      if (loadedRoomIdRef.current) return;
      if (idbSettings) {
        setSettings((prev) => ({ ...prev, ...idbSettings }));
      }
    });

    // Warm up OCR engine in background
    setTimeout(() => {
      preloadOCRWorker();
    }, 800);
  }, []);

  const handleSwitchRoom = (roomId: string) => {
    loadedRoomIdRef.current = null;
    setActiveRoomId(roomId);
  };

  const handleCreateRoom = async () => {
    if (!userId) {
      setCurrentView('login');
      return;
    }
    try {
      const base = mergeRoomSettings(settingsRef.current, { ...DEFAULT_SETTINGS, dormName: 'ห้องใหม่', roomNumber: '' });
      const newId = await createRoom(userId, base);
      setRooms(await listMyRooms(userId));
      loadedRoomIdRef.current = null;
      applyRemoteRoom(newId, [], base);
      setActiveRoomId(newId);
      setIsSettingsOpen(true);
      showToast('สร้างห้องใหม่แล้ว ตั้งชื่อหอและเลขห้องได้เลย');
    } catch {
      showToast('สร้างห้องไม่สำเร็จ กรุณาลองใหม่');
    }
  };

  const handleRoomRemoved = (roomId: string) => {
    if (!userId) return;
    if (loadedRoomIdRef.current === roomId) loadedRoomIdRef.current = null;
    listMyRooms(userId)
      .then((list) => selectRoom(userId, list.filter((r) => r.id !== roomId), [], false))
      .then(() => showToast('ออกจากห้องแล้ว'))
      .catch(() => {});
  };

  // Show the live name of the active room in the switcher
  const displayRooms = useMemo(
    () =>
      rooms.map((r) =>
        r.id === activeRoomId ? { ...r, dormName: settings.dormName, roomNumber: settings.roomNumber } : r
      ),
    [rooms, activeRoomId, settings.dormName, settings.roomNumber]
  );

  // First-time tour check
  useEffect(() => {
    const tourDone = isTourCompleted();
    if (!tourDone) {
      const timer = setTimeout(() => {
        startProductTour();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const cycleSummary = useMemo(() => {
    return calculateCycleSummary(readings, settings);
  }, [readings, settings]);

  const handleSaveReading = (newReadingData: Omit<MeterReading, 'id'>) => {
    const newReading: MeterReading = {
      ...newReadingData,
      id: `reading-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };

    setReadings((prev) => [newReading, ...prev]);
    showToast(`บันทึกมิเตอร์${newReading.meterType === 'electricity' ? 'ไฟฟ้า' : 'น้ำประปา'}แล้ว`);
  };

  const handleDeleteReading = (id: string) => {
    setReadings((prev) => prev.filter((r) => r.id !== id));
    showToast('ลบรายการบันทึกแล้ว');
  };

  const handleExportCSV = () => {
    if (readings.length === 0) {
      showToast('ยังไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    exportToCSV(readings, settings);
    showToast('ส่งออกไฟล์ CSV สำเร็จแล้ว!');
  };

  const handleLoadDemoData = () => {
    const demo = generateSampleData();
    setReadings(demo);
    showToast('โหลดข้อมูลตัวอย่างสำเร็จ');
  };

  const handleClearAllData = () => {
    setReadings([]);
    showToast('ล้างข้อมูลมิเตอร์ทั้งหมดแล้ว');
  };

  const handleImportBackup = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.readings && Array.isArray(parsed.readings)) {
        setReadings(parsed.readings);
      }
      if (parsed.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      }
      showToast('กู้คืนข้อมูลสำเร็จ');
    } catch {
      alert('ไฟล์ JSON ไม่ถูกต้อง');
    }
  };

  const openRecordModal = (type: MeterType = 'electricity') => {
    setRecordDefaultType(type);
    setIsRecordModalOpen(true);
  };

  const handleStartTour = () => {
    setActiveTab('dashboard');
    setTimeout(() => {
      startProductTour();
    }, 100);
  };

  const handleForceSyncNow = async () => {
    const roomId = loadedRoomIdRef.current;
    if (!userId || !roomId) return;
    setSyncStatus('syncing');
    try {
      await pushRoomChanges(roomId, readingsRef.current, settingsRef.current);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    } catch {
      setSyncStatus('error');
      throw new Error('Sync failed');
    }
  };

  const handlePullCloudData = async () => {
    const roomId = loadedRoomIdRef.current;
    if (!userId || !roomId) return;
    setSyncStatus('syncing');
    try {
      const [remoteReadings, remoteSettings] = await Promise.all([
        fetchRoomReadings(roomId),
        fetchRoomSettings(roomId),
      ]);
      // Explicit pull discards local unsynced edits
      loadedRoomIdRef.current = null;
      applyRemoteRoom(roomId, remoteReadings, remoteSettings);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      showToast('☁️ ดึงข้อมูลล่าสุดจากคลาวด์สำเร็จ');
    } catch {
      setSyncStatus('error');
    }
  };

  // Dedicated Login Page View
  if (currentView === 'login') {
    return (
      <div className="relative">
        <LoginPage
          onLoginSuccess={(loggedUser) => {
            setUser(loggedUser);
            setCurrentView('app');
          }}
          onContinueAsGuest={() => setCurrentView('app')}
          showToast={showToast}
        />
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-lg flex items-center gap-1.5 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  const handleOpenAuth = () => {
    if (user) {
      setIsAuthModalOpen(true);
    } else {
      setCurrentView('login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-row selection:bg-amber-100 selection:text-amber-900">
      {/* Desktop Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        currentRole={currentRole}
        readingsCount={readings.length}
        user={user}
        syncStatus={syncStatus}
        onOpenRecordModal={openRecordModal}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenBillSlip={() => setIsBillSlipOpen(true)}
        onExportCSV={handleExportCSV}
        onStartTour={handleStartTour}
        onOpenAuth={handleOpenAuth}
        onLogout={async () => {
          await logoutUser();
          setUser(null);
          showToast('ออกจากระบบสำเร็จ');
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settings={settings}
          currentRole={currentRole}
          user={user}
          syncStatus={syncStatus}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenRecordModal={openRecordModal}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenShare={() => setIsShareModalOpen(true)}
          onOpenBillSlip={() => setIsBillSlipOpen(true)}
          onExportCSV={handleExportCSV}
          onStartTour={handleStartTour}
          onOpenAuth={handleOpenAuth}
          onLogout={async () => {
            await logoutUser();
            setUser(null);
            showToast('ออกจากระบบสำเร็จ');
          }}
          rooms={displayRooms}
          activeRoomId={activeRoomId}
          onSwitchRoom={handleSwitchRoom}
          onCreateRoom={handleCreateRoom}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 pb-24 md:pb-8 space-y-6">
          {/* ================= TAB 1: DASHBOARD ================= */}
          {activeTab === 'dashboard' && (
            <HeroRealtimeCards
              summary={cycleSummary}
              settings={settings}
              readings={readings}
              onOpenRecord={openRecordModal}
              onOpenBillSlip={() => setIsBillSlipOpen(true)}
              onOpenShare={() => setIsShareModalOpen(true)}
              hasReadings={readings.length > 0}
            />
          )}

          {/* ================= TAB 2: HISTORY TABLE ================= */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              <HistoryTable
                readings={readings}
                settings={settings}
                currentRole={currentRole}
                onDeleteReading={handleDeleteReading}
                onOpenRecord={openRecordModal}
                onExportCSV={handleExportCSV}
              />
            </div>
          )}

          {/* ================= TAB 3: APPLIANCE SIMULATOR ================= */}
          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <ApplianceSimulator settings={settings} />
            </div>
          )}
        </main>

        {/* Mobile Bottom Navigation Dock */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentRole={currentRole}
          onOpenRecordModal={openRecordModal}
          onOpenBillSlip={() => setIsBillSlipOpen(true)}
        />
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        user={user}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onSyncNow={handleForceSyncNow}
        onPullCloudData={handlePullCloudData}
        onAuthChange={(u) => setUser(u)}
        showToast={showToast}
      />

      <RecordMeterModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        defaultType={recordDefaultType}
        readings={readings}
        settings={settings}
        onSaveReading={handleSaveReading}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          showToast('บันทึกการตั้งค่าแล้ว');
        }}
        onLoadDemoData={handleLoadDemoData}
        onClearAllData={handleClearAllData}
        onImportBackup={handleImportBackup}
      />

      <BillSlipModal
        isOpen={isBillSlipOpen}
        onClose={() => setIsBillSlipOpen(false)}
        summary={cycleSummary}
        settings={settings}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        user={user}
        room={displayRooms.find((r) => r.id === activeRoomId) ?? null}
        onRequireLogin={() => {
          setIsShareModalOpen(false);
          setCurrentView('login');
        }}
        onRoomRemoved={handleRoomRemoved}
        showToast={showToast}
      />

      {/* Toast Alert matching the reference alert card at bottom-right */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-3.5 rounded-2xl bg-white border border-rose-200/90 shadow-lg text-slate-800 flex items-start gap-3 max-w-sm animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
            !
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900">
              สถานะระบบ
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              {toastMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-sm ml-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
export default App;
