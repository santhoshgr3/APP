require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { UPLOAD_DIR } = require("./lib/uploads");
require("./db"); // ensures schema is created on boot

const isProd = process.env.NODE_ENV === "production";
const app = express();

// Trust the first proxy hop (Nginx/Render/Railway/etc.) so req.ip and rate
// limiting see the real client IP instead of the proxy's.
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(morgan(isProd ? "combined" : "dev"));

const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true;
app.use(cors({ origin: corsOrigins }));

// Uploaded photos, served back out as plain static files. Mounted ahead of
// express.json() (uploads go through multer, not JSON body parsing) and with
// Cross-Origin-Resource-Policy relaxed — helmet's default "same-origin" would
// otherwise block the web app (on a different port/origin) and the mobile app
// from loading these <img> sources at all.
app.use("/uploads", (req, res, next) => { res.set("Cross-Origin-Resource-Policy", "cross-origin"); next(); }, express.static(UPLOAD_DIR, { maxAge: "7d" }));

app.use(express.json({ limit: "1mb" }));

// A generous general limiter (routes with tighter needs, like OTP requests,
// layer their own stricter limiter on top — see routes/auth.js).
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));

app.use("/auth", require("./routes/auth"));
app.use("/locations", require("./routes/locations"));
app.use("/member", require("./routes/member"));
app.use("/employee", require("./routes/employee"));
app.use("/retailer", require("./routes/retailer"));
app.use("/admin", require("./routes/admin"));

app.get("/health", (req, res) => res.json({ ok: true, service: "gvcda-backend" }));

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler — catches anything a route throws or calls next(err)
// with, so clients always get a clean JSON error instead of an HTML stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  // Multer's errors ("File too large", "Unexpected field", our own mimetype
  // check) are already safe, specific, user-facing text — worth showing even
  // in production, unlike a generic internal error.
  const isMulterError = err.name === "MulterError" || /image/i.test(err.message || "");
  const status = err.status || (isMulterError ? 400 : 500);
  const message = !isProd || isMulterError ? err.message : "Internal server error";
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`GVCDA backend running on http://localhost:${PORT} [${isProd ? "production" : "development"}]`));

// Let in-flight requests finish before the process exits on deploy/restart.
function shutdown() {
  console.log("Shutting down gracefully...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
