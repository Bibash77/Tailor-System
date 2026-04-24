const router  = require('express').Router();
const tracker = require('../services/scanTracker');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildPrompt(itemCategories) {
  return `You are reading a Nepali tailor shop bill or measurement sheet. Extract all visible information and return ONLY valid JSON, no markdown, no explanation.

{
  "customerName": string | null,
  "customerPhone": string | null,
  "billNo": string | null,
  "totalAmount": number | null,
  "discount": number | null,
  "advanceAmount": number | null,
  "remainingAmount": number | null,
  "deliveryDate": "YYYY-MM-DD" | null,
  "items": [],
  "note": string | null,
  "measurements": {
    "shirt": {
      "length": number | null,
      "chest": number | null,
      "waist": number | null,
      "hip": number | null,
      "shoulder": number | null,
      "lBack": number | null,
      "sleeve": number | null,
      "neck": number | null
    },
    "pant": {
      "length": number | null,
      "waist": number | null,
      "hip": number | null,
      "high": number | null,
      "thigh": number | null,
      "knee": number | null,
      "bottom": number | null
    },
    "pantDesign": string | null,
    "shirtDesign": string | null
  }
}

${itemCategories.length > 0
  ? `Known item categories (prefer matching from this list): ${itemCategories.join(', ')}`
  : 'items: list all clothing items mentioned (shirt, pant, salwar, dress, coat, etc.)'}

Rules:
- amounts: numbers only, no currency symbols
- customerPhone: digits only
- deliveryDate: YYYY-MM-DD; today is ${new Date().toISOString().split('T')[0]}; if only day/month visible (e.g. 01/18) assume current year
- measurements: decimal values allowed (e.g. 25.5 for 25½), null if not visible
- pantDesign/shirtDesign: any design notes written on the sheet
- null for any field not found
- If this is only a measurement sheet with no billing info, leave billing fields null`;
}

async function callModel(model, images, prompt) {
  const content = [{ type: 'text', text: prompt }];
  for (const { dataUrl } of images) {
    content.push({ type: 'image_url', image_url: { url: dataUrl } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000); // 25s client-side timeout

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer':  process.env.APP_URL || 'http://localhost:3000',
        'X-Title':       'Tailor Manager',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    // AbortError or network timeout — treat as transient, try next model
    return { rateLimited: true };
  }
  clearTimeout(timer);

  // 429 quota, 402 payment, 504/503/502 gateway timeouts — all try next model
  if ([429, 402, 503, 504, 502].includes(response.status)) return { rateLimited: true };

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${model} error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  return { data };
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; }
}

// ─── GET /api/scan/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [stats, keyInfo] = await Promise.all([
      Promise.resolve(tracker.getStats()),
      tracker.fetchKeyInfo(),
    ]);
    res.json({ ...stats, keyInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/scan ───────────────────────────────────────────────────────────
// Body: { image, images: [], itemCategories: [] }
router.post('/', async (req, res) => {
  try {
    const { image, images: extraImages = [], itemCategories = [] } = req.body;

    const rawImages = image ? [image, ...extraImages] : extraImages;
    if (rawImages.length === 0) return res.status(400).json({ error: 'Image is required' });

    const images = rawImages.map(img => ({
      dataUrl: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
    }));

    const prompt      = buildPrompt(itemCategories);
    let extracted     = null;
    let lastError     = null;
    const tried       = new Set();

    // Try up to all models, starting from tracker's current model
    for (let attempt = 0; attempt < tracker.MODELS.length; attempt++) {
      const model = tracker.getCurrentModel();
      if (tried.has(model)) break;
      tried.add(model);

      const result = await callModel(model, images, prompt).catch(e => ({ error: e }));

      if (result.rateLimited) {
        tracker.recordRateLimit(model);
        continue;
      }
      if (result.error) {
        lastError = result.error;
        continue;
      }

      const text = result.data?.choices?.[0]?.message?.content || '{}';
      const cost = result.data?.usage?.cost || 0;
      const raw  = parseJSON(text);

      // Normalise items — model sometimes returns [{name,quantity}] instead of strings
      if (Array.isArray(raw.items)) {
        raw.items = raw.items
          .map(i => (typeof i === 'string' ? i : i?.name || ''))
          .filter(Boolean);
      }
      // Normalise amounts — ensure numbers, not strings
      for (const f of ['totalAmount','advanceAmount','remainingAmount','discount']) {
        if (raw[f] != null) raw[f] = Number(raw[f]) || null;
      }

      extracted = raw;
      tracker.recordSuccess(model, cost);
      break;
    }

    if (extracted === null) {
      const msg = lastError?.message || 'All models unavailable. Check OPENROUTER_API_KEY or try again later.';
      return res.status(503).json({ error: msg });
    }

    res.json({ extracted, _model: tracker.getCurrentModel() });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
