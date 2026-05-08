const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDB } = require('../db');

const ADMIN_SECRET = () => process.env.JWT_SECRET + '_admin';

// Called once on server startup — creates admin from env vars if absent
async function seedAdmin(db) {
  const email = (process.env.ADMIN_EMAIL || 'admin@tailormanager.com').toLowerCase();
  const pass  =  process.env.ADMIN_PASS  || 'TailorAdmin2025!';
  const exists = await db.collection('admins').findOne({ email });
  if (!exists) {
    const hash = await bcrypt.hash(pass, 12);
    await db.collection('admins').insertOne({ email, passwordHash: hash, createdAt: new Date() });
    console.log(`[Admin] Seeded admin account: ${email}`);
  }
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const admin = await getDB().collection('admins').findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { role: 'admin', email: admin.email },
      ADMIN_SECRET(),
      { expiresIn: '7d' },
    );
    res.json({ token, admin: { email: admin.email } });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/change-password
router.post('/change-password', require('../middleware/adminAuth'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Min 6 characters' });
    const admin = await getDB().collection('admins').findOne({ email: req.admin.email });
    const ok    = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    await getDB().collection('admins').updateOne(
      { email: req.admin.email },
      { $set: { passwordHash: await bcrypt.hash(newPassword, 12) } },
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, seedAdmin };
