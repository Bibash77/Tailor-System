require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { connectDB } = require('../server/db');
const requireAuth   = require('../server/middleware/auth');

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
      await connectDB();
      isConnected = true;
    } catch (err) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }
  next();
});

app.use('/api/auth',          require('../server/routes/auth'));
app.use('/api/orders',        requireAuth, require('../server/routes/orders'));
app.use('/api/kaligadhs',     requireAuth, require('../server/routes/kaligadhs'));
app.use('/api/assignments',   requireAuth, require('../server/routes/assignments'));
app.use('/api/dealers',       requireAuth, require('../server/routes/dealers'));
app.use('/api/activity',      requireAuth, require('../server/routes/activity'));
app.use('/api/settings',      requireAuth, require('../server/routes/settings'));
app.use('/api/upload',        requireAuth, require('../server/routes/upload'));
app.use('/api/notifications', requireAuth, require('../server/routes/notifications'));

module.exports = app;
