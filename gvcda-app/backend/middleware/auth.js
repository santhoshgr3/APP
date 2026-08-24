const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
}
// Dev-only: a random secret per process boot is fine locally (it just means
// existing tokens go stale on restart) and is safer than a checked-in constant.
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");

function signToken(user) {
  return jwt.sign(
    { user_id: user.user_id, role: user.role, village_id: user.village_id },
    SECRET,
    { expiresIn: "30d" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, SECRET };
