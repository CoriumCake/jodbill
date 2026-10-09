import React, { useState } from 'react';
import { 
  X, 
  Cloud, 
  CloudCheck, 
  RefreshCw, 
  LogOut, 
  ShieldCheck, 
  Key, 
  Smartphone, 
  Laptop, 
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-react';
import type { AuthUser, SyncStatus } from '../types';
import { 
  loginWithGoogle, 
  logoutUser, 
  getFirebaseConfig, 
  saveFirebaseConfig,
  type FirebaseConfig 
} from '../utils/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  onSyncNow: () => Promise<void>;
  onPullCloudData: () => Promise<void>;
  onAuthChange: (user: AuthUser | null) => void;
  showToast: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  syncStatus,
  lastSyncedAt,
  onSyncNow,
  onPullCloudData,
  onAuthChange,
  showToast,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfigTab, setShowConfigTab] = useState(false);
  
  // Custom Firebase config form
  const [customConfig, setCustomConfig] = useState<Partial<FirebaseConfig>>(() => {
    return getFirebaseConfig() || {};
  });

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const authUser = await loginWithGoogle();
      onAuthChange(authUser);
      showToast(`👋 ยินดีต้อนรับ ${authUser.displayName || 'ผู้ใช้งาน'}! เข้าสู่ระบบสำเร็จแล้ว`);
    } catch (err: unknown) {
      console.error(err);
      showToast('⚠️ ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      onAuthChange(null);
      showToast('ออกจากระบบเรียบร้อยแล้ว (ข้อมูลยังคงถูกเก็บไว้ในเครื่องนี้)');
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerSync = async () => {
    try {
      setIsSyncing(true);
      await onSyncNow();
      showToast('☁️ ซิงค์ข้อมูลขึ้นคลาวด์สำเร็จแล้ว!');
    } catch {
      showToast('⚠️ การซิงค์ขัดข้อง กรุณาลองใหม่');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerPull = async () => {
    try {
      setIsSyncing(true);
      await onPullCloudData();
      showToast('📥 ดึงข้อมูลล่าสุดจากคลาวด์สำเร็จแล้ว!');
    } catch {
      showToast('⚠️ ไม่สามารถดึงข้อมูลจากคลาวด์ได้');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveCustomConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customConfig.apiKey || !customConfig.projectId) {
      saveFirebaseConfig(null);
      showToast('รีเซ็ตการตั้งค่า Firebase เป็นค่าเริ่มต้นแล้ว');
    } else {
      saveFirebaseConfig(customConfig as FirebaseConfig);
      showToast('บันทึกการตั้งค่า Firebase แล้ว');
    }
    setShowConfigTab(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {user ? 'บัญชี & Cloud Sync' : 'เข้าสู่ระบบด้วย Google'}
              </h2>
              <p className="text-xs text-slate-500">ซิงค์ข้อมูลค่าน้ำ-ไฟข้ามทุกอุปกรณ์</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* STATE 1: LOGGED IN */}
          {user ? (
            <div className="space-y-4">
              {/* User Profile Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-12 h-12 rounded-full ring-2 ring-white shadow-xs object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-bold text-base flex items-center justify-center">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {user.displayName || 'Google Account'}
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <div className="text-xs text-slate-500 truncate font-mono">
                    {user.email || 'jodbill user'}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] font-medium text-emerald-700">
                      {syncStatus === 'synced' ? 'เชื่อมต่อคลาวด์แล้ว' : 'กำลังซิงค์...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Status Box */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 text-xs text-emerald-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CloudCheck className="w-4 h-4 text-emerald-600" />
                    <span>สถานะการสำรองข้อมูล</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-mono">
                    {lastSyncedAt ? `ล่าสุด: ${lastSyncedAt.toLocaleTimeString('th-TH')}` : 'ซิงค์อัตโนมัติ'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  เมื่อคุณเปิด jodbill บนอุปกรณ์อื่น (เช่น มือถือ หรือคอมเครื่องใหม่) เพียงเข้าสู่ระบบด้วย Google เดียวกัน ข้อมูลทั้งหมดจะปรากฏทันที
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-98 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'กำลังซิงค์...' : 'อัปเดตขึ้นคลาวด์'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerPull}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 cursor-pointer active:scale-98 transition-all disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5 text-slate-600" />
                  <span>ดึงจากคลาวด์</span>
                </button>
              </div>

              {/* Cross-device Illustration */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-around text-slate-500 text-xs text-center">
                <div className="flex flex-col items-center gap-1">
                  <Smartphone className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px]">โทรศัพท์มือถือ</span>
                </div>
                <span className="text-slate-300">⇄</span>
                <div className="flex flex-col items-center gap-1">
                  <Cloud className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] text-amber-700 font-medium">Cloud Database</span>
                </div>
                <span className="text-slate-300">⇄</span>
                <div className="flex flex-col items-center gap-1">
                  <Laptop className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px]">คอมพิวเตอร์</span>
                </div>
              </div>

              {/* Logout Button */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowConfigTab(!showConfigTab)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                  <span>ตั้งค่า Firebase</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          ) : (
            /* STATE 2: NOT LOGGED IN */
            <div className="space-y-4">
              {/* Feature Highlights */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 rounded-lg bg-white shadow-xs text-amber-600 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">ย้ายเครื่องได้ตลอดเวลา ไม่ต้องกลัวข้อมูลหาย</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ประวัติการจดมิเตอร์ รูปภาพ และการตั้งค่าห้องพักทั้งหมดจะถูกซิงค์ผ่านคลาวด์แบบอัตโนมัติ
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 rounded-lg bg-white shadow-xs text-blue-600 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">เข้าถึงได้จากทุก Browser & ทุกอุปกรณ์</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      เปิดเว็บได้ทั้งบน Safari, Chrome, Edge หรือเปิดจากมือถือของรูมเมทได้ทันที
                    </p>
                  </div>
                </div>
              </div>

              {/* Big Google Login CTA Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border-2 border-slate-200/90 shadow-sm hover:shadow-md active:scale-98 transition-all cursor-pointer group"
              >
                {/* Official Google G Logo SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}</span>
              </button>

              {/* Privacy / Offline Note */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 justify-center">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>หากไม่เข้าสู่ระบบ ข้อมูลจะถูกเก็บในเครื่องนี้ผ่าน IndexedDB</span>
              </div>
            </div>
          )}

          {/* Optional Firebase Custom Config Accordion */}
          {showConfigTab && (
            <form onSubmit={handleSaveCustomConfig} className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">กำหนดค่า Firebase Project เอง</span>
                <span className="text-[10px] text-slate-500">สำหรับ Host บนเซิร์ฟเวอร์ของคุณ</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">API Key</label>
                  <input
                    type="text"
                    value={customConfig.apiKey || ''}
                    onChange={(e) => setCustomConfig({ ...customConfig, apiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Project ID</label>
                  <input
                    type="text"
                    value={customConfig.projectId || ''}
                    onChange={(e) => setCustomConfig({ ...customConfig, projectId: e.target.value })}
                    placeholder="jodbill-app"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigTab(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                >
                  บันทึก
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
