const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

function normalize(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

// GET all orders — excludes billPhoto (large base64) for list performance
router.get('/', async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const docs = await getDB().collection('orders')
      .find(filter, { projection: { billPhoto: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(docs.map(normalize));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const doc = await getDB().collection('orders').findOne({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(normalize(doc));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST (create/update)
router.post('/', async (req, res) => {
  try {
    const { id, ...rest } = req.body;
    await getDB().collection('orders').replaceOne(
      { _id: id },
      { _id: id, ...rest },
      { upsert: true }
    );
    res.json({ id, ...rest });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await getDB().collection('orders').deleteOne({ _id: req.params.id });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
