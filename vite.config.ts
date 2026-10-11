import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-ocr-dev-middleware',
        configureServer(server) {
          server.middlewares.use('/api/ocr', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });

            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                const { imageDataUrl, previousReading } = parsed;

                const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured in .env' }));
                  return;
                }

                if (!imageDataUrl) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Missing imageDataUrl' }));
                  return;
                }

                const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
                if (!mimeMatch) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Invalid image format' }));
                  return;
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

                const geminiPayload = {
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
                };

                let response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiPayload),
                  }
                );

                if (!response.ok) {
                  response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(geminiPayload),
                    }
                  );
                }

                if (!response.ok) {
                  const errText = await response.text();
                  res.statusCode = response.status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: `Gemini API Error: ${errText}` }));
                  return;
                }

                const data: any = await response.json();
                const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
                const parsedData = JSON.parse(candidateText);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    reading:
                      typeof parsedData.reading === 'number'
                        ? parsedData.reading
                        : parseFloat(parsedData.reading) || 0,
                    confidence: parsedData.confidence || 95,
                    rawText: candidateText,
                    provider: 'gemini',
                    meterTypeHint: parsedData.meter_type === 'water' ? 'water' : 'electricity',
                    message: `Gemini AI ตรวจพบมิเตอร์${parsedData.meter_type === 'water' ? 'น้ำ' : 'ไฟ'}: ${parsedData.reading} (${parsedData.digits_detail || ''})`,
                  })
                );
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Internal dev server error' }));
              }
            });
          });
        },
      },
    ],
  };
});
