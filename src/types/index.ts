export type MeterType = 'electricity' | 'water';

export type OCRProvider = 'tesseract' | 'gemini' | 'manual';

export interface MeterReading {
  id: string;
  meterType: MeterType;
  reading: number;               // Cumulative meter reading (เลขหน้าปัด)
  previousReading?: number;      // Reading prior to this one
  unitsUsed?: number;            // Difference = reading - previousReading
  calculatedCost?: number;       // Calculated cost in THB
  timestamp: string;             // ISO date string e.g. "2026-10-09T18:00:00.000Z"
  photoUrl?: string;             // Base64 or image thumbnail
  notes?: string;
  detectedBy: OCRProvider;
  ocrConfidence?: number;        // Percentage 0 - 100
  location?: string;
}

export type WaterBillingType = 'per_unit' | 'flat_monthly' | 'per_person';

export interface DormFlatRateConfig {
  mode: 'dorm_flat';
  electricityUnitRate: number;      // e.g. 8 THB/unit
  waterBillingType: WaterBillingType; // 'per_unit' | 'flat_monthly' | 'per_person'
  waterUnitRate: number;            // e.g. 18 THB/unit
  waterFlatMonthlyFee: number;      // e.g. 150 THB/month
  waterFeePerPerson: number;        // e.g. 100 THB/person/month
  waterPersonCount: number;         // e.g. 1 or 2 people
  waterMinUnits?: number;           // e.g. 5 units minimum
  waterMinFee?: number;             // e.g. 100 THB minimum charge
  electricityFixedFee: number;      // e.g. 50 THB room maintenance
  waterFixedFee: number;            // e.g. 30 THB room maintenance
  vatPercent: number;               // e.g. 0% or 7%
}

export interface GovernmentRateConfig {
  mode: 'step_rate';
  provider: 'MEA' | 'PEA';          // Metropolitan or Provincial Electricity Authority
  tariffType: '1.1' | '1.2';        // 1.1 <= 150 kWh/mo, 1.2 > 150 kWh/mo
  ftRate: number;                   // e.g. 0.3972 THB/unit
  serviceFee: number;               // e.g. 24.62 or 38.22 THB
  waterUnitRate: number;            // e.g. 10.50 THB/unit (MWA/PWA standard)
  vatPercent: number;               // 7%
}

export type RateConfig = DormFlatRateConfig | GovernmentRateConfig;

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface RoomShareConfig {
  roomId: string;
  editorPin: string;
  viewerPin: string;
  roomName: string;
  createdAt: string;
  remoteSyncUrl?: string;
}

export interface SharePayload {
  version: number;
  roomId: string;
  role: UserRole;
  settings: Partial<UserSettings>;
  readings: MeterReading[];
  exportedAt: string;
  editorPin?: string;
}

export interface UserSettings {
  dormName: string;
  roomNumber: string;
  monthlyRent: number;              // Monthly room rent fee e.g. 4500 THB (0 if not applicable)
  billingCutoffDay: number;         // 1 - 31 (e.g., 25th of month)
  budgetElectricity: number;        // e.g., 1800 THB
  budgetWater: number;              // e.g., 250 THB
  rateConfig: RateConfig;
  geminiApiKey?: string;
  preferredOcrProvider: OCRProvider;
  soundEnabled: boolean;
  theme: 'dark' | 'light' | 'cyber';
  currentRole?: UserRole;           // 'owner' (default) | 'editor' | 'viewer'
  roomShare?: RoomShareConfig;
}

export interface CycleSummary {
  cycleName: string;
  startDate: Date;
  endDate: Date;
  daysTotal: number;
  daysPassed: number;
  daysRemaining: number;
  monthlyRent: number;
  electricity: {
    startReading: number;
    currentReading: number;
    unitsUsed: number;
    currentCost: number;
    dailyAvgUnits: number;
    dailyAvgCost: number;
    hourlyCost: number;
    projectedUnits: number;
    projectedCost: number;
    budgetPercent: number;
    status: 'safe' | 'warning' | 'danger';
    readingsCount: number;
  };
  water: {
    isFlatFee: boolean;
    flatFeeDetail?: string;
    startReading: number;
    currentReading: number;
    unitsUsed: number;
    currentCost: number;
    dailyAvgUnits: number;
    dailyAvgCost: number;
    hourlyCost: number;
    projectedUnits: number;
    projectedCost: number;
    budgetPercent: number;
    status: 'safe' | 'warning' | 'danger';
    readingsCount: number;
  };
  totalCurrentCost: number;
  totalProjectedCost: number;
  totalProjectedWithRent: number;
  totalCurrentWithRent: number;
  totalBudget: number;
  totalBudgetPercent: number;
}

export interface Appliance {
  id: string;
  name: string;
  nameEn: string;
  category: 'cooling' | 'heating' | 'entertainment' | 'kitchen' | 'general';
  watts: number;
  defaultHoursPerDay: number;
  icon: string;
  description: string;
  efficiencyNote?: string;
}
