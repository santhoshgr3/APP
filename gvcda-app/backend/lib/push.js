// Push notifications via Expo's push service — a public HTTP API that needs no
// separate Firebase/APNs account or credentials, just the recipient's Expo push
// token (captured from the mobile app after it registers for notifications).
// Best-effort by design: a failed send is logged, never thrown, so a broadcast
// or order-status change is never blocked by push delivery failing.
async function sendPush(tokens, { title, body, data }) {
  const valid = [...new Set(tokens)].filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"));
  if (!valid.length) return;

  const messages = valid.map((to) => ({ to, title, body, data, sound: "default" }));
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error("Push send failed:", e.message);
  }
}

module.exports = { sendPush };
