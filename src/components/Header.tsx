import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  LogOut, 
  Settings as SettingsIcon, 
  Share2, 
  FileSpreadsheet, 
  HelpCircle, 
  CheckCircle2,
  Smartphone,
  Sprout
} from 'lucide-react';
import type { UserSettings, UserRole, AuthUser, SyncStatus } from '../types';
import { usePWAInstall } from '../utils/usePWAInstall';

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
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  user,
  syncStatus: _syncStatus,
  onOpenSettings,
  onOpenShare,
  onExportCSV,
  onStartTour,
  onOpenAuth,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isInstallable, installApp } = usePWAInstall();

  // Close user dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roomDisplay = settings.roomNumber 
    ? `ห้อง ${settings.roomNumber}${settings.dormName ? ` (${settings.dormName})` : ''}`
    : settings.dormName 
    ? settings.dormName 
    : 'ยังไม่มีห้อง';

  const userInitial = user?.displayName
    ? user.displayName.slice(0, 2).toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'MP';

  return (
    <header className="sticky top-0 z-30 w-full bg-[#f8f9fa]/95 backdrop-blur-md border-b border-slate-200/60 px-3.5 sm:px-8 py-2.5 sm:py-3.5 select-none font-sans">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Badge on Mobile + Room Selector */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Only Brand Icon */}
          <div className="flex md:hidden items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
            <Sprout className="w-4 h-4 text-emerald-600" />
          </div>

          <span className="text-xs font-medium text-slate-500 hidden sm:inline shrink-0">
            เลือกห้อง
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs transition-all cursor-pointer group min-w-0"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[220px]">
              {roomDisplay}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 ml-0.5" />
          </button>
        </div>

        {/* Right: Install App & User Login / Profile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0" ref={menuRef}>
          {/* 1. PWA Install Shortcut Button (Shows on Chrome/Edge when installable) */}
          {isInstallable && (
            <button
              type="button"
              onClick={() => installApp()}
              title="ติดตั้ง JodBill เป็นแอปบนเครื่อง"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-semibold shadow-2xs transition-all cursor-pointer hover:scale-102 active:scale-98 animate-fade-in"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden xs:inline">ติดตั้งแอป</span>
            </button>
          )}

          {/* 2. Authentication Button: Prominent on Mobile & Desktop */}
          {user ? (
            /* Logged In: Avatar Button with Dropdown */
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-medium shadow-2xs transition-all cursor-pointer group"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 sm:w-6 sm:h-6 rounded-full ring-1 ring-slate-200 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {userInitial}
                  </div>
                )}
                <span className="hidden sm:inline font-semibold text-slate-800 max-w-[100px] truncate">
                  {user.displayName || 'บัญชีของฉัน'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Menu Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2.5 z-50 animate-fade-in text-xs">
                  {/* User Profile Header */}
                  <div className="px-4 py-2 border-b border-slate-100 space-y-1">
                    <div className="font-bold text-slate-900 truncate">
                      {user.displayName || 'Cat Code'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate font-mono">
                      {user.email || 'catcode.business@gmail.com'}
                    </div>
                    <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>ซิงค์กับคลาวด์แล้ว</span>
                    </div>
                  </div>

                  {/* Actions List (especially useful on mobile) */}
                  <div className="py-1">
                    {isInstallable && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          installApp();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer font-medium"
                      >
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <span>ติดตั้งแอปบนหน้าจอหลัก</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    >
                      <SettingsIcon className="w-4 h-4 text-slate-500" />
                      <span>ตั้งค่าระบบ & เรทราคา</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenShare();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-slate-500" />
                      <span>แชร์ห้อง & QR Code</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onExportCSV();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                      <span>ส่งออกไฟล์ Excel/CSV</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onStartTour();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                      <span>แนะนำการใช้งาน</span>
                    </button>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-1 border-t border-slate-100 px-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors cursor-pointer font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Not Logged In: Prominent 1-Click Login Button */
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 group"
            >
              {/* Google G Logo SVG */}
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
