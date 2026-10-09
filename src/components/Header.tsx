import { 
  Plus, 
  Download, 
  Settings as SettingsIcon, 
  FileText, 
  HelpCircle, 
  Share2, 
  Zap, 
  Droplets,
  Cloud
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
  activeTab,
  settings,
  currentRole,
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
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'ภาพรวม & คำนวณบิล Real-time',
          subtitle: `รอบบิลวันที่ 1-${settings.billingCutoffDay || 30} ของเดือน`,
        };
      case 'history':
        return {
          title: 'ประวัติการจดมิเตอร์',
          subtitle: 'บันทึกตัวเลขและรูปถ่ายหน้าปัดย้อนหลัง',
        };
      case 'simulator':
        return {
          title: 'จำลองการใช้ไฟเครื่องใช้ไฟฟ้า',
          subtitle: 'คำนวณค่าไฟแอร์และเครื่องใช้ไฟฟ้าตามชั่วโมงเปิด',
        };
    }
  };

  const { title, subtitle } = getTabTitle();

  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="w-full px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Mobile Brand / Desktop Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Only Logo & Room */}
            <div className="flex md:hidden items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white shadow-xs shrink-0">
                <div className="flex items-center -space-x-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <Droplets className="w-3 h-3 text-cyan-300 fill-cyan-300" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {settings.dormName || 'jodbill'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    #{settings.roomNumber || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onOpenShare}
                    className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-medium cursor-pointer ${
                      currentRole === 'viewer'
                        ? 'bg-amber-100 text-amber-800'
                        : currentRole === 'editor'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {currentRole === 'viewer' ? 'ดูอย่างเดียว' : currentRole === 'editor' ? 'ผู้ร่วมจด' : 'เจ้าของ'}
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Page Title & Context */}
            <div className="hidden md:block">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                {title}
              </h1>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>

          {/* Right Action Icons & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Google Profile / Cloud Sync Button */}
            <button
              onClick={onOpenAuth}
              title={user ? `เข้าสู่ระบบโดย: ${user.email || user.displayName}` : 'เข้าสู่ระบบ Google เพื่อซิงค์ข้ามเครื่อง'}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                user
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Google" className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-emerald-400" />
              ) : user ? (
                <div className="w-5 h-5 rounded-full bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {(user.displayName || 'G')[0]}
                </div>
              ) : (
                <Cloud className="w-4 h-4 text-slate-500" />
              )}
              <span className="hidden sm:inline">
                {user ? 'คลาวด์ซิงค์' : 'เข้าสู่ระบบ'}
              </span>
            </button>

            {/* Share Room Button */}
            <button
              onClick={onOpenShare}
              title="แชร์ห้อง / สิทธิ์การเข้าถึง"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">แชร์ห้อง</span>
            </button>

            {/* Export CSV (Desktop) */}
            <button
              onClick={onExportCSV}
              title="ส่งออกไฟล์ CSV"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>ส่งออก CSV</span>
            </button>

            {/* Bill Slip (Desktop) */}
            <button
              onClick={onOpenBillSlip}
              title="ดูใบแจ้งสรุปบิล"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>ใบสรุปบิล</span>
            </button>

            {/* Tour Guide Button */}
            <button
              onClick={onStartTour}
              title="แนะนำการใช้งาน (Tour)"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden xl:inline">แนะนำ</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              title="ตั้งค่าหอพัก & เรทราคา"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all cursor-pointer shadow-xs"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>

            {/* Primary Record Button (Tablet only) */}
            <button
              onClick={() => onOpenRecordModal('electricity')}
              className="hidden sm:flex md:hidden items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>จดบิล</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
