import { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Droplets, 
  Plus, 
  ArrowRight, 
  Calculator, 
  History as HistoryIcon, 
  Sparkles,
  RotateCcw,
  Camera
} from 'lucide-react';
import type { MeterReading, UserSettings, MeterType } from './types';
import { 
  loadReadings, 
  saveReadings, 
  loadSettings, 
  saveSettings, 
  exportToCSV, 
  generateSampleData,
  isTourCompleted,
  DEFAULT_SETTINGS 
} from './utils/storage';
import { calculateCycleSummary } from './utils/projection';
import { startProductTour } from './utils/tour';
import { Header } from './components/Header';
import { HeroRealtimeCards } from './components/HeroRealtimeCards';
import { ChartsSection } from './components/ChartsSection';
import { HistoryTable } from './components/HistoryTable';
import { ApplianceSimulator } from './components/ApplianceSimulator';
import { RecordMeterModal } from './components/RecordMeterModal';
import { SettingsModal } from './components/SettingsModal';
import { BillSlipModal } from './components/BillSlipModal';

export function App() {
  const [readings, setReadings] = useState<MeterReading[]>(() => loadReadings());
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'simulator'>('dashboard');

  // Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordDefaultType, setRecordDefaultType] = useState<MeterType>('electricity');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBillSlipOpen, setIsBillSlipOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    saveReadings(readings);
  }, [readings]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // First-time tour check
  useEffect(() => {
    const tourDone = isTourCompleted();
    if (!tourDone) {
      const timer = setTimeout(() => {
        startProductTour();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onOpenRecordModal={openRecordModal}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBillSlip={() => setIsBillSlipOpen(true)}
        onExportCSV={handleExportCSV}
        onStartTour={handleStartTour}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ================= TAB 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {/* Empty State Welcome Card (Shown only when readings count is 0) */}
            {readings.length === 0 && (
              <div className="clean-card p-6 sm:p-8 text-center bg-white border-dashed border-2 border-slate-200 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    ยังไม่มีข้อมูลมิเตอร์ในระบบ
                  </h3>
                  <p className="text-xs text-slate-500">
                    เริ่มต้นด้วยการถ่ายรูปหรือพิมพ์เลขหน้าปัดมิเตอร์ไฟฟ้า/น้ำรอบปัจจุบันเพื่อเริ่มคำนวณบิล
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    onClick={() => openRecordModal('electricity')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>จดมิเตอร์ครั้งแรก</span>
                  </button>
                  <button
                    onClick={handleLoadDemoData}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ลองใส่ข้อมูลตัวอย่าง</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hero Real-time Cards */}
            <HeroRealtimeCards
              summary={cycleSummary}
              settings={settings}
              onOpenRecord={openRecordModal}
              hasReadings={readings.length > 0}
            />

            {/* Action Shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => openRecordModal('electricity')}
                className="clean-card clean-card-hover p-4 flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                    <Zap className="w-4 h-4 fill-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">ถ่ายรูปมิเตอร์ไฟ</h4>
                    <span className="text-[11px] text-slate-500">สแกนตัวเลขด้วย OCR</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-700 transition-all" />
              </button>

              <button
                onClick={() => openRecordModal('water')}
                className="clean-card clean-card-hover p-4 flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-200/60">
                    <Droplets className="w-4 h-4 fill-cyan-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">ถ่ายรูปมิเตอร์น้ำ</h4>
                    <span className="text-[11px] text-slate-500">บันทึกค่าน้ำประปา</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-700 transition-all" />
              </button>

              <button
                onClick={() => setActiveTab('simulator')}
                className="clean-card clean-card-hover p-4 flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">คำนวณค่าไฟแอร์</h4>
                    <span className="text-[11px] text-slate-500">เปิดกี่ ชม. กินไฟกี่บาท</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-700 transition-all" />
              </button>
            </div>

            {/* Interactive Charts */}
            <ChartsSection readings={readings} settings={settings} />

            {/* Recent Readings Table Preview */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <HistoryIcon className="w-3.5 h-3.5 text-slate-500" />
                  บันทึกล่าสุด
                </h3>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>ดูประวัติทั้งหมด ({readings.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <HistoryTable
                readings={readings.slice(0, 5)}
                settings={settings}
                onDeleteReading={handleDeleteReading}
                onOpenRecord={openRecordModal}
                onExportCSV={handleExportCSV}
              />
            </div>
          </div>
        )}

        {/* ================= TAB 2: HISTORY ================= */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <HistoryTable
              readings={readings}
              settings={settings}
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

      {/* Floating Mobile Record Button */}
      <div className="fixed right-4 bottom-5 z-40 sm:hidden">
        <button
          onClick={() => openRecordModal('electricity')}
          className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-slate-900 text-white font-bold text-xs shadow-lg active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>จดบิล</span>
        </button>
      </div>

      {/* Modals */}
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
export default App;
