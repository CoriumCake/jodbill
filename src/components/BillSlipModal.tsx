import React from 'react';
import { 
  X, 
  Printer, 
  Zap, 
  Droplets, 
  FileText
} from 'lucide-react';
import type { CycleSummary, UserSettings } from '../types';

interface BillSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: CycleSummary;
  settings: UserSettings;
}

export const BillSlipModal: React.FC<BillSlipModalProps> = ({
  isOpen,
  onClose,
  summary,
  settings,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const { electricity, water, cycleName } = summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-800">ใบสรุปประมาณการบิล</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-all text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Slip */}
        <div className="p-6 bg-white text-slate-800 space-y-4 print:p-0">
          <div className="text-center pb-3 border-b border-dashed border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              {settings.dormName || 'ใบแจ้งค่าใช้จ่ายห้องพัก'}
            </h2>
            <p className="text-xs font-semibold text-slate-600 mt-0.5 font-mono">
              ห้อง {settings.roomNumber}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {cycleName} (ตัดรอบวันที่ {settings.billingCutoffDay})
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Electricity */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  ค่าไฟฟ้า
                </span>
                <span className="font-mono text-sm">
                  ฿{electricity.projectedCost.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-slate-500 font-mono text-[10px] pt-1 border-t border-slate-200/60">
                <div>
                  <span className="block text-slate-400">เลขต้นรอบ</span>
                  <span className="font-semibold text-slate-700">{electricity.startReading.toFixed(1)}</span>
                </div>
                <div>
                  <span className="block text-slate-400">เลขอ่านล่าสุด</span>
                  <span className="font-semibold text-slate-700">{electricity.currentReading.toFixed(1)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-slate-400">หน่วยสิ้นเดือน</span>
                  <span className="font-semibold text-slate-900">~{electricity.projectedUnits} kWh</span>
                </div>
              </div>
            </div>

            {/* Water */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-600 fill-cyan-600" />
                  ค่าน้ำประปา {water.isFlatFee && <span className="text-[10px] font-normal text-slate-500">({water.flatFeeDetail})</span>}
                </span>
                <span className="font-mono text-sm">
                  ฿{water.projectedCost.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-slate-500 font-mono text-[10px] pt-1 border-t border-slate-200/60">
                <div>
                  <span className="block text-slate-400">เลขต้นรอบ</span>
                  <span className="font-semibold text-slate-700">{water.startReading.toFixed(1)}</span>
                </div>
                <div>
                  <span className="block text-slate-400">เลขอ่านล่าสุด</span>
                  <span className="font-semibold text-slate-700">{water.currentReading.toFixed(1)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-slate-400">{water.isFlatFee ? 'รูปแบบคิดเงิน' : 'ยูนิตสิ้นเดือน'}</span>
                  <span className="font-semibold text-slate-900">{water.isFlatFee ? 'เหมาจ่าย' : `~${water.projectedUnits} m³`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">
                  ยอดรวมประมาณการ
                </span>
                <span className="text-[10px] text-slate-400">
                  (คำนวณตามอัตราใช้จริง)
                </span>
              </div>
              <span className="text-xl font-black text-slate-900 font-mono">
                ฿{summary.totalProjectedCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400">
            สร้างโดย jodbill • {new Date().toLocaleString('th-TH')}
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50 print:hidden flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
