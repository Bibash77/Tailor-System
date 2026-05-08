const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /api/upload — accepts base64 data URL, returns Cloudinary URL
router.post('/', async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || cloudName === 'REPLACE_WITH_YOUR_CLOUD_NAME') {
    // Cloudinary not configured — return the base64 as-is so the app still works
    return res.json({ url: req.body.data });
  }

  try {
    const result = await cloudinary.uploader.upload(req.body.data, {
      folder: 'tailor-app/bills',
      resource_type: 'image',
    });
    res.json({ url: result.secure_url });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
});

module.exports = router;
