import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Zap, 
  Snowflake, 
  Wind, 
  Monitor, 
  Flame, 
  Box, 
  Coffee, 
  Laptop, 
  Sparkles,
  Clock
} from 'lucide-react';
import { APPLIANCE_PRESETS } from '../utils/applianceData';
import type { UserSettings } from '../types';

interface ApplianceSimulatorProps {
  settings: UserSettings;
}

export const ApplianceSimulator: React.FC<ApplianceSimulatorProps> = ({ settings }) => {
  const [hoursMap, setHoursMap] = useState<{ [id: string]: number }>(() => {
    const initial: { [id: string]: number } = {};
    APPLIANCE_PRESETS.forEach((a) => {
      initial[a.id] = a.id === 'ac-inverter-12k' ? 8 : a.id === 'refrigerator' ? 24 : a.id === 'standing-fan' ? 8 : 0;
    });
    return initial;
  });

  const unitRate = settings.rateConfig.mode === 'dorm_flat'
    ? settings.rateConfig.electricityUnitRate
    : 4.2;

  const calculations = useMemo(() => {
    let totalDailyKwh = 0;
    let totalMonthlyKwh = 0;
    let totalDailyCost = 0;
    let totalMonthlyCost = 0;

    const items = APPLIANCE_PRESETS.map((app) => {
      const hours = hoursMap[app.id] ?? 0;
      const dailyKwh = (app.watts * hours) / 1000;
      const monthlyKwh = dailyKwh * 30;
      const dailyCost = dailyKwh * unitRate;
      const monthlyCost = monthlyKwh * unitRate;

      totalDailyKwh += dailyKwh;
      totalMonthlyKwh += monthlyKwh;
      totalDailyCost += dailyCost;
      totalMonthlyCost += monthlyCost;

      return {
        ...app,
        hours,
        dailyKwh: Math.round(dailyKwh * 100) / 100,
        monthlyKwh: Math.round(monthlyKwh * 10) / 10,
        dailyCost: Math.round(dailyCost * 10) / 10,
        monthlyCost: Math.round(monthlyCost),
      };
    });

    return {
      items,
      totalDailyKwh: Math.round(totalDailyKwh * 100) / 100,
      totalMonthlyKwh: Math.round(totalMonthlyKwh * 10) / 10,
      totalDailyCost: Math.round(totalDailyCost * 10) / 10,
      totalMonthlyCost: Math.round(totalMonthlyCost),
    };
  }, [hoursMap, unitRate]);

  const handleHourChange = (id: string, hours: number) => {
    setHoursMap((prev) => ({
      ...prev,
      [id]: hours,
    }));
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Snowflake': return <Snowflake className="w-4 h-4 text-cyan-600" />;
      case 'Wind': return <Wind className="w-4 h-4 text-amber-600" />;
      case 'Monitor': return <Monitor className="w-4 h-4 text-indigo-600" />;
      case 'Flame': return <Flame className="w-4 h-4 text-rose-600" />;
      case 'Box': return <Box className="w-4 h-4 text-blue-600" />;
      case 'Coffee': return <Coffee className="w-4 h-4 text-orange-600" />;
      case 'Laptop': return <Laptop className="w-4 h-4 text-emerald-600" />;
      default: return <Zap className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="clean-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <Calculator className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              คำนวณค่าไฟเครื่องใช้ไฟฟ้า
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            ปรับชั่วโมงการใช้งานเพื่อดูค่าไฟต่อเดือนตามเรทหอพักของคุณ (฿{unitRate}/หน่วย)
          </p>
        </div>

        {/* Big Total Monthly Badge */}
        <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">จำลองค่าไฟต่อเดือน</span>
            <span className="text-xl font-bold text-slate-900 font-mono">
              ฿{calculations.totalMonthlyCost.toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">คิดเป็นรายวัน</span>
            <span className="text-sm font-semibold text-slate-700 font-mono">
              ฿{calculations.totalDailyCost.toFixed(1)}/วัน
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Appliance Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {calculations.items.map((item) => (
          <div
            key={item.id}
            className={`clean-card p-4 transition-all ${
              item.hours > 0 ? 'bg-white border-slate-300 shadow-xs' : 'bg-slate-50/70 border-slate-200/80 opacity-80'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  {getIconComponent(item.icon)}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">{item.name}</h4>
                  <span className="text-[11px] text-slate-500 font-mono">{item.watts}W</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs font-bold font-mono text-slate-900">
                  ฿{item.monthlyCost.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block">/เดือน</span>
              </div>
            </div>

            {/* Slider */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  เปิดใช้งาน:
                </span>
                <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  {item.hours} ชม./วัน
                </span>
              </div>

              <input
                type="range"
                min="0"
                max={item.category === 'heating' ? '3' : item.id === 'kettle' || item.id === 'hair-dryer' ? '2' : '24'}
                step={item.category === 'heating' || item.id === 'kettle' || item.id === 'hair-dryer' ? '0.1' : '0.5'}
                value={item.hours}
                onChange={(e) => handleHourChange(item.id, parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
              />

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>0 ชม.</span>
                <span>{item.dailyCost > 0 ? `~฿${item.dailyCost}/วัน` : 'ปิด'}</span>
                <span>{item.category === 'heating' ? '3 ชม.' : item.id === 'kettle' || item.id === 'hair-dryer' ? '2 ชม.' : '24 ชม.'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Energy Saving Tips */}
      <div className="clean-card p-4 sm:p-5 bg-slate-50/80 space-y-2">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          เคล็ดลับประหยัดไฟหอพัก
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-0.5">
            <span className="font-semibold text-slate-900 block">❄️ แอร์ 26°C + พัดลม</span>
            <p className="text-[11px] text-slate-500">เย็นสบายเท่า 23°C แต่ประหยัดไฟเพิ่ม 10-15%</p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-0.5">
            <span className="font-semibold text-slate-900 block">🚿 ปิดเบรกเกอร์น้ำอุ่น</span>
            <p className="text-[11px] text-slate-500">เครื่องทำน้ำอุ่นกินไฟ 3,500W ปิดสวิตช์เมื่อใช้เสร็จ</p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-0.5">
            <span className="font-semibold text-slate-900 block">🧹 ล้างแผ่นกรองแอร์</span>
            <p className="text-[11px] text-slate-500">ล้างฝุ่นทุก 2 สัปดาห์ ลมแรงขึ้น คอมเพรสเซอร์ตัดเร็ว</p>
          </div>
        </div>
      </div>
    </div>
  );
};
