// One call to reach a user on every channel they've set up: an Expo push (if their
// phone registered a token) and an email (if they gave one and SMTP is configured).
// Always best-effort — callers never await or depend on delivery.
const { get } = require("../db");
const { sendPush } = require("./push");
const { sendEmail } = require("./email");

function notifyUser(userId, { title, body, data }) {
  get("SELECT push_token, email FROM users WHERE user_id = ?", [userId])
    .then((u) => {
      if (!u) return;
      sendPush([u.push_token], { title, body, data });
      sendEmail(u.email, `GVCDA — ${title}`, body);
    })
    .catch((e) => console.error("notifyUser failed:", e.message));
}

module.exports = { notifyUser };
