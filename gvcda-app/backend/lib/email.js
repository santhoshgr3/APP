// Transactional email via any SMTP provider (Gmail app password, Brevo, SES SMTP,
// Zoho...). Configure SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM in
// the backend environment. When SMTP isn't configured, sending is a silent no-op so
// the app works identically without it — same best-effort pattern as lib/push.js.
const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
const enabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = enabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

async function sendEmail(to, subject, text) {
  if (!enabled || !to) return;
  try {
    await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text });
  } catch (e) {
    console.error("Email send failed:", e.message);
  }
}

module.exports = { sendEmail, emailEnabled: enabled };
