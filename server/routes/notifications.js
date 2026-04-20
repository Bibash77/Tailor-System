const router     = require('express').Router();
const { getDB }  = require('../db');
const { ObjectId } = require('mongodb');

// ─── GET /api/notifications/unread-count ─────────────────────────────────────
router.get('/unread-count', async (req, res) => {
  try {
    const count = await getDB().collection('notifications')
      .countDocuments({ userId: 'single_user', read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/notifications ───────────────────────────────────────────────────
// ?type=delivery|payment|salary|finance  &unread=true  &limit=50
router.get('/', async (req, res) => {
  try {
    const { type, unread, limit = 60 } = req.query;
    const query = { userId: 'single_user' };
    if (type && type !== 'all') query.type = type;
    if (unread === 'true') query.read = false;

    const notifications = await getDB().collection('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();

    const unreadCount = await getDB().collection('notifications')
      .countDocuments({ userId: 'single_user', read: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/notifications/sync ─────────────────────────────────────────────
// Client sends array of computed notifications; server deduplicates and inserts new ones.
router.post('/sync', async (req, res) => {
  try {
    const { notifications } = req.body;
    if (!Array.isArray(notifications) || notifications.length === 0) {
      const unreadCount = await getDB().collection('notifications')
        .countDocuments({ userId: 'single_user', read: false });
      return res.json({ inserted: 0, unreadCount });
    }

    const db = getDB();
    let inserted = 0;

    for (const n of notifications) {
      if (!n.dedupKey) continue;

      const exists = await db.collection('notifications').findOne({ dedupKey: n.dedupKey });
      if (!exists) {
        await db.collection('notifications').insertOne({
          userId:         'single_user',
          dedupKey:       n.dedupKey,
          title:          n.title   || '',
          message:        n.message || '',
          type:           n.type    || 'general',
          priority:       n.priority || 'medium',
          moduleRedirect: n.moduleRedirect || 'dashboard',
          entityId:       n.entityId || null,
          read:           false,
          sentPush:       false,
          createdAt:      new Date(),
        });
        inserted++;
      }
    }

    const unreadCount = await db.collection('notifications')
      .countDocuments({ userId: 'single_user', read: false });

    res.json({ inserted, unreadCount });
  } catch (err) {
    console.error('Notification sync error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/notifications/fcm-token ───────────────────────────────────────
router.post('/fcm-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    await getDB().collection('users').updateOne(
      { email: req.user.email },
      { $set: { fcmToken: token, fcmUpdatedAt: new Date() } },
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
// MUST be declared before /:id/read to avoid route shadowing
router.patch('/read-all', async (req, res) => {
  try {
    await getDB().collection('notifications').updateMany(
      { userId: 'single_user', read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    res.json({ ok: true, unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    await getDB().collection('notifications').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { read: true, readAt: new Date() } },
    );
    const unreadCount = await getDB().collection('notifications')
      .countDocuments({ userId: 'single_user', read: false });
    res.json({ ok: true, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/notifications/old ───────────────────────────────────────────
// Prune read notifications older than 30 days
router.delete('/old', async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const r = await getDB().collection('notifications').deleteMany({
      userId: 'single_user', read: true, createdAt: { $lt: cutoff },
    });
    res.json({ deleted: r.deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
