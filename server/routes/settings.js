const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

router.get('/:key', async (req, res) => {
  try {
    const doc = await getDB().collection('settings').findOne({ _id: req.params.key });
    res.json(doc ? { value: doc.value } : { value: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body;
    await getDB().collection('settings').replaceOne(
      { _id: key },
      { _id: key, value },
      { upsert: true }
    );
    res.json({ key, value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
