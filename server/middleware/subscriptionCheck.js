const { getDB } = require('../db');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function resolveSubStatus(sub = {}) {
  const now = new Date();
  let s = sub.status || 'trial';
  if (s === 'trial'  && sub.trialEndsAt && now > new Date(sub.trialEndsAt))  s = 'expired';
  if (s === 'active' && sub.billedUntil && now > new Date(sub.billedUntil))  s = 'expired';
  return s;
}

module.exports = async function subscriptionCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  try {
    const db   = getDB();
    const user = await db.collection('users').findOne(
      { email: req.user.email },
      { projection: { status: 1, shopId: 1 } },
    );

    if (user?.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact admin.', suspended: true });
    }

    const shop = user?.shopId
      ? await db.collection('shops').findOne({ _id: user.shopId }, { projection: { subscription: 1 } })
      : null;

    if (resolveSubStatus(shop?.subscription) === 'expired') {
      return res.status(402).json({
        error: 'Your subscription has expired. Contact admin to renew.',
        subscriptionExpired: true,
      });
    }
    next();
  } catch {
    next();
  }
};
