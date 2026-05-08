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
    const docs = await getDB().collection('kaligadhs').find({ shopId: req.user.shopId }).toArray();
    res.json(docs.map(normalize));
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await getDB().collection('kaligadhs').findOne({ _id: req.params.id, shopId: req.user.shopId });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(normalize(doc));
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, ...rest } = req.body;
    const shopId = req.user.shopId;
    await getDB().collection('kaligadhs').replaceOne(
      { _id: id },
      { _id: id, shopId, ...rest },
      { upsert: true }
    );
    res.json({ id, shopId, ...rest });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await getDB().collection('kaligadhs').deleteOne({ _id: req.params.id, shopId: req.user.shopId });
    res.json({ deleted: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
