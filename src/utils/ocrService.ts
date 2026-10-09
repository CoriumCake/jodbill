import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import ExifReader from 'exifreader';
import type { MeterType } from '../types';

export interface OCRResult {
  reading: number;
  confidence: number;
  rawText: string;
  provider: 'tesseract' | 'gemini';
  meterTypeHint?: MeterType;
  message?: string;
  extractedTimestamp?: string;
}

let workerInstance: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;

/**
 * Preload and initialize Tesseract WASM worker eagerly in background
 */
export async function preloadOCRWorker(): Promise<void> {
  if (workerInstance) return;
  try {
    await getTesseractWorker();
  } catch (e) {
    console.warn('OCR Worker preload skipped:', e);
  }
}

async function getTesseractWorker(onProgress?: (progress: number, status: string) => void): Promise<Worker> {
  if (workerInstance) {
    return workerInstance;
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  workerInitPromise = (async () => {
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (onProgress && m.progress !== undefined) {
          onProgress(Math.round(m.progress * 100), m.status || 'กำลังอ่านตัวเลข...');
        }
      },
    });

    // Configure for high-speed digits recognition
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.',
      tessedit_pageseg_mode: '6' as any,
    });

    workerInstance = worker;
    return worker;
  })();

  return workerInitPromise;
}

/**
 * Extract photo creation date from EXIF metadata or file modified date
 */
export async function extractPhotoDate(file: File): Promise<string | null> {
  try {
    const tags = await ExifReader.load(file, { expanded: true });
    
    const exifAny = (tags as any)?.exif || tags;
    const rawDate = 
      exifAny?.DateTimeOriginal?.description || 
      exifAny?.CreateDate?.description || 
      exifAny?.DateTime?.description ||
      exifAny?.DateTimeDigitized?.description;

    if (rawDate && typeof rawDate === 'string') {
      const match = rawDate.match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})\s+(\d{2}):(\d{2})/);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
      }
    }
  } catch (err) {
    console.warn('Exif extraction skipped/failed:', err);
  }

  // Fallback to file.lastModified timestamp if it's within a valid range
  if (file.lastModified && file.lastModified > 0) {
    const d = new Date(file.lastModified);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  return null;
}

/**
 * Fast dial strip extraction (Extracts center 70% width x 30% height, inverts white-on-black dials, and scales to ~360x100px)
 * Processing a 360x100px image takes only ~40-70ms in WASM!
 */
export async function extractUltraFastDialStrip(
  imageSource: string | HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ dialStripInverted: string; dialStripStandard: string }> {
  return new Promise((resolve) => {
    let srcW = 0;
    let srcH = 0;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const processFrame = (source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
      srcW = 'videoWidth' in source ? source.videoWidth : source.width;
      srcH = 'videoHeight' in source ? source.videoHeight : source.height;

      if (!srcW || !srcH) {
        resolve({ dialStripInverted: '', dialStripStandard: '' });
        return;
      }

      // Crop center rectangular strip where mechanical dials sit
      const cropW = Math.round(srcW * 0.72);
      const cropH = Math.round(srcH * 0.32);
      const cropX = Math.round((srcW - cropW) / 2);
      const cropY = Math.round((srcH - cropH) / 2);

      // Target resolution: 380px width
      const targetW = 380;
      const targetH = Math.round((cropH * targetW) / cropW);

      canvas.width = targetW;
      canvas.height = targetH;

      if (!ctx) {
        resolve({ dialStripInverted: '', dialStripStandard: '' });
        return;
      }

      ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const d = imgData.data;

      // Single-pass contrast enhancement + grayscale
      const contrast = 1.6;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      const invData = new Uint8ClampedArray(d.length);

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        
        // Standard high contrast
        d[i] = enhanced;
        d[i + 1] = enhanced;
        d[i + 2] = enhanced;

        // Inverted (white-on-black to black-on-white)
        const inv = 255 - enhanced;
        invData[i] = inv;
        invData[i + 1] = inv;
        invData[i + 2] = inv;
        invData[i + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);
      const dialStripStandard = canvas.toDataURL('image/jpeg', 0.85);

      const invImageData = new ImageData(invData, targetW, targetH);
      ctx.putImageData(invImageData, 0, 0);
      const dialStripInverted = canvas.toDataURL('image/jpeg', 0.85);

      resolve({ dialStripInverted, dialStripStandard });
    };

    if (typeof imageSource === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => processFrame(img);
      img.onerror = () => resolve({ dialStripInverted: imageSource, dialStripStandard: imageSource });
      img.src = imageSource;
    } else {
      processFrame(imageSource);
    }
  });
}

