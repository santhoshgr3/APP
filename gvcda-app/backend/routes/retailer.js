const express = require("express");
const router = express.Router();
const { get, all, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const paymentRequests = require("../lib/paymentRequests");
const { uploadPhotos, uploadSingleImage, saveFiles, deleteFile } = require("../lib/uploads");

router.use(requireAuth);

// POST /retailer/register { business_name, category_id, village_id, phone }
// Self-registration path. Sets the caller's role to 'retailer' and creates a pending listing.
router.post("/register", async (req, res, next) => {
  try {
    const { business_name, category_id, village_id, phone } = req.body;
    if (!business_name || !category_id || !village_id) return res.status(400).json({ error: "Missing required fields" });

    await run("UPDATE users SET role = 'retailer' WHERE user_id = ?", [req.auth.user_id]);
    await run("INSERT INTO user_roles (user_id, role) VALUES (?, 'retailer') ON CONFLICT DO NOTHING", [req.auth.user_id]);
    const result = await run(
      `INSERT INTO retailers (user_id, business_name, category_id, village_id, phone, onboarded_by, status)
       VALUES (?, ?, ?, ?, ?, 'self', 'pending') RETURNING retailer_id`,
      [req.auth.user_id, business_name, category_id, village_id, phone]
    );

    const retailer = await get("SELECT * FROM retailers WHERE retailer_id = ?", [result.lastInsertRowid]);
    res.json({ retailer, note: "Re-login to refresh your role token." });
  } catch (e) { next(e); }
});

// middleware for the rest: must be an approved retailer, scoped to their own retailer_id
async function withRetailer(req, res, next) {
  try {
    const retailer = await get("SELECT * FROM retailers WHERE user_id = ?", [req.auth.user_id]);
    if (!retailer) return res.status(404).json({ error: "No retailer profile for this account" });
    req.retailer = retailer;
    next();
  } catch (e) { next(e); }
}

// GET /retailer/me — status, whether approved yet
router.get("/me", withRetailer, (req, res) => res.json({ retailer: req.retailer }));

// GET /retailer/products
router.get("/products", withRetailer, async (req, res, next) => {
  try { res.json(await all("SELECT * FROM products WHERE retailer_id = ?", [req.retailer.retailer_id])); } catch (e) { next(e); }
});

// POST /retailer/products { name, price }
router.post("/products", withRetailer, async (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined || price === null) return res.status(400).json({ error: "name and price required" });
    if (!(Number(price) > 0)) return res.status(400).json({ error: "price must be greater than 0" });
    const result = await run("INSERT INTO products (retailer_id, name, price) VALUES (?, ?, ?) RETURNING product_id", [req.retailer.retailer_id, name, price]);
    res.json(await get("SELECT * FROM products WHERE product_id = ?", [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

// GET /retailer/orders?status=placed
router.get("/orders", withRetailer, async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `SELECT o.*, u.full_name as member_name FROM orders o
               JOIN users u ON u.user_id = o.member_id WHERE o.retailer_id = ?`;
    const params = [req.retailer.retailer_id];
    if (status) { sql += " AND o.status = ?"; params.push(status); }
    sql += " ORDER BY o.placed_at DESC";
    res.json(await all(sql, params));
  } catch (e) { next(e); }
});

// GET /retailer/orders/:id — with line items
router.get("/orders/:id", withRetailer, async (req, res, next) => {
  try {
    const order = await get("SELECT * FROM orders WHERE order_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const items = await all(
      `SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ?`,
      [order.order_id]
    );
    res.json({ order, items });
  } catch (e) { next(e); }
});

// PATCH /retailer/orders/:id { status: accepted|rejected|fulfilled }
router.patch("/orders/:id", withRetailer, async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ["accepted", "rejected", "fulfilled"];
    if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const order = await get("SELECT * FROM orders WHERE order_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const fulfilledAt = status === "fulfilled" ? new Date().toISOString() : order.fulfilled_at;
    await run("UPDATE orders SET status = ?, fulfilled_at = ? WHERE order_id = ?", [status, fulfilledAt, order.order_id]);
    res.json(await get("SELECT * FROM orders WHERE order_id = ?", [order.order_id]));
  } catch (e) { next(e); }
});

// GET /retailer/earnings — every order is Cash on Delivery, so the retailer
// collects `gross` in cash directly from members. `commission_owed` is what's
// still unpaid to GVCDA out of that; `commission_settled` is what's already been
// paid over (see /commission/checkout below). `net` is what the retailer keeps.
router.get("/earnings", withRetailer, async (req, res, next) => {
  try {
    const row = await get(
      `SELECT COALESCE(SUM(order_total),0) as gross,
              COALESCE(SUM(commission_amt),0) as commission,
              COALESCE(SUM(CASE WHEN commission_settled = 0 THEN commission_amt ELSE 0 END),0) as commission_owed,
              COALESCE(SUM(CASE WHEN commission_settled = 1 THEN commission_amt ELSE 0 END),0) as commission_settled,
              COALESCE(SUM(payout_amt),0) as net, COUNT(*) as order_count
       FROM orders WHERE retailer_id = ? AND status = 'fulfilled'`,
      [req.retailer.retailer_id]
    );
    res.json(row);
  } catch (e) { next(e); }
});

// POST /retailer/commission/checkout — start settling whatever commission is
// currently owed on fulfilled orders. Same bank/UPI-transfer pattern as member
// membership payments: returns a QR-able UPI link + reference code; Admin
// verifies the transfer by hand against the bank statement (see routes/admin.js).
router.post("/commission/checkout", withRetailer, async (req, res) => {
  try {
    res.json(await paymentRequests.startCommissionSettlement(req.auth.user_id, req.retailer.retailer_id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /retailer/commission/submit-utr { request_id, utr }
router.post("/commission/submit-utr", withRetailer, async (req, res) => {
  const { request_id, utr } = req.body;
  if (!utr || !utr.trim()) return res.status(400).json({ error: "UTR / transaction reference is required" });
  try {
    res.json({ request: await paymentRequests.submitUtr(request_id, req.auth.user_id, utr.trim()) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /retailer/commission/requests — this retailer's settlement history
router.get("/commission/requests", withRetailer, async (req, res, next) => {
  try {
    res.json(await all(
      "SELECT * FROM payment_requests WHERE type = 'commission_settlement' AND retailer_id = ? ORDER BY created_at DESC",
      [req.retailer.retailer_id]
    ));
  } catch (e) { next(e); }
});

// PATCH /retailer/products/:id { name, price, is_available }
router.patch("/products/:id", withRetailer, async (req, res, next) => {
  try {
    const { name, price, is_available } = req.body;
    if (price !== undefined && price !== null && !(Number(price) > 0)) return res.status(400).json({ error: "price must be greater than 0" });
    const product = await get("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!product) return res.status(404).json({ error: "Product not found" });
    await run(
      "UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), is_available = COALESCE(?, is_available) WHERE product_id = ?",
      [name, price, is_available === undefined ? undefined : (is_available ? 1 : 0), req.params.id]
    );
    res.json(await get("SELECT * FROM products WHERE product_id = ?", [req.params.id]));
  } catch (e) { next(e); }
});

// DELETE /retailer/products/:id
router.delete("/products/:id", withRetailer, async (req, res, next) => {
  try {
    const product = await get("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    await run("DELETE FROM products WHERE product_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (product?.image_filename) deleteFile(product.image_filename);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /retailer/profile { address, hours, description, phone, bank_account, bank_ifsc, upi_id }
router.patch("/profile", withRetailer, async (req, res, next) => {
  try {
    const { address, hours, description, phone, bank_account, bank_ifsc, upi_id } = req.body;
    await run(
      `UPDATE retailers SET address = COALESCE(?, address), hours = COALESCE(?, hours),
       description = COALESCE(?, description), phone = COALESCE(?, phone),
       bank_account = COALESCE(?, bank_account), bank_ifsc = COALESCE(?, bank_ifsc), upi_id = COALESCE(?, upi_id)
       WHERE retailer_id = ?`,
      [address, hours, description, phone, bank_account, bank_ifsc, upi_id, req.retailer.retailer_id]
    );
    res.json({ retailer: await get("SELECT * FROM retailers WHERE retailer_id = ?", [req.retailer.retailer_id]) });
  } catch (e) { next(e); }
});

// GET /retailer/promotions
router.get("/promotions", withRetailer, async (req, res, next) => {
  try { res.json(await all("SELECT * FROM promotions WHERE retailer_id = ? ORDER BY created_at DESC", [req.retailer.retailer_id])); } catch (e) { next(e); }
});

// POST /retailer/promotions { title, discount_pct, start_date, end_date, scope }
router.post("/promotions", withRetailer, async (req, res, next) => {
  try {
    const { title, discount_pct, start_date, end_date, scope } = req.body;
    if (!title || !discount_pct || !start_date || !end_date) return res.status(400).json({ error: "Missing required fields" });
    if (!(Number(discount_pct) > 0) || Number(discount_pct) > 100) return res.status(400).json({ error: "discount_pct must be between 0 and 100" });
    const result = await run(
      "INSERT INTO promotions (retailer_id, title, discount_pct, start_date, end_date, scope) VALUES (?, ?, ?, ?, ?, ?) RETURNING promotion_id",
      [req.retailer.retailer_id, title, discount_pct, start_date, end_date, scope || "all_products"]
    );
    res.json(await get("SELECT * FROM promotions WHERE promotion_id = ?", [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

// PATCH /retailer/promotions/:id { is_active }
router.patch("/promotions/:id", withRetailer, async (req, res, next) => {
  try {
    const { is_active } = req.body;
    await run("UPDATE promotions SET is_active = ? WHERE promotion_id = ? AND retailer_id = ?", [is_active ? 1 : 0, req.params.id, req.retailer.retailer_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /retailer/photos — this retailer's storefront gallery
router.get("/photos", withRetailer, async (req, res, next) => {
  try { res.json(await all("SELECT * FROM retailer_photos WHERE retailer_id = ? ORDER BY is_primary DESC, created_at", [req.retailer.retailer_id])); } catch (e) { next(e); }
});

// POST /retailer/photos — multipart, field name "photos", up to 5 files at once.
// The first photo a retailer ever uploads becomes the primary/cover image
// automatically; after that, use PATCH /photos/:id to change it.
router.post("/photos", withRetailer, uploadPhotos.array("photos", 5), async (req, res, next) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No photos uploaded" });
  try {
    const urls = await saveFiles(req.files);
    const hasExisting = await get("SELECT 1 FROM retailer_photos WHERE retailer_id = ?", [req.retailer.retailer_id]);
    for (let i = 0; i < urls.length; i++) {
      const isPrimary = !hasExisting && i === 0 ? 1 : 0;
      await run("INSERT INTO retailer_photos (retailer_id, filename, is_primary) VALUES (?, ?, ?)", [req.retailer.retailer_id, urls[i], isPrimary]);
    }
    res.json(await all("SELECT * FROM retailer_photos WHERE retailer_id = ? ORDER BY is_primary DESC, created_at", [req.retailer.retailer_id]));
  } catch (e) { next(e); }
});

// PATCH /retailer/photos/:id { is_primary: true } — set the listing's cover photo
router.patch("/photos/:id", withRetailer, async (req, res, next) => {
  try {
    const photo = await get("SELECT * FROM retailer_photos WHERE photo_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!photo) return res.status(404).json({ error: "Photo not found" });
    await run("UPDATE retailer_photos SET is_primary = 0 WHERE retailer_id = ?", [req.retailer.retailer_id]);
    await run("UPDATE retailer_photos SET is_primary = 1 WHERE photo_id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /retailer/photos/:id
router.delete("/photos/:id", withRetailer, async (req, res, next) => {
  try {
    const photo = await get("SELECT * FROM retailer_photos WHERE photo_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!photo) return res.status(404).json({ error: "Photo not found" });
    await run("DELETE FROM retailer_photos WHERE photo_id = ?", [req.params.id]);
    deleteFile(photo.filename);
    // If that was the primary photo, promote whichever one's left (if any).
    if (photo.is_primary) {
      const next_ = await get("SELECT photo_id FROM retailer_photos WHERE retailer_id = ? ORDER BY created_at LIMIT 1", [req.retailer.retailer_id]);
      if (next_) await run("UPDATE retailer_photos SET is_primary = 1 WHERE photo_id = ?", [next_.photo_id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /retailer/products/:id/image — multipart, field name "image". Replaces
// whatever image the product already had (old file deleted from disk).
router.post("/products/:id/image", withRetailer, uploadSingleImage.single("image"), async (req, res, next) => {
  try {
    const product = await get("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    const [url] = await saveFiles([req.file]);
    await run("UPDATE products SET image_filename = ? WHERE product_id = ?", [url, req.params.id]);
    if (product.image_filename) deleteFile(product.image_filename);
    res.json(await get("SELECT * FROM products WHERE product_id = ?", [req.params.id]));
  } catch (e) { next(e); }
});

// DELETE /retailer/products/:id/image
router.delete("/products/:id/image", withRetailer, async (req, res, next) => {
  try {
    const product = await get("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (product.image_filename) deleteFile(product.image_filename);
    await run("UPDATE products SET image_filename = NULL WHERE product_id = ?", [req.params.id]);
    res.json(await get("SELECT * FROM products WHERE product_id = ?", [req.params.id]));
  } catch (e) { next(e); }
});

module.exports = router;
