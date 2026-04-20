require('dotenv').config();
const { connectDB } = require('../../server/db');
const { sendPendingPushes } = require('../../server/jobs/notificationScheduler');

let isConnected = false;

module.exports = async (req, res) => {
  // Vercel Cron calls this with a special header
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }

  await sendPendingPushes();
  res.json({ ok: true });
};
