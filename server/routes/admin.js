const router       = require('express').Router();
const { getDB }    = require('../db');
const { ObjectId } = require('mongodb');
const crypto       = require('crypto');

function uid(id) {
  try { return new ObjectId(id); } catch { return id; }
}

const MONTH = () => new Date().toISOString().slice(0, 7);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveSubStatus(sub = {}) {
  const now = new Date();
  let s = sub.status || 'trial';
  if (s === 'trial'  && sub.trialEndsAt && now > new Date(sub.trialEndsAt))  s = 'expired';
  if (s === 'active' && sub.billedUntil && now > new Date(sub.billedUntil))  s = 'expired';
  return s;
}

// Enrich a user with their shop's subscription + quota data
function enrichUser(u, shopsMap = {}, month) {
  const shop = shopsMap[u.shopId] || {};
  const q    = shop.scanQuota   || {};
  const sub  = shop.subscription || {};

  const isCurrentMonth = q.month === month;
  const used      = isCurrentMonth ? (q.used || 0) : 0;
  const freeLimit = q.freeScanLimit ?? 20;
  const paidLimit = q.paidPlanLimit ?? 0;
  const total     = freeLimit + paidLimit;
  const remaining = Math.max(0, total - used);
  const nearQuota = remaining <= 3 && total > 0;

  return {
    _id:       u._id,
    email:     u.email,
    shopName:  u.shopName,
    shopId:    u.shopId || null,
    shop:      shop._id ? { _id: shop._id, name: shop.name } : null,
    role:      u.role   || 'shop_admin',
    status:    u.status || 'active',
    createdAt: u.createdAt,
    scanQuota: {
      freeScanLimit: freeLimit,
      paidPlanLimit: paidLimit,
      used,
      remaining,
      monthlyCharge: q.monthlyCharge ?? 500,
      billingStatus: q.billingStatus ?? 'active',
      nearQuota,
      month,
    },
    subscription: {
      status:      resolveSubStatus(sub),
      trialEndsAt: sub.trialEndsAt || null,
      billedUntil: sub.billedUntil || null,
      monthlyFee:  sub.monthlyFee  ?? 500,
      payments:    sub.payments    || [],
    },
  };
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const db    = getDB();
    const month = MONTH();
    const from  = new Date(month + '-01T00:00:00.000Z');

    const [users, shops, scansThisMonth, totalScans] = await Promise.all([
      db.collection('users').find({}, { projection: { status: 1, shopId: 1 } }).toArray(),
      db.collection('shops').find({}).toArray(),
      db.collection('scanQueue').countDocuments({ createdAt: { $gte: from } }),
      db.collection('scanQueue').countDocuments(),
    ]);

    // User-level stats
    let activeUsers = 0, suspendedUsers = 0;
    for (const u of users) {
      const s = u.status || 'active';
      if (s === 'active')    activeUsers++;
      if (s === 'suspended') suspendedUsers++;
    }

    // Shop-level billing stats
    let nearQuota = 0, expiredSub = 0, expectedRevenue = 0;
    for (const shop of shops) {
      const q   = shop.scanQuota   || {};
      const sub = shop.subscription || {};
      const isCurrent = q.month === month;
      const used  = isCurrent ? (q.used || 0) : 0;
      const total = (q.freeScanLimit ?? 20) + (q.paidPlanLimit ?? 0);
      if (Math.max(0, total - used) <= 3) nearQuota++;
      if (resolveSubStatus(sub) === 'expired') expiredSub++;
      expectedRevenue += q.monthlyCharge ?? 500;
    }

    res.json({
      totalUsers: users.length,
      activeUsers,
      suspendedUsers,
      totalShops: shops.length,
      scansThisMonth,
      totalScans,
      nearQuota,
      expiredSub,
      expectedRevenue,
      month,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const db    = getDB();
    const month = MONTH();

    const [users, shopList] = await Promise.all([
      db.collection('users')
        .find({}, { projection: { passwordHash: 0, resetToken: 0, resetExpiry: 0, fcmToken: 0 } })
        .sort({ createdAt: -1 })
        .toArray(),
      db.collection('shops').find({}).toArray(),
    ]);

    const shopsMap = Object.fromEntries(shopList.map(s => [s._id, s]));
    res.json({ users: users.map(u => enrichUser(u, shopsMap, month)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── PATCH /api/admin/users/:id — role, status, shopId only ──────────────────
router.patch('/users/:id', async (req, res) => {
  try {
    const { role, status, shopId } = req.body;
    const $set = {};
    if (role   != null) $set.role   = role;
    if (status != null) $set.status = status;
    if (shopId != null) $set.shopId = shopId;
    if (Object.keys($set).length === 0) return res.json({ ok: true });
    await getDB().collection('users').updateOne({ _id: uid(req.params.id) }, { $set });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    await getDB().collection('users').deleteOne({ _id: uid(req.params.id) });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── GET /api/admin/shops ─────────────────────────────────────────────────────
router.get('/shops', async (req, res) => {
  try {
    const db    = getDB();
    const shops = await db.collection('shops').find({}).sort({ createdAt: -1 }).toArray();
    const users = await db.collection('users')
      .find({}, { projection: { email: 1, shopName: 1, shopId: 1, role: 1, status: 1 } })
      .toArray();

    const byShop = {};
    for (const u of users) {
      if (!byShop[u.shopId]) byShop[u.shopId] = [];
      byShop[u.shopId].push({ _id: u._id, email: u.email, role: u.role || 'shop_admin', status: u.status || 'active' });
    }

    const month = MONTH();
    res.json({
      shops: shops.map(s => {
        const q   = s.scanQuota   || {};
        const sub = s.subscription || {};
        const isCurrent = q.month === month;
        const used  = isCurrent ? (q.used || 0) : 0;
        const total = (q.freeScanLimit ?? 20) + (q.paidPlanLimit ?? 0);
        return {
          ...s,
          users: byShop[s._id] || [],
          scanQuota: { ...q, used, remaining: Math.max(0, total - used), total },
          subscription: { ...sub, status: resolveSubStatus(sub) },
        };
      }),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── POST /api/admin/shops ────────────────────────────────────────────────────
router.post('/shops', async (req, res) => {
  try {
    const db = getDB();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Shop name required' });

    // Get admin defaults
    let defaults = { freeScanLimit: 20, monthlyCharge: 500 };
    try {
      const d = await db.collection('settings').findOne({ _id: 'adminDefaults' });
      if (d) defaults = { ...defaults, ...d };
    } catch {}

    const trialEndsAt = new Date(Date.now() + 30 * 86_400_000);
    const shop = {
      _id:       crypto.randomUUID(),
      name:      name.trim(),
      createdAt: new Date(),
      scanQuota: {
        freeScanLimit: defaults.freeScanLimit,
        paidPlanLimit: 0,
        used:          0,
        monthlyCharge: defaults.monthlyCharge,
        billingStatus: 'active',
        renewDate:     null,
        month:         '',
      },
      subscription: {
        status:      'trial',
        trialEndsAt,
        billedUntil: null,
        monthlyFee:  defaults.monthlyCharge,
        payments:    [],
      },
    };
    await db.collection('shops').insertOne(shop);
    res.json({ shop });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── PATCH /api/admin/shops/:id — name + quota + billing settings ─────────────
router.patch('/shops/:id', async (req, res) => {
  try {
    const { name, freeScanLimit, paidPlanLimit, monthlyCharge, billingStatus, subscriptionStatus } = req.body;
    const $set = {};
    if (name              != null) $set.name                            = name.trim();
    if (freeScanLimit     != null) $set['scanQuota.freeScanLimit']      = Math.max(0, Number(freeScanLimit));
    if (paidPlanLimit     != null) $set['scanQuota.paidPlanLimit']      = Math.max(0, Number(paidPlanLimit));
    if (monthlyCharge     != null) $set['scanQuota.monthlyCharge']      = Math.max(0, Number(monthlyCharge));
    if (billingStatus     != null) $set['scanQuota.billingStatus']      = billingStatus;
    if (subscriptionStatus!= null) $set['subscription.status']         = subscriptionStatus;
    if (Object.keys($set).length === 0) return res.json({ ok: true });
    await getDB().collection('shops').updateOne({ _id: req.params.id }, { $set });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── POST /api/admin/shops/:id/reset-quota ───────────────────────────────────
router.post('/shops/:id/reset-quota', async (req, res) => {
  try {
    await getDB().collection('shops').updateOne(
      { _id: req.params.id },
      { $set: { 'scanQuota.used': 0, 'scanQuota.month': MONTH() } },
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── POST /api/admin/shops/:id/grant-scans ───────────────────────────────────
router.post('/shops/:id/grant-scans', async (req, res) => {
  try {
    const extra = Math.max(1, Number(req.body.scans) || 0);
    await getDB().collection('shops').updateOne(
      { _id: req.params.id },
      { $inc: { 'scanQuota.paidPlanLimit': extra } },
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── POST /api/admin/shops/:id/subscription/payment ──────────────────────────
router.post('/shops/:id/subscription/payment', async (req, res) => {
  try {
    const { amount, method = 'cash', note = '' } = req.body;
    const db   = getDB();
    const shop = await db.collection('shops').findOne({ _id: req.params.id });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const sub  = shop.subscription || {};
    const now  = new Date();
    const base = sub.billedUntil && new Date(sub.billedUntil) > now ? new Date(sub.billedUntil) : now;
    const billedUntil = new Date(base);
    billedUntil.setMonth(billedUntil.getMonth() + 1);

    const payment = { amount: Number(amount) || sub.monthlyFee || 500, method, note, paidAt: now };
    await db.collection('shops').updateOne(
      { _id: req.params.id },
      {
        $set:  { 'subscription.status': 'active', 'subscription.billedUntil': billedUntil },
        $push: { 'subscription.payments': payment },
      },
    );
    res.json({ ok: true, billedUntil });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── GET /api/admin/defaults ──────────────────────────────────────────────────
router.get('/defaults', async (req, res) => {
  try {
    const doc = await getDB().collection('settings').findOne({ _id: 'adminDefaults' });
    res.json({ freeScanLimit: 20, monthlyCharge: 500, ...(doc || {}) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── PATCH /api/admin/defaults ────────────────────────────────────────────────
router.patch('/defaults', async (req, res) => {
  try {
    const { freeScanLimit, monthlyCharge } = req.body;
    const $set = {};
    if (freeScanLimit != null) $set.freeScanLimit = Math.max(1, Number(freeScanLimit));
    if (monthlyCharge != null) $set.monthlyCharge = Math.max(0, Number(monthlyCharge));
    await getDB().collection('settings').updateOne(
      { _id: 'adminDefaults' },
      { $set },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── GET /api/admin/scan-history ─────────────────────────────────────────────
router.get('/scan-history', async (req, res) => {
  try {
    const db    = getDB();
    const month = req.query.month || MONTH();
    const from  = new Date(month + '-01T00:00:00.000Z');
    const rows  = await db.collection('scanQueue')
      .find({ createdAt: { $gte: from } }, { projection: { imageThumb: 0 } })
      .sort({ createdAt: -1 }).limit(200).toArray();
    res.json({ rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
