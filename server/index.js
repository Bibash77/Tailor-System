require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const { connectDB }  = require('./db');
const requireAuth    = require('./middleware/auth');
const subCheck       = require('./middleware/subscriptionCheck');

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5001',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.startsWith('http://localhost')) return cb(null, true);
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));

const adminGuard = require('./middleware/adminAuth');
const { router: adminAuthRouter, seedAdmin } = require('./routes/adminAuth');

// ── Public routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/scan',       requireAuth, require('./routes/scan'));
app.use('/api/scan-queue', requireAuth, require('./routes/scanQueue'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Admin routes ──────────────────────────────────────────────────────────────
app.use('/api/admin', adminGuard, require('./routes/admin'));

// ── Protected routes (JWT + subscription check) ───────────────────────────────
app.use('/api/orders',            requireAuth, subCheck, require('./routes/orders'));
app.use('/api/kaligadhs',         requireAuth, subCheck, require('./routes/kaligadhs'));
app.use('/api/assignments',       requireAuth, subCheck, require('./routes/assignments'));
app.use('/api/dealers',           requireAuth, subCheck, require('./routes/dealers'));
app.use('/api/dealer-payments',   requireAuth, subCheck, require('./routes/dealerPayments'));
app.use('/api/kaligadh-payments', requireAuth, subCheck, require('./routes/kaligadhPayments'));
app.use('/api/salary-records',    requireAuth, subCheck, require('./routes/salaryRecords'));
app.use('/api/salary-payments',   requireAuth, subCheck, require('./routes/salaryPayments'));
app.use('/api/expenses',          requireAuth, subCheck, require('./routes/expenses'));
app.use('/api/activity',          requireAuth, require('./routes/activity'));
app.use('/api/settings',          requireAuth, subCheck, require('./routes/settings'));
app.use('/api/upload',            requireAuth, subCheck, require('./routes/upload'));
app.use('/api/notifications',     requireAuth, require('./routes/notifications'));

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async db => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    require('./jobs/notificationScheduler').startScheduler();
    require('./services/scanTracker').init(db);
    await seedAdmin(db);
  })
  .catch(err => { console.error('Failed to connect to MongoDB:', err); process.exit(1); });
