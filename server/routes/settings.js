const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// Settings are stored with composite _id `${shopId}:${key}` for shop isolation.
// Falls back to legacy unscoped key on first read (writes always use scoped id).

router.get('/:key', async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const key    = req.params.key;
    const id     = shopId ? `${shopId}:${key}` : key;
    const doc = await getDB().collection('settings').findOne({ _id: id });
    if (doc) return res.json({ value: doc.value });
    // Legacy fallback for unscoped docs (pre-migration)
    const legacy = await getDB().collection('settings').findOne({ _id: key });
    res.json(legacy ? { value: legacy.value } : { value: null });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body;
    const shopId = req.user.shopId;
    const id = shopId ? `${shopId}:${key}` : key;
    await getDB().collection('settings').replaceOne(
      { _id: id },
      { _id: id, shopId: shopId || null, value },
      { upsert: true }
    );
    res.json({ key, value });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
