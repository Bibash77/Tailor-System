const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

function normalize(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

router.get('/', async (req, res) => {
  try {
    const filter = { shopId: req.user.shopId };
    if (req.query.referenceId) filter.referenceId = req.query.referenceId;
    const docs = await getDB().collection('activity')
      .find(filter)
      .sort({ date: -1 })
      .limit(500)
      .toArray();
    res.json(docs.map(normalize));
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, ...rest } = req.body;
    const shopId = req.user.shopId;
    await getDB().collection('activity').replaceOne(
      { _id: id },
      { _id: id, shopId, ...rest },
      { upsert: true }
    );
    res.json({ id, shopId, ...rest });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
