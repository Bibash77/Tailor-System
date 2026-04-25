require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { connectDB } = require('../server/db');
const requireAuth   = require('../server/middleware/auth');
const subCheck      = require('../server/middleware/subscriptionCheck');

const app = express();

let isConnected = false;

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));

// Health check — no DB needed
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(async (req, res, next) => {
  if (!isConnected) {
    try {
      const db = await connectDB();
      isConnected = true;
      require('../server/services/scanTracker').init(db);
      await seedAdmin(db);
    } catch (err) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }
  next();
});

const adminGuard = require('../server/middleware/adminAuth');
const { router: adminAuthRouter, seedAdmin } = require('../server/routes/adminAuth');

app.use('/api/auth',              require('../server/routes/auth'));
app.use('/api/admin/auth',        adminAuthRouter);
app.use('/api/admin',             adminGuard, require('../server/routes/admin'));
app.use('/api/scan',              requireAuth, require('../server/routes/scan'));
app.use('/api/scan-queue',        requireAuth, require('../server/routes/scanQueue'));
app.use('/api/orders',            requireAuth, subCheck, require('../server/routes/orders'));
app.use('/api/kaligadhs',         requireAuth, subCheck, require('../server/routes/kaligadhs'));
app.use('/api/assignments',       requireAuth, subCheck, require('../server/routes/assignments'));
app.use('/api/dealers',           requireAuth, subCheck, require('../server/routes/dealers'));
app.use('/api/dealer-payments',   requireAuth, subCheck, require('../server/routes/dealerPayments'));
app.use('/api/kaligadh-payments', requireAuth, subCheck, require('../server/routes/kaligadhPayments'));
app.use('/api/salary-records',    requireAuth, subCheck, require('../server/routes/salaryRecords'));
app.use('/api/salary-payments',   requireAuth, subCheck, require('../server/routes/salaryPayments'));
app.use('/api/expenses',          requireAuth, subCheck, require('../server/routes/expenses'));
app.use('/api/activity',          requireAuth, require('../server/routes/activity'));
app.use('/api/settings',          requireAuth, subCheck, require('../server/routes/settings'));
app.use('/api/upload',            requireAuth, subCheck, require('../server/routes/upload'));
app.use('/api/notifications',     requireAuth, require('../server/routes/notifications'));

module.exports = app;
