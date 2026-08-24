const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const paymentRequests = require("../lib/paymentRequests");
const { uploadPhotos, uploadSingleImage, deleteFile } = require("../lib/uploads");

router.use(requireAuth);

// POST /retailer/register { business_name, category_id, village_id, phone }
// Self-registration path. Sets the caller's role to 'retailer' and creates a pending listing.
router.post("/register", (req, res) => {
  const { business_name, category_id, village_id, phone } = req.body;
  if (!business_name || !category_id || !village_id) return res.status(400).json({ error: "Missing required fields" });

  db.prepare("UPDATE users SET role = 'retailer' WHERE user_id = ?").run(req.auth.user_id);
  db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'retailer')").run(req.auth.user_id);
  const result = db.prepare(
    `INSERT INTO retailers (user_id, business_name, category_id, village_id, phone, onboarded_by, status)
     VALUES (?, ?, ?, ?, ?, 'self', 'pending')`
  ).run(req.auth.user_id, business_name, category_id, village_id, phone);

  const retailer = db.prepare("SELECT * FROM retailers WHERE retailer_id = ?").get(result.lastInsertRowid);
  res.json({ retailer, note: "Re-login to refresh your role token." });
});

// middleware for the rest: must be an approved retailer, scoped to their own retailer_id
function withRetailer(req, res, next) {
  const retailer = db.prepare("SELECT * FROM retailers WHERE user_id = ?").get(req.auth.user_id);
  if (!retailer) return res.status(404).json({ error: "No retailer profile for this account" });
  req.retailer = retailer;
  next();
}

// GET /retailer/me — status, whether approved yet
router.get("/me", withRetailer, (req, res) => res.json({ retailer: req.retailer }));

// GET /retailer/products
router.get("/products", withRetailer, (req, res) => {
  res.json(db.prepare("SELECT * FROM products WHERE retailer_id = ?").all(req.retailer.retailer_id));
});

// POST /retailer/products { name, price }
router.post("/products", withRetailer, (req, res) => {
  const { name, price } = req.body;
  if (!name || !price) return res.status(400).json({ error: "name and price required" });
  const result = db.prepare("INSERT INTO products (retailer_id, name, price) VALUES (?, ?, ?)").run(req.retailer.retailer_id, name, price);
  res.json(db.prepare("SELECT * FROM products WHERE product_id = ?").get(result.lastInsertRowid));
});

// GET /retailer/orders?status=placed
router.get("/orders", withRetailer, (req, res) => {
  const { status } = req.query;
  let sql = `SELECT o.*, u.full_name as member_name FROM orders o
             JOIN users u ON u.user_id = o.member_id WHERE o.retailer_id = ?`;
  const params = [req.retailer.retailer_id];
  if (status) { sql += " AND o.status = ?"; params.push(status); }
  sql += " ORDER BY o.placed_at DESC";
  res.json(db.prepare(sql).all(...params));
});

// GET /retailer/orders/:id — with line items
router.get("/orders/:id", withRetailer, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE order_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const items = db.prepare(
    `SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ?`
  ).all(order.order_id);
  res.json({ order, items });
});

