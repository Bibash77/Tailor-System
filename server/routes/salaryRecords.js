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
    if (req.query.kaligadhId) filter.kaligadhId = req.query.kaligadhId;
    if (req.query.month)      filter.month      = req.query.month;
    const docs = await getDB().collection('salaryRecords').find(filter).toArray();
    res.json(docs.map(normalize));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await getDB().collection('salaryRecords').findOne({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(normalize(doc));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, ...rest } = req.body;
    await getDB().collection('salaryRecords').replaceOne(
      { _id: id }, { _id: id, ...rest }, { upsert: true }
    );
    res.json({ id, ...rest });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await getDB().collection('salaryRecords').deleteOne({ _id: req.params.id });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
