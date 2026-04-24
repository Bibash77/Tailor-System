/**
 * Notification Scheduler
 * - Runs every 6 hours: computes notifications from DB data, inserts new ones, sends emails.
 * - Runs every 2 min: sends pending FCM push (if Firebase Admin configured).
 * - Runs daily at 03:00: prunes old read notifications.
 */

const cron = require('node-cron');
const { getDB } = require('../db');
const { sendNotificationEmail } = require('../services/mailer');

// ─── Firebase Admin (optional push) ──────────────────────────────────────────
let admin = null;

function initFirebaseAdmin() {
  try {
    admin = require('firebase-admin');
    if (admin.apps.length > 0) return;
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else {
      const sa = require('../firebase-service-account.json');
      credential = admin.credential.cert(sa);
    }
    admin.initializeApp({ credential });
    console.log('[Notifications] Firebase Admin ready — push enabled');
  } catch (err) {
    admin = null;
    if (err.code !== 'MODULE_NOT_FOUND' && !err.message?.includes('firebase-service-account')) {
      console.warn('[Notifications] Firebase Admin init failed:', err.message);
    } else {
      console.info('[Notifications] Push disabled (no service account) — in-app + email only');
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a, b) {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.round((db - da) / 86_400_000);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(n) {
  return 'Rs ' + Number(n).toLocaleString('en-IN');
}

// ─── Load notification settings from DB ───────────────────────────────────────

async function loadSettings(db) {
  try {
    const doc = await db.collection('settings').findOne({ _id: 'notificationSettings' });
    const defaults = {
      emailEnabled: true,
      notifyEmail:  '',
      delivery:     { enabled: true, daysBefore: 3 },
      payment:      { enabled: true, daysBefore: 3 },
      salary:       { enabled: true, daysBeforeMonthEnd: 5 },
      finance:      { enabled: true },
    };
    return doc?.value ? { ...defaults, ...doc.value } : defaults;
  } catch {
    return { emailEnabled: false, notifyEmail: '' };
  }
}

// ─── Compute notifications from live DB data ──────────────────────────────────

async function computeNotifications(db, settings) {
  const list   = [];
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const tod    = todayStr();
  const month  = currentMonth();
  const dayOfM = new Date().getDate();
  const daysInM = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  // ── 1. DELIVERY ────────────────────────────────────────────────────────────
  if (settings.delivery?.enabled !== false) {
    const daysBefore = settings.delivery?.daysBefore ?? 3;
    try {
      const orders = await db.collection('orders')
        .find({ status: { $nin: ['completed', 'delivered'] }, deliveryDate: { $exists: true, $ne: null } },
              { projection: { billPhoto: 0 } })
        .toArray();

      for (const o of orders) {
        const dLeft = daysBetween(today, new Date(o.deliveryDate));
        const name  = o.customerName || 'Customer';
        const bill  = o.billNo ? ` (#${o.billNo})` : '';
        const id    = o._id;

        if (dLeft === daysBefore) {
          list.push({
            dedupKey: `order_${id}_del_${daysBefore}d`,
            title: `Delivery in ${daysBefore} Day${daysBefore > 1 ? 's' : ''}`,
            message: `${name}${bill} — due ${new Date(o.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
            type: 'delivery', priority: 'medium', moduleRedirect: 'orders', entityId: String(id),
          });
        }
        if (dLeft === 1) {
          list.push({
            dedupKey: `order_${id}_del_1d`,
            title: 'Delivery Tomorrow',
            message: `${name}${bill} must be ready by tomorrow`,
            type: 'delivery', priority: 'high', moduleRedirect: 'orders', entityId: String(id),
          });
        }
        if (dLeft === 0) {
          list.push({
            dedupKey: `order_${id}_del_today`,
            title: 'Delivery Due Today',
            message: `${name}${bill} — hand over the order today`,
            type: 'delivery', priority: 'urgent', moduleRedirect: 'orders', entityId: String(id),
          });
        }
        if (dLeft < 0) {
          list.push({
            dedupKey: `order_${id}_del_overdue_${tod}`,
            title: 'Delivery Overdue',
            message: `${name}${bill} is ${Math.abs(dLeft)} day${Math.abs(dLeft) > 1 ? 's' : ''} late`,
            type: 'delivery', priority: 'urgent', moduleRedirect: 'orders', entityId: String(id),
          });
        }
      }
    } catch (e) { console.warn('[Notifications] Delivery compute error:', e.message); }
  }

  // ── 2. DEALER PAYMENTS ────────────────────────────────────────────────────
  if (settings.payment?.enabled !== false) {
    const daysBefore = settings.payment?.daysBefore ?? 3;
    try {
      const dealers = await db.collection('dealers')
        .find({ dueDate: { $exists: true, $ne: null } })
        .toArray();

      for (const d of dealers) {
        const remaining = d.remainingAmount || 0;
        if (remaining <= 0 || d.status === 'paid') continue;

        const dLeft     = daysBetween(today, new Date(d.dueDate));
        const isPremium = d.category === 'Premium';
        const amt       = fmt(remaining);
        const name      = d.dealerName || 'Dealer';
        const id        = d._id;

        if (d.createdAt) {
          const totalDays   = daysBetween(new Date(d.createdAt), new Date(d.dueDate));
          const elapsedDays = daysBetween(new Date(d.createdAt), today);
          const pct = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

          if (pct >= 50 && pct < 80 && dLeft > daysBefore) {
            list.push({
              dedupKey: `dealer_${id}_50pct`,
              title: 'Dealer Payment Reminder',
              message: `${amt} due to ${name} — halfway to deadline`,
              type: 'payment', priority: 'low', moduleRedirect: 'dealers', entityId: String(id),
            });
          }
          if (pct >= 80 && dLeft > daysBefore) {
            list.push({
              dedupKey: `dealer_${id}_80pct`,
              title: isPremium ? 'Premium Dealer: Payment Warning' : 'Dealer Payment Warning',
              message: `${amt} due to ${name} — deadline approaching`,
              type: 'payment', priority: isPremium ? 'high' : 'medium', moduleRedirect: 'dealers', entityId: String(id),
            });
          }
        }

        if (dLeft <= daysBefore && dLeft > 0) {
          list.push({
            dedupKey: `dealer_${id}_urgent_${daysBefore}d`,
            title: isPremium ? '⚠ Premium Dealer Payment Due' : 'Dealer Payment Due Soon',
            message: `${amt} to ${name} due in ${dLeft} day${dLeft > 1 ? 's' : ''}`,
            type: 'payment', priority: isPremium ? 'urgent' : 'high', moduleRedirect: 'dealers', entityId: String(id),
          });
        }
        if (dLeft === 0) {
          list.push({
            dedupKey: `dealer_${id}_due_today`,
            title: 'Dealer Payment Due Today',
            message: `Pay ${amt} to ${name} today`,
            type: 'payment', priority: 'urgent', moduleRedirect: 'dealers', entityId: String(id),
          });
        }
        if (dLeft < 0) {
          list.push({
            dedupKey: `dealer_${id}_overdue_${tod}`,
            title: isPremium ? 'Premium Dealer OVERDUE' : 'Dealer Payment Overdue',
            message: `${amt} to ${name} — ${Math.abs(dLeft)} day${Math.abs(dLeft) > 1 ? 's' : ''} overdue`,
            type: 'payment', priority: 'urgent', moduleRedirect: 'dealers', entityId: String(id),
          });
        }
      }
    } catch (e) { console.warn('[Notifications] Payment compute error:', e.message); }
  }

  // ── 3. SALARY (last N days of month) ──────────────────────────────────────
  const daysBeforeMonthEnd = settings.salary?.daysBeforeMonthEnd ?? 5;
  const isLastWeek = (daysInM - dayOfM) < daysBeforeMonthEnd;

  if (settings.salary?.enabled !== false && isLastWeek) {
    try {
      const workers     = await db.collection('kaligadhs').find({}).toArray();
      const allPayments = await db.collection('salaryPayments').find({}).toArray();
      const allAsgn     = await db.collection('assignments').find({ completedAt: { $exists: true, $ne: null } }).toArray();

      for (const w of workers) {
        const monthAsgn = allAsgn.filter(a => {
          if (a.kaligadhId !== String(w._id) && a.kaligadhId !== w._id) return false;
          const d  = new Date(a.completedAt);
          const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return mk === month;
        });

        const earned = monthAsgn.reduce((s, a) => s + (Number(a.makingCost) || 0), 0);
        if (earned <= 0) continue;

        const paid = allPayments
          .filter(p => (p.kaligadhId === String(w._id) || p.kaligadhId === w._id) &&
                       p.month === month && (p.type === 'payment' || p.type === 'recovery'))
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);

        const due = earned - paid;
        if (due <= 0) continue;

        list.push({
          dedupKey:       `salary_${w._id}_${month}`,
          title:          'Salary Payment Pending',
          message:        `${w.name}: ${fmt(due)} due for ${month}`,
          type:           'salary',
          priority:       'high',
          moduleRedirect: 'salary',
          entityId:       String(w._id),
        });
      }
    } catch (e) { console.warn('[Notifications] Salary compute error:', e.message); }
  }

  // ── 4. FINANCE (last N days of month) ─────────────────────────────────────
  if (settings.finance?.enabled !== false && isLastWeek) {
    try {
      const monthStart = new Date(month + '-01');
      const monthEnd   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const pendingExp = await db.collection('expenses')
        .find({ paymentStatus: 'pending', date: { $gte: monthStart.toISOString(), $lte: monthEnd.toISOString() } })
        .toArray();

      if (pendingExp.length > 0) {
        const total = pendingExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        list.push({
          dedupKey:       `finance_pending_expenses_${month}`,
          title:          'Unpaid Expenses This Month',
          message:        `${pendingExp.length} expense${pendingExp.length > 1 ? 's' : ''} — ${fmt(total)} still pending`,
          type:           'finance',
          priority:       'medium',
          moduleRedirect: 'expenses',
          entityId:       null,
        });
      }

      const pendingDlrs = await db.collection('dealers')
        .find({ status: { $ne: 'paid' }, remainingAmount: { $gt: 0 } })
        .toArray();

      if (pendingDlrs.length > 0) {
        const total = pendingDlrs.reduce((s, d) => s + (Number(d.remainingAmount) || 0), 0);
        list.push({
          dedupKey:       `finance_payables_${month}`,
          title:          'Month-End: Pending Payables',
          message:        `${fmt(total)} payable to ${pendingDlrs.length} dealer${pendingDlrs.length > 1 ? 's' : ''}`,
          type:           'finance',
          priority:       'medium',
          moduleRedirect: 'dealers',
          entityId:       null,
        });
      }
    } catch (e) { console.warn('[Notifications] Finance compute error:', e.message); }
  }

  return list;
}

// ─── Insert new notifications + send emails ───────────────────────────────────

async function runNotificationCheck() {
  try {
    const db       = getDB();
    const settings = await loadSettings(db);
    const list     = await computeNotifications(db, settings);

    const canEmail = settings.emailEnabled && settings.notifyEmail;
    let inserted = 0, emailed = 0;

    // Fetch shop name once for use in email sender field
    let shopName = 'Tailor Manager';
    try {
      const user = await db.collection('users').findOne({});
      if (user?.shopName) shopName = user.shopName;
    } catch {}

    for (const n of list) {
      if (!n.dedupKey) continue;

      const existing = await db.collection('notifications').findOne({ dedupKey: n.dedupKey });
      if (existing) {
        // Send email for high/urgent existing items that haven't been emailed yet
        if (canEmail && !existing.sentEmail && (existing.priority === 'high' || existing.priority === 'urgent')) {
          const sent = await sendNotificationEmail({ to: settings.notifyEmail, ...existing, shopName });
          if (sent) {
            await db.collection('notifications').updateOne(
              { _id: existing._id },
              { $set: { sentEmail: true, sentEmailAt: new Date() } }
            );
            emailed++;
          }
        }
        continue;
      }

      // New notification
      const doc = {
        userId:         'single_user',
        dedupKey:       n.dedupKey,
        title:          n.title   || '',
        message:        n.message || '',
        type:           n.type    || 'general',
        priority:       n.priority || 'medium',
        moduleRedirect: n.moduleRedirect || 'dashboard',
        entityId:       n.entityId || null,
        read:           false,
        sentPush:       false,
        sentEmail:      false,
        createdAt:      new Date(),
      };
      await db.collection('notifications').insertOne(doc);
      inserted++;

      // Email for high/urgent
      if (canEmail && (n.priority === 'high' || n.priority === 'urgent')) {
        const sent = await sendNotificationEmail({ to: settings.notifyEmail, title: n.title, message: n.message, type: n.type, shopName });
        if (sent) {
          await db.collection('notifications').updateOne(
            { dedupKey: n.dedupKey },
            { $set: { sentEmail: true, sentEmailAt: new Date() } }
          );
          emailed++;
        }
      }
    }

    if (inserted > 0 || emailed > 0) {
      console.info(`[Notifications] Check done — ${inserted} new, ${emailed} emailed`);
    }
  } catch (err) {
    console.error('[Notifications] Check error:', err.message);
  }
}

// ─── FCM push for pending notifications ──────────────────────────────────────

async function sendPendingPushes() {
  if (!admin) return; // push disabled — logged at startup

  try {
    const db   = getDB();
    const user = await db.collection('users').findOne({});
    if (!user?.fcmToken) return;

    const pending = await db.collection('notifications')
      .find({ userId: 'single_user', sentPush: false, read: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    if (pending.length === 0) return;

    const URGENCY = { urgent: 'high', high: 'high', medium: 'normal', low: 'low' };

    for (const n of pending) {
      try {
        await admin.messaging().send({
          token:        user.fcmToken,
          notification: { title: n.title, body: n.message },
          data: {
            type:           n.type           || '',
            moduleRedirect: n.moduleRedirect || 'dashboard',
            dedupKey:       n.dedupKey       || '',
            notificationId: n._id.toString(),
          },
          webpush: {
            headers:      { Urgency: URGENCY[n.priority] || 'normal' },
            notification: {
              title: n.title, body: n.message,
              icon: '/favicon.ico', badge: '/favicon.ico',
              tag: n.dedupKey || n._id.toString(), renotify: true,
            },
            fcmOptions: { link: '/' },
          },
        });
        await db.collection('notifications').updateOne(
          { _id: n._id },
          { $set: { sentPush: true, sentPushAt: new Date() } }
        );
      } catch (err) {
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
          await db.collection('users').updateOne({ _id: user._id }, { $unset: { fcmToken: '' } });
          console.warn('[Notifications] FCM token expired — cleared');
          return;
        }
        console.error('[Notifications] FCM send error:', err.message);
      }
    }
    console.info(`[Notifications] Pushed ${pending.length} notification(s)`);
  } catch (err) {
    console.error('[Notifications] Push scheduler error:', err.message);
  }
}

// ─── Prune old read notifications ────────────────────────────────────────────

async function pruneOldNotifications() {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const r = await getDB().collection('notifications').deleteMany({
      userId: 'single_user', read: true, createdAt: { $lt: cutoff },
    });
    if (r.deletedCount > 0) {
      console.info(`[Notifications] Pruned ${r.deletedCount} old notification(s)`);
    }
  } catch (err) {
    console.error('[Notifications] Prune error:', err.message);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

function startScheduler() {
  initFirebaseAdmin();

  // Notification check + email: every 6 hours
  cron.schedule('0 */6 * * *', runNotificationCheck);

  // FCM push: every 2 minutes (only if admin configured)
  cron.schedule('*/2 * * * *', sendPendingPushes);

  // Prune old: daily at 03:00
  cron.schedule('0 3 * * *', pruneOldNotifications);

  // Run once on startup after 30s (DB might not be ready immediately)
  setTimeout(runNotificationCheck, 30_000);

  console.log('[Notifications] Scheduler started');
}

module.exports = { startScheduler, runNotificationCheck };