// Common false-positive electrical specification numbers printed on Thai meters
const COMMON_METER_SPECS = new Set([
  '220', '230', '240', '110', // Voltage
  '50', '60', // Frequency Hz
  '515', '5', '15', '45', '100', // Current Amp e.g. 5(15)A
  '1200', '600', '1600', // rev/kWh
  '33', '330', // Model MF-33E
]);

export function parseMeterNumber(
  rawText: string,
  previousReading?: number
): { reading: number; confidence: number; candidate: string } {
  const sanitized = rawText
    .replace(/[oO]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '8')
    .replace(/[^\d.]/g, ' ')
    .trim();

  const matches = sanitized.match(/\d+(?:\.\d+)?/g);

  if (!matches || matches.length === 0) {
    return { reading: 0, confidence: 0, candidate: '' };
  }

  // Score candidate numbers
  let bestCandidate = '';
  let bestScore = -1;

  for (const match of matches) {
    const val = parseFloat(match);
    if (isNaN(val)) continue;

    const digitsOnly = match.replace('.', '');
    const len = digitsOnly.length;

    // Reject obvious electrical rating noise
    if (COMMON_METER_SPECS.has(digitsOnly) && len <= 3) {
      continue;
    }

    let score = 0;

    // Typical meter dials have 4 to 6 digits (e.g. 1234, 05234, 1890.5)
    if (len >= 4 && len <= 7) {
      score += 45;
    } else if (len === 3) {
      score += 15;
    } else if (len > 7) {
      score += 5;
    }

    // Has decimal point (e.g. 1234.5)
    if (match.includes('.')) {
      score += 15;
    }

    // If previous reading is known, prefer readings that are close and >= previous
    if (previousReading && previousReading > 0) {
      const diff = val - previousReading;
      if (diff >= 0 && diff <= 500) {
        score += 50; // Ideal delta for normal monthly/daily usage
      } else if (diff >= 0 && diff <= 2000) {
        score += 25;
      } else if (diff < 0 && Math.abs(diff) < 50) {
        score += 10;
      }
    } else if (val > 10) {
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = match;
    }
  }

  if (!bestCandidate) {
    const sorted = [...matches].sort((a, b) => b.length - a.length);
    bestCandidate = sorted[0];
  }

  const numValue = parseFloat(bestCandidate);

  return {
    reading: isNaN(numValue) ? 0 : numValue,
    confidence: Math.min(Math.max(bestScore, 40), 95),
    candidate: bestCandidate,
  };
}

/**
 * Ultra-Fast Local OCR (<100ms inference)
 */
export async function performLocalOCR(
  imageDataUrl: string,
  onProgress?: (progress: number, status: string) => void,
  previousReading?: number
): Promise<OCRResult> {
  try {
    if (onProgress) onProgress(25, 'ตัดโฟกัสหน้าปัด...');
    const { dialStripInverted, dialStripStandard } = await extractUltraFastDialStrip(imageDataUrl);

    if (onProgress) onProgress(50, 'อ่านตัวเลข...');
    const worker = await getTesseractWorker(onProgress);

    // Rapid Pass 1: Inverted Dial Strip (takes ~50ms)
    const retInv = await worker.recognize(dialStripInverted);
    const textInv = retInv.data.text || '';
    const parsedInv = parseMeterNumber(textInv, previousReading);

    if (parsedInv.reading > 0 && parsedInv.confidence >= 50) {
      if (onProgress) onProgress(100, 'อ่านสำเร็จ!');
      return {
        reading: parsedInv.reading,
        confidence: parsedInv.confidence,
        rawText: textInv.trim(),
        provider: 'tesseract',
        message: `อ่านตัวเลขหน้าปัดได้: ${parsedInv.reading}`,
      };
    }

    // Quick Pass 2: Standard Dial Strip (takes ~50ms)
    if (onProgress) onProgress(80, 'วิเคราะห์แถบมาตรฐาน...');
    const retStd = await worker.recognize(dialStripStandard);
    const textStd = retStd.data.text || '';
    const parsedStd = parseMeterNumber(textStd, previousReading);

    const bestResult = [parsedInv, parsedStd].sort((a, b) => b.confidence - a.confidence)[0];

    if (onProgress) onProgress(100, bestResult.reading > 0 ? 'อ่านสำเร็จ!' : 'ประมวลผลเสร็จสิ้น');

    return {
      reading: bestResult.reading,
      confidence: bestResult.confidence,
      rawText: (textInv + ' ' + textStd).trim(),
      provider: 'tesseract',
      message:
        bestResult.reading > 0
          ? `อ่านตัวเลขได้ ${bestResult.reading}`
          : 'ไม่พบตัวเลขชัดเจน (แนะนำถ่ายซูมเฉพาะช่องตัวเลข หรือกรอกตัวเลขเอง)',
    };
  } catch (error) {
    console.error('Local OCR failed:', error);
    return {
      reading: 0,
      confidence: 0,
      rawText: '',
      provider: 'tesseract',
      message: 'เกิดข้อผิดพลาดในการประมวลผล OCR',
    };
  }
}

