import React from 'react';
import { 
  Plus, 
  Calculator, 
  History as HistoryIcon, 
  LayoutDashboard,
  FileText
} from 'lucide-react';
import type { UserRole } from '../types';

interface BottomNavProps {
  activeTab: 'dashboard' | 'history' | 'simulator';
  setActiveTab: (tab: 'dashboard' | 'history' | 'simulator') => void;
  currentRole: UserRole;
  onOpenRecordModal: (type?: 'electricity' | 'water') => void;
  onOpenBillSlip: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  currentRole: _currentRole,
  onOpenRecordModal,
  onOpenBillSlip,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 md:hidden pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto relative">
        {/* Tab 1: Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-amber-50 text-amber-600' : ''}`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">แดชบอร์ด</span>
        </button>

        {/* Tab 2: History */}
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-all ${activeTab === 'history' ? 'bg-cyan-50 text-cyan-600' : ''}`}>
            <HistoryIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">ประวัติ</span>
        </button>

        {/* Center Floating Action Button (+ จดบิล) */}
        <div className="flex flex-col items-center justify-center -mt-6 px-1 shrink-0">
          <button
            onClick={() => onOpenRecordModal('electricity')}
            aria-label="จดมิเตอร์ใหม่"
            className="w-13 h-13 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-lg shadow-slate-900/25 active:scale-95 transition-all ring-4 ring-white cursor-pointer group"
          >
            <Plus className="w-6 h-6 text-amber-400 group-hover:rotate-90 transition-transform duration-200" />
          </button>
          <span className="text-[10px] font-bold text-slate-800 mt-1">จดบิล</span>
        </div>

        {/* Tab 3: Simulator */}
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
            activeTab === 'simulator'
              ? 'text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className={`relative p-1 rounded-xl transition-all ${activeTab === 'simulator' ? 'bg-emerald-50 text-emerald-600' : ''}`}>
            <Calculator className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">คำนวณแอร์</span>
        </button>

        {/* Tab 4: Bill Slip / Receipt */}
        <button
          onClick={onOpenBillSlip}
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
        >
          <div className="p-1 rounded-xl">
            <FileText className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">สรุปบิล</span>
        </button>
      </div>
    </nav>
  );
};
