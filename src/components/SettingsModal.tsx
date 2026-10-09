import React, { useState } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Building2, 
  Zap, 
  Droplets, 
  Key, 
  Database, 
  Save, 
  RotateCcw, 
  Upload,
  Users,
  Home
} from 'lucide-react';
import type { UserSettings, DormFlatRateConfig, GovernmentRateConfig, WaterBillingType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
  onLoadDemoData: () => void;
  onClearAllData: () => void;
  onImportBackup: (jsonContent: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onLoadDemoData,
  onClearAllData,
  onImportBackup,
}) => {
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'rates' | 'budget' | 'ai' | 'backup'>('rates');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        onImportBackup(content);
        setImportStatus('นำเข้าข้อมูลสำเร็จ!');
        setTimeout(() => setImportStatus(null), 3000);
      } catch {
        alert('ไฟล์ข้อมูลสำรองไม่ถูกต้อง');
      }
    };
    reader.readAsText(file);
  };

  const updateDormRate = (updates: Partial<DormFlatRateConfig>) => {
    if (formData.rateConfig.mode === 'dorm_flat') {
      setFormData({
        ...formData,
        rateConfig: {
          ...formData.rateConfig,
          ...updates,
        },
      });
    }
  };

  const dormRate = formData.rateConfig.mode === 'dorm_flat' ? formData.rateConfig : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                ตั้งค่าระบบ & อัตราค่าน้ำค่าไฟ
              </h2>
              <p className="text-xs text-slate-500">
                กำหนดเรทราคาค่าน้ำ (เหมาจ่าย/ตามมิเตอร์) และค่าไฟ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
          {[
            { id: 'rates', label: 'เรทราคา & ค่าน้ำเหมาจ่าย', icon: Zap },
            { id: 'general', label: 'ข้อมูลห้อง', icon: Building2 },
            { id: 'budget', label: 'งบประมาณ', icon: Droplets },
            { id: 'ai', label: 'Gemini AI', icon: Key },
            { id: 'backup', label: 'จัดการข้อมูล', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB: RATES */}
          {activeTab === 'rates' && (
            <div className="space-y-4">
              {/* Mode switch */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      rateConfig: {
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
                      },
                    });
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                    formData.rateConfig.mode === 'dorm_flat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏢 เรทหอพัก / คอนโด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      rateConfig: {
                        mode: 'step_rate',
                        provider: 'MEA',
                        tariffType: '1.2',
                        ftRate: 0.3972,
                        serviceFee: 24.62,
                        waterUnitRate: 10.5,
                        vatPercent: 7,
                      },
                    });
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                    formData.rateConfig.mode === 'step_rate'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚡ อัตราก้าวหน้า MEA/PEA
                </button>
              </div>

              {dormRate ? (
                <div className="space-y-4 pt-1">
                  {/* Electricity Unit Rate */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      ค่าไฟฟ้าต่อหน่วย (บาท/หน่วย)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        value={dormRate.electricityUnitRate}
                        onChange={(e) => updateDormRate({ electricityUnitRate: parseFloat(e.target.value) || 0 })}
                        className="w-32 bg-white text-base font-bold font-mono text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 focus:border-slate-800 focus:outline-none"
                      />
                      <span className="text-slate-500 text-[11px]">ส่วนใหญ่หอพักอยู่ที่ 7 - 9 บาท</span>
                    </div>
                  </div>

                  {/* Water Billing Type Selection */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-cyan-600 fill-cyan-600" />
                        รูปแบบการคิดค่าน้ำประปา
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        เลือกรูปแบบที่หอพักของคุณเรียกเก็บเงิน
                      </p>
                    </div>

                    {/* Radio Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'flat_monthly', label: 'เหมาจ่ายรายเดือน', desc: 'เช่น 150 บาท/ห้อง' },
                        { id: 'per_person', label: 'เหมาจ่ายรายคน', desc: 'เช่น 100 บาท/คน' },
                        { id: 'per_unit', label: 'คิดตามมิเตอร์', desc: 'เช่น 18 บาท/ยูนิต' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateDormRate({ waterBillingType: opt.id as WaterBillingType })}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            (dormRate.waterBillingType || 'flat_monthly') === opt.id
                              ? 'bg-white border-cyan-600 shadow-xs ring-1 ring-cyan-600/30'
                              : 'bg-white/60 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <span className={`font-bold block ${
                            (dormRate.waterBillingType || 'flat_monthly') === opt.id ? 'text-cyan-700' : 'text-slate-800'
                          }`}>
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{opt.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Sub-inputs depending on water type */}
                    {(dormRate.waterBillingType === 'flat_monthly' || !dormRate.waterBillingType) && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <label className="font-medium text-slate-700 block">
                          ค่าน้ำเหมาจ่ายต่อเดือน (บาท/ห้อง)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="10"
                            value={dormRate.waterFlatMonthlyFee ?? 150}
                            onChange={(e) => updateDormRate({ waterFlatMonthlyFee: parseFloat(e.target.value) || 0 })}
                            className="w-32 bg-slate-50 text-base font-bold font-mono text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300"
                          />
                          <span className="text-[11px] text-slate-500">บาทต่อเดือน (ยอดคงที่ทุกรอบบิล)</span>
                        </div>
                      </div>
                    )}

                    {dormRate.waterBillingType === 'per_person' && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-medium text-slate-700 block mb-1">
                            ค่าน้ำต่อคน (บาท/คน)
                          </label>
                          <input
                            type="number"
                            step="10"
                            value={dormRate.waterFeePerPerson ?? 100}
                            onChange={(e) => updateDormRate({ waterFeePerPerson: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-50 text-base font-bold font-mono text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div>
                          <label className="font-medium text-slate-700 flex items-center gap-1 mb-1">
                            <Users className="w-3 h-3 text-slate-500" />
                            จำนวนผู้อยู่อาศัย (คน)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={dormRate.waterPersonCount ?? 1}
                            onChange={(e) => updateDormRate({ waterPersonCount: parseInt(e.target.value) || 1 })}
                            className="w-full bg-slate-50 text-base font-bold font-mono text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300"
                          />
                        </div>
                        <div className="col-span-2 text-[11px] text-cyan-700 font-medium">
                          รวมค่าน้ำเหมาจ่าย = {(dormRate.waterFeePerPerson ?? 100) * (dormRate.waterPersonCount ?? 1)} บาท/เดือน
                        </div>
                      </div>
                    )}

                    {dormRate.waterBillingType === 'per_unit' && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <label className="font-medium text-slate-700 block">
                          ค่าน้ำต่อยูนิต (บาท/m³)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="1"
                            value={dormRate.waterUnitRate ?? 18}
                            onChange={(e) => updateDormRate({ waterUnitRate: parseFloat(e.target.value) || 0 })}
                            className="w-32 bg-slate-50 text-base font-bold font-mono text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300"
                          />
                          <span className="text-[11px] text-slate-500">ส่วนใหญ่หอพักอยู่ที่ 17 - 20 บาท/ยูนิต</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-medium text-slate-700 block mb-1">การไฟฟ้า</label>
                      <select
                        value={(formData.rateConfig as GovernmentRateConfig).provider}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            rateConfig: {
                              ...formData.rateConfig,
                              provider: e.target.value as any,
                              serviceFee: e.target.value === 'PEA' ? 38.22 : 24.62,
                            } as GovernmentRateConfig,
                          });
                        }}
                        className="w-full bg-white text-slate-800 p-2 rounded-lg border border-slate-200"
                      >
                        <option value="MEA">กฟน. (MEA)</option>
                        <option value="PEA">กฟภ. (PEA)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-medium text-slate-700 block mb-1">ค่า Ft (บาท/หน่วย)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={(formData.rateConfig as GovernmentRateConfig).ftRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            rateConfig: { ...formData.rateConfig, ftRate: val } as GovernmentRateConfig,
                          });
                        }}
                        className="w-full bg-white text-slate-800 p-2 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ชื่อหอพัก / อพาร์ทเมนท์
                </label>
                <input
                  type="text"
                  value={formData.dormName}
                  onChange={(e) => setFormData({ ...formData, dormName: e.target.value })}
                  placeholder="เช่น หอพักสุขสบาย"
                  className="w-full bg-slate-50 text-xs text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    หมายเลขห้อง
                  </label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    placeholder="เช่น 408"
                    className="w-full bg-slate-50 text-xs text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 focus:bg-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    วันตัดรอบบิลของเดือน
                  </label>
                  <select
                    value={formData.billingCutoffDay}
                    onChange={(e) => setFormData({ ...formData, billingCutoffDay: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 text-xs text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 focus:bg-white focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        วันที่ {day} ของเดือน
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Monthly Room Rent */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-slate-700" />
                    ค่าเช่าห้องรายเดือน (บาท)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">ใส่ 0 หากไม่มี</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="100"
                    value={formData.monthlyRent ?? 0}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyRent: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                    placeholder="เช่น 3500 หรือ 4500"
                    className="w-full bg-white text-sm font-bold font-mono text-slate-900 px-3 py-2 rounded-lg border border-slate-300 focus:border-slate-800 focus:outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">บาท/เดือน</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400">เลือกเร็ว:</span>
                  {[0, 3000, 3500, 4000, 4500, 5500, 7000].map((rent) => (
                    <button
                      key={rent}
                      type="button"
                      onClick={() => setFormData({ ...formData, monthlyRent: rent })}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                        formData.monthlyRent === rent
                          ? 'bg-slate-800 text-white font-bold'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {rent === 0 ? 'ไม่มีค่าห้อง' : `฿${rent.toLocaleString()}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: BUDGET */}
          {activeTab === 'budget' && (
            <div className="space-y-3">
              <p className="text-slate-500">
                ตั้งเป้าหมายงบประมาณเพื่อแสดงการแจ้งเตือนบนแดชบอร์ด
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="font-semibold text-slate-700 block mb-1">
                    งบค่าไฟ (บาท/เดือน)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={formData.budgetElectricity}
                    onChange={(e) => setFormData({ ...formData, budgetElectricity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white text-base font-bold font-mono text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="font-semibold text-slate-700 block mb-1">
                    งบค่าน้ำ (บาท/เดือน)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={formData.budgetWater}
                    onChange={(e) => setFormData({ ...formData, budgetWater: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white text-base font-bold font-mono text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: GEMINI AI */}
          {activeTab === 'ai' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60 text-purple-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Google Gemini Vision AI
                </span>
                <p className="text-[11px] text-purple-800">
                  ใส่ API Key เพื่อเพิ่มความแม่นยำในการอ่านมิเตอร์แบบล้อหมุนเก่าหรือตัวเลขเบลอ
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-purple-700 font-semibold underline block"
                >
                  👉 ขอรับ Gemini API Key ฟรี
                </a>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={formData.geminiApiKey || ''}
                  onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-50 font-mono text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB: BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onLoadDemoData}
                  className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-all cursor-pointer"
                >
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                    ข้อมูลตัวอย่าง
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    โหลดข้อมูลมิเตอร์ 30 วัน
                  </p>
                </button>

                <label className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-all cursor-pointer block">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    นำเข้าไฟล์ JSON
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    กู้คืนข้อมูลสำรอง
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {importStatus && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-semibold">
                  {importStatus}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลมิเตอร์ทั้งหมด?')) {
                      onClearAllData();
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold cursor-pointer"
                >
                  ล้างข้อมูลทั้งหมดในเครื่อง
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>
    </div>
  );
};
