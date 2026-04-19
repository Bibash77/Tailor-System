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
    const filter = {};
    if (req.query.referenceId) filter.referenceId = req.query.referenceId;
    const docs = await getDB().collection('activity')
      .find(filter)
      .sort({ date: -1 })
      .toArray();
    res.json(docs.map(normalize));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, ...rest } = req.body;
    await getDB().collection('activity').replaceOne(
      { _id: id },
      { _id: id, ...rest },
      { upsert: true }
    );
    res.json({ id, ...rest });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
