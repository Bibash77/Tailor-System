require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const { connectDB }  = require('./db');
const requireAuth    = require('./middleware/auth');

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
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

// ── Public routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Protected routes (JWT required) ──────────────────────────────────────────
app.use('/api/orders',            requireAuth, require('./routes/orders'));
app.use('/api/kaligadhs',         requireAuth, require('./routes/kaligadhs'));
app.use('/api/assignments',       requireAuth, require('./routes/assignments'));
app.use('/api/dealers',           requireAuth, require('./routes/dealers'));
app.use('/api/dealer-payments',   requireAuth, require('./routes/dealerPayments'));
app.use('/api/kaligadh-payments', requireAuth, require('./routes/kaligadhPayments'));
app.use('/api/salary-records',    requireAuth, require('./routes/salaryRecords'));
app.use('/api/salary-payments',   requireAuth, require('./routes/salaryPayments'));
app.use('/api/expenses',          requireAuth, require('./routes/expenses'));
app.use('/api/activity',          requireAuth, require('./routes/activity'));
app.use('/api/settings',          requireAuth, require('./routes/settings'));
app.use('/api/upload',            requireAuth, require('./routes/upload'));
app.use('/api/notifications',     requireAuth, require('./routes/notifications'));

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    require('./jobs/notificationScheduler').startScheduler();
  })
  .catch(err => { console.error('Failed to connect to MongoDB:', err); process.exit(1); });
