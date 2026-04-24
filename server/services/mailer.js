const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transporter;
}

const TYPE_COLOR = {
  delivery: '#2563EB',
  payment:  '#D97706',
  salary:   '#7C3AED',
  finance:  '#059669',
};

function buildHTML({ title, message, type, shopName }) {
  const color = TYPE_COLOR[type] || '#1C1917';
  const shop  = shopName || 'Tailor Manager';
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F4;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10)">
    <div style="background:${color};padding:22px 28px">
      <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">${shop}</div>
      <div style="color:white;font-size:19px;font-weight:700;line-height:1.3">${title}</div>
      <div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:4px;text-transform:uppercase;letter-spacing:.08em">${type} alert</div>
    </div>
    <div style="background:white;padding:24px 28px">
      <p style="margin:0 0 20px;font-size:15px;color:#1C1917;line-height:1.65">${message}</p>
      <p style="margin:0;font-size:12px;color:#A8A29E">Open your Tailor Manager app to take action.</p>
    </div>
    <div style="background:#FAFAF9;padding:14px 28px;font-size:11px;color:#A8A29E;border-top:1px solid #E7E5E4">
      ${shop} · Automated notification · You can disable these in Settings → Notifications
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a notification email.
 * @param {object} opts
 * @param {string} opts.to         - recipient address
 * @param {string} opts.title      - notification title
 * @param {string} opts.message    - notification body
 * @param {string} opts.type       - delivery | payment | salary | finance
 * @param {string} [opts.shopName] - shown as sender label in email body
 * Returns true on success, false if SMTP not configured or send fails.
 */
async function sendNotificationEmail({ to, title, message, type, shopName }) {
  const t = getTransporter();
  if (!t || !to) return false;

  const shop      = shopName || 'Tailor Manager';
  const fromAddr  = process.env.SMTP_FROM || process.env.SMTP_USER;
  const fromField = `${shop} <${fromAddr}>`;

  try {
    await t.sendMail({
      from:    fromField,
      to,
      subject: `[${shop}] ${title}`,
      html:    buildHTML({ title, message, type, shopName: shop }),
    });
    return true;
  } catch (err) {
    console.warn('[Email] Send failed:', err.message);
    return false;
  }
}

/**
 * Send a test email to verify SMTP config.
 */
async function sendTestEmail(to, shopName) {
  return sendNotificationEmail({
    to,
    title:    'Test Notification',
    message:  'Your email notifications are working correctly. You will receive alerts here for deliveries, payments, and salary reminders.',
    type:     'finance',
    shopName,
  });
}

module.exports = { sendNotificationEmail, sendTestEmail };
