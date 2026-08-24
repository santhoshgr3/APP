// Retailer/product photo storage. Uses Supabase Storage when SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY are configured (see ../.env.example); falls back to
// local disk storage under backend/uploads/ for local dev with zero setup —
// same dev-fallback pattern as lib/sms.js. Every route calls only the functions
// this file exports, never multer or Supabase directly, so this is the only
// file that needs to change if the storage backend ever changes again.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const ALLOWED_MIME = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "gvcda-photos";
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME[file.mimetype]) return cb(new Error("Only JPEG, PNG or WEBP images are allowed"));
  cb(null, true);
}

// Never trust the client's filename — generate our own, keyed only off the
// verified mimetype, so there's no path-traversal or extension-spoofing surface.
function randomName(mimetype) {
  return `${crypto.randomUUID()}${ALLOWED_MIME[mimetype]}`;
}

let uploadPhotos, uploadSingleImage, saveFiles, deleteFile, UPLOAD_DIR;

if (useSupabase) {
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const storage = multer.memoryStorage();

  uploadPhotos = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES, files: 5 } });
  uploadSingleImage = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

  // Uploads already-validated multer files (in-memory buffers) to the
  // Supabase Storage bucket and returns their public URLs, in order.
  saveFiles = async function saveFiles(files) {
    const urls = [];
    for (const file of files) {
      const objectPath = randomName(file.mimetype);
      const { error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
      const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(objectPath);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  // Stored value is the public URL saveFiles() returned; Supabase's remove()
  // needs just the object path back out of it.
  deleteFile = async function deleteFile(fileUrl) {
    if (!fileUrl) return;
    const marker = `/object/public/${SUPABASE_BUCKET}/`;
    const idx = fileUrl.indexOf(marker);
    const objectPath = idx >= 0 ? fileUrl.slice(idx + marker.length) : fileUrl;
    await supabase.storage.from(SUPABASE_BUCKET).remove([objectPath]).catch(() => {}); // best-effort
  };
} else {
  UPLOAD_DIR = path.join(__dirname, "..", "uploads");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, randomName(file.mimetype)),
  });

  uploadPhotos = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES, files: 5 } });
  uploadSingleImage = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_BYTES, files: 1 } });

  // Disk storage already wrote the file during multer's parsing — just hand
  // back the filenames it picked, kept async to match the Supabase code path.
  saveFiles = async function saveFiles(files) {
    return files.map((f) => f.filename);
  };

  deleteFile = async function deleteFile(filename) {
    if (!filename) return;
    fs.unlink(path.join(UPLOAD_DIR, filename), () => {}); // best-effort
  };
}

module.exports = { UPLOAD_DIR, uploadPhotos, uploadSingleImage, saveFiles, deleteFile, useSupabase, SUPABASE_BUCKET };
