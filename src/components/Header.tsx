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
  HelpCircle
} from 'lucide-react';
import type { UserSettings } from '../types';

interface HeaderProps {
  activeTab: 'dashboard' | 'history' | 'simulator';
  setActiveTab: (tab: 'dashboard' | 'history' | 'simulator') => void;
  settings: UserSettings;
  onOpenRecordModal: (type?: 'electricity' | 'water') => void;
  onOpenSettings: () => void;
  onOpenBillSlip: () => void;
  onExportCSV: () => void;
  onStartTour: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onOpenRecordModal,
  onOpenSettings,
  onOpenBillSlip,
  onExportCSV,
  onStartTour,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Logo & Room Info */}
          <div id="tour-brand" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-white shadow-xs">
              <div className="flex items-center -space-x-1">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <Droplets className="w-3.5 h-3.5 text-cyan-300 fill-cyan-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  jodbill
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium hidden sm:inline-block">
                  จดบิล
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate max-w-[130px] sm:max-w-[200px] font-medium text-slate-700">
                  {settings.dormName || 'หอพัก'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-900 font-mono font-semibold">
                  ห้อง {settings.roomNumber || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Clean Segment Navigation Tabs */}
          <nav className="hidden md:flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-amber-500" />
              แดชบอร์ด
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HistoryIcon className="w-3.5 h-3.5 text-cyan-600" />
              ประวัติ
            </button>
            <button
              id="tour-simulator-tab"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              คำนวณแอร์
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={onStartTour}
              title="แนะนำการใช้งาน (Tour)"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span className="hidden lg:inline">แนะนำ</span>
            </button>

            <button
              onClick={onExportCSV}
              title="ส่งออกไฟล์ CSV"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              onClick={onOpenBillSlip}
              title="ดูใบแจ้งสรุปบิล"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">ใบสรุปบิล</span>
            </button>

            <button
              id="tour-settings-btn"
              onClick={onOpenSettings}
              title="ตั้งค่า"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>

            {/* Primary Record Button */}
            <button
              id="tour-record-btn"
              onClick={() => onOpenRecordModal()}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>จดบิล</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            แดชบอร์ด
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600'
            }`}
          >
            <HistoryIcon className="w-3.5 h-3.5" />
            ประวัติ
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'simulator'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            คำนวณแอร์
          </button>
        </div>
      </div>
    </header>
  );
};
