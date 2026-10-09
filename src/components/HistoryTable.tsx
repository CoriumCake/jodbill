import React, { useState } from 'react';
import { 
  Zap, 
  Droplets, 
  Search, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  Sparkles, 
  Camera, 
  X, 
  Plus
} from 'lucide-react';
import type { MeterReading, MeterType, UserSettings, UserRole } from '../types';

interface HistoryTableProps {
  readings: MeterReading[];
  settings?: UserSettings;
  currentRole?: UserRole;
  onDeleteReading: (id: string) => void;
  onOpenRecord: (type?: MeterType) => void;
  onExportCSV: () => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({
  readings,
  currentRole = 'owner',
  onDeleteReading,
  onOpenRecord,
  onExportCSV,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'electricity' | 'water'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const filteredReadings = readings
    .filter((r) => {
      if (filterType !== 'all' && r.meterType !== filterType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const dateStr = new Date(r.timestamp).toLocaleDateString('th-TH');
        const notesStr = (r.notes || '').toLowerCase();
        const readingStr = r.reading.toString();
        return dateStr.includes(query) || notesStr.includes(query) || readingStr.includes(query);
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="clean-card p-5 sm:p-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slate-700" />
            ประวัติการบันทึก ({filteredReadings.length})
          </h3>
          <p className="text-xs text-slate-500">
            รายการบันทึกย้อนหลังและรูปถ่ายมิเตอร์
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>ส่งออก CSV</span>
          </button>
          <button
            onClick={() => onOpenRecord()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>จดบิลใหม่</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setFilterType('electricity')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              filterType === 'electricity'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
            ไฟฟ้า
          </button>
          <button
            onClick={() => setFilterType('water')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
              filterType === 'water'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Droplets className="w-3 h-3 text-cyan-500 fill-cyan-500" />
            น้ำประปา
          </button>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาวันที่, เลข..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 text-xs text-slate-800 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table Container */}
      {filteredReadings.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-1 text-xs">
          <FileSpreadsheet className="w-8 h-8 opacity-30" />
          <p>ไม่พบรายการบันทึก</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                <th className="py-2.5 px-3.5">วันที่-เวลา</th>
                <th className="py-2.5 px-3">ประเภท</th>
                <th className="py-2.5 px-3">เลขหน้าปัด</th>
                <th className="py-2.5 px-3">หน่วยที่ใช้</th>
                <th className="py-2.5 px-3">คิดเป็นเงิน</th>
                <th className="py-2.5 px-3">วิธีตรวจจับ</th>
                <th className="py-2.5 px-3">รูปภาพ</th>
                <th className="py-2.5 px-3">หมายเหตุ</th>
                <th className="py-2.5 px-3 text-right">ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReadings.map((reading) => {
                const isElec = reading.meterType === 'electricity';
                const dateObj = new Date(reading.timestamp);
                const dateFormatted = dateObj.toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: '2-digit',
                });
                const timeFormatted = dateObj.toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={reading.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{dateFormatted}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{timeFormatted} น.</div>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          isElec
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-cyan-50 text-cyan-700 border border-cyan-200/60'
                        }`}
                      >
                        {isElec ? <Zap className="w-2.5 h-2.5 fill-current" /> : <Droplets className="w-2.5 h-2.5 fill-current" />}
                        {isElec ? 'ไฟฟ้า' : 'น้ำประปา'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                      <span>{reading.reading.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-400 ml-1 font-normal">
                        {isElec ? 'kWh' : 'm³'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                      {reading.unitsUsed ? (
                        <span className="text-emerald-600 font-semibold">
                          +{reading.unitsUsed.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium text-slate-800">
                      {reading.calculatedCost ? (
                        <span>฿{reading.calculatedCost.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {reading.detectedBy === 'gemini' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          <Sparkles className="w-2.5 h-2.5" /> Gemini
                        </span>
                      ) : reading.detectedBy === 'tesseract' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          <Camera className="w-2.5 h-2.5" /> OCR
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          กรอกมือ
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {reading.photoUrl ? (
                        <button
                          onClick={() => setSelectedPhoto(reading.photoUrl || null)}
                          className="w-7 h-7 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition-opacity relative group"
                        >
                          <img src={reading.photoUrl} alt="Meter" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-slate-500 max-w-[140px] truncate">
                      {reading.notes || <span className="text-slate-300">—</span>}
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {currentRole !== 'viewer' ? (
                        <button
                          onClick={() => {
                            if (confirm('ยืนยันลบรายการบันทึกนี้หรือไม่?')) {
                              onDeleteReading(reading.id);
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-semibold text-slate-700">ภาพถ่ายมิเตอร์</span>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-900 flex items-center justify-center max-h-[70vh]">
              <img src={selectedPhoto} alt="Zoomed meter" className="max-h-[65vh] w-auto object-contain rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