/**
 * Live Real-time Camera Frame Scanner (Called in loop on live camera video feed)
 */
export async function scanLiveCameraFrame(
  videoElement: HTMLVideoElement,
  previousReading?: number
): Promise<{ reading: number; confidence: number; rawText: string } | null> {
  try {
    if (!workerInstance || videoElement.readyState < 2) return null;
    const { dialStripInverted } = await extractUltraFastDialStrip(videoElement);
    if (!dialStripInverted) return null;

    const ret = await workerInstance.recognize(dialStripInverted);
    const text = ret.data.text || '';
    const parsed = parseMeterNumber(text, previousReading);

    if (parsed.reading > 0 && parsed.confidence >= 55) {
      return {
        reading: parsed.reading,
        confidence: parsed.confidence,
        rawText: text.trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function performGeminiVisionOCR(
  imageDataUrl: string,
  apiKey: string,
  onProgress?: (progress: number, status: string) => void,
  previousReading?: number
): Promise<OCRResult> {
  try {
    if (onProgress) onProgress(20, 'กำลังเชื่อมต่อ Gemini AI Vision...');

    const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!mimeMatch) {
      throw new Error('รูปแบบภาพไม่ถูกต้อง');
    }
    const mimeType = mimeMatch[1];
    const base64Data = mimeMatch[2];

    const prevHint = previousReading ? `Previous recorded reading was approx: ${previousReading}` : '';

    const prompt = `You are an expert utility meter reader for Thai dorm electricity and water meters.
Analyze this utility meter photo.
${prevHint}

Instructions:
1. Identify if this is an electricity meter (มิเตอร์ไฟ) or water meter (มิเตอร์น้ำ).
2. Read the cumulative number shown in the main rolling dials / mechanical counter window.
3. For electricity meters (e.g., Mitsubishi MF-33E, Holley, Chang), read all counter digits. Ignore 220V, 50Hz, 5(15)A, model names, and serial numbers.
4. For water meters (e.g., Asahi, Sanwa), read the main counter digits in m³.
5. Return strictly a valid JSON object with this exact structure:
{
  "meter_type": "electricity" | "water",
  "reading": number,
  "confidence": number,
  "digits_detail": string,
  "notes": string
}`;

    if (onProgress) onProgress(50, 'Gemini กำลังอ่านตัวเลขหน้าปัดมิเตอร์...');

    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: 'application/json',
            },
          }),
        }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedData = JSON.parse(candidateText);

    if (onProgress) onProgress(100, 'Gemini AI อ่านเลขมิเตอร์เสร็จสมบูรณ์!');

    return {
      reading: typeof parsedData.reading === 'number' ? parsedData.reading : parseFloat(parsedData.reading) || 0,
      confidence: parsedData.confidence || 95,
      rawText: candidateText,
      provider: 'gemini',
      meterTypeHint: parsedData.meter_type === 'water' ? 'water' : 'electricity',
      message: `Gemini AI ตรวจพบมิเตอร์${parsedData.meter_type === 'water' ? 'น้ำ' : 'ไฟ'}: ${parsedData.reading} (${parsedData.digits_detail || ''})`,
    };
  } catch (error: any) {
    console.warn('Gemini OCR failed, falling back to local Tesseract:', error);
    if (onProgress) onProgress(40, 'สลับไปใช้ OCR ในเครื่องแทน...');
    const localResult = await performLocalOCR(imageDataUrl, onProgress, previousReading);
    localResult.message = `(OCR ในเครื่อง) ${localResult.message || ''}`;
    return localResult;
  }
}
