import React from 'react';
import { 
  Building2, 
  ChevronDown, 
  Moon
} from 'lucide-react';
import type { UserSettings, UserRole, AuthUser, SyncStatus } from '../types';

interface HeaderProps {
  activeTab: 'dashboard' | 'history' | 'simulator';
  setActiveTab: (tab: 'dashboard' | 'history' | 'simulator') => void;
  settings: UserSettings;
  currentRole: UserRole;
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

export const Header: React.FC<HeaderProps> = ({
  activeTab: _activeTab,
  setActiveTab: _setActiveTab,
  settings,
  currentRole: _currentRole,
  user: _user,
  syncStatus: _syncStatus,
  onOpenRecordModal: _onOpenRecordModal,
  onOpenSettings,
  onOpenShare: _onOpenShare,
  onOpenBillSlip: _onOpenBillSlip,
  onExportCSV: _onExportCSV,
  onStartTour: _onStartTour,
  onOpenAuth: _onOpenAuth,
}) => {
  const roomDisplay = settings.roomNumber 
    ? `ห้อง ${settings.roomNumber}${settings.dormName ? ` (${settings.dormName})` : ''}`
    : settings.dormName 
    ? settings.dormName 
    : 'ยังไม่มีห้อง';

  return (
    <header className="sticky top-0 z-30 w-full bg-[#f8f9fa]/90 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Room Selector (matches "เลือกสวน / ยังไม่มีสวน" from reference) */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">
            เลือกห้อง
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs transition-all cursor-pointer group"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            <span className="truncate max-w-[180px] sm:max-w-[240px]">
              {roomDisplay}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 ml-0.5" />
          </button>
        </div>

        {/* Right: Theme Toggle & Minimal Indicators */}
        <div className="flex items-center gap-2">
          {/* Subtle Cloud Sync Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200/70 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>พร้อมใช้งาน</span>
          </div>

          {/* Minimalist Theme / Aesthetics Icon Button (Matches the Moon icon on top right in reference) */}
          <button
            type="button"
            onClick={() => {}}
            title="สลับโหมดการแสดงผล"
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs transition-all cursor-pointer"
          >
            <Moon className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>
    </header>
  );
};
