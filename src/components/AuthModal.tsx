import React, { useState, useEffect } from 'react';
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
  Mail,
  User as UserIcon,
  Plus,
  Trash2,
  ExternalLink
} from 'lucide-react';
import type { AuthUser, SyncStatus } from '../types';
import { 
  getGoogleClientId,
  saveGoogleClientId,
  getFirebaseConfig, 
  saveFirebaseConfig,
  loginWithGoogleGIS,
  loginWithFirebaseGoogle,
  loginWithCustomAccount,
  logoutUser, 
  getSavedAccounts,
  removeSavedAccount,
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
  const [activeTab, setActiveTab] = useState<'picker' | 'oauth_config'>('picker');
  
  // Custom Google Email input form
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  
  // Saved accounts list
  const [savedAccounts, setSavedAccounts] = useState<AuthUser[]>([]);

  // Config fields
  const [googleClientId, setGoogleClientId] = useState(() => getGoogleClientId() || '');
  const [firebaseConfig, setFirebaseConfig] = useState<Partial<FirebaseConfig>>(() => getFirebaseConfig() || {});

  useEffect(() => {
    if (isOpen) {
      setSavedAccounts(getSavedAccounts());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Real OAuth Google Sign-In attempt (via GIS or Firebase)
  const handleRealGoogleOAuth = async () => {
    const clientId = getGoogleClientId();
    const fbConfig = getFirebaseConfig();

    if (!clientId && (!fbConfig || !fbConfig.apiKey)) {
      setActiveTab('oauth_config');
      showToast('💡 เพื่อเปิด Google Popup จริง กรุณาใส่ Google Client ID หรือ Firebase Config');
      return;
    }

    try {
      setIsLoggingIn(true);
      let authUser: AuthUser;

      if (clientId) {
        authUser = await loginWithGoogleGIS(clientId);
      } else {
        authUser = await loginWithFirebaseGoogle();
      }

      onAuthChange(authUser);
      setSavedAccounts(getSavedAccounts());
      showToast(`👋 ยินดีต้อนรับ ${authUser.displayName || 'Google Account'}! เข้าสู่ระบบสำเร็จ`);
    } catch (err: unknown) {
      console.error(err);
      showToast('⚠️ การเข้าสู่ระบบด้วย Google ขัดข้อง หรือหน้าต่างถูกปิด');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Switch or Login with Custom / Saved Account
  const handleSelectAccount = (acc: AuthUser) => {
    const authUser = loginWithCustomAccount(acc.email || 'user@gmail.com', acc.displayName || '', acc.photoURL || '');
    onAuthChange(authUser);
    setSavedAccounts(getSavedAccounts());
    showToast(`🔄 สลับบัญชีเป็น "${authUser.email}" สำเร็จ`);
  };

  const handleCreateCustomAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) {
      showToast('⚠️ กรุณากรอกอีเมลที่ถูกต้อง เช่น yourname@gmail.com');
      return;
    }

    const authUser = loginWithCustomAccount(customEmail, customName);
    onAuthChange(authUser);
    setSavedAccounts(getSavedAccounts());
    showToast(`🎉 เข้าสู่ระบบด้วย "${authUser.email}" เรียบร้อย`);
    setCustomEmail('');
    setCustomName('');
  };

  const handleRemoveAccount = (e: React.MouseEvent, uid: string) => {
    e.stopPropagation();
    removeSavedAccount(uid);
    setSavedAccounts(getSavedAccounts());
    showToast('ลบบัญชีออกจากประวัติแล้ว');
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      onAuthChange(null);
      showToast('ออกจากระบบเรียบร้อยแล้ว');
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

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveGoogleClientId(googleClientId || null);
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      saveFirebaseConfig(firebaseConfig as FirebaseConfig);
    } else {
      saveFirebaseConfig(null);
    }
    showToast('บันทึกการตั้งค่า Google OAuth / Firebase แล้ว');
    setActiveTab('picker');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {user ? 'จัดการบัญชี & Cloud Sync' : 'เลือกบัญชี Google / เข้าสู่ระบบ'}
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

        {/* Tab Navigation */}
        <div className="px-5 pt-3 flex gap-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('picker')}
            className={`pb-2.5 text-xs font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'picker'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {user ? 'ข้อมูลบัญชีปัจจุบัน' : 'เลือก/กรอกบัญชี'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('oauth_config')}
            className={`pb-2.5 text-xs font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'oauth_config'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>ตั้งค่า Google OAuth / Firebase</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {activeTab === 'picker' ? (
            <>
              {/* CURRENT LOGGED IN USER CARD */}
              {user && (
                <div className="space-y-4">
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
                        {user.email || 'user@gmail.com'}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[11px] font-medium text-emerald-700">
                          {syncStatus === 'synced' ? 'เชื่อมต่อคลาวด์แล้ว' : 'กำลังซิงค์...'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sync Status Banner */}
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
                      ข้อมูลมิเตอร์และการตั้งค่าจะถูกซิงค์ตามอีเมล <strong>{user.email}</strong> เมื่อเปิดบนเครื่องอื่น
                    </p>
                  </div>

                  {/* Sync Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
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

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">สลับบัญชีหรือออกจากระบบ:</span>
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
              )}

              {/* REAL GOOGLE OAUTH POPUP BUTTON */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">
                  1. เข้าสู่ระบบด้วย Google Popup (OAuth 2.0)
                </div>
                <button
                  type="button"
                  onClick={handleRealGoogleOAuth}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm border-2 border-slate-200 shadow-xs hover:shadow-sm active:scale-98 transition-all cursor-pointer group"
                >
                  {/* Google Icon SVG */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isLoggingIn ? 'กำลังเปิดหน้าต่าง Google...' : 'เปิด Google Account Chooser'}</span>
                </button>
              </div>

              {/* SAVED ACCOUNTS SELECTOR */}
              {savedAccounts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>2. บัญชีที่เคยบันทึกไว้ในเครื่องนี้ (คลิกเพื่อสลับ)</span>
                  </div>
                  <div className="space-y-1.5">
                    {savedAccounts.map((acc) => {
                      const isCurrent = user?.email === acc.email;
                      return (
                        <div
                          key={acc.uid}
                          onClick={() => handleSelectAccount(acc)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {acc.photoURL ? (
                              <img src={acc.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {(acc.displayName || acc.email || 'G')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 text-left">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {acc.displayName || 'Google User'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate">
                                {acc.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold">
                                บัญชีปัจจุบัน
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveAccount(e, acc.uid)}
                              title="ลบบัญชีนี้"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MANUAL / CUSTOM GOOGLE EMAIL LOGIN */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-900">
                  3. กรอกอีเมล Google / Gmail ของคุณเอง
                </div>
                <form onSubmit={handleCreateCustomAccount} className="space-y-2.5">
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="ชื่อของคุณ (เช่น มุกต์ / ปลื้ม)"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs cursor-pointer active:scale-98 transition-all"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>เข้าสู่ระบบด้วยอีเมลนี้</span>
                  </button>
                </form>
              </div>

              {/* Cross-device Flow Note */}
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
            </>
          ) : (
            /* TAB 2: GOOGLE OAUTH & FIREBASE CONFIG */
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>วิธีเปิด Google OAuth Popup จริง (ฟรี 100%)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  เนื่องจาก Google มีนโยบายความปลอดภัยที่ต้องระบุ <strong>Google Client ID</strong> เพื่อแสดงหน้าต่างเลือกบัญชี Gmail จริง คุณสามารถใส่ Client ID หรือ Firebase Config ได้ที่นี่:
                </p>
                <ol className="text-[11px] text-slate-600 list-decimal list-inside space-y-1 pl-1">
                  <li>เข้า <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a> หรือ <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-2.5 h-2.5" /></a></li>
                  <li>สร้าง OAuth 2.0 Client ID (Web Application)</li>
                  <li>ใส่ Authorized JavaScript origins: <code className="bg-slate-200 px-1 rounded text-[10px]">http://localhost:5173</code></li>
                  <li>คัดลอก Client ID หรือ Firebase Config มาวางด้านล่าง</li>
                </ol>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    Google OAuth Client ID (แนะนำ)
                  </label>
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxxxxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-900 mb-2">หรือใช้ Firebase Config (Firestore Sync)</div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">API Key</label>
                      <input
                        type="text"
                        value={firebaseConfig.apiKey || ''}
                        onChange={(e) => setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Project ID</label>
                      <input
                        type="text"
                        value={firebaseConfig.projectId || ''}
                        onChange={(e) => setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value })}
                        placeholder="jodbill-app"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('picker')}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
