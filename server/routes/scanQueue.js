const router   = require('express').Router();
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const tracker  = require('../services/scanTracker');
const crypto   = require('crypto');

const OPENROUTER_URL        = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MONTHLY_LIMIT = 100;
const DEFAULT_PRICE         = 100; // Rs per month
const MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash-preview',
  'meta-llama/llama-4-maverick',
  'google/gemini-flash-1.5',
];

// ─── Per-user quota (stored in users collection) ──────────────────────────────

async function getUserQuota(db, email) {
  const month = new Date().toISOString().slice(0, 7);
  const user  = await db.collection('users').findOne({ email });
  if (!user) throw new Error('User not found');

  const q = user.scanQuota || {};
  if (q.month !== month) {
    // New month — reset
    const fresh = {
      monthlyLimit: q.monthlyLimit || DEFAULT_MONTHLY_LIMIT,
      price:        q.price        || DEFAULT_PRICE,
      used:  0,
      month,
    };
    await db.collection('users').updateOne({ email }, { $set: { scanQuota: fresh } });
    return { ...fresh, remaining: fresh.monthlyLimit };
  }
  const used      = q.used || 0;
  const limit     = q.monthlyLimit || DEFAULT_MONTHLY_LIMIT;
  return { monthlyLimit: limit, price: q.price || DEFAULT_PRICE, used, month, remaining: Math.max(0, limit - used) };
}

// Charge is on API hit — called immediately before AI processing
async function chargeOneScan(db, email) {
  const month = new Date().toISOString().slice(0, 7);
  await db.collection('users').updateOne(
    { email },
    {
      $inc: { 'scanQuota.used': 1 },
      $set: { 'scanQuota.month': month },
    },
  );
}

// ─── AI processing ────────────────────────────────────────────────────────────

function buildPrompt(cats) {
  const today = new Date().toISOString().split('T')[0];
  return `You are reading a Nepali tailor shop bill or measurement sheet. Return ONLY valid JSON, no markdown.

{
  "customerName":string|null,"customerPhone":string|null,"billNo":string|null,
  "totalAmount":number|null,"discount":number|null,"advanceAmount":number|null,"remainingAmount":number|null,
  "deliveryDate":"YYYY-MM-DD"|null,"items":[],"note":string|null,
  "measurements":{
    "shirt":{"length":null,"chest":null,"waist":null,"hip":null,"shoulder":null,"lBack":null,"sleeve":null,"neck":null},
    "pant":{"length":null,"waist":null,"hip":null,"high":null,"thigh":null,"knee":null,"bottom":null},
    "pantDesign":null,"shirtDesign":null
  }
}
${cats.length ? `Item categories (match from list): ${cats.join(', ')}` : 'items: list clothing items found'}
Rules: amounts=numbers, phone=digits, deliveryDate=YYYY-MM-DD (today=${today}, day/month only → assume current year), measurements=numbers (25.5 for 25½), null if not found.`;
}

async function runAI(imageDataUrl, cats) {
  const content = [
    { type: 'text',      text: buildPrompt(cats) },
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
      if ([429, 402, 503, 504, 502].includes(r.status)) { tracker.recordRateLimit(model); continue; }
      if (!r.ok) continue;

      const data = await r.json();
      const text = data.choices?.[0]?.message?.content || '{}';
      tracker.recordSuccess(model, data.usage?.cost || 0);

      let ex;
      try { ex = JSON.parse(text); } catch { ex = {}; }
      if (Array.isArray(ex.items)) {
        ex.items = ex.items.map(i => typeof i === 'string' ? i : i?.name || '').filter(Boolean);
      }
      for (const f of ['totalAmount','advanceAmount','remainingAmount','discount']) {
        if (ex[f] != null) ex[f] = Number(ex[f]) || null;
      }
      return ex;
    } catch { clearTimeout(timer); }
  }
  throw new Error('AI scan failed — all models unavailable. Please try again.');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/scan-queue/quota
router.get('/quota', async (req, res) => {
  try {
    const q = await getUserQuota(getDB(), req.user.email);
    res.json(q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/scan-queue
router.get('/', async (req, res) => {
  try {
    const items = await getDB().collection('scanQueue')
      .find({ userId: req.user.email, status: { $in: ['ready', 'failed'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .project({ imageThumb: 1, status: 1, extracted: 1, error: 1, createdAt: 1 })
      .toArray();
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/scan-queue  ← CHARGE HAPPENS HERE on every API hit
router.post('/', async (req, res) => {
  try {
    const db    = getDB();
    const email = req.user.email;
    const { image, thumb, itemCategories = [] } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });

    // Check quota first
    const quota = await getUserQuota(db, email);
    if (quota.used >= quota.monthlyLimit) {
      return res.status(402).json({
        error: `Monthly scan limit of ${quota.monthlyLimit} reached. Resets next month.`,
        quotaExceeded: true,
      });
    }

    // Charge immediately — API hit counts regardless of outcome
    await chargeOneScan(db, email);

    // Save as processing
    const { insertedId } = await db.collection('scanQueue').insertOne({
      userId:    email,
      status:    'processing',
      extracted: null,
      error:     null,
      imageThumb: thumb || null,
      createdAt: new Date(),
      processedAt: null,
    });

    // Run AI
    try {
      const extracted = await runAI(image, itemCategories);
      await db.collection('scanQueue').updateOne(
        { _id: insertedId },
        { $set: { status: 'ready', extracted, processedAt: new Date() } },
      );
      return res.json({ id: insertedId, status: 'ready', extracted, thumb: thumb || null });
    } catch (err) {
      await db.collection('scanQueue').updateOne(
        { _id: insertedId },
        { $set: { status: 'failed', error: err.message, processedAt: new Date() } },
      );
      return res.json({ id: insertedId, status: 'failed', error: err.message });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/scan-queue/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const db   = getDB();
    const item = await db.collection('scanQueue').findOne({ _id: new ObjectId(req.params.id) });
    if (!item)                   return res.status(404).json({ error: 'Not found' });
    if (item.status === 'confirmed') return res.status(400).json({ error: 'Already confirmed' });

    const { orderData } = req.body;
    const orderId = crypto.randomUUID();

    await db.collection('orders').insertOne({
      _id:         orderId,
      ...orderData,
      status:      'pending',
      createdAt:   new Date().toISOString(),
      fromScan:    true,
      scanQueueId: item._id.toString(),
    });

    await db.collection('scanQueue').updateOne(
      { _id: item._id },
      { $set: { status: 'confirmed', orderId, confirmedAt: new Date() } },
    );

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

// DELETE /api/scan-queue/:id
router.delete('/:id', async (req, res) => {
  try {
    await getDB().collection('scanQueue').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
