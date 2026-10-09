import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import type { MeterType } from '../types';

export interface OCRResult {
  reading: number;
  confidence: number;
  rawText: string;
  provider: 'tesseract' | 'gemini';
  meterTypeHint?: MeterType;
  message?: string;
}

let workerInstance: Worker | null = null;

async function getTesseractWorker(onProgress?: (progress: number, status: string) => void): Promise<Worker> {
  if (workerInstance) {
    return workerInstance;
  }

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
}

// Generate multiple preprocessed variants (normal high contrast, inverted for white-on-black dials, and center crop)
export async function generateImageVariants(
  imageSource: string | HTMLImageElement
): Promise<{ standard: string; inverted: string; centerCrop: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 1200;
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

      // 1. Standard High Contrast
      const canvasStd = document.createElement('canvas');
      canvasStd.width = width;
      canvasStd.height = height;
      const ctxStd = canvasStd.getContext('2d');
      if (!ctxStd) {
        const raw = typeof imageSource === 'string' ? imageSource : img.src;
        resolve({ standard: raw, inverted: raw, centerCrop: raw });
        return;
      }

      ctxStd.drawImage(img, 0, 0, width, height);
      const imgDataStd = ctxStd.getImageData(0, 0, width, height);
      const dataStd = imgDataStd.data;
      const contrast = 1.6;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < dataStd.length; i += 4) {
        const gray = 0.299 * dataStd[i] + 0.587 * dataStd[i + 1] + 0.114 * dataStd[i + 2];
        const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        dataStd[i] = enhanced;
        dataStd[i + 1] = enhanced;
        dataStd[i + 2] = enhanced;
      }
      ctxStd.putImageData(imgDataStd, 0, 0);
      const standardData = canvasStd.toDataURL('image/png');

      // 2. Inverted High Contrast (Crucial for white-on-black mechanical counter wheels)
      const canvasInv = document.createElement('canvas');
      canvasInv.width = width;
      canvasInv.height = height;
      const ctxInv = canvasInv.getContext('2d');
      if (ctxInv) {
        ctxInv.drawImage(canvasStd, 0, 0);
        const imgDataInv = ctxInv.getImageData(0, 0, width, height);
        const dataInv = imgDataInv.data;
        for (let i = 0; i < dataInv.length; i += 4) {
          const inv = 255 - dataInv[i];
          dataInv[i] = inv;
          dataInv[i + 1] = inv;
          dataInv[i + 2] = inv;
        }
        ctxInv.putImageData(imgDataInv, 0, 0);
      }
      const invertedData = canvasInv ? canvasInv.toDataURL('image/png') : standardData;

      // 3. Center Crop (Focus on central 65% width and 35% height where meter counter sits)
      const canvasCrop = document.createElement('canvas');
      const cropW = Math.round(width * 0.7);
      const cropH = Math.round(height * 0.4);
      const cropX = Math.round((width - cropW) / 2);
      const cropY = Math.round((height - cropH) / 2);

      canvasCrop.width = cropW;
      canvasCrop.height = cropH;
      const ctxCrop = canvasCrop.getContext('2d');
      if (ctxCrop) {
        ctxCrop.drawImage(canvasStd, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      }
      const centerCropData = canvasCrop ? canvasCrop.toDataURL('image/png') : standardData;

      resolve({
        standard: standardData,
        inverted: invertedData,
        centerCrop: centerCropData,
      });
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
      score += 40;
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
    if (onProgress) onProgress(15, 'กำลังเตรียมรูปภาพและปรับความคมชัด...');
    const variants = await generateImageVariants(imageDataUrl);

    if (onProgress) onProgress(35, 'กำลังโหลดโมเดล OCR ตัวเลข...');
    const worker = await getTesseractWorker(onProgress);

    // Pass 1: Center Cropped region (where the meter counter dial is positioned)
    if (onProgress) onProgress(55, 'วิเคราะห์ตัวเลขบริเวณหน้าปัดมิเตอร์...');
    const retCrop = await worker.recognize(variants.centerCrop);
    const textCrop = retCrop.data.text || '';
    const parsedCrop = parseMeterNumber(textCrop, previousReading);

    if (parsedCrop.reading > 0 && parsedCrop.confidence >= 60) {
      if (onProgress) onProgress(100, 'อ่านตัวเลขสำเร็จ!');
      return {
        reading: parsedCrop.reading,
        confidence: parsedCrop.confidence,
        rawText: textCrop.trim(),
        provider: 'tesseract',
        message: `อ่านตัวเลขหน้าปัดได้: ${parsedCrop.reading}`,
      };
    }

    // Pass 2: Inverted binarized (handles white text on black roller dials)
    if (onProgress) onProgress(75, 'ปรับโหมดอ่านตัวเลขสีขาวบนพื้นดำ...');
    const retInv = await worker.recognize(variants.inverted);
    const textInv = retInv.data.text || '';
    const parsedInv = parseMeterNumber(textInv, previousReading);

    if (parsedInv.reading > 0 && parsedInv.confidence >= 55) {
      if (onProgress) onProgress(100, 'อ่านตัวเลขสำเร็จ!');
      return {
        reading: parsedInv.reading,
        confidence: parsedInv.confidence,
        rawText: textInv.trim(),
        provider: 'tesseract',
        message: `อ่านตัวเลขหน้าปัดได้: ${parsedInv.reading}`,
      };
    }

    // Pass 3: Full Standard Image
    if (onProgress) onProgress(88, 'วิเคราะห์ภาพรวมทั้งหมด...');
    const retStd = await worker.recognize(variants.standard);
    const textStd = retStd.data.text || '';
    const parsedStd = parseMeterNumber(textStd, previousReading);

    const bestResult = [parsedCrop, parsedInv, parsedStd].sort((a, b) => b.confidence - a.confidence)[0];

    if (onProgress) onProgress(100, bestResult.reading > 0 ? 'อ่านตัวเลขสำเร็จ!' : 'ประมวลผลเสร็จสิ้น');

    return {
      reading: bestResult.reading,
      confidence: bestResult.confidence,
      rawText: (textCrop + ' ' + textInv + ' ' + textStd).trim(),
      provider: 'tesseract',
      message:
        bestResult.reading > 0
          ? `อ่านตัวเลขได้ ${bestResult.reading}`
          : 'ไม่พบตัวเลขชัดเจน (แนะนำถ่ายให้เห็นเฉพาะช่องตัวเลข หรือกรอกตัวเลขเอง)',
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

    // Try gemini-2.5-flash first, fallback to gemini-1.5-flash
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
      // Fallback to gemini-1.5-flash
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
