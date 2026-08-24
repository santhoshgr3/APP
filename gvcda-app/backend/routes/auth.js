const express = require("express");
const crypto = require("crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const router = express.Router();
const { db } = require("../db");
const { signToken } = require("../middleware/auth");
const { sendOtpSms } = require("../lib/sms");

// In-memory OTP store. Fine for a single backend instance; move to Redis (with the
// same TTL semantics) if you ever run more than one instance behind a load balancer.
const otpStore = new Map(); // phone -> { otp, expiresAt, attempts }
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 3;

function generateOtp() {
  // Fixed demo OTP only when no real SMS provider is configured — see lib/sms.js.
  const hasProvider = !!(process.env.MSG91_AUTH_KEY || process.env.TWILIO_ACCOUNT_SID);
  if (!hasProvider) return "123456";
  return String(crypto.randomInt(100000, 1000000));
}

// Throttle OTP requests hard — this endpoint is unauthenticated and sends a real
// SMS (money) once a provider is configured, so it's the obvious abuse target.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator normalizes IPv6 addresses to their /64 prefix — without it, an
  // IPv6 client could bypass this limiter by cycling through addresses in their
  // own subnet, since every address in it would otherwise count as "different".
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.body?.phone || ""}`,
  message: { error: "Too many OTP requests. Try again in a few minutes." },
});

// POST /auth/request-otp { phone }
router.post("/request-otp", otpRequestLimiter, async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ error: "Valid 10-digit phone number required" });

  const otp = generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });

  try {
    const { devOtpVisible } = await sendOtpSms(phone, otp);
    res.json({ ok: true, ...(devOtpVisible ? { dev_otp: otp } : {}) });
  } catch (e) {
    otpStore.delete(phone);
    res.status(502).json({ error: "Couldn't send OTP right now. Please try again." });
  }
});

// POST /auth/verify-otp { phone, otp, full_name? }
// Logs in if the phone exists; otherwise creates a new "member" account (self-signup).
router.post("/verify-otp", (req, res) => {
  const { phone, otp, full_name } = req.body;
  const record = otpStore.get(phone);

  if (!record) return res.status(401).json({ error: "Request a new OTP first" });
  if (Date.now() > record.expiresAt) { otpStore.delete(phone); return res.status(401).json({ error: "OTP expired — request a new one" }); }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) { otpStore.delete(phone); return res.status(429).json({ error: "Too many wrong attempts — request a new OTP" }); }
  if (record.otp !== otp) {
    record.attempts += 1;
    return res.status(401).json({ error: `Invalid OTP (${MAX_VERIFY_ATTEMPTS - record.attempts} attempts left)` });
  }
  otpStore.delete(phone);

  let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
  let isNewUser = false;
  if (!user) {
    const result = db.prepare(
      "INSERT INTO users (phone, full_name, role) VALUES (?, ?, 'member')"
    ).run(phone, full_name || "New Member");
    user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(result.lastInsertRowid);
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'member')").run(user.user_id);
    isNewUser = true;
  }

  if (!user.is_active) return res.status(403).json({ error: "Account deactivated. Contact admin." });

  const token = signToken(user);
  const roles = db.prepare("SELECT role FROM user_roles WHERE user_id = ?").all(user.user_id).map((r) => r.role);
  res.json({ token, user, is_new_user: isNewUser, roles: roles.length ? roles : [user.role] });
});

// GET /auth/me
router.get("/me", require("../middleware/auth").requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.auth.user_id);
  const roles = db.prepare("SELECT role FROM user_roles WHERE user_id = ?").all(req.auth.user_id).map((r) => r.role);
  res.json({ user, roles: roles.length ? roles : [user.role] });
});

// POST /auth/switch-role { role } — dual-role accounts only; issues a fresh token with a
// different active role (e.g. a Member who is also an approved Retailer).
router.post("/switch-role", require("../middleware/auth").requireAuth, (req, res) => {
  const { role } = req.body;
  const held = db.prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?").get(req.auth.user_id, role);
  if (!held) return res.status(403).json({ error: "This account does not hold that role" });

  db.prepare("UPDATE users SET role = ? WHERE user_id = ?").run(role, req.auth.user_id);
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.auth.user_id);
  const token = signToken(user);
  res.json({ token, user });
});

module.exports = router;
