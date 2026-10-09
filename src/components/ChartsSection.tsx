import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { TrendingUp, Calendar, Zap, Droplets } from 'lucide-react';
import type { MeterReading, UserSettings } from '../types';

interface ChartsSectionProps {
  readings: MeterReading[];
  settings: UserSettings;
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ readings, settings }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d' | 'all'>('14d');
  const [chartType, setChartType] = useState<'daily' | 'cycles'>('daily');

  const chartData = useMemo(() => {
    const sorted = [...readings].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const daysMap = new Map<string, { date: string; electricity: number; water: number; elecCount: number; waterCount: number; timestamp: number }>();

    let lastElecReading: MeterReading | null = null;
    let lastWaterReading: MeterReading | null = null;

    sorted.forEach((reading) => {
      const dateKey = new Date(reading.timestamp).toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric',
      });
      const ts = new Date(reading.timestamp).getTime();

      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          date: dateKey,
          electricity: 0,
          water: 0,
          elecCount: 0,
          waterCount: 0,
          timestamp: ts,
        });
      }

      const dayObj = daysMap.get(dateKey)!;

      if (reading.meterType === 'electricity') {
        if (lastElecReading) {
          const delta = Math.max(0, reading.reading - lastElecReading.reading);
          dayObj.electricity += delta;
        }
        lastElecReading = reading;
        dayObj.elecCount++;
      } else {
        if (lastWaterReading) {
          const delta = Math.max(0, reading.reading - lastWaterReading.reading);
          dayObj.water += delta;
        }
        lastWaterReading = reading;
        dayObj.waterCount++;
      }
    });

    let arr = Array.from(daysMap.values()).map((d) => ({
      ...d,
      electricity: Math.round(d.electricity * 10) / 10,
      water: Math.round(d.water * 10) / 10,
    }));

    const cutoffDays = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : timeRange === '30d' ? 30 : 999;
    if (cutoffDays !== 999 && arr.length > cutoffDays) {
      arr = arr.slice(-cutoffDays);
    }

    return arr;
  }, [readings, timeRange]);

  const cycleComparisonData = useMemo(() => {
    const groups: { [month: string]: { month: string; elecUnits: number; waterUnits: number; estCost: number } } = {};

    readings.forEach((r) => {
      const d = new Date(r.timestamp);
      const mKey = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      if (!groups[mKey]) {
        groups[mKey] = { month: mKey, elecUnits: 0, waterUnits: 0, estCost: 0 };
      }
      if (r.unitsUsed) {
        if (r.meterType === 'electricity') {
          groups[mKey].elecUnits += r.unitsUsed;
        } else {
          groups[mKey].waterUnits += r.unitsUsed;
        }
      }
    });

    const list = Object.values(groups).map((g) => ({
      ...g,
      elecUnits: Math.round(g.elecUnits * 10) / 10,
      waterUnits: Math.round(g.waterUnits * 10) / 10,
      costElec: Math.round(g.elecUnits * (settings.rateConfig.mode === 'dorm_flat' ? settings.rateConfig.electricityUnitRate : 4.2)),
      costWater: Math.round(g.waterUnits * (settings.rateConfig.mode === 'dorm_flat' ? settings.rateConfig.waterUnitRate : 10.5)),
    }));

    return list.slice(-5);
  }, [readings, settings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2.5 rounded-xl border border-slate-200 bg-white shadow-md text-xs space-y-1">
          <p className="font-semibold text-slate-900 border-b border-slate-100 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                {entry.dataKey === 'electricity' ? <Zap className="w-3 h-3 fill-current" /> : <Droplets className="w-3 h-3 fill-current" />}
                {entry.dataKey === 'electricity' ? 'ไฟฟ้า' : 'น้ำประปา'}:
              </span>
              <span className="font-mono font-bold text-slate-900">
                {entry.value} {entry.dataKey === 'electricity' ? 'หน่วย' : 'ยูนิต'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="tour-charts" className="clean-card p-5 sm:p-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-slate-700" />
            แนวโน้มการใช้งาน
          </h3>
          <p className="text-xs text-slate-500">
            สถิติการใช้ไฟและน้ำรายวัน
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Chart Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setChartType('daily')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                chartType === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายวัน
            </button>
            <button
              onClick={() => setChartType('cycles')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                chartType === 'cycles'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายเดือน
            </button>
          </div>

          {/* Time range selector */}
          {chartType === 'daily' && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              {(['7d', '14d', '30d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2 py-1 rounded-md font-medium transition-all uppercase ${
                    timeRange === r
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r === 'all' ? 'ทั้งหมด' : r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-64 sm:h-72">
        {chartType === 'daily' ? (
          chartData.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
              <Calendar className="w-6 h-6 opacity-40" />
              <span>ยังไม่มีข้อมูลเพียงพอสำหรับแสดงกราฟ</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="elecGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="electricity"
                  name="ไฟฟ้า (kWh)"
                  stroke="#d97706"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#elecGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="water"
                  name="น้ำประปา (m³)"
                  stroke="#0284c7"
                  strokeWidth={1.75}
                  fillOpacity={1}
                  fill="url(#waterGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cycleComparisonData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="costElec" name="ค่าไฟ (฿)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="costWater" name="ค่าน้ำ (฿)" fill="#0284c7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend Indicators */}
      <div className="flex items-center justify-center gap-6 text-xs text-slate-500 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>ไฟฟ้า (kWh)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
          <span>น้ำประปา (m³)</span>
        </div>
      </div>
    </div>
  );
};
