import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Crown,
  ShieldCheck,
  UserPlus,
  Trash2,
  LogIn,
  LogOut,
  Mail,
  Clock,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { AuthUser, RoomSummary, RoomMember, RoomInvite } from '../types';
import {
  listRoomMembers,
  listPendingInvites,
  createInvite,
  revokeInvite,
  removeRoomMember,
  deleteRoom,
  buildInviteUrl,
} from '../utils/roomService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  room: RoomSummary | null;
  onRequireLogin: () => void;
  onRoomRemoved: (roomId: string) => void;
  showToast: (msg: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  user,
  room,
  onRequireLogin,
  onRoomRemoved,
  showToast,
}) => {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [latestInvite, setLatestInvite] = useState<RoomInvite | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = room?.role === 'owner';

  const loadData = useCallback(async () => {
    if (!room) return;
    setIsLoading(true);
    try {
      const [nextMembers, nextInvites] = await Promise.all([
        listRoomMembers(room.id),
        room.role === 'owner' ? listPendingInvites(room.id) : Promise.resolve([]),
      ]);
      setMembers(nextMembers);
      setInvites(nextInvites);
    } catch {
      setError('โหลดรายชื่อสมาชิกไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, [room]);

  useEffect(() => {
    if (isOpen && user && room) {
      setError(null);
      setLatestInvite(null);
      loadData();
    }
  }, [isOpen, user, room, loadData]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleNativeShare = (invite: RoomInvite) => {
    const url = buildInviteUrl(invite.token);
    if (navigator.share) {
      navigator.share({
        title: `เชิญเข้าห้อง ${room?.roomNumber || ''} - JodBill`,
        text: `เข้าร่วมจัดการค่าน้ำค่าไฟห้อง ${room?.roomNumber || ''} (เข้าสู่ระบบด้วย ${invite.email})`,
        url,
      }).catch(() => {});
    } else {
      handleCopy(url, invite.id);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !user) return;
    const email = inviteEmail.trim().toLowerCase();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (members.some((m) => m.email?.toLowerCase() === email)) {
      setError('อีเมลนี้เป็นสมาชิกของห้องอยู่แล้ว');
      return;
    }

    setIsInviting(true);
    try {
      const invite = await createInvite(room.id, email, user.uid);
      setLatestInvite(invite);
      setInviteEmail('');
      setInvites((prev) => [invite, ...prev.filter((i) => i.email !== invite.email)]);
      showToast(`สร้างคำเชิญสำหรับ ${email} แล้ว`);
    } catch {
      setError('สร้างคำเชิญไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (invite: RoomInvite) => {
    try {
      await revokeInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (latestInvite?.id === invite.id) setLatestInvite(null);
      showToast(`ยกเลิกคำเชิญ ${invite.email} แล้ว`);
    } catch {
      setError('ยกเลิกคำเชิญไม่สำเร็จ');
    }
  };

  const handleRemoveMember = async (member: RoomMember) => {
    if (!room) return;
    if (!confirm(`ลบ ${member.displayName || member.email} ออกจากผู้ดูแลห้องนี้?`)) return;
    try {
      await removeRoomMember(room.id, member.userId);
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      showToast('ลบผู้ดูแลออกจากห้องแล้ว');
    } catch {
      setError('ลบสมาชิกไม่สำเร็จ');
    }
  };

  const handleLeaveRoom = async () => {
    if (!room || !user) return;
    if (!confirm('ออกจากห้องนี้? คุณจะไม่เห็นข้อมูลห้องนี้อีกจนกว่าเจ้าของจะเชิญใหม่')) return;
    try {
      await removeRoomMember(room.id, user.uid);
      onRoomRemoved(room.id);
      onClose();
    } catch {
      setError('ออกจากห้องไม่สำเร็จ');
    }
  };

  const handleDeleteRoom = async () => {
    if (!room) return;
    if (!confirm(`ลบห้อง "${room.dormName} ${room.roomNumber}" ถาวร? ข้อมูลมิเตอร์ทั้งหมดและผู้ดูแลทุกคนจะถูกลบ`)) return;
    try {
      await deleteRoom(room.id);
      onRoomRemoved(room.id);
      onClose();
    } catch {
      setError('ลบห้องไม่สำเร็จ');
    }
  };

  const latestInviteUrl = latestInvite ? buildInviteUrl(latestInvite.token) : '';

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
                แชร์ห้อง & จัดการผู้ดูแล
              </h2>
              <p className="text-xs text-slate-500">
                ผู้ดูแลจะเห็นและจัดการห้องได้เหมือนคุณ ข้อมูลอัปเดตแบบ Real-time
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

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {!user ? (
            <div className="text-center space-y-3 py-6">
              <p className="text-slate-600 leading-relaxed">
                การแชร์ห้องต้องเข้าสู่ระบบก่อน เพื่อให้ข้อมูลซิงค์กับผู้ดูแลคนอื่นได้แบบ Real-time
              </p>
              <button
                type="button"
                onClick={onRequireLogin}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบ</span>
              </button>
            </div>
          ) : !room ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>กำลังโหลดห้อง...</span>
            </div>
          ) : (
            <>
              {/* Room status */}
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {room.dormName} {room.roomNumber && `ห้อง ${room.roomNumber}`}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">{room.id}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] border ${
                  isOwner
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                  {isOwner ? '👑 เจ้าของห้อง' : '🛡️ ผู้ดูแล (Admin)'}
                </span>
              </div>

              {/* Invite form (owner only) */}
              {isOwner && (
                <form onSubmit={handleInvite} className="space-y-2">
                  <label className="font-semibold text-slate-800 block">เพิ่มผู้ดูแลด้วยอีเมล</label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="roommate@gmail.com"
                        className="w-full bg-slate-50 text-xs text-slate-800 pl-8 pr-3 py-2 rounded-lg border border-slate-200 focus:border-slate-900 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!inviteEmail || isInviting}
                      className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold shrink-0 cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      <span>เชิญ</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ผู้ได้รับเชิญต้องเข้าสู่ระบบด้วยอีเมลนี้เท่านั้น ห้องจะปรากฏให้อัตโนมัติเมื่อเข้าสู่ระบบ หรือส่งลิงก์ด้านล่างให้เขาเปิดก็ได้
                  </p>
                </form>
              )}

              {/* Freshly created invite link */}
              {isOwner && latestInvite && (
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <div className="p-2 bg-white border border-slate-200 rounded-xl shrink-0">
                    <QRCodeSVG value={latestInviteUrl} size={110} level="M" />
                  </div>
                  <div className="space-y-2 flex-1 w-full min-w-0">
                    <div className="text-slate-700">
                      ลิงก์เชิญสำหรับ <strong>{latestInvite.email}</strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={latestInviteUrl}
                        className="w-full bg-white text-[11px] font-mono text-slate-700 px-3 py-2 rounded-lg border border-slate-200 truncate focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(latestInviteUrl, latestInvite.id)}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white shrink-0 cursor-pointer"
                        title="คัดลอกลิงก์"
                      >
                        {copiedId === latestInvite.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNativeShare(latestInvite)}
                      className="w-full py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>ส่งลิงก์ผ่าน LINE / แอปอื่น</span>
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-rose-600 font-medium">{error}</p>}

              {/* Members */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  สมาชิกห้อง
                  {isLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </div>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {members.map((member) => (
                    <li key={member.userId} className="flex items-center gap-3 p-3">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0">
                          {(member.displayName || member.email || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">
                          {member.displayName || member.email}
                          {member.userId === user.uid && <span className="text-slate-400 font-normal"> (คุณ)</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{member.email}</div>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-slate-600 shrink-0">
                        {member.role === 'owner' ? (
                          <><Crown className="w-3.5 h-3.5 text-amber-600" /> เจ้าของ</>
                        ) : (
                          <><ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> ผู้ดูแล</>
                        )}
                      </span>
                      {isOwner && member.role !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="ลบออกจากห้อง"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                  {!isLoading && members.length === 0 && (
                    <li className="p-3 text-slate-400">ยังไม่มีสมาชิก</li>
                  )}
                </ul>
              </div>

              {/* Pending invites (owner only) */}
              {isOwner && invites.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-800">คำเชิญที่รอตอบรับ</div>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {invites.map((invite) => {
                      const expired = new Date(invite.expiresAt) < new Date();
                      return (
                        <li key={invite.id} className="flex items-center gap-3 p-3">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-800 truncate">{invite.email}</div>
                            <div className={`text-[11px] ${expired ? 'text-rose-600' : 'text-slate-500'}`}>
                              {expired
                                ? 'หมดอายุแล้ว — เชิญใหม่อีกครั้ง'
                                : `หมดอายุ ${new Date(invite.expiresAt).toLocaleDateString('th-TH')}`}
                            </div>
                          </div>
                          {!expired && (
                            <button
                              type="button"
                              onClick={() => handleCopy(buildInviteUrl(invite.token), invite.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                              title="คัดลอกลิงก์เชิญ"
                            >
                              {copiedId === invite.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRevoke(invite)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="ยกเลิกคำเชิญ"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Danger zone */}
              <div className="pt-1">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={handleDeleteRoom}
                    className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบห้องนี้</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ออกจากห้องนี้</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
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
