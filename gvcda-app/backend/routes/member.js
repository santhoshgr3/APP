const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");
const paymentRequests = require("../lib/paymentRequests");

router.use(requireAuth); // every route below requires a logged-in user

// PATCH /member/profile { full_name, village_id }
router.patch("/profile", (req, res) => {
  const { full_name, village_id } = req.body;
  db.prepare("UPDATE users SET full_name = COALESCE(?, full_name), village_id = COALESCE(?, village_id) WHERE user_id = ?")
    .run(full_name, village_id, req.auth.user_id);
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.auth.user_id);
  res.json({ user });
});

// POST /member/membership/checkout { plan_id }
// There's no payment gateway account yet, so this is direct bank/UPI transfer:
// returns a QR-able UPI link + GVCDA's bank details and a reference code. The
// membership itself is created once Admin verifies the payment (see
// routes/admin.js's /payment-requests endpoints) — this endpoint alone does NOT
// grant membership, on purpose.
router.post("/membership/checkout", (req, res) => {
  const { plan_id } = req.body;
  try {
    const result = paymentRequests.startMembershipRequest(req.auth.user_id, plan_id);
    res.json(result);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /member/membership/submit-utr { request_id, utr }
// Step 2: after paying, the member reports the UTR (their bank/UPI app's
// transaction reference) as proof — this moves the request into Admin's queue.
router.post("/membership/submit-utr", (req, res) => {
  const { request_id, utr } = req.body;
  if (!utr || !utr.trim()) return res.status(400).json({ error: "UTR / transaction reference is required" });
  try {
    res.json({ request: paymentRequests.submitUtr(request_id, req.auth.user_id, utr.trim()) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /member/membership/requests — this member's payment request history (to
// show "awaiting verification" state after submitting a UTR).
router.get("/membership/requests", (req, res) => {
  res.json(db.prepare(
    `SELECT pr.*, mp.name as plan_name FROM payment_requests pr
     LEFT JOIN membership_plans mp ON mp.plan_id = pr.plan_id
     WHERE pr.type = 'membership' AND pr.user_id = ? ORDER BY pr.created_at DESC`
  ).all(req.auth.user_id));
});

// GET /member/membership — current active membership + digital card
router.get("/membership", (req, res) => {
  const membership = db.prepare(
    `SELECT m.*, p.name as plan_name FROM memberships m
     JOIN membership_plans p ON p.plan_id = m.plan_id
     WHERE m.user_id = ? AND m.status = 'active' ORDER BY m.membership_id DESC LIMIT 1`
  ).get(req.auth.user_id);
  res.json({ membership: membership || null });
});

// GET /member/home — sectors + nearby retailers based on the member's own village
router.get("/home", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.auth.user_id);
  const categories = db.prepare("SELECT * FROM retailer_categories ORDER BY name").all();

  let nearby = [];
  if (user.village_id) {
    nearby = db.prepare(
      `SELECT r.*, v.name as village_name,
              (SELECT filename FROM retailer_photos WHERE retailer_id = r.retailer_id ORDER BY is_primary DESC, created_at LIMIT 1) as primary_photo
       FROM retailers r
       JOIN villages v ON v.village_id = r.village_id
       WHERE r.village_id = ? AND r.status = 'approved' LIMIT 5`
    ).all(user.village_id);
  }
  res.json({ user, categories, nearby });
});

// GET /member/retailers?category_id=2&village_id=1  (village_id optional -> defaults to member's own)
router.get("/retailers", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.auth.user_id);
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

  res.json(db.prepare(sql).all(...params));
});

// GET /member/retailers/:id — profile + product list
router.get("/retailers/:id", (req, res) => {
  const retailer = db.prepare(
    `SELECT r.*, v.name as village_name, c.name as category_name FROM retailers r
     JOIN villages v ON v.village_id = r.village_id
     JOIN retailer_categories c ON c.category_id = r.category_id
     WHERE r.retailer_id = ?`
  ).get(req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });
  const products = db.prepare("SELECT * FROM products WHERE retailer_id = ? AND is_available = 1").all(req.params.id);
  const promotions = db.prepare(
    "SELECT * FROM promotions WHERE retailer_id = ? AND is_active = 1 AND date('now') BETWEEN start_date AND end_date"
  ).all(req.params.id);
  const photos = db.prepare("SELECT * FROM retailer_photos WHERE retailer_id = ? ORDER BY is_primary DESC, created_at").all(req.params.id);
  res.json({ retailer, products, promotions, photos });
});

// POST /member/orders { retailer_id, items: [{product_id, quantity}] }
router.post("/orders", (req, res) => {
  const { retailer_id, items } = req.body;
  const retailer = db.prepare("SELECT * FROM retailers WHERE retailer_id = ? AND status = 'approved'").get(retailer_id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found or not approved" });
  if (!items || !items.length) return res.status(400).json({ error: "Order must have at least one item" });

  let total = 0;
  const lineItems = items.map((i) => {
    const product = db.prepare("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?").get(i.product_id, retailer_id);
    if (!product) throw new Error("Invalid product in order");
    const lineTotal = product.price * i.quantity;
    total += lineTotal;
    return { product_id: product.product_id, quantity: i.quantity, unit_price: product.price, line_total: lineTotal };
  });

  const commissionPct = retailer.commission_pct;
  const commissionAmt = Math.round(total * commissionPct / 100);
  const payoutAmt = total - commissionAmt;

  const orderResult = db.prepare(
    `INSERT INTO orders (member_id, retailer_id, order_total, commission_pct, commission_amt, payout_amt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.auth.user_id, retailer_id, total, commissionPct, commissionAmt, payoutAmt);

  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)"
  );
  lineItems.forEach((li) => insertItem.run(orderResult.lastInsertRowid, li.product_id, li.quantity, li.unit_price, li.line_total));

  const order = db.prepare("SELECT * FROM orders WHERE order_id = ?").get(orderResult.lastInsertRowid);
  res.json({ order });
});

// GET /member/orders — this member's order history + status
router.get("/orders", (req, res) => {
  const orders = db.prepare(
    `SELECT o.*, r.business_name FROM orders o
     JOIN retailers r ON r.retailer_id = o.retailer_id
     WHERE o.member_id = ? ORDER BY o.placed_at DESC`
  ).all(req.auth.user_id);
  res.json(orders);
});

// GET /member/jobs
router.get("/jobs", (req, res) => {
  const jobs = db.prepare(
    `SELECT j.*, v.name as village_name,
       EXISTS(SELECT 1 FROM job_applications a WHERE a.job_id = j.job_id AND a.member_id = ?) as applied
     FROM jobs j LEFT JOIN villages v ON v.village_id = j.village_id
     WHERE j.is_open = 1`
  ).all(req.auth.user_id);
  res.json(jobs);
});

// POST /member/jobs/:id/apply
router.post("/jobs/:id/apply", (req, res) => {
  try {
    db.prepare("INSERT INTO job_applications (job_id, member_id) VALUES (?, ?)").run(req.params.id, req.auth.user_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "Already applied" });
  }
});

// POST /member/complaints { category, description, against_retailer_id? }
router.post("/complaints", (req, res) => {
  const { category, description, against_retailer_id } = req.body;
  if (!description) return res.status(400).json({ error: "description required" });
  const result = db.prepare("INSERT INTO complaints (raised_by, category, description, against_retailer_id) VALUES (?, ?, ?, ?)")
    .run(req.auth.user_id, category, description, against_retailer_id || null);
  res.json({ complaint_id: result.lastInsertRowid });
});

// GET /member/complaints — this member's own complaint history
router.get("/complaints", (req, res) => {
  res.json(db.prepare("SELECT * FROM complaints WHERE raised_by = ? ORDER BY created_at DESC").all(req.auth.user_id));
});

// GET /member/orders/:id — single order with line items, for the tracking screen
router.get("/orders/:id", (req, res) => {
  const order = db.prepare(
    `SELECT o.*, r.business_name FROM orders o JOIN retailers r ON r.retailer_id = o.retailer_id
     WHERE o.order_id = ? AND o.member_id = ?`
  ).get(req.params.id, req.auth.user_id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const items = db.prepare(
    `SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ?`
  ).all(order.order_id);
  res.json({ order, items });
});

module.exports = router;
