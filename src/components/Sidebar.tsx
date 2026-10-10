import React from 'react';
import { 
  Calculator, 
  History as HistoryIcon, 
  LayoutDashboard,
  FileText,
  Share2,
  LogOut,
  LogIn,
  Sprout,
  SlidersHorizontal
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
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  settings: _settings,
  currentRole: _currentRole,
  readingsCount: _readingsCount,
  user,
  syncStatus: _syncStatus,
  onOpenRecordModal: _onOpenRecordModal,
  onOpenSettings,
  onOpenShare,
  onOpenBillSlip,
  onExportCSV: _onExportCSV,
  onStartTour: _onStartTour,
  onOpenAuth,
  onLogout,
}) => {
  // Extract user initials
  const userInitial = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'MP';

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/70 shrink-0 select-none h-screen sticky top-0 font-sans">
      {/* Brand Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Sprout className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
              JodBill
            </h1>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              Smart meter monitor
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 tracking-wider">
            เมนูหลัก
          </div>

          <nav className="space-y-1">
            {/* 1. ภาพรวม (Dashboard) */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-amber-100/70 text-amber-950 border border-amber-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-amber-800' : 'text-slate-500'}`} />
              <span className="truncate">ภาพรวม</span>
            </button>

            {/* 2. ประวัติมิเตอร์ (History) */}
            <button
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-100/70 text-amber-950 border border-amber-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <HistoryIcon className={`w-4 h-4 shrink-0 ${activeTab === 'history' ? 'text-amber-800' : 'text-slate-500'}`} />
              <span className="truncate">ประวัติมิเตอร์</span>
            </button>

            {/* 3. คำนวณค่าไฟแอร์ (Simulator) */}
            <button
              onClick={() => setActiveTab('simulator')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-amber-100/70 text-amber-950 border border-amber-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calculator className={`w-4 h-4 shrink-0 ${activeTab === 'simulator' ? 'text-amber-800' : 'text-slate-500'}`} />
              <span className="truncate">ข้อมูลการใช้ไฟ-น้ำ</span>
            </button>

            {/* 4. ใบเสร็จ & สลิปบิล */}
            <button
              onClick={onOpenBillSlip}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4 shrink-0 text-slate-500" />
              <span className="truncate">จัดการบิล & สลิป</span>
            </button>

            {/* 5. แชร์ห้อง & จัดการห้อง */}
            <button
              onClick={onOpenShare}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 shrink-0 text-slate-500" />
              <span className="truncate">จัดการห้องพัก</span>
            </button>

            {/* 6. ตั้งค่าระบบ */}
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0 text-slate-500" />
              <span className="truncate">จัดการระบบ</span>
            </button>
          </nav>
        </div>
      </div>

      {/* User Profile Card at Bottom */}
      <div className="p-4 border-t border-slate-100 bg-white">
        {user ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-9 h-9 rounded-full ring-2 ring-slate-100 object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {userInitial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-800 truncate">
                  {user.displayName || 'Cat Code'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user.email || 'catcode.business@gmail.com'}
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 text-xs font-medium transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบด้วย Google</span>
          </button>
        )}
      </div>
    </aside>
  );
};
