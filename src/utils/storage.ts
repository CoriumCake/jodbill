import type { MeterReading, UserSettings, DormFlatRateConfig } from '../types';

const STORAGE_KEYS = {
  READINGS: 'jodbill_readings_v2',
  SETTINGS: 'jodbill_settings_v2',
  TOUR_COMPLETED: 'jodbill_tour_completed_v2',
};

export const DEFAULT_RATE_CONFIG: DormFlatRateConfig = {
  mode: 'dorm_flat',
  electricityUnitRate: 8,
  waterBillingType: 'flat_monthly',
  waterUnitRate: 18,
  waterFlatMonthlyFee: 150,
  waterFeePerPerson: 100,
  waterPersonCount: 1,
  waterMinUnits: 0,
  waterMinFee: 0,
  electricityFixedFee: 0,
  waterFixedFee: 0,
  vatPercent: 0,
};

export const DEFAULT_SETTINGS: UserSettings = {
  dormName: 'หอพักของฉัน',
  roomNumber: '101',
  billingCutoffDay: 25,
  budgetElectricity: 1500,
  budgetWater: 200,
  rateConfig: DEFAULT_RATE_CONFIG,
  preferredOcrProvider: 'tesseract',
  soundEnabled: true,
  theme: 'dark',
};

export function generateSampleData(): MeterReading[] {
  const now = new Date();
  const readings: MeterReading[] = [];

  let elecMeter = 2150.0;
  let waterMeter = 420.0;

  for (let i = 30; i >= 0; i -= 2) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    date.setHours(19, Math.floor(Math.random() * 30), 0);

    const elecDelta = Math.round((8 + Math.random() * 5) * 10) / 10;
    elecMeter += elecDelta;

    readings.push({
      id: `sample-elec-${i}`,
      meterType: 'electricity',
      reading: Math.round(elecMeter * 10) / 10,
      timestamp: date.toISOString(),
      detectedBy: i % 4 === 0 ? 'tesseract' : 'manual',
      notes: i === 0 ? 'จดมิเตอร์ล่าสุด' : undefined,
    });

    const waterDelta = Math.round((0.8 + Math.random() * 0.8) * 10) / 10;
    waterMeter += waterDelta;

    readings.push({
      id: `sample-water-${i}`,
      meterType: 'water',
      reading: Math.round(waterMeter * 10) / 10,
      timestamp: date.toISOString(),
      detectedBy: 'manual',
    });
  }

  return readings;
}

export function loadReadings(): MeterReading[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.READINGS);
    if (!raw) {
      // First time user: Start clean & empty
      return [];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load readings from localStorage:', e);
    return [];
  }
}

export function saveReadings(readings: MeterReading[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));
  } catch (e) {
    console.error('Failed to save readings to localStorage:', e);
  }
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.error('Failed to load settings:', e);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOUR_COMPLETED) === 'true';
  } catch {
    return false;
  }
}

export function setTourCompleted(completed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TOUR_COMPLETED, completed ? 'true' : 'false');
  } catch (e) {
    console.error('Failed to save tour status:', e);
  }
}

export function exportToCSV(readings: MeterReading[], settings: UserSettings): void {
  const sorted = [...readings].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const headers = [
    'ลำดับ (ID)',
    'วันที่-เวลา (Timestamp)',
    'ประเภทมิเตอร์ (Type)',
    'เลขหน้าปัดมิเตอร์ (Reading)',
    'หน่วยที่ใช้ไป (Units Used)',
    'ค่าใช้จ่ายประมาณการ (THB)',
    'วิธีการอ่าน (Method)',
    'หมายเหตุ (Notes)',
  ];

  const rows = sorted.map((r, idx) => {
    const dateStr = new Date(r.timestamp).toLocaleString('th-TH');
    const typeStr = r.meterType === 'electricity' ? 'ไฟฟ้า (kWh)' : 'น้ำประปา (m³)';
    const methodStr = r.detectedBy === 'gemini' ? 'Gemini AI' : r.detectedBy === 'tesseract' ? 'OCR กล้อง' : 'กรอกมือ';
    const notesStr = (r.notes || '').replace(/"/g, '""');

    return [
      `"${idx + 1}"`,
      `"${dateStr}"`,
      `"${typeStr}"`,
      r.reading.toFixed(1),
      r.unitsUsed ? r.unitsUsed.toFixed(1) : '-',
      r.calculatedCost ? r.calculatedCost.toFixed(2) : '-',
      `"${methodStr}"`,
      `"${notesStr}"`,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const nowStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `jodbill_meter_records_${settings.roomNumber}_${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportJSONBackup(readings: MeterReading[], settings: UserSettings): void {
  const payload = {
    appName: 'jodbill',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    settings,
    readings,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const nowStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `jodbill_backup_${nowStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
