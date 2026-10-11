import React, { useState } from 'react';
import { 
  Zap, 
  Droplets, 
  Plus, 
  Maximize2, 
  ArrowRight,
  Building,
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
import { calculateElectricityCost, calculateWaterCost } from '../utils/rateCalculator';
import { ThaiBahtIcon } from './ThaiBahtIcon';

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
  const [displayMode, setDisplayMode] = useState<'cost' | 'units'>('cost');

  const isWaterFlatFee = summary.water.isFlatFee;
  const flatWaterCost = summary.water.currentCost;

  // Format chart data with cost & units from readings
  const chartData = React.useMemo(() => {
    if (!readings || readings.length === 0) return [];
    const sorted = [...readings].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const elecReadings = sorted.filter((r) => r.meterType === 'electricity');
    const waterReadings = sorted.filter((r) => r.meterType === 'water');

    const elecBase = elecReadings.length > 0 ? elecReadings[0].reading : 0;
    const waterBase = waterReadings.length > 0 ? waterReadings[0].reading : 0;

    const dateMap = new Map<string, {
      date: string;
      rawDate: Date;
      electricityUnits: number;
      electricityCost: number;
      waterUnits: number;
      waterCost: number;
    }>();

    // Map electricity readings chronologically
    elecReadings.forEach((r) => {
      const d = new Date(r.timestamp);
      const dKey = d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
      });
      const units = Math.max(0, Math.round((r.reading - elecBase) * 10) / 10);
      const costCalc = calculateElectricityCost(units, settings.rateConfig);

      dateMap.set(dKey, {
        date: dKey,
        rawDate: d,
        electricityUnits: units,
        electricityCost: costCalc.totalCost,
        waterUnits: 0,
        waterCost: isWaterFlatFee ? flatWaterCost : 0,
      });
    });

    // Map water readings if metered
    if (!isWaterFlatFee && waterReadings.length > 0) {
      waterReadings.forEach((r) => {
        const d = new Date(r.timestamp);
        const dKey = d.toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
        });
        const units = Math.max(0, Math.round((r.reading - waterBase) * 10) / 10);
        const costCalc = calculateWaterCost(units, settings.rateConfig);

        if (dateMap.has(dKey)) {
          const item = dateMap.get(dKey)!;
          item.waterUnits = units;
          item.waterCost = costCalc.totalCost;
        } else {
          dateMap.set(dKey, {
            date: dKey,
            rawDate: d,
            electricityUnits: 0,
            electricityCost: 0,
            waterUnits: units,
            waterCost: costCalc.totalCost,
          });
        }
      });
    }

    return Array.from(dateMap.values())
      .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
      .slice(-7)
      .map((item) => ({
        date: item.date,
        electricity: displayMode === 'cost' ? item.electricityCost : item.electricityUnits,
        water: displayMode === 'cost' ? item.waterCost : item.waterUnits,
        electricityCost: item.electricityCost,
        electricityUnits: item.electricityUnits,
        waterCost: item.waterCost,
        waterUnits: item.waterUnits,
      }));
  }, [readings, settings.rateConfig, isWaterFlatFee, flatWaterCost, displayMode]);

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

      {/* 2. Three Metric Cards Row (Minimal style without background boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: ค่าไฟ (ไอคอนไฟฟ้าสีเหลือง minimal ไม่มีพื้นหลัง) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4">
          <div className="shrink-0 flex items-center justify-center">
            <Zap className="w-8 h-8 sm:w-9 sm:h-9 text-amber-500 fill-amber-400 stroke-amber-500 stroke-[1.5]" />
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

        {/* Card 2: ค่าน้ำ (ไอคอนหยดน้ำ 2 หยด minimal ไม่มีพื้นหลัง) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4">
          <div className="shrink-0 flex items-center justify-center">
            <Droplets className="w-8 h-8 sm:w-9 sm:h-9 text-sky-500 stroke-sky-500 stroke-[1.8] fill-sky-400/25" />
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

        {/* Card 3: ยอดรวมโดยประมาณ (ไอคอนเงินบาทสีเขียว minimal ไม่มีพื้นหลัง) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/70 shadow-2xs hover:shadow-xs transition-all flex items-center gap-4">
          <div className="shrink-0 flex items-center justify-center">
            <ThaiBahtIcon className="w-8 h-8 sm:w-9 sm:h-9 text-emerald-500" />
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
            <div className="flex items-center gap-1.5 flex-wrap">
              {chartData.length > 0 && (
                <>
                  {/* Mode Toggle: Cost (฿) vs Units */}
                  <div className="flex items-center gap-0.5 text-[11px] bg-slate-50 p-1 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setDisplayMode('cost')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                        displayMode === 'cost' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      ยอดเงิน (฿)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('units')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                        displayMode === 'units' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      หน่วย
                    </button>
                  </div>

                  {/* Filter: Both / Elec / Water */}
                  <div className="flex items-center gap-1 text-[11px] bg-slate-50 p-1 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setActiveMetricTab('both')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                        activeMetricTab === 'both' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMetricTab('electricity')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                        activeMetricTab === 'electricity' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      ไฟ
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMetricTab('water')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                        activeMetricTab === 'water' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      น้ำ
                    </button>
                  </div>
                </>
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
            {activeMetricTab === 'water' && isWaterFlatFee ? (
              <div className="w-full h-56 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-sky-50/50 rounded-xl border border-sky-100">
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <Droplets className="w-6 h-6 fill-sky-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    ค่าน้ำเหมาจ่าย {summary.water.flatFeeDetail || `฿${flatWaterCost}/เดือน`}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    หอพักของคุณกำหนดค่าน้ำเป็นยอดเหมาจ่ายคงที่ <strong>฿{flatWaterCost.toLocaleString()} / เดือน</strong> ไม่คิดตามมิเตอร์ จึงไม่ต้องจดเลขหน้าปัดน้ำ
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-3 py-1 rounded-lg bg-white border border-sky-200 text-sky-800 text-xs font-mono font-bold shadow-2xs">
                    ยอดคงที่: ฿{flatWaterCost.toLocaleString()} / เดือน
                  </span>
                  <span className="text-[11px] text-slate-400">
                    (เหมาจ่าย ไม่ใช้มิเตอร์)
                  </span>
                </div>
              </div>
            ) : chartData.length > 0 ? (
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
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false}
                      tickFormatter={(val) => displayMode === 'cost' ? `฿${val}` : `${val}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        return (
                          <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-md text-xs space-y-1.5 min-w-[150px]">
                            <p className="font-bold text-slate-800 border-b border-slate-100 pb-1">{label}</p>
                            {payload.map((entry: any, idx: number) => {
                              const isElec = entry.dataKey === 'electricity';
                              const isWater = entry.dataKey === 'water';
                              const color = isElec ? '#f59e0b' : '#0ea5e9';
                              
                              let title = isElec ? 'ไฟฟ้า' : 'น้ำประปา';
                              let valText = '';
                              
                              if (displayMode === 'cost') {
                                title = isElec ? 'ค่าไฟ' : (isWaterFlatFee ? 'ค่าน้ำ (เหมาจ่าย)' : 'ค่าน้ำ');
                                valText = `฿${Number(entry.value).toLocaleString()}`;
                              } else {
                                if (isWater && isWaterFlatFee) {
                                  valText = 'เหมาจ่าย (ไม่มีมิเตอร์)';
                                } else {
                                  valText = `${entry.value} ${isElec ? 'หน่วย' : 'ยูนิต'}`;
                                }
                              }

                              return (
                                <div key={idx} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 font-medium text-slate-600">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <span>{title}:</span>
                                  </span>
                                  <span className="font-mono font-bold text-slate-900">{valText}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    {(activeMetricTab === 'both' || activeMetricTab === 'electricity') && (
                      <Area
                        type="monotone"
                        dataKey="electricity"
                        name={displayMode === 'cost' ? 'ค่าไฟ' : 'ไฟ (หน่วย)'}
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
                        name={displayMode === 'cost' ? (isWaterFlatFee ? 'ค่าน้ำ (เหมาจ่าย)' : 'ค่าน้ำ') : 'น้ำ (ยูนิต)'}
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
