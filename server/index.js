require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { connectDB } = require('./db');
const requireAuth   = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Public routes (no auth required) ─────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── Protected routes (JWT required) ──────────────────────────────────────────
app.use('/api/orders',        requireAuth, require('./routes/orders'));
app.use('/api/kaligadhs',     requireAuth, require('./routes/kaligadhs'));
app.use('/api/assignments',   requireAuth, require('./routes/assignments'));
app.use('/api/dealers',       requireAuth, require('./routes/dealers'));
app.use('/api/activity',      requireAuth, require('./routes/activity'));
app.use('/api/settings',      requireAuth, require('./routes/settings'));
app.use('/api/upload',        requireAuth, require('./routes/upload'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    require('./jobs/notificationScheduler').startScheduler();
  })
  .catch(err => { console.error('Failed to connect to MongoDB:', err); process.exit(1); });
