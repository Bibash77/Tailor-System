/**
 * Notification Scheduler
 * Runs every 15 minutes to send pending push notifications via FCM.
 * Falls back to in-app-only mode if Firebase Admin is not configured.
 *
 * To enable push: add server/firebase-service-account.json
 * (Firebase Console → Project Settings → Service Accounts → Generate private key)
 */

const cron = require('node-cron');
const path = require('path');
const { getDB } = require('../db');

// ─── Firebase Admin (optional) ────────────────────────────────────────────────
let admin = null;

function initFirebaseAdmin() {
  try {
    admin = require('firebase-admin');
    if (admin.apps.length > 0) return; // already initialized

    let credential;
    const saPath = path.join(__dirname, '..', 'firebase-service-account.json');

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Prefer env var (JSON string) for production deployments
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else {
      // Fall back to local JSON file
      const sa = require(saPath); // throws if file missing
      credential = admin.credential.cert(sa);
    }

    admin.initializeApp({ credential });
    console.log('[Notifications] Firebase Admin initialized — push notifications enabled');
  } catch (err) {
    admin = null;
    if (err.code !== 'MODULE_NOT_FOUND') {
      console.warn('[Notifications] Firebase Admin init failed:', err.message);
    } else {
      console.info('[Notifications] firebase-service-account.json not found — push disabled (in-app only)');
    }
  }
}

// ─── Send pending push notifications ─────────────────────────────────────────
async function sendPendingPushes() {
  if (!admin) return;

  try {
    const db  = getDB();
    const user = await db.collection('users').findOne({});
    if (!user?.fcmToken) return; // no device registered yet

    // Find notifications not yet pushed (limit 10 per cycle to avoid flooding)
    const pending = await db.collection('notifications')
      .find({ userId: 'single_user', sentPush: false, read: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    if (pending.length === 0) return;

    const PRIORITY_MAP = { urgent: 'high', high: 'high', medium: 'normal', low: 'low' };

    for (const n of pending) {
      try {
        await admin.messaging().send({
          token: user.fcmToken,
          notification: { title: n.title, body: n.message },
          data: {
            type:           n.type           || '',
            moduleRedirect: n.moduleRedirect || 'dashboard',
            dedupKey:       n.dedupKey       || '',
            notificationId: n._id.toString(),
          },
          webpush: {
            headers:    { Urgency: PRIORITY_MAP[n.priority] || 'normal' },
            notification: {
              title: n.title,
              body:  n.message,
              icon:  '/logo192.png',
              badge: '/logo192.png',
              tag:   n.dedupKey || n._id.toString(),
              renotify: true,
            },
            fcmOptions: { link: '/' },
          },
        });

        await db.collection('notifications').updateOne(
          { _id: n._id },
          { $set: { sentPush: true, sentPushAt: new Date() } },
        );
      } catch (err) {
        // Token might be invalid/rotated — mark as sent to avoid retry loop
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
          await db.collection('users').updateOne(
            { _id: user._id },
            { $unset: { fcmToken: '' } },
          );
          console.warn('[Notifications] FCM token expired — cleared from DB');
          return;
        }
        console.error('[Notifications] FCM send error:', err.message);
      }
    }

    if (pending.length > 0) {
      console.info(`[Notifications] Sent ${pending.length} push notification(s)`);
    }
  } catch (err) {
    console.error('[Notifications] Scheduler error:', err.message);
  }
}

// ─── Prune old read notifications (runs daily at 03:00) ──────────────────────
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

// ─── Start scheduler ──────────────────────────────────────────────────────────
function startScheduler() {
  initFirebaseAdmin();

  // Send pending pushes every 15 minutes
  cron.schedule('*/15 * * * *', sendPendingPushes);

  // Prune old read notifications every day at 3 AM
  cron.schedule('0 3 * * *', pruneOldNotifications);

  console.log('[Notifications] Scheduler started (push check: every 15 min)');
}

module.exports = { startScheduler, sendPendingPushes };
