const express = require("express");
const router = express.Router();
const { get, all, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const paymentRequests = require("../lib/paymentRequests");

router.use(requireAuth); // every route below requires a logged-in user

// PATCH /member/profile { full_name, village_id }
router.patch("/profile", async (req, res, next) => {
  try {
    const { full_name, village_id } = req.body;
    await run("UPDATE users SET full_name = COALESCE(?, full_name), village_id = COALESCE(?, village_id) WHERE user_id = ?",
      [full_name, village_id, req.auth.user_id]);
    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.auth.user_id]);
    res.json({ user });
  } catch (e) { next(e); }
});

// POST /member/membership/checkout { plan_id }
// There's no payment gateway account yet, so this is direct bank/UPI transfer:
// returns a QR-able UPI link + GVCDA's bank details and a reference code. The
// membership itself is created once Admin verifies the payment (see
// routes/admin.js's /payment-requests endpoints) — this endpoint alone does NOT
// grant membership, on purpose.
router.post("/membership/checkout", async (req, res) => {
  const { plan_id } = req.body;
  try {
    const result = await paymentRequests.startMembershipRequest(req.auth.user_id, plan_id);
    res.json(result);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /member/membership/submit-utr { request_id, utr }
// Step 2: after paying, the member reports the UTR (their bank/UPI app's
// transaction reference) as proof — this moves the request into Admin's queue.
router.post("/membership/submit-utr", async (req, res) => {
  const { request_id, utr } = req.body;
  if (!utr || !utr.trim()) return res.status(400).json({ error: "UTR / transaction reference is required" });
  try {
    res.json({ request: await paymentRequests.submitUtr(request_id, req.auth.user_id, utr.trim()) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /member/membership/requests — this member's payment request history (to
// show "awaiting verification" state after submitting a UTR).
router.get("/membership/requests", async (req, res, next) => {
  try {
    res.json(await all(
      `SELECT pr.*, mp.name as plan_name FROM payment_requests pr
       LEFT JOIN membership_plans mp ON mp.plan_id = pr.plan_id
       WHERE pr.type = 'membership' AND pr.user_id = ? ORDER BY pr.created_at DESC`,
      [req.auth.user_id]
    ));
  } catch (e) { next(e); }
});

// GET /member/membership — current active membership + digital card
router.get("/membership", async (req, res, next) => {
  try {
    const membership = await get(
      `SELECT m.*, p.name as plan_name FROM memberships m
       JOIN membership_plans p ON p.plan_id = m.plan_id
       WHERE m.user_id = ? AND m.status = 'active' ORDER BY m.membership_id DESC LIMIT 1`,
      [req.auth.user_id]
    );
    res.json({ membership: membership || null });
  } catch (e) { next(e); }
});

// GET /member/home — sectors + nearby retailers based on the member's own village
router.get("/home", async (req, res, next) => {
  try {
    const user = await get(
      `SELECT u.*, v.name as village_name, m.name as mandal_name
       FROM users u
       LEFT JOIN villages v ON v.village_id = u.village_id
       LEFT JOIN mandals m ON m.mandal_id = v.mandal_id
       WHERE u.user_id = ?`,
      [req.auth.user_id]
    );
    const categories = await all("SELECT * FROM retailer_categories ORDER BY name");

    let nearby = [];
    if (user.village_id) {
      nearby = await all(
        `SELECT r.*, v.name as village_name,
                (SELECT filename FROM retailer_photos WHERE retailer_id = r.retailer_id ORDER BY is_primary DESC, created_at LIMIT 1) as primary_photo
         FROM retailers r
         JOIN villages v ON v.village_id = r.village_id
         WHERE r.village_id = ? AND r.status = 'approved' LIMIT 5`,
        [user.village_id]
      );
    }
    res.json({ user, categories, nearby });
  } catch (e) { next(e); }
});

// GET /member/retailers?category_id=2&village_id=1  (village_id optional -> defaults to member's own)
router.get("/retailers", async (req, res, next) => {
  try {
    const user = await get("SELECT * FROM users WHERE user_id = ?", [req.auth.user_id]);
    const villageId = req.query.village_id || user.village_id;
    const { category_id } = req.query;

    let sql = `SELECT r.*, v.name as village_name, c.name as category_name,
                      (SELECT filename FROM retailer_photos WHERE retailer_id = r.retailer_id ORDER BY is_primary DESC, created_at LIMIT 1) as primary_photo
               FROM retailers r
               JOIN villages v ON v.village_id = r.village_id
               JOIN retailer_categories c ON c.category_id = r.category_id
               WHERE r.status = 'approved'`;
    const params = [];
    if (villageId) { sql += " AND r.village_id = ?"; params.push(villageId); }
    if (category_id) { sql += " AND r.category_id = ?"; params.push(category_id); }

    res.json(await all(sql, params));
  } catch (e) { next(e); }
});

// GET /member/retailers/:id — profile + product list
router.get("/retailers/:id", async (req, res, next) => {
  try {
    const retailer = await get(
      `SELECT r.*, v.name as village_name, c.name as category_name FROM retailers r
       JOIN villages v ON v.village_id = r.village_id
       JOIN retailer_categories c ON c.category_id = r.category_id
       WHERE r.retailer_id = ?`,
      [req.params.id]
    );
    if (!retailer) return res.status(404).json({ error: "Retailer not found" });
    const products = await all("SELECT * FROM products WHERE retailer_id = ? AND is_available = 1", [req.params.id]);
    const promotions = await all(
      "SELECT * FROM promotions WHERE retailer_id = ? AND is_active = 1 AND CURRENT_DATE BETWEEN start_date::date AND end_date::date",
      [req.params.id]
    );
    const photos = await all("SELECT * FROM retailer_photos WHERE retailer_id = ? ORDER BY is_primary DESC, created_at", [req.params.id]);
    res.json({ retailer, products, promotions, photos });
  } catch (e) { next(e); }
});

// POST /member/orders { retailer_id, items: [{product_id, quantity}] }
router.post("/orders", async (req, res, next) => {
  try {
    const { retailer_id, items } = req.body;
    const retailer = await get("SELECT * FROM retailers WHERE retailer_id = ? AND status = 'approved'", [retailer_id]);
    if (!retailer) return res.status(404).json({ error: "Retailer not found or not approved" });
    if (!items || !items.length) return res.status(400).json({ error: "Order must have at least one item" });

    let total = 0;
    const lineItems = [];
    for (const i of items) {
      const quantity = Number(i.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: "Item quantity must be a positive whole number" });
      const product = await get("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?", [i.product_id, retailer_id]);
      if (!product) return res.status(400).json({ error: "Invalid product in order" });
      if (!product.is_available) return res.status(400).json({ error: `${product.name} is currently unavailable` });
      const lineTotal = product.price * quantity;
      total += lineTotal;
      lineItems.push({ product_id: product.product_id, quantity, unit_price: product.price, line_total: lineTotal });
    }

    const commissionPct = retailer.commission_pct;
    const commissionAmt = Math.round(total * commissionPct / 100);
    const payoutAmt = total - commissionAmt;

    const orderResult = await run(
      `INSERT INTO orders (member_id, retailer_id, order_total, commission_pct, commission_amt, payout_amt)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING order_id`,
      [req.auth.user_id, retailer_id, total, commissionPct, commissionAmt, payoutAmt]
    );

    for (const li of lineItems) {
      await run(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)",
        [orderResult.lastInsertRowid, li.product_id, li.quantity, li.unit_price, li.line_total]
      );
    }

    const order = await get("SELECT * FROM orders WHERE order_id = ?", [orderResult.lastInsertRowid]);
    res.json({ order });
  } catch (e) { next(e); }
});

// GET /member/orders — this member's order history + status
router.get("/orders", async (req, res, next) => {
  try {
    const orders = await all(
      `SELECT o.*, r.business_name FROM orders o
       JOIN retailers r ON r.retailer_id = o.retailer_id
       WHERE o.member_id = ? ORDER BY o.placed_at DESC`,
      [req.auth.user_id]
    );
    res.json(orders);
  } catch (e) { next(e); }
});

// GET /member/jobs
router.get("/jobs", async (req, res, next) => {
  try {
    const jobs = await all(
      `SELECT j.*, v.name as village_name,
         EXISTS(SELECT 1 FROM job_applications a WHERE a.job_id = j.job_id AND a.member_id = ?) as applied
       FROM jobs j LEFT JOIN villages v ON v.village_id = j.village_id
       WHERE j.is_open = 1`,
      [req.auth.user_id]
    );
    res.json(jobs);
  } catch (e) { next(e); }
});

// POST /member/jobs/:id/apply
router.post("/jobs/:id/apply", async (req, res) => {
  try {
    await run("INSERT INTO job_applications (job_id, member_id) VALUES (?, ?)", [req.params.id, req.auth.user_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "Already applied" });
  }
});

// POST /member/complaints { category, description, against_retailer_id? }
router.post("/complaints", async (req, res, next) => {
  try {
    const { category, description, against_retailer_id } = req.body;
    if (!description) return res.status(400).json({ error: "description required" });
    const result = await run("INSERT INTO complaints (raised_by, category, description, against_retailer_id) VALUES (?, ?, ?, ?) RETURNING complaint_id",
      [req.auth.user_id, category, description, against_retailer_id || null]);
    res.json({ complaint_id: result.lastInsertRowid });
  } catch (e) { next(e); }
});

// GET /member/complaints — this member's own complaint history
router.get("/complaints", async (req, res, next) => {
  try {
    res.json(await all("SELECT * FROM complaints WHERE raised_by = ? ORDER BY created_at DESC", [req.auth.user_id]));
  } catch (e) { next(e); }
});

// GET /member/orders/:id — single order with line items, for the tracking screen
router.get("/orders/:id", async (req, res, next) => {
  try {
    const order = await get(
      `SELECT o.*, r.business_name FROM orders o JOIN retailers r ON r.retailer_id = o.retailer_id
       WHERE o.order_id = ? AND o.member_id = ?`,
      [req.params.id, req.auth.user_id]
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    const items = await all(
      `SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ?`,
      [order.order_id]
    );
    res.json({ order, items });
  } catch (e) { next(e); }
});

module.exports = router;
