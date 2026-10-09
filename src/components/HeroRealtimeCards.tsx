import React from 'react';
import { 
  Zap, 
  Droplets, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  Plus
} from 'lucide-react';
import type { CycleSummary, UserSettings } from '../types';

interface HeroRealtimeCardsProps {
  summary: CycleSummary;
  settings: UserSettings;
  onOpenRecord: (type: 'electricity' | 'water') => void;
  hasReadings?: boolean;
}

export const HeroRealtimeCards: React.FC<HeroRealtimeCardsProps> = ({
  summary,
  settings,
  onOpenRecord,
}) => {
  const { electricity, water, daysRemaining, daysPassed, cycleName } = summary;

  const formatOdometer = (val: number) => {
    const parts = val.toFixed(1).split('.');
    const whole = parts[0].padStart(5, '0');
    const decimal = parts[1] || '0';
    return { whole, decimal };
  };

  const elecOdometer = formatOdometer(electricity.currentReading);
  const waterOdometer = formatOdometer(water.currentReading);

  return (
    <div id="tour-hero-cards" className="space-y-4">
      {/* Top Banner: Cycle Summary & Total Projection */}
      <div className="clean-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              สถานะรอบบิล
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs font-medium text-slate-700">
              {cycleName}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            ผ่านไปแล้ว <span className="font-semibold text-slate-800">{daysPassed} วัน</span> / เหลืออีก{' '}
            <span className="font-semibold text-slate-800">{daysRemaining} วัน</span> (ตัดรอบวันที่ {settings.billingCutoffDay})
          </p>
        </div>

        {/* Total Cost Badges */}
        <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">ประมาณการบิลสิ้นเดือน</span>
            <span className="text-lg font-bold text-slate-900 font-mono">
              ฿{summary.totalProjectedCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">ใช้ไปแล้วตอนนี้</span>
            <span className="text-sm font-semibold text-slate-700 font-mono">
              ฿{summary.totalCurrentCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2 Main Cards: Electricity & Water */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ================= ELECTRICITY CARD ================= */}
        <div className="clean-card clean-card-hover p-5 sm:p-6 space-y-4">
          {/* Card Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
                <Zap className="w-4 h-4 fill-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">ค่าไฟฟ้า</h3>
                  {electricity.status === 'danger' ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertTriangle className="w-2.5 h-2.5" /> เกินงบ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" /> ในงบ
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  {settings.rateConfig.mode === 'dorm_flat'
                    ? `฿${settings.rateConfig.electricityUnitRate}/หน่วย`
                    : `อัตราก้าวหน้า ${settings.rateConfig.provider}`}
                </span>
              </div>
            </div>

            <button
              onClick={() => onOpenRecord('electricity')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>จดมิเตอร์</span>
            </button>
          </div>

          {/* Numbers Grid */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[11px] font-medium text-slate-500">ประมาณการสิ้นเดือน</span>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                ฿{electricity.projectedCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <span className="text-xs text-slate-500 font-mono">
                ~{electricity.projectedUnits} หน่วย (kWh)
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-medium text-slate-500">ใช้ไปแล้วรอบนี้</span>
              <div className="text-xl font-bold text-slate-700 font-mono mt-0.5">
                ฿{electricity.currentCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <span className="text-xs font-semibold text-amber-600 font-mono">
                {electricity.unitsUsed} หน่วย
              </span>
            </div>
          </div>

          {/* Odometer & Daily Burn Pace */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block mb-1">เลขมิเตอร์ล่าสุด</span>
              <div className="meter-odometer text-sm sm:text-base">
                <span>{elecOdometer.whole}</span>
                <span className="decimal">.{elecOdometer.decimal}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" />
                อัตราใช้เฉลี่ย
              </span>
              <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                {electricity.dailyAvgUnits} หน่วย/วัน
              </span>
              <span className="text-[10px] text-slate-500">~฿{electricity.dailyAvgCost}/วัน (~฿{electricity.hourlyCost}/ชม.)</span>
            </div>
          </div>

          {/* Budget Bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500">งบ: ฿{settings.budgetElectricity.toLocaleString()}</span>
              <span className={`font-mono font-semibold ${electricity.budgetPercent > 100 ? 'text-rose-600' : 'text-slate-700'}`}>
                {electricity.budgetPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  electricity.budgetPercent > 100 ? 'bg-rose-500' : electricity.budgetPercent > 80 ? 'bg-amber-500' : 'bg-slate-900'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, electricity.budgetPercent))}%` }}
              />
            </div>
          </div>
        </div>

        {/* ================= WATER CARD ================= */}
        <div className="clean-card clean-card-hover p-5 sm:p-6 space-y-4">
          {/* Card Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200/60">
                <Droplets className="w-4 h-4 fill-cyan-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">ค่าน้ำประปา</h3>
                  {water.status === 'danger' ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertTriangle className="w-2.5 h-2.5" /> เกินงบ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" /> ในงบ
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  {water.isFlatFee
                    ? (water.flatFeeDetail || 'ค่าน้ำแบบเหมาจ่าย')
                    : (settings.rateConfig.mode === 'dorm_flat'
                        ? `฿${settings.rateConfig.waterUnitRate}/ยูนิต`
                        : `มาตรฐาน ฿${settings.rateConfig.waterUnitRate}/ยูนิต`)}
                </span>
              </div>
            </div>

            <button
              onClick={() => onOpenRecord('water')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>จดมิเตอร์</span>
            </button>
          </div>

          {/* Numbers Grid */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[11px] font-medium text-slate-500">ประมาณการสิ้นเดือน</span>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                ฿{water.projectedCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <span className="text-xs text-slate-500 font-mono">
                ~{water.projectedUnits} ยูนิต (m³)
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-medium text-slate-500">ใช้ไปแล้วรอบนี้</span>
              <div className="text-xl font-bold text-slate-700 font-mono mt-0.5">
                ฿{water.currentCost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <span className="text-xs font-semibold text-cyan-600 font-mono">
                {water.unitsUsed} ยูนิต
              </span>
            </div>
          </div>

          {/* Odometer & Daily Average */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block mb-1">เลขมิเตอร์ล่าสุด</span>
              <div className="meter-odometer text-sm sm:text-base">
                <span>{waterOdometer.whole}</span>
                <span className="decimal">.{waterOdometer.decimal}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-cyan-500" />
                อัตราใช้เฉลี่ย
              </span>
              <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                {water.dailyAvgUnits} ยูนิต/วัน
              </span>
              <span className="text-[10px] text-slate-500">~฿{water.dailyAvgCost}/วัน ({water.readingsCount} บันทึก)</span>
            </div>
          </div>

          {/* Budget Bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500">งบ: ฿{settings.budgetWater.toLocaleString()}</span>
              <span className={`font-mono font-semibold ${water.budgetPercent > 100 ? 'text-rose-600' : 'text-slate-700'}`}>
                {water.budgetPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  water.budgetPercent > 100 ? 'bg-rose-500' : water.budgetPercent > 80 ? 'bg-cyan-500' : 'bg-slate-900'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, water.budgetPercent))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
