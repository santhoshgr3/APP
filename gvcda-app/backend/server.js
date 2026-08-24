require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
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
  res.status(err.status || 500).json({ error: isProd ? "Internal server error" : err.message });
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
