const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const router = express.Router();
const { get, all, run } = require("../db");
const { signToken, requireAuth } = require("../middleware/auth");
const { generateUniqueReferralCode, ensureReferralCode } = require("../lib/referrals");

const PHONE_RE = /^\d{10}$/;

// Throttle login attempts hard — this endpoint is unauthenticated and the
// obvious target for password-guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator normalizes IPv6 addresses to their /64 prefix — without it, an
  // IPv6 client could bypass this limiter by cycling through addresses in their
  // own subnet, since every address in it would otherwise count as "different".
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.body?.phone || ""}`,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: "Too many accounts created from this network. Try again later." },
});

// POST /auth/register { phone, password, full_name, referral_code? }
// Self-signup — always creates a "member" account (Employee/Retailer-only accounts
// are created by an Admin via /admin/users, Retailer role is added later via
// /retailer/register on top of an existing member login).
router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { phone, password, full_name, referral_code } = req.body;
    if (!phone || !PHONE_RE.test(phone)) return res.status(400).json({ error: "Valid 10-digit phone number required" });
    if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await get("SELECT 1 FROM users WHERE phone = ?", [phone]);
    if (existing) return res.status(409).json({ error: "An account with this phone number already exists — log in instead" });

    let referredBy = null;
    if (referral_code && referral_code.trim()) {
      const referrer = await get("SELECT user_id FROM users WHERE referral_code = ?", [referral_code.trim().toUpperCase()]);
      if (!referrer) return res.status(400).json({ error: "Referral code not found" });
      referredBy = referrer.user_id;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const myReferralCode = await generateUniqueReferralCode();
    const result = await run(
      "INSERT INTO users (phone, password_hash, full_name, role, referred_by, referral_code) VALUES (?, ?, ?, 'member', ?, ?) RETURNING user_id",
      [phone, password_hash, full_name || "New Member", referredBy, myReferralCode]
    );
    const user = await get("SELECT * FROM users WHERE user_id = ?", [result.lastInsertRowid]);
    await run("INSERT INTO user_roles (user_id, role) VALUES (?, 'member') ON CONFLICT DO NOTHING", [user.user_id]);

    const token = signToken(user);
    res.json({ token, user, is_new_user: true, roles: ["member"] });
  } catch (e) { next(e); }
});

// POST /auth/login { phone, password }
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !PHONE_RE.test(phone)) return res.status(400).json({ error: "Valid 10-digit phone number required" });
    if (!password) return res.status(400).json({ error: "Password required" });

    const user = await get("SELECT * FROM users WHERE phone = ?", [phone]);
    // Compare against a dummy hash when the user doesn't exist so the response
    // time doesn't reveal whether the phone number is registered.
    const hash = user?.password_hash || "$2a$10$CwTycUXWue0Thq9StjUM0uJ8OyLYVUR2zHzB6q9dGCF3XLevZ6bDW";
    const valid = await bcrypt.compare(password, hash);
    if (!user || !valid) return res.status(401).json({ error: "Invalid phone number or password" });
    if (!user.is_active) return res.status(403).json({ error: "Account deactivated. Contact admin." });

    const token = signToken(user);
    const roles = (await all("SELECT role FROM user_roles WHERE user_id = ?", [user.user_id])).map((r) => r.role);
    res.json({ token, user, is_new_user: false, roles: roles.length ? roles : [user.role] });
  } catch (e) { next(e); }
});

// GET /auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    let user = await get("SELECT * FROM users WHERE user_id = ?", [req.auth.user_id]);
    // Accounts created before the referral feature existed don't have a code yet.
    if (!user.referral_code) {
      await ensureReferralCode(user.user_id);
      user = await get("SELECT * FROM users WHERE user_id = ?", [req.auth.user_id]);
    }
    const roles = (await all("SELECT role FROM user_roles WHERE user_id = ?", [req.auth.user_id])).map((r) => r.role);
    res.json({ user, roles: roles.length ? roles : [user.role] });
  } catch (e) { next(e); }
});

// POST /auth/push-token { token } — registers this device for Expo push notifications.
router.post("/push-token", requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });
    await run("UPDATE users SET push_token = ? WHERE user_id = ?", [token, req.auth.user_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /auth/language { language: 'en' | 'te' }
router.patch("/language", requireAuth, async (req, res, next) => {
  try {
    const { language } = req.body;
    if (!["en", "te"].includes(language)) return res.status(400).json({ error: "Invalid language" });
    await run("UPDATE users SET language = ? WHERE user_id = ?", [language, req.auth.user_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /auth/switch-role { role } — dual-role accounts only; issues a fresh token with a
// different active role (e.g. a Member who is also an approved Retailer).
router.post("/switch-role", requireAuth, async (req, res, next) => {
  try {
    const { role } = req.body;
    const held = await get("SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?", [req.auth.user_id, role]);
    if (!held) return res.status(403).json({ error: "This account does not hold that role" });

    await run("UPDATE users SET role = ? WHERE user_id = ?", [role, req.auth.user_id]);
    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.auth.user_id]);
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) { next(e); }
});

// POST /auth/change-password { current_password, new_password }
router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.auth.user_id]);
    const valid = await bcrypt.compare(current_password || "", user.password_hash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const password_hash = await bcrypt.hash(new_password, 10);
    await run("UPDATE users SET password_hash = ? WHERE user_id = ?", [password_hash, req.auth.user_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
