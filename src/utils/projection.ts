import type { MeterReading, UserSettings, CycleSummary, MeterType } from '../types';
import { calculateElectricityCost, calculateWaterCost } from './rateCalculator';

/**
 * A cycle covers the day after one cutoff day through the end of the next cutoff day.
 * The cutoff day itself belongs to the cycle it closes, so a reading taken on payment day
 * (e.g. the 29th) completes the old cycle instead of being the zero baseline of the new one.
 * `start` is the end of the previous cutoff day: readings at or before it are baselines.
 */
export function getBillingCycleRange(cutoffDay: number, referenceDate: Date = new Date()): { start: Date; end: Date; cycleName: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  // Clamp to month length so cutoff 29-31 never spills into the next month (e.g. 31 in Feb)
  const cutoffEnd = (m: number) => {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    return new Date(year, m, Math.min(cutoffDay, daysInMonth), 23, 59, 59, 999);
  };

  const closesThisMonth = referenceDate.getTime() <= cutoffEnd(month).getTime();
  const start = cutoffEnd(closesThisMonth ? month - 1 : month);
  const end = cutoffEnd(closesThisMonth ? month : month + 1);

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const cycleName = `รอบ ${start.getDate()} ${thaiMonths[start.getMonth()]} - ${end.getDate()} ${thaiMonths[end.getMonth()]} ${(end.getFullYear() + 543).toString().slice(-2)}`;

  return { start, end, cycleName };
}

/**
 * Reference date inside the cycle `offset` cycles away from the current one (0 = current, -1 = previous).
 * Past cycles are referenced at their end so they read as fully elapsed.
 */
export function getCycleRefDate(cutoffDay: number, offset: number, now: Date = new Date()): Date {
  if (offset === 0) return now;
  const current = getBillingCycleRange(cutoffDay, now);
  const target = new Date(current.end.getFullYear(), current.end.getMonth() + offset, 1, 12);
  return getBillingCycleRange(cutoffDay, target).end;
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

  // Readings after the cycle's end belong to later cycles and must not count as "latest"
  const visible = readings.filter((r) => new Date(r.timestamp).getTime() <= end.getTime());

  const elecReadings = visible
    .filter((r) => r.meterType === 'electricity')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const waterReadings = visible
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
      (r) => new Date(r.timestamp).getTime() > start.getTime() && new Date(r.timestamp).getTime() <= end.getTime()
    );

    let baseline = utilityReadings.filter((r) => new Date(r.timestamp).getTime() <= start.getTime()).pop();
    if (!baseline && inCycleReadings.length > 0) {
      baseline = inCycleReadings[0];
    }

    const latest = utilityReadings[utilityReadings.length - 1];
    let startReading = baseline ? baseline.reading : (inCycleReadings[0]?.reading || latest.reading);
    const currentReading = latest.reading;

    let unitsUsed = Math.max(0, Math.round((currentReading - startReading) * 10) / 10);

    // If currentReading < startReading due to decimal/typo mismatch (e.g. 64812 vs 6560.6), find matching scale baseline or fallback to latest.unitsUsed
    if (currentReading < startReading && utilityReadings.length > 1) {
      const matchingBaseline = utilityReadings
        .filter((r) => r.reading <= currentReading && r.id !== latest.id)
        .pop();
      if (matchingBaseline) {
        startReading = matchingBaseline.reading;
        unitsUsed = Math.max(0, Math.round((currentReading - startReading) * 10) / 10);
      } else if (typeof latest.unitsUsed === 'number' && latest.unitsUsed > 0) {
        unitsUsed = latest.unitsUsed;
        startReading = Math.max(0, currentReading - unitsUsed);
      }
    }
    
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

  const monthlyRent = typeof settings.monthlyRent === 'number' ? settings.monthlyRent : 0;
  const totalCurrentCost = Math.round((electricity.currentCost + water.currentCost) * 100) / 100;
  const totalProjectedCost = Math.round((electricity.projectedCost + water.projectedCost) * 100) / 100;
  const totalProjectedWithRent = Math.round((totalProjectedCost + monthlyRent) * 100) / 100;
  const totalCurrentWithRent = Math.round((totalCurrentCost + monthlyRent) * 100) / 100;
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
    monthlyRent,
    totalCurrentCost,
    totalProjectedCost,
    totalProjectedWithRent,
    totalCurrentWithRent,
    totalBudget,
    totalBudgetPercent,
  };
}
