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
        onProgress(Math.round(m.progress * 100), m.status || 'กำลังประมวลผล OCR...');
      }
    },
  });

  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.',
    tessedit_pageseg_mode: '7' as any,
  });

  workerInstance = worker;
  return worker;
}

export async function preprocessImage(imageSource: string | HTMLImageElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof imageSource === 'string' ? imageSource : img.src);
        return;
      }

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

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const contrast = 1.35;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = (e) => reject(e);

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = imageSource.src;
    }
  });
}

export function parseMeterNumber(rawText: string): { reading: number; confidence: number } {
  const sanitized = rawText
    .replace(/[oO]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '8')
    .replace(/[^\d.]/g, ' ')
    .trim();

  const matches = sanitized.match(/\d+(?:\.\d+)?/g);

  if (!matches || matches.length === 0) {
    return { reading: 0, confidence: 0 };
  }

  const sortedCandidates = [...matches].sort((a, b) => b.length - a.length);
  const bestMatch = sortedCandidates[0];
  const numValue = parseFloat(bestMatch);

  let confidence = 75;
  if (bestMatch.length >= 4 && bestMatch.length <= 7) confidence += 15;
  if (!isNaN(numValue) && numValue > 0) confidence += 5;

  return {
    reading: isNaN(numValue) ? 0 : numValue,
    confidence: Math.min(confidence, 98),
  };
}

export async function performLocalOCR(
  imageDataUrl: string,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> {
  try {
    if (onProgress) onProgress(10, 'กำลังเตรียมรูปภาพและปรับความคมชัด...');
    const preprocessed = await preprocessImage(imageDataUrl);

    if (onProgress) onProgress(30, 'กำลังโหลดโมเดลตัวรู้จำตัวเลข...');
    const worker = await getTesseractWorker(onProgress);

    if (onProgress) onProgress(60, 'กำลังวิเคราะห์ตัวเลขมิเตอร์...');
    const ret = await worker.recognize(preprocessed);
    const rawText = ret.data.text || '';
    const parsed = parseMeterNumber(rawText);

    if (onProgress) onProgress(100, 'อ่านตัวเลขสำเร็จ!');

    return {
      reading: parsed.reading,
      confidence: Math.round(ret.data.confidence || parsed.confidence),
      rawText: rawText.trim(),
      provider: 'tesseract',
      message: parsed.reading > 0 ? `อ่านตัวเลขได้ ${parsed.reading}` : 'ไม่พบตัวเลขชัดเจน กรุณาพิมพ์แก้ไขหรือถ่ายมุมตรง',
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
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> {
  try {
    if (onProgress) onProgress(20, 'กำลังเชื่อมต่อ Gemini AI Vision...');
    
    const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!mimeMatch) {
      throw new Error('รูปแบบภาพไม่ถูกต้อง');
    }
    const mimeType = mimeMatch[1];
    const base64Data = mimeMatch[2];

    const prompt = `You are an expert utility meter reader (Thai dorm electricity and water meters).
Analyze this utility meter photo.
Instructions:
1. Identify if this is an electricity meter (มิเตอร์ไฟ) or water meter (มิเตอร์น้ำ).
2. Read the cumulative number shown on the main display/mechanical rolling counter dials.
3. For electricity meters (e.g., Mitsubishi, Holley, Chang), black numbers are whole units (kWh), red sub-digits (if any) are decimal point.
4. For water meters (e.g., Asahi, Sanwa), read the main black counter numbers in m³ (cubic meters).
5. Return strictly a JSON object with this structure:
{
  "meter_type": "electricity" | "water",
  "reading": number,
  "confidence": number (between 0 to 100),
  "digits_detail": string,
  "notes": string
}`;

    if (onProgress) onProgress(50, 'Gemini กำลังอ่านตัวเลขหน้าปัดมิเตอร์...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    if (onProgress) onProgress(40, 'Gemini ใช้งานไม่ได้ กำลังสลับไปใช้ OCR ในเครื่องแทน...');
    const localResult = await performLocalOCR(imageDataUrl, onProgress);
    localResult.message = `(ใช้ OCR ในเครื่องแทน) ${localResult.message || ''}`;
    return localResult;
  }
}
