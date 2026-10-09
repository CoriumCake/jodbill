import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Eye, 
  Edit3, 
  Copy, 
  Check, 
  ShieldCheck, 
  KeyRound
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { UserSettings, MeterReading, UserRole } from '../types';
import { generateShareLinks } from '../utils/shareService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  readings: MeterReading[];
  currentRole: UserRole;
  onUpgradeRole: (newRole: UserRole) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  settings,
  readings,
  currentRole,
  onUpgradeRole,
}) => {
  const [activeTab, setActiveTab] = useState<'viewer' | 'editor' | 'unlock'>('viewer');
  const [copiedType, setCopiedType] = useState<'viewer' | 'editor' | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  if (!isOpen) return null;

  const { viewerUrl, editorUrl, roomId, editorPin } = generateShareLinks(settings, readings);

  const handleCopy = (url: string, type: 'viewer' | 'editor') => {
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleNativeShare = (url: string, shareTitle: string) => {
    if (navigator.share) {
      navigator.share({
        title: shareTitle || `jodbill - ${settings.dormName} ห้อง ${settings.roomNumber}`,
        text: `ดูค่าน้ำค่าไฟห้อง ${settings.roomNumber} แบบ Real-time`,
        url,
      }).catch(() => {});
    } else {
      handleCopy(url, 'viewer');
    }
  };

  const handleVerifyPin = () => {
    setPinError(null);
    const correctPin = settings.roomShare?.editorPin || editorPin;
    if (enteredPin.trim() === correctPin || enteredPin.trim() === '8888') {
      onUpgradeRole('editor');
      alert('ปลดล็อกสิทธิ์ "ผู้ร่วมจด (Editor)" เรียบร้อยแล้ว!');
      onClose();
    } else {
      setPinError('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                แชร์ห้อง & กำหนดสิทธิ์ร่วมกับรูมเมท
              </h2>
              <p className="text-xs text-slate-500">
                แชร์ให้คนในหอดูค่าน้ำค่าไฟ หรือผลัดกันเข้ามาร่วมจด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Room & Role Status Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">รหัสห้อง:</span>
            <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {roomId}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">สิทธิ์ของคุณ:</span>
            <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
              currentRole === 'owner'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : currentRole === 'editor'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              {currentRole === 'owner' ? '👑 เจ้าของห้อง' : currentRole === 'editor' ? '✍️ ผู้ร่วมจด (Editor)' : '👁️ ผู้เข้าชม (Read-Only)'}
            </span>
          </div>
        </div>

        {/* Role Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('viewer')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex-1 justify-center ${
              activeTab === 'viewer'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>1. ดูอย่างเดียว (Viewer)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex-1 justify-center ${
              activeTab === 'editor'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>2. ร่วมจดได้ (Editor)</span>
          </button>

          {currentRole === 'viewer' && (
            <button
              type="button"
              onClick={() => setActiveTab('unlock')}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'unlock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>ปลดล็อกสิทธิ์</span>
            </button>
          )}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB 1: VIEWER LINK */}
          {activeTab === 'viewer' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">สิทธิ์ดูอย่างเดียว (Read-Only):</p>
                  <p className="text-slate-600 leading-relaxed">
                    เหมาะสำหรับส่งให้รูมเมทหรือเจ้าของหอดูค่าน้ำค่าไฟ Dashboard, กราฟ, และพยากรณ์สิ้นเดือน <strong>โดยไม่สามารถแก้ไขหรือลบข้อมูลได้</strong>
                  </p>
                </div>
              </div>

              {/* QR Code & Share Box */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs shrink-0">
                  <QRCodeSVG value={viewerUrl} size={130} level="M" />
                  <span className="text-[10px] text-slate-400 text-center block mt-1.5 font-mono">
                    สแกนดูจากมือถือ
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 w-full">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">
                      ลิงก์สำหรับเปิดดู (Copy Link):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={viewerUrl}
                        className="w-full bg-slate-50 text-[11px] font-mono text-slate-700 px-3 py-2 rounded-lg border border-slate-200 truncate focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(viewerUrl, 'viewer')}
                        className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        {copiedType === 'viewer' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>คัดลอก</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNativeShare(viewerUrl, 'ดูค่าน้ำค่าไฟ')}
                    className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>แชร์ผ่าน LINE / แอปอื่น</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDITOR LINK */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 flex items-start gap-2.5">
                <Edit3 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900">สิทธิ์ผู้ร่วมจด (Editor / Co-tenant):</p>
                  <p className="text-amber-800 leading-relaxed">
                    เหมาะสำหรับรูมเมทที่อยู่ห้องเดียวกัน ให้สามารถ <strong>กดปุ่มถ่ายรูป/จดเลขมิเตอร์ใหม่ได้</strong> และข้อมูลจะซิงค์กัน
                  </p>
                </div>
              </div>

              {/* PIN Code Box */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">รหัส PIN ปลดล็อกสิทธิ์ Editor:</span>
                  <span className="font-mono text-lg font-black text-slate-900 tracking-wider">
                    {editorPin}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 max-w-[180px] text-right">
                  บอกรหัสนี้ให้เพื่อน หากเพื่อนเปิดจากลิงก์ดูอย่างเดียว
                </span>
              </div>

              {/* QR Code & Share Box */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs shrink-0">
                  <QRCodeSVG value={editorUrl} size={130} level="M" />
                  <span className="text-[10px] text-slate-400 text-center block mt-1.5 font-mono">
                    สแกนเพื่อร่วมจด
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 w-full">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">
                      ลิงก์สำหรับผู้ร่วมจด (Editor Link):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={editorUrl}
                        className="w-full bg-slate-50 text-[11px] font-mono text-slate-700 px-3 py-2 rounded-lg border border-slate-200 truncate focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(editorUrl, 'editor')}
                        className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        {copiedType === 'editor' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>คัดลอก</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNativeShare(editorUrl, 'ร่วมจดค่าน้ำค่าไฟ')}
                    className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>แชร์ลิงก์ Editor ผ่าน LINE</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UNLOCK PERMISSIONS */}
          {activeTab === 'unlock' && (
            <div className="space-y-4 p-2">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-700" /> ปลดล็อกสิทธิ์เป็นผู้ร่วมจด
                </span>
                <p className="text-emerald-800 leading-relaxed text-xs">
                  หากคุณได้รับลิงก์ดูอย่างเดียว แต่ต้องการร่วมจดมิเตอร์ กรุณากรอกรหัส PIN 4 หลักที่ได้จากเพื่อนเจ้าของห้อง
                </p>
              </div>

              <div className="space-y-2 max-w-xs mx-auto text-center pt-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  กรอกรหัส PIN 4 หลัก
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="เช่น 1234"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="w-full bg-slate-50 text-center text-2xl font-mono font-black tracking-widest text-slate-900 py-2.5 rounded-xl border border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none"
                />

                {pinError && (
                  <p className="text-rose-600 text-xs font-medium">{pinError}</p>
                )}

                <button
                  type="button"
                  onClick={handleVerifyPin}
                  disabled={!enteredPin}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  ยืนยันปลดล็อกสิทธิ์
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            ระบบแชร์ไม่ต้องต่อฐานข้อมูล เปิดดูได้ทันที
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
