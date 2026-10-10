import { useState, useEffect, useMemo, useCallback } from 'react';
import { Eye, Sparkles } from 'lucide-react';
import type { MeterReading, UserSettings, MeterType, UserRole, AuthUser, SyncStatus } from './types';
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
import { checkUrlForShare, clearShareUrlParams } from './utils/shareService';
import { preloadOCRWorker } from './utils/ocrService';
import { 
  subscribeToAuth, 
  pushUserDataToCloud, 
  fetchUserDataFromCloud,
  logoutUser 
} from './utils/authService';
import { subscribeToRoomRealtime } from './utils/supabase';
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

export function App() {
  const [readings, setReadings] = useState<MeterReading[]>(() => loadReadings());
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'simulator'>('dashboard');

  // Cloud Auth & Sync state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unauthenticated');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'app' | 'login'>('app');

  // Role permissions: 'owner' | 'editor' | 'viewer'
  const currentRole: UserRole = settings.currentRole || 'owner';

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordDefaultType, setRecordDefaultType] = useState<MeterType>('electricity');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillSlipOpen, setIsBillSlipOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Sync state to LocalStorage & IndexedDB on changes + Cloud Firestore
  useEffect(() => {
    saveReadings(readings);
    if (user) {
      setSyncStatus('syncing');
      pushUserDataToCloud(user.uid, { readings, settings })
        .then((ok) => {
          if (ok) {
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
          }
        })
        .catch(() => setSyncStatus('error'));
    }
  }, [readings, user, settings]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Handle Cloud Sync on User Authentication Change
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setCurrentView('app');
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setSyncStatus('syncing');
        fetchUserDataFromCloud(currentUser.uid).then((cloudData) => {
          if (cloudData) {
            if (cloudData.readings && cloudData.readings.length > 0) {
              setReadings(cloudData.readings);
              saveReadings(cloudData.readings);
            }
            if (cloudData.settings) {
              setSettings((prev) => {
                const merged = { ...prev, ...cloudData.settings };
                saveSettings(merged);
                return merged;
              });
            }
            showToast(`☁️ ดึงข้อมูลคลาวด์ของ ${currentUser.displayName || 'Google'} สำเร็จ`);
          }
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        }).catch(() => {
          setSyncStatus('synced');
        });
      } else {
        setSyncStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, [showToast]);

  // Real-time Supabase listener (auto syncs when roommates record a meter on their device)
  useEffect(() => {
    if (!user) return;
    const unsubRealtime = subscribeToRoomRealtime('default-room', () => {
      fetchUserDataFromCloud(user.uid).then((cloudData) => {
        if (cloudData) {
          if (cloudData.readings && cloudData.readings.length > 0) {
            setReadings(cloudData.readings);
            saveReadings(cloudData.readings);
          }
          if (cloudData.settings) {
            setSettings((prev) => {
              const merged = { ...prev, ...cloudData.settings };
              saveSettings(merged);
              return merged;
            });
          }
          showToast('⚡ ได้รับข้อมูลมิเตอร์อัปเดตแบบ Real-time');
        }
      });
    });

    return () => unsubRealtime();
  }, [user, showToast]);

  // Async IndexedDB hydration (guarantees no data loss even after heavy sessions)
  useEffect(() => {
    loadReadingsAsync().then((idbReadings) => {
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
      if (idbSettings) {
        setSettings((prev) => ({ ...prev, ...idbSettings }));
      }
    });

    // Warm up OCR engine in background
    setTimeout(() => {
      preloadOCRWorker();
    }, 800);
  }, []);

  // Check if opened via room share link
  useEffect(() => {
    const shared = checkUrlForShare();
    if (shared) {
      if (shared.readings && shared.readings.length > 0) {
        setReadings(shared.readings);
        saveReadings(shared.readings);
      }
      if (shared.settings) {
        const nextSettings = {
          ...settings,
          ...shared.settings,
          currentRole: shared.role,
        };
        setSettings(nextSettings);
        saveSettings(nextSettings);
      }
      clearShareUrlParams();
      showToast(
        `📥 นำเข้าห้อง "${shared.settings.dormName || 'หอพัก'}" สำเร็จ (สิทธิ์: ${
          shared.role === 'viewer' ? 'ดูอย่างเดียว' : 'ผู้ร่วมจด'
        })`
      );
    }
  }, [settings, showToast]);

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
    if (currentRole === 'viewer') {
      setIsShareModalOpen(true);
      showToast('⚠️ คุณอยู่ในโหมดดูอย่างเดียว กรุณาใส่รหัส PIN เพื่อปลดล็อกสิทธิ์จดมิเตอร์');
      return;
    }

    const newReading: MeterReading = {
      ...newReadingData,
      id: `reading-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };

    const nextReadings = [newReading, ...readings];
    setReadings(nextReadings);
    saveReadings(nextReadings);
    showToast(`บันทึกมิเตอร์${newReading.meterType === 'electricity' ? 'ไฟฟ้า' : 'น้ำประปา'}แล้ว`);
  };

  const handleDeleteReading = (id: string) => {
    if (currentRole === 'viewer') {
      showToast('⚠️ ไม่อนุญาตให้ลบข้อมูลในโหมดดูอย่างเดียว');
      return;
    }
    const nextReadings = readings.filter((r) => r.id !== id);
    setReadings(nextReadings);
    saveReadings(nextReadings);
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
    if (currentRole === 'viewer') {
      setIsShareModalOpen(true);
      showToast('⚠️ คุณอยู่ในโหมดดูอย่างเดียว กรุณาใส่รหัส PIN เพื่อปลดล็อกสิทธิ์ร่วมจด');
      return;
    }
    setRecordDefaultType(type);
    setIsRecordModalOpen(true);
  };

  const handleUpgradeRole = (newRole: UserRole) => {
    setSettings((prev) => ({ ...prev, currentRole: newRole }));
    showToast(`🎉 อัปเกรดสิทธิ์เป็น "${newRole === 'editor' ? 'ผู้ร่วมจด' : 'เจ้าของห้อง'}" เรียบร้อยแล้ว`);
  };

  const handleStartTour = () => {
    setActiveTab('dashboard');
    setTimeout(() => {
      startProductTour();
    }, 100);
  };

  const handleForceSyncNow = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    const ok = await pushUserDataToCloud(user.uid, { readings, settings });
    if (ok) {
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    } else {
      setSyncStatus('error');
      throw new Error('Sync failed');
    }
  };

  const handlePullCloudData = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    const cloudData = await fetchUserDataFromCloud(user.uid);
    if (cloudData) {
      if (cloudData.readings && cloudData.readings.length > 0) {
        setReadings(cloudData.readings);
        saveReadings(cloudData.readings);
      }
      if (cloudData.settings) {
        const merged = { ...settings, ...cloudData.settings };
        setSettings(merged);
        saveSettings(merged);
      }
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    } else {
      setSyncStatus('synced');
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
        {/* Viewer Notice Header Banner if in Read-Only Mode */}
        {currentRole === 'viewer' && (
          <div className="bg-amber-500/10 border-b border-amber-200/80 px-4 py-2 text-center text-xs text-amber-900 flex items-center justify-center gap-2">
            <Eye className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>คุณกำลังเปิดดูในโหมด <strong>"ดูอย่างเดียว (Viewer)"</strong></span>
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="underline font-bold text-amber-800 hover:text-amber-950 cursor-pointer ml-1"
            >
              ใส่รหัส PIN เพื่อร่วมจดมิเตอร์
            </button>
          </div>
        )}

        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          settings={settings}
          currentRole={currentRole}
          user={user}
          syncStatus={syncStatus}
          onOpenRecordModal={openRecordModal}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenShare={() => setIsShareModalOpen(true)}
          onOpenBillSlip={() => setIsBillSlipOpen(true)}
          onExportCSV={handleExportCSV}
          onStartTour={handleStartTour}
          onOpenAuth={handleOpenAuth}
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
        settings={settings}
        readings={readings}
        currentRole={currentRole}
        onUpgradeRole={handleUpgradeRole}
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