// PATCH /retailer/orders/:id { status: accepted|rejected|fulfilled }
router.patch("/orders/:id", withRetailer, (req, res) => {
  const { status } = req.body;
  const valid = ["accepted", "rejected", "fulfilled"];
  if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const order = db.prepare("SELECT * FROM orders WHERE order_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const fulfilledAt = status === "fulfilled" ? new Date().toISOString() : order.fulfilled_at;
  db.prepare("UPDATE orders SET status = ?, fulfilled_at = ? WHERE order_id = ?").run(status, fulfilledAt, order.order_id);
  res.json(db.prepare("SELECT * FROM orders WHERE order_id = ?").get(order.order_id));
});

// GET /retailer/earnings — every order is Cash on Delivery, so the retailer
// collects `gross` in cash directly from members. `commission_owed` is what's
// still unpaid to GVCDA out of that; `commission_settled` is what's already been
// paid over (see /commission/checkout below). `net` is what the retailer keeps.
router.get("/earnings", withRetailer, (req, res) => {
  const row = db.prepare(
    `SELECT COALESCE(SUM(order_total),0) as gross,
            COALESCE(SUM(commission_amt),0) as commission,
            COALESCE(SUM(CASE WHEN commission_settled = 0 THEN commission_amt ELSE 0 END),0) as commission_owed,
            COALESCE(SUM(CASE WHEN commission_settled = 1 THEN commission_amt ELSE 0 END),0) as commission_settled,
            COALESCE(SUM(payout_amt),0) as net, COUNT(*) as order_count
     FROM orders WHERE retailer_id = ? AND status = 'fulfilled'`
  ).get(req.retailer.retailer_id);
  res.json(row);
});

// POST /retailer/commission/checkout — start settling whatever commission is
// currently owed on fulfilled orders. Same bank/UPI-transfer pattern as member
// membership payments: returns a QR-able UPI link + reference code; Admin
// verifies the transfer by hand against the bank statement (see routes/admin.js).
router.post("/commission/checkout", withRetailer, (req, res) => {
  try {
    res.json(paymentRequests.startCommissionSettlement(req.auth.user_id, req.retailer.retailer_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /retailer/commission/submit-utr { request_id, utr }
router.post("/commission/submit-utr", withRetailer, (req, res) => {
  const { request_id, utr } = req.body;
  if (!utr || !utr.trim()) return res.status(400).json({ error: "UTR / transaction reference is required" });
  try {
    res.json({ request: paymentRequests.submitUtr(request_id, req.auth.user_id, utr.trim()) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /retailer/commission/requests — this retailer's settlement history
router.get("/commission/requests", withRetailer, (req, res) => {
  res.json(db.prepare(
    "SELECT * FROM payment_requests WHERE type = 'commission_settlement' AND retailer_id = ? ORDER BY created_at DESC"
  ).all(req.retailer.retailer_id));
});

// PATCH /retailer/products/:id { name, price, is_available }
router.patch("/products/:id", withRetailer, (req, res) => {
  const { name, price, is_available } = req.body;
  const product = db.prepare("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  db.prepare("UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), is_available = COALESCE(?, is_available) WHERE product_id = ?")
    .run(name, price, is_available === undefined ? undefined : (is_available ? 1 : 0), req.params.id);
  res.json(db.prepare("SELECT * FROM products WHERE product_id = ?").get(req.params.id));
});

// DELETE /retailer/products/:id
router.delete("/products/:id", withRetailer, (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  db.prepare("DELETE FROM products WHERE product_id = ? AND retailer_id = ?").run(req.params.id, req.retailer.retailer_id);
  if (product?.image_filename) deleteFile(product.image_filename);
  res.json({ ok: true });
});

// PATCH /retailer/profile { address, hours, description, phone, bank_account, bank_ifsc, upi_id }
router.patch("/profile", withRetailer, (req, res) => {
  const { address, hours, description, phone, bank_account, bank_ifsc, upi_id } = req.body;
  db.prepare(
    `UPDATE retailers SET address = COALESCE(?, address), hours = COALESCE(?, hours),
     description = COALESCE(?, description), phone = COALESCE(?, phone),
     bank_account = COALESCE(?, bank_account), bank_ifsc = COALESCE(?, bank_ifsc), upi_id = COALESCE(?, upi_id)
     WHERE retailer_id = ?`
  ).run(address, hours, description, phone, bank_account, bank_ifsc, upi_id, req.retailer.retailer_id);
  res.json({ retailer: db.prepare("SELECT * FROM retailers WHERE retailer_id = ?").get(req.retailer.retailer_id) });
});

// GET /retailer/promotions
router.get("/promotions", withRetailer, (req, res) => {
  res.json(db.prepare("SELECT * FROM promotions WHERE retailer_id = ? ORDER BY created_at DESC").all(req.retailer.retailer_id));
});

// POST /retailer/promotions { title, discount_pct, start_date, end_date, scope }
router.post("/promotions", withRetailer, (req, res) => {
  const { title, discount_pct, start_date, end_date, scope } = req.body;
  if (!title || !discount_pct || !start_date || !end_date) return res.status(400).json({ error: "Missing required fields" });
  const result = db.prepare(
    "INSERT INTO promotions (retailer_id, title, discount_pct, start_date, end_date, scope) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(req.retailer.retailer_id, title, discount_pct, start_date, end_date, scope || "all_products");
  res.json(db.prepare("SELECT * FROM promotions WHERE promotion_id = ?").get(result.lastInsertRowid));
});

// PATCH /retailer/promotions/:id { is_active }
router.patch("/promotions/:id", withRetailer, (req, res) => {
  const { is_active } = req.body;
  db.prepare("UPDATE promotions SET is_active = ? WHERE promotion_id = ? AND retailer_id = ?")
    .run(is_active ? 1 : 0, req.params.id, req.retailer.retailer_id);
  res.json({ ok: true });
});

// GET /retailer/photos — this retailer's storefront gallery
router.get("/photos", withRetailer, (req, res) => {
  res.json(db.prepare("SELECT * FROM retailer_photos WHERE retailer_id = ? ORDER BY is_primary DESC, created_at").all(req.retailer.retailer_id));
});

// POST /retailer/photos — multipart, field name "photos", up to 5 files at once.
// The first photo a retailer ever uploads becomes the primary/cover image
// automatically; after that, use PATCH /photos/:id to change it.
router.post("/photos", withRetailer, uploadPhotos.array("photos", 5), (req, res, next) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No photos uploaded" });
  try {
    const hasExisting = db.prepare("SELECT 1 FROM retailer_photos WHERE retailer_id = ?").get(req.retailer.retailer_id);
    const insert = db.prepare("INSERT INTO retailer_photos (retailer_id, filename, is_primary) VALUES (?, ?, ?)");
    req.files.forEach((file, i) => {
      const isPrimary = !hasExisting && i === 0 ? 1 : 0;
      insert.run(req.retailer.retailer_id, file.filename, isPrimary);
    });
    res.json(db.prepare("SELECT * FROM retailer_photos WHERE retailer_id = ? ORDER BY is_primary DESC, created_at").all(req.retailer.retailer_id));
  } catch (e) { next(e); }
});

// PATCH /retailer/photos/:id { is_primary: true } — set the listing's cover photo
router.patch("/photos/:id", withRetailer, (req, res) => {
  const photo = db.prepare("SELECT * FROM retailer_photos WHERE photo_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  db.prepare("UPDATE retailer_photos SET is_primary = 0 WHERE retailer_id = ?").run(req.retailer.retailer_id);
  db.prepare("UPDATE retailer_photos SET is_primary = 1 WHERE photo_id = ?").run(req.params.id);
  res.json({ ok: true });
});

// DELETE /retailer/photos/:id
router.delete("/photos/:id", withRetailer, (req, res) => {
  const photo = db.prepare("SELECT * FROM retailer_photos WHERE photo_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  db.prepare("DELETE FROM retailer_photos WHERE photo_id = ?").run(req.params.id);
  deleteFile(photo.filename);
  // If that was the primary photo, promote whichever one's left (if any).
  if (photo.is_primary) {
    const next = db.prepare("SELECT photo_id FROM retailer_photos WHERE retailer_id = ? ORDER BY created_at LIMIT 1").get(req.retailer.retailer_id);
    if (next) db.prepare("UPDATE retailer_photos SET is_primary = 1 WHERE photo_id = ?").run(next.photo_id);
  }
  res.json({ ok: true });
});

// POST /retailer/products/:id/image — multipart, field name "image". Replaces
// whatever image the product already had (old file deleted from disk).
router.post("/products/:id/image", withRetailer, uploadSingleImage.single("image"), (req, res, next) => {
  const product = db.prepare("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  try {
    db.prepare("UPDATE products SET image_filename = ? WHERE product_id = ?").run(req.file.filename, req.params.id);
    if (product.image_filename) deleteFile(product.image_filename);
    res.json(db.prepare("SELECT * FROM products WHERE product_id = ?").get(req.params.id));
  } catch (e) { next(e); }
});

// DELETE /retailer/products/:id/image
router.delete("/products/:id/image", withRetailer, (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?").get(req.params.id, req.retailer.retailer_id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.image_filename) deleteFile(product.image_filename);
  db.prepare("UPDATE products SET image_filename = NULL WHERE product_id = ?").run(req.params.id);
  res.json(db.prepare("SELECT * FROM products WHERE product_id = ?").get(req.params.id));
});

module.exports = router;
