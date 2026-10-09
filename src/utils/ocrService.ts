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
          onProgress(Math.round(m.progress * 100), m.status || 'กำลังวิเคราะห์ตัวเลข...');
        }
      },
    });

    // Use PSM 6 (single uniform block of text) and allow digits and dot
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
 * Fast optimized image preprocessing (Resizes to 720px and applies contrast + ROI inversion in single pass)
 */
export async function fastPreprocessImage(
  imageSource: string | HTMLImageElement
): Promise<{ fastROI: string; fastStandard: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Optimal resolution for high-speed OCR: 720px max dimension
      const maxDim = 720;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      // 1. Process Standard Enhanced
      const canvasStd = document.createElement('canvas');
      canvasStd.width = width;
      canvasStd.height = height;
      const ctxStd = canvasStd.getContext('2d');
      if (!ctxStd) {
        const raw = typeof imageSource === 'string' ? imageSource : img.src;
        resolve({ fastROI: raw, fastStandard: raw });
        return;
      }

      ctxStd.drawImage(img, 0, 0, width, height);
      const imgData = ctxStd.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Fast contrast + grayscale formula
      const contrast = 1.5;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }
      ctxStd.putImageData(imgData, 0, 0);
      const fastStandard = canvasStd.toDataURL('image/jpeg', 0.85);

      // 2. Process ROI (Center Crop + Invert white-on-black dials in single pass)
      const cropW = Math.round(width * 0.75);
      const cropH = Math.round(height * 0.45);
      const cropX = Math.round((width - cropW) / 2);
      const cropY = Math.round((height - cropH) / 2);

      const canvasROI = document.createElement('canvas');
      canvasROI.width = cropW;
      canvasROI.height = cropH;
      const ctxROI = canvasROI.getContext('2d');
      if (ctxROI) {
        ctxROI.drawImage(canvasStd, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const roiData = ctxROI.getImageData(0, 0, cropW, cropH);
        const rData = roiData.data;
        // Invert to convert white-on-black rolling counter dials to black-on-white
        for (let i = 0; i < rData.length; i += 4) {
          rData[i] = 255 - rData[i];
          rData[i + 1] = 255 - rData[i + 1];
          rData[i + 2] = 255 - rData[i + 2];
        }
        ctxROI.putImageData(roiData, 0, 0);
      }
      const fastROI = canvasROI ? canvasROI.toDataURL('image/jpeg', 0.85) : fastStandard;

      resolve({ fastROI, fastStandard });
    };

    img.onerror = (e) => reject(e);

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = imageSource.src;
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
      score += 5; // Might be serial number
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
    // Fallback to longest match if all were filtered
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

export async function performLocalOCR(
  imageDataUrl: string,
  onProgress?: (progress: number, status: string) => void,
  previousReading?: number
): Promise<OCRResult> {
  try {
    if (onProgress) onProgress(20, 'ปรับความคมชัดรูปภาพ...');
    const { fastROI, fastStandard } = await fastPreprocessImage(imageDataUrl);

    if (onProgress) onProgress(45, 'กำลังประมวลผลตัวเลข...');
    const worker = await getTesseractWorker(onProgress);

    // High Speed Pass 1: Target Inverted Center ROI (White-on-black rolling dials)
    if (onProgress) onProgress(70, 'อ่านตัวเลขหน้าปัด...');
    const retROI = await worker.recognize(fastROI);
    const textROI = retROI.data.text || '';
    const parsedROI = parseMeterNumber(textROI, previousReading);

    // Fast Early Exit: If ROI pass found a solid candidate, return immediately (0.4s!)
    if (parsedROI.reading > 0 && parsedROI.confidence >= 55) {
      if (onProgress) onProgress(100, 'อ่านสำเร็จ!');
      return {
        reading: parsedROI.reading,
        confidence: parsedROI.confidence,
        rawText: textROI.trim(),
        provider: 'tesseract',
        message: `อ่านตัวเลขหน้าปัดได้: ${parsedROI.reading}`,
      };
    }

    // Quick Pass 2 Fallback: Standard image
    if (onProgress) onProgress(85, 'ตรวจสอบภาพรวม...');
    const retStd = await worker.recognize(fastStandard);
    const textStd = retStd.data.text || '';
    const parsedStd = parseMeterNumber(textStd, previousReading);

    const bestResult = [parsedROI, parsedStd].sort((a, b) => b.confidence - a.confidence)[0];

    if (onProgress) onProgress(100, bestResult.reading > 0 ? 'อ่านสำเร็จ!' : 'ประมวลผลเสร็จสิ้น');

    return {
      reading: bestResult.reading,
      confidence: bestResult.confidence,
      rawText: (textROI + ' ' + textStd).trim(),
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
      message: 'เกิดข้อผิดพลาดในการประมวลผล OCR ในเครื่อง',
    };
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
