export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use as is
      }
    }

    const { imageDataUrl, previousReading } = body || {};
    if (!imageDataUrl) {
      res.status(400).json({ error: 'Missing imageDataUrl' });
      return;
    }

    const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!mimeMatch) {
      res.status(400).json({ error: 'Invalid image format' });
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
      res.status(response.status).json({ error: `Gemini API Error: ${errText}` });
      return;
    }

    const data: any = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedData = JSON.parse(candidateText);

    res.status(200).json({
      reading: typeof parsedData.reading === 'number' ? parsedData.reading : parseFloat(parsedData.reading) || 0,
      confidence: parsedData.confidence || 95,
      rawText: candidateText,
      provider: 'gemini',
      meterTypeHint: parsedData.meter_type === 'water' ? 'water' : 'electricity',
      message: `Gemini AI ตรวจพบมิเตอร์${parsedData.meter_type === 'water' ? 'น้ำ' : 'ไฟ'}: ${parsedData.reading} (${parsedData.digits_detail || ''})`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
