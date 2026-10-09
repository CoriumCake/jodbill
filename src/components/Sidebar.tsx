import React from 'react';
import { 
  Zap, 
  Droplets, 
  Plus, 
  Download, 
  Settings as SettingsIcon, 
  Calculator, 
  History as HistoryIcon, 
  LayoutDashboard,
  Building2,
  FileText,
  HelpCircle,
  Share2,
  Eye,
  Edit3,
  ShieldCheck,
  Sparkles,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import type { UserSettings, UserRole, AuthUser, SyncStatus } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'history' | 'simulator';
  setActiveTab: (tab: 'dashboard' | 'history' | 'simulator') => void;
  settings: UserSettings;
  currentRole: UserRole;
  readingsCount: number;
  user: AuthUser | null;
  syncStatus: SyncStatus;
  onOpenRecordModal: (type?: 'electricity' | 'water') => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  onOpenBillSlip: () => void;
  onExportCSV: () => void;
  onStartTour: () => void;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  currentRole,
  readingsCount,
  user,
  syncStatus: _syncStatus,
  onOpenRecordModal,
  onOpenSettings,
  onOpenShare,
  onOpenBillSlip,
  onExportCSV,
  onStartTour,
  onOpenAuth,
}) => {
  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200/80 shrink-0 select-none h-screen sticky top-0">
      {/* Brand & Room Info Header */}
      <div className="p-5 pb-3 border-b border-slate-100 space-y-3">
        <div id="tour-brand" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900 text-white shadow-sm ring-4 ring-slate-100 shrink-0">
            <div className="flex items-center -space-x-1">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <Droplets className="w-3.5 h-3.5 text-cyan-300 fill-cyan-300" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-slate-900 font-display">
                jodbill
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200/60">
                จดบิล
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">คำนวณค่าน้ำ-ไฟหอพัก Real-time</p>
          </div>
        </div>

        {/* Room Card Badge */}
        <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0 shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">
                {settings.dormName || 'หอพักของฉัน'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                ห้อง <span className="font-semibold text-slate-700">{settings.roomNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Role Status Tag */}
          <button
            type="button"
            onClick={onOpenShare}
            title={currentRole === 'viewer' ? 'คลิกเพื่อปลดล็อกสิทธิ์' : 'จัดการการแชร์ห้อง'}
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium cursor-pointer transition-all shrink-0 ${
              currentRole === 'viewer'
                ? 'bg-amber-100/80 text-amber-800 hover:bg-amber-200 border border-amber-300/80'
                : currentRole === 'editor'
                ? 'bg-blue-100/80 text-blue-800 hover:bg-blue-200 border border-blue-300/80'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
            }`}
          >
            {currentRole === 'viewer' ? (
              <>
                <Eye className="w-2.5 h-2.5 text-amber-700" />
                <span>ดูอย่างเดียว</span>
              </>
            ) : currentRole === 'editor' ? (
              <>
                <Edit3 className="w-2.5 h-2.5 text-blue-700" />
                <span>ผู้ร่วมจด</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                <span>เจ้าของ</span>
              </>
            )}
          </button>
        </div>

        {/* Google Auth / Cloud Sync Status Pill */}
        {user ? (
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Google" className="w-6 h-6 rounded-full ring-1 ring-emerald-400 shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(user.displayName || 'G')[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate">
                  {user.displayName || 'Google Account'}
                </div>
                <div className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>ซิงค์ข้ามเครื่องแล้ว</span>
                </div>
              </div>
            </div>
            <Cloud className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
          >
            {/* Google Icon SVG */}
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="truncate">เข้าสู่ระบบเพื่อซิงค์ข้อมูล</span>
          </button>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="p-4 pb-2">
        <button
          id="tour-record-btn"
          onClick={() => onOpenRecordModal('electricity')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm active:scale-98 transition-all cursor-pointer group"
        >
          <Plus className="w-4 h-4 text-amber-400 group-hover:rotate-90 transition-transform duration-200" />
          <span>+ จดมิเตอร์ (สแกน/พิมพ์)</span>
        </button>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 scrollbar-thin">
        {/* Menu Section 1: Main Pages */}
        <div className="space-y-1">
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            เมนูหลัก
          </div>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-amber-400' : 'text-amber-500'}`} />
              <span>ภาพรวม & แดชบอร์ด</span>
            </div>
            {readingsCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                activeTab === 'dashboard' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {readingsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HistoryIcon className={`w-4 h-4 ${activeTab === 'history' ? 'text-cyan-400' : 'text-cyan-600'}`} />
              <span>ประวัติการจดมิเตอร์</span>
            </div>
            {readingsCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                activeTab === 'history' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
              }`}>
                {readingsCount} รายการ
              </span>
            )}
          </button>

          <button
            id="tour-simulator-tab"
            onClick={() => setActiveTab('simulator')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Calculator className={`w-4 h-4 ${activeTab === 'simulator' ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span>คำนวณค่าไฟแอร์</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-medium ${
              activeTab === 'simulator' ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
            }`}>
              Sim
            </span>
          </button>
        </div>

        {/* Menu Section 2: Utilities & Tools */}
        <div className="space-y-1">
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            เครื่องมือ & รายงาน
          </div>

          <button
            onClick={onOpenBillSlip}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>ใบสรุปบิล / สลิป</span>
            </div>
            <span className="text-[10px] text-slate-400">PDF/Print</span>
          </button>

          <button
            onClick={onOpenShare}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Share2 className="w-4 h-4 text-slate-500" />
              <span>แชร์ห้อง & QR Code</span>
            </div>
            <span className="text-[10px] text-slate-400">Sync</span>
          </button>

          <button
            onClick={onExportCSV}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-slate-500" />
              <span>ส่งออกไฟล์ CSV</span>
            </div>
            <span className="text-[10px] text-slate-400">Excel</span>
          </button>

          <button
            onClick={onStartTour}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>แนะนำการใช้งาน</span>
            </div>
            <Sparkles className="w-3 h-3 text-amber-500" />
          </button>
        </div>
      </div>

      {/* Footer Settings & Storage Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <button
          id="tour-settings-btn"
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white text-slate-700 border border-transparent hover:border-slate-200 transition-all cursor-pointer shadow-none hover:shadow-xs group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-200/70 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <SettingsIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-slate-900">ตั้งค่าระบบ</div>
              <div className="text-[10px] text-slate-500">เรทราคา, ค่าเช่า, รอบบิล</div>
            </div>
          </div>
          <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform text-xs">→</span>
        </button>

        <div className="flex items-center justify-between px-2 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{user ? 'Cloud & IDB ซิงค์แล้ว' : 'IndexedDB ซิงค์ในเครื่อง'}</span>
          </div>
          <span className="font-mono">v1.2</span>
        </div>
      </div>
    </aside>
  );
};
