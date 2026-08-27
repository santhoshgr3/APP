const crypto = require("crypto");
const { get, run } = require("../db");

// 6-char alphanumeric code, retried on the rare collision — same pattern as
// payments.js's reference codes, just shorter since this one's meant to be
// read aloud/typed by a member sharing it with a friend.
async function generateUniqueReferralCode() {
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
    const existing = await get("SELECT 1 FROM users WHERE referral_code = ?", [code]);
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

// Assigns a referral code to a user who doesn't have one yet (existing
// accounts created before this feature) and returns it.
async function ensureReferralCode(userId) {
  const user = await get("SELECT referral_code FROM users WHERE user_id = ?", [userId]);
  if (user.referral_code) return user.referral_code;
  const code = await generateUniqueReferralCode();
  await run("UPDATE users SET referral_code = ? WHERE user_id = ?", [code, userId]);
  return code;
}

module.exports = { generateUniqueReferralCode, ensureReferralCode };
