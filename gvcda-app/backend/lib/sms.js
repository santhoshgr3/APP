// SMS delivery, abstracted behind one function so routes/auth.js never cares which
// provider is behind it. In dev (no provider configured) it just logs — the OTP is
// also returned in the API response so the demo works without any SMS account.
//
// To go live, set ONE of these in .env:
//   MSG91_AUTH_KEY + MSG91_TEMPLATE_ID + MSG91_SENDER_ID   (India — needs DLT registration, see README)
//   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER
const isProd = process.env.NODE_ENV === "production";

async function sendViaMsg91(phone, otp) {
  const { MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, MSG91_SENDER_ID } = process.env;
  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: MSG91_AUTH_KEY },
    body: JSON.stringify({
      template_id: MSG91_TEMPLATE_ID,
      mobile: `91${phone}`,
      sender: MSG91_SENDER_ID,
      otp,
    }),
  });
  if (!res.ok) throw new Error(`MSG91 send failed: ${res.status} ${await res.text()}`);
}

async function sendViaTwilio(phone, otp) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = new URLSearchParams({
    To: `+91${phone}`,
    From: TWILIO_FROM_NUMBER,
    Body: `Your GVCDA verification code is ${otp}. Valid for 5 minutes.`,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Twilio send failed: ${res.status} ${await res.text()}`);
}

// Returns { sent: boolean, devOtpVisible: boolean } — devOtpVisible controls whether
// routes/auth.js is allowed to echo the OTP back in the API response (never do that
// once real SMS is wired up, even accidentally in a misconfigured prod env).
async function sendOtpSms(phone, otp) {
  if (process.env.MSG91_AUTH_KEY) {
    await sendViaMsg91(phone, otp);
    return { sent: true, devOtpVisible: false };
  }
  if (process.env.TWILIO_ACCOUNT_SID) {
    await sendViaTwilio(phone, otp);
    return { sent: true, devOtpVisible: false };
  }
  if (isProd) {
    throw new Error("No SMS provider configured (set MSG91_* or TWILIO_* in .env) — refusing to run OTP auth in production without one.");
  }
  console.log(`[DEV] OTP for ${phone}: ${otp} (no SMS provider configured — set MSG91_* or TWILIO_* env vars to send real SMS)`);
  return { sent: false, devOtpVisible: true };
}

module.exports = { sendOtpSms };
