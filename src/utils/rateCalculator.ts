import type { RateConfig, DormFlatRateConfig, GovernmentRateConfig } from '../types';

export interface CalculatedCostBreakdown {
  unitsUsed: number;
  baseCost: number;
  ftCost: number;
  serviceCost: number;
  vatCost: number;
  totalCost: number;
  unitPriceEffective: number;
  detail: string;
}

/**
 * Calculates progressive step rate for MEA/PEA residential electricity
 */
export function calculateGovElectricityCost(units: number, config: GovernmentRateConfig): CalculatedCostBreakdown {
  if (units <= 0) {
    return {
      unitsUsed: 0,
      baseCost: 0,
      ftCost: 0,
      serviceCost: config.serviceFee,
      vatCost: config.serviceFee * (config.vatPercent / 100),
      totalCost: config.serviceFee * (1 + config.vatPercent / 100),
      unitPriceEffective: 0,
      detail: '0 หน่วย (คิดเฉพาะค่าบริการ)',
    };
  }

  let baseCost = 0;
  let remaining = units;

  if (config.tariffType === '1.1' && units <= 150) {
    const tiers = [
      { limit: 15, rate: 2.3488 },
      { limit: 10, rate: 2.9882 },
      { limit: 10, rate: 3.2405 },
      { limit: 65, rate: 3.6237 },
      { limit: 50, rate: 3.7171 },
      { limit: 250, rate: 4.2218 },
      { limit: Infinity, rate: 4.4217 },
    ];

    for (const tier of tiers) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, tier.limit);
      baseCost += take * tier.rate;
      remaining -= take;
    }
  } else {
    const tiers = [
      { limit: 150, rate: 3.2484 },
      { limit: 250, rate: 4.2218 },
      { limit: Infinity, rate: 4.4217 },
    ];

    for (const tier of tiers) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, tier.limit);
      baseCost += take * tier.rate;
      remaining -= take;
    }
  }

  const ftCost = units * config.ftRate;
  const serviceCost = config.serviceFee;
  const subTotal = baseCost + ftCost + serviceCost;
  const vatCost = subTotal * (config.vatPercent / 100);
  const totalCost = subTotal + vatCost;

  return {
    unitsUsed: units,
    baseCost: Math.round(baseCost * 100) / 100,
    ftCost: Math.round(ftCost * 100) / 100,
    serviceCost: Math.round(serviceCost * 100) / 100,
    vatCost: Math.round(vatCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    unitPriceEffective: units > 0 ? Math.round((totalCost / units) * 100) / 100 : 0,
    detail: `อัตราก้าวหน้า ${config.provider} (ฐาน ฿${baseCost.toFixed(1)} + Ft ฿${ftCost.toFixed(1)} + บริการ ฿${serviceCost.toFixed(1)} + VAT ฿${vatCost.toFixed(1)})`,
  };
}

/**
 * Calculates Dorm / Condo Flat Rate
 */
