const router       = require('express').Router();
const { getDB }    = require('../db');
const { ObjectId } = require('mongodb');
const tracker      = require('../services/scanTracker');
const crypto       = require('crypto');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash-preview',
  'meta-llama/llama-4-maverick',
  'google/gemini-flash-1.5',
];
const DEFAULT_MONTHLY_LIMIT = 100;

// ─── Quota helpers ────────────────────────────────────────────────────────────

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function getQuota(db) {
  const month = currentMonth();
  const doc   = await db.collection('settings').findOne({ _id: 'scanQuota' });
  if (!doc || doc.value?.month !== month) {
    const limit = doc?.value?.monthlyLimit || DEFAULT_MONTHLY_LIMIT;
    const value = { monthlyLimit: limit, month, used: 0, price: 100 };
    await db.collection('settings').replaceOne(
      { _id: 'scanQuota' }, { _id: 'scanQuota', value }, { upsert: true }
    );
    return value;
  }
  return doc.value;
}

async function incrementUsed(db) {
  await db.collection('settings').updateOne(
    { _id: 'scanQuota' }, { $inc: { 'value.used': 1 } }
  );
}

// ─── AI scan ─────────────────────────────────────────────────────────────────

function buildPrompt(itemCategories) {
  const today = new Date().toISOString().split('T')[0];
  return `You are reading a Nepali tailor shop bill or measurement sheet. Extract all visible information and return ONLY valid JSON, no markdown.

{
  "customerName": string|null, "customerPhone": string|null, "billNo": string|null,
  "totalAmount": number|null, "discount": number|null,
  "advanceAmount": number|null, "remainingAmount": number|null,
  "deliveryDate": "YYYY-MM-DD"|null, "items": [], "note": string|null,
  "measurements": {
    "shirt": {"length":null,"chest":null,"waist":null,"hip":null,"shoulder":null,"lBack":null,"sleeve":null,"neck":null},
    "pant":  {"length":null,"waist":null,"hip":null,"high":null,"thigh":null,"knee":null,"bottom":null},
    "pantDesign":null,"shirtDesign":null
  }
}
${itemCategories.length ? `Item categories (match from list): ${itemCategories.join(', ')}` : 'items: list all clothing items found'}
Rules: amounts=numbers only, phone=digits only, deliveryDate=YYYY-MM-DD (today=${today}, if day/month only assume current year), measurements=numbers (25.5 for 25½), null if not found.`;
}

async function runAI(imageDataUrl, itemCategories) {
  const content = [
    { type: 'text',      text: buildPrompt(itemCategories) },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ];

  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const r = await fetch(OPENROUTER_URL, {
        method: 'POST', signal: controller.signal,
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
      clearTimeout(timer);

      if ([429, 402, 503, 504, 502].includes(r.status)) {
        tracker.recordRateLimit(model);
        continue;
      }
      if (!r.ok) continue;

      const data  = await r.json();
      const text  = data.choices?.[0]?.message?.content || '{}';
      const cost  = data.usage?.cost || 0;
      tracker.recordSuccess(model, cost);

      let extracted;
      try { extracted = JSON.parse(text); } catch { extracted = {}; }

      // Normalise
      if (Array.isArray(extracted.items)) {
        extracted.items = extracted.items
          .map(i => typeof i === 'string' ? i : i?.name || '')
          .filter(Boolean);
      }
      for (const f of ['totalAmount', 'advanceAmount', 'remainingAmount', 'discount']) {
        if (extracted[f] != null) extracted[f] = Number(extracted[f]) || null;
      }
      return extracted;
    } catch {
      clearTimeout(timer);
    }
  }
  throw new Error('AI scan failed — all models unavailable. Try again in a moment.');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/scan-queue/quota
router.get('/quota', async (req, res) => {
  try {
    const quota = await getQuota(getDB());
    res.json({ ...quota, remaining: Math.max(0, quota.monthlyLimit - (quota.used || 0)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/scan-queue — list pending/ready items (no thumbnails in list)
router.get('/', async (req, res) => {
  try {
    const items = await getDB().collection('scanQueue')
      .find({ userId: 'single_user', status: { $in: ['ready', 'failed'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .project({ imageThumb: 1, status: 1, extracted: 1, error: 1, createdAt: 1 })
      .toArray();
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/scan-queue — scan image and save to queue
router.post('/', async (req, res) => {
  try {
    const db = getDB();
    const { image, thumb, itemCategories = [] } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });

    const quota = await getQuota(db);
    if ((quota.used || 0) >= quota.monthlyLimit) {
      return res.status(402).json({
        error: `Monthly scan limit of ${quota.monthlyLimit} reached. Resets next month.`,
        quotaExceeded: true,
      });
    }

    // Save as processing
    const { insertedId } = await db.collection('scanQueue').insertOne({
      userId: 'single_user',
      status: 'processing',
      extracted: null,
      error: null,
      imageThumb: thumb || null,
      createdAt: new Date(),
      processedAt: null,
    });

    // Run AI
    try {
      const extracted = await runAI(image, itemCategories);
      await db.collection('scanQueue').updateOne(
        { _id: insertedId },
        { $set: { status: 'ready', extracted, processedAt: new Date() } }
      );
      return res.json({ id: insertedId, status: 'ready', extracted, thumb: thumb || null });
    } catch (err) {
      await db.collection('scanQueue').updateOne(
        { _id: insertedId },
        { $set: { status: 'failed', error: err.message, processedAt: new Date() } }
      );
      return res.json({ id: insertedId, status: 'failed', error: err.message });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/scan-queue/:id/confirm — create order from confirmed scan
router.post('/:id/confirm', async (req, res) => {
  try {
    const db   = getDB();
    const item = await db.collection('scanQueue').findOne({ _id: new ObjectId(req.params.id) });
    if (!item)                   return res.status(404).json({ error: 'Item not found' });
    if (item.status === 'confirmed') return res.status(400).json({ error: 'Already confirmed' });

    const { orderData } = req.body;
    const orderId = crypto.randomUUID();

    await db.collection('orders').insertOne({
      _id:          orderId,
      ...orderData,
      status:       'pending',
      createdAt:    new Date().toISOString(),
      fromScan:     true,
      scanQueueId:  item._id.toString(),
    });

    await db.collection('scanQueue').updateOne(
      { _id: item._id },
      { $set: { status: 'confirmed', orderId, confirmedAt: new Date() } }
    );

    await incrementUsed(db);

    // Activity log
    if (orderData.totalAmount) {
      await db.collection('activity').insertOne({
        type:        'income',
        description: `New order — ${orderData.customerName || 'Customer'} (scanned)`,
        amount:      Number(orderData.totalAmount) || 0,
        date:        new Date().toISOString().split('T')[0],
        createdAt:   new Date(),
      }).catch(() => {});
    }

    res.json({ ok: true, orderId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/scan-queue/:id — discard
router.delete('/:id', async (req, res) => {
  try {
    await getDB().collection('scanQueue').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
