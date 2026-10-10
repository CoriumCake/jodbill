import React, { useState } from 'react';
import { 
  Zap, 
  Droplets, 
  ArrowLeft, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Sparkles, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Camera, 
  Users,
  Smartphone
} from 'lucide-react';
import { 
  loginWithGoogle, 
  signInWithEmailSupabase, 
  signUpWithEmailSupabase 
} from '../utils/authService';
import type { AuthUser } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onContinueAsGuest: () => void;
  showToast: (msg: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
  showToast,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // 1. Google OAuth
  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      const user = await loginWithGoogle();
      if (user) {
        onLoginSuccess(user);
        showToast(`👋 ยินดีต้อนรับ ${user.displayName || 'ผู้ใช้งาน'}! เข้าสู่ระบบสำเร็จ`);
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.toLowerCase().includes('provider') || errMsg.toLowerCase().includes('unsupported')) {
        showToast('⚠️ กรุณาเปิดใช้งาน Google Provider ใน Supabase Dashboard');
      } else {
        showToast('⚠️ การเข้าสู่ระบบด้วย Google ขัดข้อง หรือหน้าต่างถูกปิด');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 2. Email & Password Form Submit
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('⚠️ กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }

    if (password.length < 6) {
      showToast('⚠️ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    try {
      setIsLoading(true);
      if (mode === 'signin') {
        const user = await signInWithEmailSupabase(email, password);
        onLoginSuccess(user);
        showToast(`👋 ยินดีต้อนรับกลับ ${user.displayName || user.email}! เข้าสู่ระบบสำเร็จ`);
      } else {
        const user = await signUpWithEmailSupabase(email, password, displayName);
        if (user) {
          onLoginSuccess(user);
          showToast(`🎉 สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!`);
        } else {
          showToast('📩 สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน (ถ้ามี)');
        }
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Invalid login credentials')) {
        showToast('❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (errMsg.includes('User already registered')) {
        showToast('⚠️ อีเมลนี้มีในระบบแล้ว กรุณาเลือก "เข้าสู่ระบบ"');
        setMode('signin');
      } else {
        showToast(`⚠️ เกิดข้อผิดพลาด: ${errMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/70 to-amber-50/40 text-slate-800 flex flex-col justify-between selection:bg-amber-100 selection:text-amber-900">
      {/* Top Header Bar */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900 text-white shadow-xs">
            <div className="flex items-center -space-x-1">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <Droplets className="w-3.5 h-3.5 text-cyan-300 fill-cyan-300" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 font-display">
              jodbill
            </span>
            <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 font-bold border border-amber-200">
              จดบิล
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinueAsGuest}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>ข้ามไปแดชบอร์ด (Guest)</span>
        </button>
      </header>

      {/* Main Content (Split Hero / Auth Card) */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14">
        {/* Left Column: Hero Brand Info */}
        <div className="w-full lg:w-1/2 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 text-xs font-semibold border border-amber-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>ระบบติดตามและซิงค์ค่าน้ำ-ไฟหอพัก Real-time</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-display leading-tight">
              จดมิเตอร์ง่าย ไม่กลัวบิลช็อค <br />
              <span className="text-amber-600 underline decoration-amber-300 decoration-wavy">
                ซิงค์ข้อมูลกับรูมเมท
              </span> ได้ทุกที่
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto lg:mx-0">
              บันทึกตัวเลขมิเตอร์ไฟฟ้าและน้ำประปา พร้อมระบบ AI OCR สแกนหน้าปัดอัตโนมัติ 
              คำนวณ Burn Rate ต่อชั่วโมง และพยากรณ์ค่าใช้จ่ายสิ้นเดือนแม่นยำ
            </p>
          </div>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2 max-w-md mx-auto lg:mx-0">
            <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs flex items-center gap-2.5 text-left">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">AI OCR Scanner</h4>
                <p className="text-[10px] text-slate-500">สแกนเลขไวใน Sub-100ms</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs flex items-center gap-2.5 text-left">
              <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Real-time Cost</h4>
                <p className="text-[10px] text-slate-500">คำนวณค่าไฟ/น้ำ ฿/ชม.</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs flex items-center gap-2.5 text-left">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Roommate Sync</h4>
                <p className="text-[10px] text-slate-500">ซิงค์สดผ่าน Supabase</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs flex items-center gap-2.5 text-left">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Cross-Device</h4>
                <p className="text-[10px] text-slate-500">เปิดได้ทั้งมือถือและคอม</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/90 space-y-6">
            {/* Header & Mode Switcher */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {mode === 'signin' ? 'เข้าสู่ระบบ jodbill' : 'สร้างบัญชีผู้ใช้ใหม่'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mode === 'signin' 
                    ? 'ยินดีต้อนรับกลับ! เข้าสู่ระบบเพื่อซิงค์ข้อมูลห้องพักของคุณ'
                    : 'เริ่มต้นใช้งานฟรี ข้อมูลถูกบันทึกและซิงค์ผ่านคลาวด์ปลอดภัย'}
                </p>
              </div>

              {/* Segmented Switcher */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 border border-slate-200/60 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`py-2 rounded-xl transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  เข้าสู่ระบบ (Sign In)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`py-2 rounded-xl transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  สมัครสมาชิก (Sign Up)
                </button>
              </div>
            </div>

            {/* 1. Official Google One-Click Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm border-2 border-slate-200/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer group disabled:opacity-50"
            >
              {/* Google G Logo SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isGoogleLoading ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google'}</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">
                หรือใช้อีเมลและรหัสผ่าน
              </span>
            </div>

            {/* 2. Email & Password Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อของคุณ (Display Name)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="เช่น ปลื้ม หรือ Room 402"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อีเมล (Email)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    รหัสผ่าน (Password)
                  </label>
                  {mode === 'signin' && (
                    <span className="text-[11px] text-slate-400">
                      อย่างน้อย 6 ตัวอักษร
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>
                  {isLoading 
                    ? 'กำลังประมวลผล...' 
                    : mode === 'signin' 
                    ? 'เข้าสู่ระบบ (Sign In)' 
                    : 'สร้างบัญชีใหม่ (Create Account)'}
                </span>
              </button>
            </form>

            {/* Offline / Guest Mode Shortcut */}
            <div className="pt-2 border-t border-slate-100 text-center space-y-2">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium underline underline-offset-2 cursor-pointer transition-colors"
              >
                ใช้งานแบบไม่เข้าสู่ระบบ (บันทึกลง IndexedDB ในเครื่องนี้)
              </button>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Supabase PostgreSQL Cloud พร้อมใช้งาน</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400">
        jodbill (จดบิล) &copy; 2026 &bull; Real-time Utility Tracker for Dorms & Condos
      </footer>
    </div>
  );
};