export function calculateDormElectricityCost(units: number, config: DormFlatRateConfig): CalculatedCostBreakdown {
  const baseCost = units * config.electricityUnitRate;
  const serviceCost = config.electricityFixedFee || 0;
  const subTotal = baseCost + serviceCost;
  const vatCost = subTotal * (config.vatPercent / 100);
  const totalCost = subTotal + vatCost;

  return {
    unitsUsed: units,
    baseCost: Math.round(baseCost * 100) / 100,
    ftCost: 0,
    serviceCost: Math.round(serviceCost * 100) / 100,
    vatCost: Math.round(vatCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    unitPriceEffective: units > 0 ? Math.round((totalCost / units) * 100) / 100 : config.electricityUnitRate,
    detail: `เรทหอพัก ฿${config.electricityUnitRate}/หน่วย ${serviceCost > 0 ? `+ ค่าบริการ ฿${serviceCost}` : ''}`,
  };
}

/**
 * Calculates Water Cost (Dorm Flat or Per-Unit or Gov)
 */
export function calculateWaterCost(units: number, rateConfig: RateConfig): CalculatedCostBreakdown {
  if (rateConfig.mode === 'dorm_flat') {
    // 1. Flat monthly fee (เหมาจ่ายรายเดือนคงที่)
    if (rateConfig.waterBillingType === 'flat_monthly') {
      const fixedCost = rateConfig.waterFlatMonthlyFee ?? 150;
      return {
        unitsUsed: units,
        baseCost: fixedCost,
        ftCost: 0,
        serviceCost: 0,
        vatCost: 0,
        totalCost: fixedCost,
        unitPriceEffective: units > 0 ? Math.round((fixedCost / units) * 100) / 100 : fixedCost,
        detail: `เหมาจ่ายรายเดือน ฿${fixedCost}/เดือน`,
      };
    }

    // 2. Flat fee per person (เหมาจ่ายรายคน)
    if (rateConfig.waterBillingType === 'per_person') {
      const perPerson = rateConfig.waterFeePerPerson ?? 100;
      const count = rateConfig.waterPersonCount ?? 1;
      const totalPersonCost = perPerson * count;
      return {
        unitsUsed: units,
        baseCost: totalPersonCost,
        ftCost: 0,
        serviceCost: 0,
        vatCost: 0,
        totalCost: totalPersonCost,
        unitPriceEffective: units > 0 ? Math.round((totalPersonCost / units) * 100) / 100 : totalPersonCost,
        detail: `เหมาจ่าย ${count} คน (คนละ ฿${perPerson}) รวม ฿${totalPersonCost}/เดือน`,
      };
    }

    // 3. Per Unit (คิดตามมิเตอร์)
    let baseCost = units * (rateConfig.waterUnitRate || 18);
    
    if (rateConfig.waterMinFee && baseCost < rateConfig.waterMinFee) {
      baseCost = rateConfig.waterMinFee;
    } else if (rateConfig.waterMinUnits && units < rateConfig.waterMinUnits) {
      baseCost = rateConfig.waterMinUnits * (rateConfig.waterUnitRate || 18);
    }

    const serviceCost = rateConfig.waterFixedFee || 0;
    const subTotal = baseCost + serviceCost;
    const vatCost = subTotal * (rateConfig.vatPercent / 100);
    const totalCost = subTotal + vatCost;

    return {
      unitsUsed: units,
      baseCost: Math.round(baseCost * 100) / 100,
      ftCost: 0,
      serviceCost: Math.round(serviceCost * 100) / 100,
      vatCost: Math.round(vatCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      unitPriceEffective: units > 0 ? Math.round((totalCost / units) * 100) / 100 : rateConfig.waterUnitRate,
      detail: `เรทค่าน้ำหอพัก ฿${rateConfig.waterUnitRate}/หน่วย`,
    };
  } else {
    // Government MWA / PWA
    const baseCost = units * (rateConfig.waterUnitRate || 10.5);
    const vatCost = baseCost * 0.07;
    const totalCost = baseCost + vatCost;

    return {
      unitsUsed: units,
      baseCost: Math.round(baseCost * 100) / 100,
      ftCost: 0,
      serviceCost: 0,
      vatCost: Math.round(vatCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      unitPriceEffective: units > 0 ? Math.round((totalCost / units) * 100) / 100 : 10.5,
      detail: `เรทการประปา ~฿${(rateConfig.waterUnitRate || 10.5).toFixed(2)}/หน่วย + VAT`,
    };
  }
}

/**
 * Universal Electricity Cost Calculator based on active configuration
 */
export function calculateElectricityCost(units: number, rateConfig: RateConfig): CalculatedCostBreakdown {
  if (rateConfig.mode === 'dorm_flat') {
    return calculateDormElectricityCost(units, rateConfig);
  } else {
    return calculateGovElectricityCost(units, rateConfig);
  }
}
