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
  Sparkles
} from 'lucide-react';
import type { UserSettings, UserRole } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'history' | 'simulator';
  setActiveTab: (tab: 'dashboard' | 'history' | 'simulator') => void;
  settings: UserSettings;
  currentRole: UserRole;
  readingsCount: number;
  onOpenRecordModal: (type?: 'electricity' | 'water') => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  onOpenBillSlip: () => void;
  onExportCSV: () => void;
  onStartTour: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  currentRole,
  readingsCount,
  onOpenRecordModal,
  onOpenSettings,
  onOpenShare,
  onOpenBillSlip,
  onExportCSV,
  onStartTour,
}) => {
  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200/80 shrink-0 select-none h-screen sticky top-0">
      {/* Brand & Room Info Header */}
      <div className="p-5 pb-4 border-b border-slate-100">
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
        <div className="mt-4 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between gap-2">
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
                <span>เจ้าของห้อง</span>
              </>
            )}
          </button>
        </div>
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
            <span>IndexedDB ซิงค์อัตโนมัติ</span>
          </div>
          <span className="font-mono">v1.2</span>
        </div>
      </div>
    </aside>
  );
};
