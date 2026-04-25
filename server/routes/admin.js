const router       = require('express').Router();
const { getDB }    = require('../db');
const { ObjectId } = require('mongodb');

const CURRENT_MONTH = () => new Date().toISOString().slice(0, 7);

function resolveSubStatus(sub = {}) {
  const now = new Date();
  let status = sub.status || 'trial';
  if (status === 'trial'  && sub.trialEndsAt && now > new Date(sub.trialEndsAt))  status = 'expired';
  if (status === 'active' && sub.billedUntil && now > new Date(sub.billedUntil))  status = 'expired';
  return status;
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const db    = getDB();
    const month = CURRENT_MONTH();
    const from  = new Date(month + '-01T00:00:00.000Z');

    const [userCount, scansThisMonth, totalScans] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('scanQueue').countDocuments({ createdAt: { $gte: from } }),
      db.collection('scanQueue').countDocuments(),
    ]);

    // Estimate revenue: sum of (used * price) per user this month
    const users = await db.collection('users').find({}).project({ scanQuota: 1 }).toArray();
    const estimatedRevenue = users.reduce((sum, u) => {
      const q = u.scanQuota || {};
      if (q.month !== month) return sum;
      return sum + (q.used || 0) * ((q.price || 100) / (q.monthlyLimit || 100));
    }, 0);

    res.json({ userCount, scansThisMonth, totalScans, estimatedRevenue: Math.round(estimatedRevenue), month });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const db    = getDB();
    const month = CURRENT_MONTH();

    const users = await db.collection('users')
      .find({}, { projection: { passwordHash: 0, resetToken: 0, resetExpiry: 0, fcmToken: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    const enriched = users.map(u => {
      const q   = u.scanQuota   || {};
      const sub = u.subscription || {};
      const isCurrentMonth = q.month === month;
      return {
        _id:      u._id,
        email:    u.email,
        shopName: u.shopName,
        createdAt: u.createdAt,
        scanQuota: {
          monthlyLimit: q.monthlyLimit || 100,
          used:         isCurrentMonth ? (q.used || 0) : 0,
          remaining:    Math.max(0, (q.monthlyLimit || 100) - (isCurrentMonth ? (q.used || 0) : 0)),
          price:        q.price || 100,
          month,
        },
        subscription: {
          status:      resolveSubStatus(sub),
          trialEndsAt: sub.trialEndsAt  || null,
          billedUntil: sub.billedUntil  || null,
          monthlyFee:  sub.monthlyFee   ?? 500,
          payments:    sub.payments     || [],
        },
      };
    });

    res.json({ users: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/admin/users/:id/quota ─────────────────────────────────────────
router.patch('/users/:id/quota', async (req, res) => {
  try {
    const { monthlyLimit, price } = req.body;
    const update = {};
    if (monthlyLimit != null) update['scanQuota.monthlyLimit'] = Math.max(1, Number(monthlyLimit));
    if (price != null)        update['scanQuota.price']        = Math.max(0, Number(price));
    await getDB().collection('users').updateOne(
      { _id: req.params.id },
      { $set: update },
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/admin/users/:id/reset-quota ────────────────────────────────────
router.post('/users/:id/reset-quota', async (req, res) => {
  try {
    await getDB().collection('users').updateOne(
      { _id: req.params.id },
      { $set: { 'scanQuota.used': 0, 'scanQuota.month': CURRENT_MONTH() } },
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/admin/scan-history ─────────────────────────────────────────────
router.get('/scan-history', async (req, res) => {
  try {
    const db    = getDB();
    const month = req.query.month || CURRENT_MONTH();
    const from  = new Date(month + '-01T00:00:00.000Z');

    const rows = await db.collection('scanQueue')
      .find({ createdAt: { $gte: from } }, { projection: { imageThumb: 0 } })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/admin/users/:id/subscription ──────────────────────────────────
router.patch('/users/:id/subscription', async (req, res) => {
  try {
    const { monthlyFee, status } = req.body;
    const update = {};
    if (monthlyFee != null) update['subscription.monthlyFee'] = Math.max(0, Number(monthlyFee));
    if (status)             update['subscription.status']     = status;
    await getDB().collection('users').updateOne({ _id: req.params.id }, { $set: update });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/admin/users/:id/subscription/payment ───────────────────────────
router.post('/users/:id/subscription/payment', async (req, res) => {
  try {
    const { amount, method = 'cash', note = '' } = req.body;
    const db   = getDB();
    const user = await db.collection('users').findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sub        = user.subscription || {};
    const now        = new Date();
    // Extend from today or current billedUntil — whichever is later
    const base       = sub.billedUntil && new Date(sub.billedUntil) > now
      ? new Date(sub.billedUntil)
      : now;
    const billedUntil = new Date(base);
    billedUntil.setMonth(billedUntil.getMonth() + 1);

    const payment = { amount: Number(amount) || sub.monthlyFee || 500, method, note, paidAt: now };

    await db.collection('users').updateOne(
      { _id: req.params.id },
      {
        $set:  { 'subscription.status': 'active', 'subscription.billedUntil': billedUntil },
        $push: { 'subscription.payments': payment },
      },
    );
    res.json({ ok: true, billedUntil });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
