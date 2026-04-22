const router = require('express').Router();

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

router.post('/', async (req, res) => {
  try {
    const { image, itemCategories = [] } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required' });

    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    const base64   = image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Extract tailor shop order info from this bill image. Return ONLY a JSON object, no markdown:

{
  "customerName": string | null,
  "customerPhone": string | null,
  "billNo": string | null,
  "totalAmount": number | null,
  "discount": number | null,
  "advanceAmount": number | null,
  "items": [matched names from categories list only],
  "deliveryDate": "YYYY-MM-DD" | null,
  "note": string | null
}

Known item categories (only match from this list): ${itemCategories.join(', ')}

Rules:
- items: only include exact matches from the categories list above
- amounts: numbers only, no currency symbols
- customerPhone: digits only
- deliveryDate: YYYY-MM-DD format, today is ${new Date().toISOString().split('T')[0]}
- null for any field not found in the image`;

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ]}],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: `Gemini error: ${text}` });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let extracted;
    try {
      extracted = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      extracted = m ? JSON.parse(m[0]) : {};
    }

    res.json({ extracted });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
