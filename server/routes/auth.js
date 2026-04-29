require('dotenv').config();
const router     = require('express').Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const { getDB }  = require('../db');

const SESSION_DAYS  = 25;
const RESET_MINUTES = 30;
const JWT_SECRET    = process.env.JWT_SECRET;
const APP_URL       = process.env.APP_URL || 'http://localhost:3000';

// ─── SMTP TRANSPORTER (Brevo) ────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host:   'smtp-relay.brevo.com',
  port:   587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Inline guard for protected auth sub-routes
function guard(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
}

const TRIAL_DAYS    = 30;
const DEFAULT_FEE   = 500; // Rs per month

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, shopName: user.shopName },
    JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` },
  );
}

function resolveSubStatus(sub = {}) {
  const now = new Date();
  let status = sub.status || 'trial';
  if (status === 'trial'  && sub.trialEndsAt  && now > new Date(sub.trialEndsAt))  status = 'expired';
  if (status === 'active' && sub.billedUntil  && now > new Date(sub.billedUntil))  status = 'expired';
  return status;
}

async function publicUser(u, db) {
  const shop   = u.shopId ? await db.collection('shops').findOne({ _id: u.shopId }) : null;
  const sub    = shop?.subscription || {};
  const status = resolveSubStatus(sub);
  return {
    email:    u.email,
    shopName: u.shopName,
    status:   u.status || 'active',
    subscription: {
      status,
      trialEndsAt: sub.trialEndsAt || null,
      billedUntil: sub.billedUntil || null,
      monthlyFee:  sub.monthlyFee  ?? DEFAULT_FEE,
    },
  };
}

// ─── GET /api/auth/status ─────────────────────────────────────────────────────
router.get('/status', (req, res) => res.json({ hasUser: true }));

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const db = getDB();
    const { email, shopName, password } = req.body;
    if (!email || !shopName || !password)
      return res.status(400).json({ error: 'Email, shop name, and password are all required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await db.collection('users').findOne({ email: email.trim().toLowerCase() });
    if (existing)
      return res.status(400).json({ error: 'An account with this email already exists.' });

    // Get admin defaults for quota
    let defaults = { freeScanLimit: 20, monthlyCharge: 500 };
    try {
      const d = await db.collection('settings').findOne({ _id: 'adminDefaults' });
      if (d) defaults = { ...defaults, ...d };
    } catch {}

    // Create shop (subscription + quota live on the shop, shared by all its users)
    const shopId      = crypto.randomUUID();
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
    await db.collection('shops').insertOne({
      _id:       shopId,
      name:      shopName.trim(),
      createdAt: new Date(),
      scanQuota: {
        freeScanLimit: defaults.freeScanLimit,
        used:          0,
        paidPlanLimit: 0,
        monthlyCharge: defaults.monthlyCharge,
        billingStatus: 'active',
        renewDate:     null,
        month:         '',
      },
      subscription: {
        status:      'trial',
        trialEndsAt,
        billedUntil: null,
        monthlyFee:  defaults.monthlyCharge,
        payments:    [],
      },
    });

    const passwordHash = await bcrypt.hash(password, 12);
    const doc = {
      email:       email.trim().toLowerCase(),
      shopName:    shopName.trim(),
      passwordHash,
      createdAt:   new Date(),
      resetToken:  null,
      resetExpiry: null,
      shopId,
      role:        'shop_admin',
      status:      'active',
    };

    const result = await db.collection('users').insertOne(doc);
    doc._id = result.insertedId;
    res.status(201).json({ token: signToken(doc), user: await publicUser(doc, db) });
  } catch (err) {
    console.error('Register:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Public.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await getDB().collection('users').findOne({
      email: email.trim().toLowerCase(),
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const db = getDB();
    res.json({ token: signToken(user), user: await publicUser(user, db) });
  } catch (err) {
    console.error('Login:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', guard, async (req, res) => {
  try {
    const db   = getDB();
    const user = await db.collection('users').findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: await publicUser(user, db) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/auth/profile ──────────────────────────────────────────────────
// Protected. Update shop name.
router.patch('/profile', guard, async (req, res) => {
  try {
    const shopName = req.body.shopName?.trim();
    if (!shopName) return res.status(400).json({ error: 'Shop name is required.' });

    await getDB().collection('users').updateOne(
      { email: req.user.email },
      { $set: { shopName } },
    );

    res.json({ user: { email: req.user.email, shopName } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/auth/password ─────────────────────────────────────────────────
// Protected. Change password (requires current password).
router.patch('/password', guard, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await getDB().collection('users').findOne({ email: req.user.email });
    const ok   = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await getDB().collection('users').updateOne(
      { email: req.user.email },
      { $set: { passwordHash } },
    );

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/auth/email ────────────────────────────────────────────────────
// Protected. Change email (requires current password). Returns a fresh token.
router.patch('/email', guard, async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: 'New email and current password are required.' });
    }

    const email = newEmail.trim().toLowerCase();
    const user  = await getDB().collection('users').findOne({ email: req.user.email });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    await getDB().collection('users').updateOne(
      { _id: user._id },
      { $set: { email } },
    );

    const updatedUser = { ...user, email };
    res.json({ token: signToken(updatedUser), user: await publicUser(updatedUser, getDB()) });
  } catch (err) {
    console.error('Change email:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/auth/forgot ────────────────────────────────────────────────────
// Public. Sends a password-reset email.
router.post('/forgot', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await getDB().collection('users').findOne({ email });

    // Always respond the same way to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + RESET_MINUTES * 60_000);

    await getDB().collection('users').updateOne(
      { email },
      { $set: { resetToken: token, resetExpiry: expiry } },
    );

    const resetURL = `${APP_URL}/?resetToken=${token}`;

    await mailer.sendMail({
      from:    `"Tailor Manager" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to:      user.email,
      subject: 'Password Reset — Tailor Manager',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:40px 24px;background:#fff">
          <div style="margin-bottom:28px">
            <h1 style="font-family:Georgia,serif;font-size:26px;color:#1C1917;margin:0 0 4px">Tailor Manager</h1>
            <p style="color:#A8A29E;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:0">Business Suite</p>
          </div>
          <h2 style="font-size:20px;color:#1C1917;margin:0 0 12px;font-weight:700">Reset Your Password</h2>
          <p style="color:#78716C;font-size:14px;line-height:1.7;margin:0 0 28px">
            You (or someone) requested a password reset for your Tailor Manager account.
            Click the button below to set a new password.
            This link is valid for <strong>${RESET_MINUTES} minutes</strong>.
          </p>
          <a href="${resetURL}"
             style="display:inline-block;background:#1C1917;color:#fff;padding:14px 28px;border-radius:8px;
                    text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em">
            Reset Password →
          </a>
          <p style="color:#A8A29E;font-size:12px;margin-top:28px;line-height:1.6">
            If you didn't request this, you can safely ignore this email.
            Your password will not change.
          </p>
          <hr style="border:none;border-top:1px solid #E7E5E4;margin:28px 0">
          <p style="color:#A8A29E;font-size:11px;margin:0">
            Shop: <strong>${user.shopName}</strong> · ${user.email}
          </p>
        </div>
      `,
    });

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password:', err);
    res.status(500).json({ error: 'Failed to send reset email. Check your internet connection.' });
  }
});

// ─── POST /api/auth/reset ─────────────────────────────────────────────────────
// Public. Resets password using the token from the email link.
router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = await getDB().collection('users').findOne({ resetToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or already used reset link.' });
    }
    if (new Date() > new Date(user.resetExpiry)) {
      return res.status(400).json({ error: `Reset link has expired (valid for ${RESET_MINUTES} minutes). Please request a new one.` });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await getDB().collection('users').updateOne(
      { _id: user._id },
      { $set: { passwordHash, resetToken: null, resetExpiry: null } },
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
