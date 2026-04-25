const { getDB } = require('../db');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function resolveStatus(sub = {}) {
  const now = new Date();
  let status = sub.status || 'trial';
  if (status === 'trial'  && sub.trialEndsAt && now > new Date(sub.trialEndsAt))  status = 'expired';
  if (status === 'active' && sub.billedUntil && now > new Date(sub.billedUntil))  status = 'expired';
  return status;
}

module.exports = async function subscriptionCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  try {
    const user   = await getDB().collection('users').findOne({ email: req.user.email }, { projection: { subscription: 1 } });
    const status = resolveStatus(user?.subscription);
    if (status === 'expired') {
      return res.status(402).json({
        error: 'Your subscription has expired. Please contact the admin to renew.',
        subscriptionExpired: true,
      });
    }
    next();
  } catch {
    next();
  }
};
