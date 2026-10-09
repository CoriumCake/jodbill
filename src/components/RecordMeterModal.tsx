import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Zap, 
  Droplets, 
  Sparkles, 
  Check, 
  RotateCw, 
  CheckCircle2,
  Calendar
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { MeterType, MeterReading, UserSettings, OCRProvider } from '../types';
import { 
  performLocalOCR, 
  performGeminiVisionOCR, 
  extractPhotoDate, 
  preloadOCRWorker,
  scanLiveCameraFrame
} from '../utils/ocrService';
import { createThumbnail } from '../utils/storage';
import { calculateElectricityCost, calculateWaterCost } from '../utils/rateCalculator';

interface RecordMeterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: MeterType;
  readings: MeterReading[];
  settings: UserSettings;
  onSaveReading: (reading: Omit<MeterReading, 'id'>) => void;
}

export const RecordMeterModal: React.FC<RecordMeterModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'electricity',
  readings,
  settings,
  onSaveReading,
}) => {
  const [meterType, setMeterType] = useState<MeterType>(defaultType);
  const [readingInput, setReadingInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString().slice(0, 16));
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  
  const [isProcessingOCR, setIsProcessingOCR] = useState<boolean>(false);
  const [ocrStatusText, setOcrStatusText] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [detectedProvider, setDetectedProvider] = useState<OCRProvider>('manual');
  const [ocrConfidence, setOcrConfidence] = useState<number | undefined>(undefined);
  const [ocrResultMessage, setOcrResultMessage] = useState<string | null>(null);
  const [extractedDateNotice, setExtractedDateNotice] = useState<string | null>(null);
  const [liveReading, setLiveReading] = useState<{ reading: number; confidence: number } | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const latestReading = readings
    .filter((r) => r.meterType === meterType)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const previousValue = latestReading ? latestReading.reading : 0;
  const currentNumValue = parseFloat(readingInput) || 0;
  const unitsDiff = readingInput ? Math.round((currentNumValue - previousValue) * 10) / 10 : 0;

  const costDiff = unitsDiff > 0
    ? (meterType === 'electricity'
        ? calculateElectricityCost(unitsDiff, settings.rateConfig).totalCost
        : calculateWaterCost(unitsDiff, settings.rateConfig).totalCost)
    : 0;

  useEffect(() => {
    if (isOpen) {
      setMeterType(defaultType);
      setReadingInput('');
      setNotes('');
      setTimestamp(new Date().toISOString().slice(0, 16));
      setPhotoDataUrl(null);
      setIsCameraActive(false);
      setIsProcessingOCR(false);
      setOcrResultMessage(null);
      setExtractedDateNotice(null);
      setLiveReading(null);
      setDetectedProvider('manual');
      setOcrConfidence(undefined);

      // Pre-warm OCR worker in background
      preloadOCRWorker();
    } else {
      stopCamera();
    }
  }, [isOpen, defaultType]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Real-time live camera frame scanner loop (Runs every ~350ms while camera is pointing at meter)
  useEffect(() => {
    if (!isCameraActive) {
      setLiveReading(null);
      return;
    }

    let isCancelled = false;
    let isScanning = false;

    const interval = setInterval(async () => {
      if (isCancelled || isScanning || !videoRef.current || videoRef.current.readyState < 2) return;
      isScanning = true;
      try {
        const res = await scanLiveCameraFrame(videoRef.current, previousValue);
        if (!isCancelled && res && res.reading > 0) {
          setLiveReading(res);
        }
      } catch {
        // Ignore live frame glitches
      } finally {
        isScanning = false;
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isCameraActive, previousValue]);

  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      alert('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง หรือเลือกอัปโหลดรูปภาพแทน');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    if (isCameraActive) {
      setTimeout(startCamera, 100);
    }
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPhotoDataUrl(dataUrl);
      stopCamera();
      triggerOCR(dataUrl);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Automatically extract photo timestamp from EXIF metadata
    try {
      const photoDate = await extractPhotoDate(file);
      if (photoDate) {
        setTimestamp(photoDate);
        setExtractedDateNotice(`ดึงเวลาถ่ายภาพอัตโนมัติ: ${photoDate.replace('T', ' ')}`);
      }
    } catch (err) {
      console.warn('Could not extract EXIF date:', err);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPhotoDataUrl(dataUrl);
      triggerOCR(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const triggerOCR = async (dataUrl: string) => {
    setIsProcessingOCR(true);
    setOcrProgress(10);
    setOcrStatusText('กำลังเตรียมประมวลผลรูปภาพ...');
    setOcrResultMessage(null);

    try {
      let result;
      if (settings.geminiApiKey && settings.geminiApiKey.trim().length > 10) {
        result = await performGeminiVisionOCR(
          dataUrl,
          settings.geminiApiKey,
          (p, s) => {
            setOcrProgress(p);
            setOcrStatusText(s);
          },
          previousValue
        );
      } else {
        result = await performLocalOCR(
          dataUrl,
          (p, s) => {
            setOcrProgress(p);
            setOcrStatusText(s);
          },
          previousValue
        );
      }

      if (result.reading > 0) {
        setReadingInput(result.reading.toString());
        setDetectedProvider(result.provider);
        setOcrConfidence(result.confidence);
        setOcrResultMessage(result.message || `ตรวจพบเลข ${result.reading}`);
        if (result.meterTypeHint) {
          setMeterType(result.meterTypeHint);
        }
      } else {
        setOcrResultMessage(
          result.message || 'ไม่พบตัวเลขชัดเจน แนะนำถ่ายซูมเฉพาะช่องตัวเลขหมุน หรือกรอกเลขเอง'
        );
      }
    } catch {
      setOcrResultMessage('เกิดข้อผิดพลาดในการอ่านภาพ กรุณากรอกตัวเลขเอง');
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const adjustReading = (delta: number) => {
    const current = parseFloat(readingInput) || (latestReading ? latestReading.reading : 0);
    const nextVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    setReadingInput(nextVal.toString());
  };

  const handleSave = async () => {
    const num = parseFloat(readingInput);
    if (isNaN(num) || num < 0) {
      alert('กรุณาระบุเลขมิเตอร์ให้ถูกต้อง');
      return;
    }

    let finalPhotoUrl = photoDataUrl || undefined;
    if (photoDataUrl && photoDataUrl.length > 50000) {
      try {
        finalPhotoUrl = await createThumbnail(photoDataUrl, 360);
      } catch {
        finalPhotoUrl = photoDataUrl;
      }
    }

    onSaveReading({
      meterType,
      reading: num,
      previousReading: previousValue > 0 ? previousValue : undefined,
      unitsUsed: unitsDiff > 0 ? unitsDiff : undefined,
      calculatedCost: costDiff > 0 ? costDiff : undefined,
      timestamp: new Date(timestamp).toISOString(),
      photoUrl: finalPhotoUrl,
      notes: notes.trim() || undefined,
      detectedBy: detectedProvider,
      ocrConfidence: ocrConfidence,
    });

    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#0f172a', '#f59e0b', '#0284c7'],
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                จดมิเตอร์ค่าน้ำ-ค่าไฟ
              </h2>
              <p className="text-xs text-slate-500">
                ใส่เลขใหม่หรือถ่ายรูปให้อ่านเลขอัตโนมัติ
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Segmented Meter Type Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMeterType('electricity')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                meterType === 'electricity'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>มิเตอร์ไฟ (kWh)</span>
            </button>
            <button
              type="button"
              onClick={() => setMeterType('water')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                meterType === 'water'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Droplets className="w-3.5 h-3.5 text-cyan-600 fill-cyan-600" />
              <span>มิเตอร์น้ำ (m³)</span>
            </button>
          </div>

          {/* Water flat fee hint */}
          {meterType === 'water' && settings.rateConfig.mode === 'dorm_flat' && settings.rateConfig.waterBillingType !== 'per_unit' && (
            <div className="p-2.5 rounded-xl bg-cyan-50/80 border border-cyan-200/60 text-cyan-800 text-[11px] flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 shrink-0 text-cyan-600" />
              <span>
                ค่าน้ำของคุณเป็นแบบ<strong>{settings.rateConfig.waterBillingType === 'per_person' ? `เหมาจ่ายรายคน (฿${settings.rateConfig.waterFeePerPerson || 100}x${settings.rateConfig.waterPersonCount || 1})` : `เหมาจ่ายรายเดือน (฿${settings.rateConfig.waterFlatMonthlyFee || 150}/เดือน)`}</strong> การจดมิเตอร์จะใช้สำหรับดูสถิติปริมาณน้ำที่ใช้
              </span>
            </div>
          )}

          {/* Camera / Photo Scanner */}
          <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                สแกนภาพถ่าย (OCR)
              </span>
              {detectedProvider !== 'manual' && ocrConfidence && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                  {detectedProvider === 'gemini' ? 'Gemini AI' : 'OCR'} ({ocrConfidence}%)
                </span>
              )}
            </div>

            {isCameraActive ? (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                
                {/* Live Real-time Detection Floating Action */}
                {liveReading && (
                  <button
                    type="button"
                    onClick={() => {
                      setReadingInput(liveReading.reading.toString());
                      setDetectedProvider('tesseract');
                      setOcrConfidence(liveReading.confidence);
                      setOcrResultMessage(`⚡ สแกนสดพบเลข: ${liveReading.reading}`);
                      stopCamera();
                    }}
                    className="absolute top-3 inset-x-3 mx-auto max-w-sm py-2 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xl flex items-center justify-center gap-1.5 cursor-pointer z-10 active:scale-95 transition-all border border-emerald-300 animate-pulse"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white text-white" />
                    <span>⚡ สแกนสดพบ: <strong>{liveReading.reading}</strong> (แตะเพื่อใช้ทันที)</span>
                  </button>
                )}

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-3/4 h-20 border-2 rounded-lg bg-black/20 flex items-center justify-center transition-all ${
                    liveReading ? 'border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]' : 'border-dashed border-white/80'
                  }`}>
                    <span className={`text-[10px] px-2 py-0.5 rounded transition-all ${
                      liveReading ? 'bg-emerald-600 text-white font-bold' : 'text-white bg-black/60'
                    }`}>
                      {liveReading ? `ตรวจพบ ${liveReading.reading}` : 'จัดตัวเลขมิเตอร์ให้อยู่ในกรอบนี้'}
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={flipCamera}
                    title="สลับกล้อง"
                    className="p-2 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="px-4 py-2 rounded-full bg-white text-slate-900 font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>ถ่ายรูป</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-2 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : photoDataUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 aspect-video">
                <img src={photoDataUrl} alt="Meter preview" className="w-full h-full object-contain" />
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => triggerOCR(photoDataUrl)}
                    disabled={isProcessingOCR}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium border border-slate-200 shadow-xs flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>อ่านซ้ำ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(null)}
                    className="p-1 rounded-lg bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer text-slate-700 text-xs font-semibold"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>เปิดกล้องถ่าย</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer text-slate-700 text-xs font-semibold"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>เลือกรูปถ่าย</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {isProcessingOCR && (
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
                    {ocrStatusText}
                  </span>
                  <span className="font-mono font-bold text-slate-800">{ocrProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                  <div className="bg-slate-800 h-full rounded-full transition-all" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}

            {ocrResultMessage && !isProcessingOCR && (
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{ocrResultMessage}</p>
                </div>
              </div>
            )}

            {!settings.geminiApiKey && (
              <div className="text-[11px] text-slate-500 bg-white/70 p-2 rounded-lg border border-slate-200/70 flex items-center justify-between">
                <span>💡 <strong>คำแนะนำ:</strong> ถ่ายมุมตรงระยะใกล้ช่องตัวเลขเพื่อความแม่นยำ</span>
              </div>
            )}
          </div>

          {/* Number Input & Stepper */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                เลขหน้าปัดมิเตอร์ใหม่
              </label>
              {previousValue > 0 && (
                <span className="text-xs text-slate-500 font-mono">
                  เดิม: <span className="text-slate-800 font-semibold">{previousValue.toFixed(1)}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.1"
                placeholder={previousValue > 0 ? (previousValue + 1).toFixed(1) : '2190.0'}
                value={readingInput}
                onChange={(e) => {
                  setReadingInput(e.target.value);
                  setDetectedProvider('manual');
                }}
                className="w-full bg-slate-50 text-2xl font-black font-mono text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-800 focus:bg-white focus:outline-none"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 font-mono">
                {meterType === 'electricity' ? 'kWh' : 'm³'}
              </span>
            </div>

            {/* Quick Step Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 mr-0.5">ปรับเร็ว:</span>
              {[-1.0, -0.1, +0.1, +1.0, +5.0, +10.0].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => adjustReading(step)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-medium transition-all"
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>

            {/* Difference & Cost preview */}
            {readingInput && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium ${
                  unitsDiff < 0
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>
                    {unitsDiff < 0
                      ? '⚠️ ตัวเลขน้อยกว่าครั้งก่อนหน้า'
                      : `ใช้เพิ่มขึ้น: +${unitsDiff.toFixed(1)} ${meterType === 'electricity' ? 'หน่วย' : 'ยูนิต'}`}
                  </span>
                  {unitsDiff > 0 && (
                    <span className="font-mono font-bold text-sm">
                      +฿{costDiff.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date & Notes Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-slate-600 block">
                  วันและเวลาที่จด
                </label>
                {extractedDateNotice && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/80 flex items-center gap-1 font-medium animate-fade-in">
                    <Calendar className="w-2.5 h-2.5 text-emerald-600" />
                    ดึงจากรูปภาพอัตโนมัติ
                  </span>
                )}
              </div>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => {
                  setTimestamp(e.target.value);
                  setExtractedDateNotice(null);
                }}
                className="w-full bg-slate-50 text-xs text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                หมายเหตุ (ถ้ามี)
              </label>
              <input
                type="text"
                placeholder="เช่น ก่อนเปิดแอร์..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 text-xs text-slate-800 px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
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
            disabled={!readingInput || parseFloat(readingInput) <= 0}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>บันทึก</span>
          </button>
        </div>
      </div>
    </div>
  );
};
