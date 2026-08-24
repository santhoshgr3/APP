// Local-disk file storage for retailer/product photos. No S3/GCS account exists
// yet, so files live under backend/uploads/ and are served back out via
// express.static (see server.js) — genuinely working today, not a stub. If this
// backend ever runs across multiple instances or needs a CDN, swap this module
// for an S3/GCS-backed one; every route that uses it only calls the functions
// below, not multer directly, so that swap stays contained to this file.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Never trust the client's filename — generate our own, keyed only off the
  // verified mimetype, so there's no path-traversal or extension-spoofing surface.
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED_MIME[file.mimetype]}`),
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME[file.mimetype]) return cb(new Error("Only JPEG, PNG or WEBP images are allowed"));
  cb(null, true);
}

const uploadPhotos = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES, files: 5 } });
const uploadSingleImage = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

function deleteFile(filename) {
  if (!filename) return;
  const p = path.join(UPLOAD_DIR, filename);
  fs.unlink(p, () => {}); // best-effort — a missing file on disk shouldn't fail the request
}

module.exports = { UPLOAD_DIR, uploadPhotos, uploadSingleImage, deleteFile };
