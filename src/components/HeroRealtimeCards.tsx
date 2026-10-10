import React, { useState } from 'react';
import { 
  Zap, 
  Droplets, 
  Plus, 
  Maximize2, 
  ArrowRight,
  Building,
  Sprout,
  FileText,
  Share2,
  MapPin
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import type { CycleSummary, UserSettings, MeterReading } from '../types';

interface HeroRealtimeCardsProps {
  summary: CycleSummary;
  settings: UserSettings;
  readings?: MeterReading[];
  onOpenRecord: (type: 'electricity' | 'water') => void;
  onOpenBillSlip?: () => void;
  onOpenShare?: () => void;
  hasReadings?: boolean;
}

export const HeroRealtimeCards: React.FC<HeroRealtimeCardsProps> = ({
  summary,
  settings,
  readings = [],
  onOpenRecord,
  onOpenBillSlip,
  onOpenShare,
  hasReadings: _hasReadings = false,
}) => {
  const { electricity, water, monthlyRent } = summary;
  const [activeMetricTab, setActiveMetricTab] = useState<'both' | 'electricity' | 'water'>('both');

  // Format chart data from readings if available
  const chartData = React.useMemo(() => {
    if (!readings || readings.length === 0) return [];
    const sorted = [...readings].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const map = new Map<string, { date: string; electricity: number; water: number }>();
    sorted.forEach((r) => {
      const d = new Date(r.timestamp).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
      });
      if (!map.has(d)) {
        map.set(d, { date: d, electricity: 0, water: 0 });
      }
      const item = map.get(d)!;
      if (r.meterType === 'electricity') {
        item.electricity = r.reading;
      } else {
        item.water = r.reading;
      }
    });

    return Array.from(map.values()).slice(-7);
  }, [readings]);

  // Total projected calculation
  const totalProjected = monthlyRent > 0 
    ? summary.totalProjectedWithRent 
    : summary.totalProjectedCost;

  return (
    <div className="space-y-6">
      {/* 1. Page Header (matches "สวนวันนี้" in reference) */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              ภาพรวมวันนี้
            </h2>
            {/* Clean Plus Button right next to title (matches "+" in reference) */}
            <button
              type="button"
              onClick={() => onOpenRecord('electricity')}
              title="จดมิเตอร์ใหม่"
              className="w-8 h-8 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 flex items-center justify-center text-slate-700 shadow-2xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-700" />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            ติดตามสภาพแวดล้อมและสถานะมิเตอร์จากจุดเดียว
          </p>
        </div>
      </div>

      {/* 2. Three Metric Cards Row (matches 3 cards in reference) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: ค่าไฟ (matches อุณหภูมิ / red icon) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
            {/* Thermometer / Zap Icon */}
            <Zap className="w-6 h-6 text-rose-500 fill-rose-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-500">
              ค่าไฟรอบนี้
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono mt-0.5">
              {electricity.currentCost > 0 ? `฿${electricity.currentCost.toLocaleString()}` : '— ฿'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {electricity.dailyAvgUnits > 0
                ? `ค่าเฉลี่ย 24 ชม.ล่าสุด ${electricity.dailyAvgUnits} หน่วย`
                : 'ยังไม่มีประวัติการใช้'}
            </div>
          </div>
        </div>

        {/* Card 2: ค่าน้ำ (matches ความชื้นอากาศ / blue droplet icon) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0">
            <Droplets className="w-6 h-6 text-sky-500 fill-sky-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-500">
              ค่าน้ำรอบนี้
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono mt-0.5">
              {water.currentCost > 0 ? `฿${water.currentCost.toLocaleString()}` : '— ฿'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {water.dailyAvgUnits > 0
                ? `ค่าเฉลี่ย 24 ชม.ล่าสุด ${water.dailyAvgUnits} ยูนิต`
                : (water.isFlatFee ? water.flatFeeDetail : 'ยังไม่มีประวัติการใช้')}
            </div>
          </div>
        </div>

        {/* Card 3: ยอดรวมรอบนี้ / ความชื้นดิน (matches green sprout icon) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Sprout className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-500">
              ยอดรวมโดยประมาณ
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono mt-0.5">
              {totalProjected > 0 ? `฿${totalProjected.toLocaleString()}` : '— ฿'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {monthlyRent > 0
                ? `รวมค่าเช่าห้อง ฿${monthlyRent.toLocaleString()}`
                : 'รวมค่าน้ำและค่าไฟฟ้า'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lower 2-Column Grid (matches left map + right device status) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column (7 of 12 cols): Graph / Recent Trend (matches แผนที่อุปกรณ์) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs flex flex-col justify-between min-h-[340px]">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                แนวโน้มการใช้งาน
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                ประวัติและการใช้พลังงาน
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {chartData.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] bg-slate-50 p-1 rounded-lg border border-slate-200/60">
                  <button
                    onClick={() => setActiveMetricTab('both')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      activeMetricTab === 'both' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    onClick={() => setActiveMetricTab('electricity')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      activeMetricTab === 'electricity' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    ไฟ
                  </button>
                  <button
                    onClick={() => setActiveMetricTab('water')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      activeMetricTab === 'water' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    น้ำ
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => onOpenRecord('electricity')}
                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                title="ขยายมุมมอง"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chart or Placeholder */}
          <div className="flex-1 flex items-center justify-center w-full min-h-[220px]">
            {chartData.length > 0 ? (
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="elecGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      }}
                    />
                    {(activeMetricTab === 'both' || activeMetricTab === 'electricity') && (
                      <Area
                        type="monotone"
                        dataKey="electricity"
                        name="มิเตอร์ไฟ"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#elecGrad)"
                      />
                    )}
                    {(activeMetricTab === 'both' || activeMetricTab === 'water') && (
                      <Area
                        type="monotone"
                        dataKey="water"
                        name="มิเตอร์น้ำ"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#waterGrad)"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              /* Clean Minimal Empty Placeholder matching the reference screenshot map */
              <div className="w-full h-full bg-slate-50/60 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100/60 text-amber-700 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    ยังไม่มีข้อมูลการจดมิเตอร์
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    กดปุ่ม + ด้านบนเพื่อเริ่มบันทึกเลขหน้าปัดรอบนี้
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenRecord('electricity')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                >
                  + จดมิเตอร์รอบแรก
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 of 12 cols): Device / Bill Status (matches สถานะอุปกรณ์) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs flex flex-col justify-between min-h-[340px]">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  สรุปรอบบิล
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  สถานะบิลรอบนี้
                </h3>
              </div>
              {onOpenBillSlip && (
                <button
                  type="button"
                  onClick={onOpenBillSlip}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>ดูทั้งหมด</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bill Breakdown Box */}
            <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 text-xs">
              {monthlyRent > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>ค่าเช่าห้องพัก</span>
                  </span>
                  <span className="font-mono font-medium text-slate-800">
                    ฿{monthlyRent.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>ค่าไฟฟ้า ({electricity.unitsUsed} หน่วย)</span>
                </span>
                <span className="font-mono font-medium text-slate-800">
                  ฿{electricity.currentCost.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-sky-500" />
                  <span>ค่าน้ำประปา ({water.unitsUsed} ยูนิต)</span>
                </span>
                <span className="font-mono font-medium text-slate-800">
                  ฿{water.currentCost.toLocaleString()}
                </span>
              </div>

              {settings.rateConfig.mode === 'dorm_flat' && settings.rateConfig.electricityFixedFee > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>ค่าส่วนกลาง/บำรุงรักษา</span>
                  <span className="font-mono font-medium text-slate-800">
                    ฿{settings.rateConfig.electricityFixedFee.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between font-bold text-slate-900">
                <span>ยอดรวมสุทธิ</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  ฿{totalProjected.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-4">
            <button
              type="button"
              onClick={onOpenBillSlip}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>พิมพ์สลิปบิล</span>
            </button>
            <button
              type="button"
              onClick={onOpenShare}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>แชร์ห้อง</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
