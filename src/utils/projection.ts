import type { MeterReading, UserSettings, CycleSummary, MeterType } from '../types';
import { calculateElectricityCost, calculateWaterCost } from './rateCalculator';

export function getBillingCycleRange(cutoffDay: number, referenceDate: Date = new Date()): { start: Date; end: Date; cycleName: string } {
  const currentDay = referenceDate.getDate();
  const currentMonth = referenceDate.getMonth();
  const currentYear = referenceDate.getFullYear();

  let start: Date;
  let end: Date;

  if (currentDay >= cutoffDay) {
    start = new Date(currentYear, currentMonth, cutoffDay, 0, 0, 0, 0);
    end = new Date(currentYear, currentMonth + 1, cutoffDay, 23, 59, 59, 999);
  } else {
    start = new Date(currentYear, currentMonth - 1, cutoffDay, 0, 0, 0, 0);
    end = new Date(currentYear, currentMonth, cutoffDay, 23, 59, 59, 999);
  }

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const cycleName = `รอบ ${cutoffDay} ${thaiMonths[start.getMonth()]} - ${cutoffDay} ${thaiMonths[end.getMonth()]} ${(end.getFullYear() + 543).toString().slice(-2)}`;

  return { start, end, cycleName };
}

export function calculateCycleSummary(
  readings: MeterReading[],
  settings: UserSettings,
  refDate: Date = new Date()
): CycleSummary {
  const { start, end, cycleName } = getBillingCycleRange(settings.billingCutoffDay, refDate);
  
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysTotal = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay));
  
  const msPassed = Math.max(1000 * 60 * 60 * 12, refDate.getTime() - start.getTime());
  const daysPassed = Math.min(daysTotal, Math.max(0.5, msPassed / msPerDay));
  const daysRemaining = Math.max(0, daysTotal - daysPassed);

  const elecReadings = readings
    .filter((r) => r.meterType === 'electricity')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const waterReadings = readings
    .filter((r) => r.meterType === 'water')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const isWaterFlatFee = settings.rateConfig.mode === 'dorm_flat' && 
    (settings.rateConfig.waterBillingType === 'flat_monthly' || settings.rateConfig.waterBillingType === 'per_person');

  function computeUtilityMetrics(
    utilityReadings: MeterReading[],
    type: MeterType,
    budget: number
  ) {
    if (utilityReadings.length === 0) {
      // If flat fee water with 0 readings, projected cost is still the fixed flat amount!
      let currentCost = 0;
      let projectedCost = 0;
      if (type === 'water' && isWaterFlatFee) {
        const flatBreakdown = calculateWaterCost(0, settings.rateConfig);
        currentCost = flatBreakdown.totalCost;
        projectedCost = flatBreakdown.totalCost;
      }

      return {
        startReading: 0,
        currentReading: 0,
        unitsUsed: 0,
        currentCost,
        dailyAvgUnits: 0,
        dailyAvgCost: type === 'water' && isWaterFlatFee ? Math.round((projectedCost / daysTotal) * 10) / 10 : 0,
        hourlyCost: 0,
        projectedUnits: 0,
        projectedCost,
        budgetPercent: budget > 0 ? Math.round((projectedCost / budget) * 100) : 0,
        status: 'safe' as const,
        readingsCount: 0,
      };
    }

    const inCycleReadings = utilityReadings.filter(
      (r) => new Date(r.timestamp).getTime() >= start.getTime() && new Date(r.timestamp).getTime() <= end.getTime()
    );

    let baseline = utilityReadings.filter((r) => new Date(r.timestamp).getTime() <= start.getTime()).pop();
    if (!baseline && inCycleReadings.length > 0) {
      baseline = inCycleReadings[0];
    }

    const latest = utilityReadings[utilityReadings.length - 1];
    const startReading = baseline ? baseline.reading : (inCycleReadings[0]?.reading || latest.reading);
    const currentReading = latest.reading;

    const unitsUsed = Math.max(0, Math.round((currentReading - startReading) * 10) / 10);
    
    let currentCost = 0;
    let projectedCost = 0;

    if (type === 'electricity') {
      currentCost = calculateElectricityCost(unitsUsed, settings.rateConfig).totalCost;
    } else {
      currentCost = calculateWaterCost(unitsUsed, settings.rateConfig).totalCost;
    }

    const dailyAvgUnits = Math.round((unitsUsed / daysPassed) * 100) / 100;
    const dailyAvgCost = Math.round((currentCost / daysPassed) * 100) / 100;
    const hourlyCost = Math.round((dailyAvgCost / 24) * 100) / 100;

    const projectedUnits = Math.round((dailyAvgUnits * daysTotal) * 10) / 10;
    
    if (type === 'electricity') {
      projectedCost = calculateElectricityCost(projectedUnits, settings.rateConfig).totalCost;
    } else {
      if (isWaterFlatFee) {
        projectedCost = currentCost; // Fixed flat amount
      } else {
        projectedCost = calculateWaterCost(projectedUnits, settings.rateConfig).totalCost;
      }
    }

    const budgetPercent = budget > 0 ? Math.round((projectedCost / budget) * 100) : 0;
    
    let status: 'safe' | 'warning' | 'danger' = 'safe';
    if (budgetPercent > 105) {
      status = 'danger';
    } else if (budgetPercent >= 85) {
      status = 'warning';
    }

    return {
      startReading,
      currentReading,
      unitsUsed,
      currentCost,
      dailyAvgUnits,
      dailyAvgCost,
      hourlyCost,
      projectedUnits,
      projectedCost,
      budgetPercent,
      status,
      readingsCount: inCycleReadings.length,
    };
  }

  const electricity = computeUtilityMetrics(elecReadings, 'electricity', settings.budgetElectricity);
  const waterRaw = computeUtilityMetrics(waterReadings, 'water', settings.budgetWater);

  const water = {
    ...waterRaw,
    isFlatFee: isWaterFlatFee,
    flatFeeDetail: isWaterFlatFee ? calculateWaterCost(0, settings.rateConfig).detail : undefined,
  };

  const totalCurrentCost = Math.round((electricity.currentCost + water.currentCost) * 100) / 100;
  const totalProjectedCost = Math.round((electricity.projectedCost + water.projectedCost) * 100) / 100;
  const totalBudget = settings.budgetElectricity + settings.budgetWater;
  const totalBudgetPercent = totalBudget > 0 ? Math.round((totalProjectedCost / totalBudget) * 100) : 0;

  return {
    cycleName,
    startDate: start,
    endDate: end,
    daysTotal,
    daysPassed: Math.round(daysPassed * 10) / 10,
    daysRemaining: Math.round(daysRemaining),
    electricity,
    water,
    totalCurrentCost,
    totalProjectedCost,
    totalBudget,
    totalBudgetPercent,
  };
}
