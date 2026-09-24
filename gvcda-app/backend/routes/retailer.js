const express = require("express");
const router = express.Router();
const { get, all, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const paymentRequests = require("../lib/paymentRequests");
const { uploadPhotos, uploadSingleImage, saveFiles, deleteFile } = require("../lib/uploads");
const broadcasts = require("../lib/broadcasts");
const { notifyUser } = require("../lib/notify");
const { restockOrder } = require("../lib/inventory");
const { DELIVERY_METHODS, parseDeliveryMethods } = require("../lib/retailerPublic");

router.use(requireAuth);

const LOW_STOCK_THRESHOLD = 5;

// Shared shape for stock input: blank/null = "don't track", otherwise a whole number >= 0.
function parseStock(v) {
  if (v === undefined) return { ok: true, skip: true };
  if (v === null || v === "") return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

// GET /retailer/broadcasts — announcements targeted at this retailer's district/mandal, or all of Telangana
router.get("/broadcasts", async (req, res, next) => {
  try { res.json(await broadcasts.getVisibleBroadcasts(req.auth.user_id)); } catch (e) { next(e); }
});

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
router.get("/me", withRetailer, (req, res) => res.json({ retailer: { ...req.retailer, delivery_methods: parseDeliveryMethods(req.retailer.delivery_methods) } }));

// GET /retailer/products
router.get("/products", withRetailer, async (req, res, next) => {
  try { res.json(await all("SELECT * FROM products WHERE retailer_id = ?", [req.retailer.retailer_id])); } catch (e) { next(e); }
});

// POST /retailer/products { name, price, stock?, item_type? }
// item_type: 'product' (default) or 'service' (booked for a time slot, no stock).
router.post("/products", withRetailer, async (req, res, next) => {
  try {
    const { name, price, item_type } = req.body;
    if (!name || price === undefined || price === null) return res.status(400).json({ error: "name and price required" });
    if (!(Number(price) > 0)) return res.status(400).json({ error: "price must be greater than 0" });
    const type = item_type || "product";
    if (!["product", "service"].includes(type)) return res.status(400).json({ error: "item_type must be product or service" });
    const stock = parseStock(req.body.stock);
    if (!stock.ok) return res.status(400).json({ error: "Stock must be a whole number, 0 or more" });
    const result = await run(
      "INSERT INTO products (retailer_id, name, price, item_type, stock) VALUES (?, ?, ?, ?, ?) RETURNING product_id",
      [req.retailer.retailer_id, name, price, type, type === "service" || stock.skip ? null : stock.value]
    );
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

// GET /retailer/orders/:id — with line items, the customer, and delivery/payment details
router.get("/orders/:id", withRetailer, async (req, res, next) => {
  try {
    const order = await get(
      `SELECT o.*, u.full_name as member_name, u.phone as member_phone
       FROM orders o JOIN users u ON u.user_id = o.member_id
       WHERE o.order_id = ? AND o.retailer_id = ?`,
      [req.params.id, req.retailer.retailer_id]
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    const items = await all(
      `SELECT oi.*, p.name, p.item_type FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ?`,
      [order.order_id]
    );
    res.json({ order, items });
  } catch (e) { next(e); }
});

// PATCH /retailer/orders/:id { status: accepted|rejected|fulfilled }
// Finished orders (fulfilled/rejected/cancelled) can't be changed again. A UPI order
// can't be fulfilled until the retailer has confirmed the money actually arrived.
router.patch("/orders/:id", withRetailer, async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ["accepted", "rejected", "fulfilled"];
    if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const order = await get("SELECT * FROM orders WHERE order_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (["fulfilled", "rejected", "cancelled"].includes(order.status)) return res.status(400).json({ error: `This order is already ${order.status}` });
    if (status === "fulfilled" && order.payment_method === "upi" && order.payment_status !== "paid") {
      return res.status(400).json({ error: "Confirm the customer's UPI payment before marking this order delivered" });
    }

    const fulfilledAt = status === "fulfilled" ? new Date().toISOString() : order.fulfilled_at;
    // Cash on Delivery is settled the moment the order is handed over.
    const paymentStatus = status === "fulfilled" && order.payment_method === "cod" ? "paid" : order.payment_status;
    await run("UPDATE orders SET status = ?, fulfilled_at = ?, payment_status = ? WHERE order_id = ?", [status, fulfilledAt, paymentStatus, order.order_id]);
    if (status === "rejected") await restockOrder(order.order_id);

    const STATUS_MESSAGE = {
      accepted: "Your order was accepted and is being prepared.",
      rejected: "Your order was rejected by the retailer.",
      fulfilled: "Your order has been delivered!",
    };
    notifyUser(order.member_id, { title: `Order #${order.order_id} update`, body: STATUS_MESSAGE[status], data: { type: "order_status", order_id: order.order_id } });

    res.json(await get("SELECT * FROM orders WHERE order_id = ?", [order.order_id]));
  } catch (e) { next(e); }
});

// PATCH /retailer/orders/:id/payment { received: boolean } — confirm (or un-confirm,
// if the UTR turned out not to match) a UPI payment against the retailer's own bank/UPI app.
router.patch("/orders/:id/payment", withRetailer, async (req, res, next) => {
  try {
    const order = await get("SELECT * FROM orders WHERE order_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.payment_method !== "upi") return res.status(400).json({ error: "This is a Cash on Delivery order" });
    if (["cancelled", "rejected"].includes(order.status)) return res.status(400).json({ error: "This order is closed" });

    const received = Boolean(req.body.received);
    await run("UPDATE orders SET payment_status = ? WHERE order_id = ?", [received ? "paid" : "pending", order.order_id]);
    notifyUser(order.member_id, {
      title: `Order #${order.order_id} payment`,
      body: received ? "The retailer confirmed your UPI payment. Thank you!" : "The retailer couldn't match your UPI payment. Please re-check the UTR and submit again.",
      data: { type: "order_payment", order_id: order.order_id },
    });
    res.json(await get("SELECT * FROM orders WHERE order_id = ?", [order.order_id]));
  } catch (e) { next(e); }
});

// GET /retailer/customers — everyone who's ordered here, with repeat-business stats.
router.get("/customers", withRetailer, async (req, res, next) => {
  try {
    res.json(await all(
      `SELECT u.user_id as member_id, u.full_name, u.phone,
              COUNT(o.order_id) as order_count,
              COUNT(o.order_id) FILTER (WHERE o.status = 'fulfilled') as fulfilled_count,
              COALESCE(SUM(o.order_total) FILTER (WHERE o.status = 'fulfilled'), 0) as total_spent,
              MAX(o.placed_at) as last_order_at,
              (SELECT ROUND(AVG(rv.rating)::numeric, 1) FROM reviews rv WHERE rv.retailer_id = o.retailer_id AND rv.member_id = u.user_id) as avg_rating
       FROM orders o JOIN users u ON u.user_id = o.member_id
       WHERE o.retailer_id = ?
       GROUP BY u.user_id, u.full_name, u.phone, o.retailer_id
       ORDER BY MAX(o.placed_at) DESC`,
      [req.retailer.retailer_id]
    ));
  } catch (e) { next(e); }
});

// GET /retailer/customers/:memberId — one customer's history with this shop
router.get("/customers/:memberId", withRetailer, async (req, res, next) => {
  try {
    const customer = await get("SELECT user_id as member_id, full_name, phone, address FROM users WHERE user_id = ?", [req.params.memberId]);
    const orders = await all(
      "SELECT * FROM orders WHERE retailer_id = ? AND member_id = ? ORDER BY placed_at DESC",
      [req.retailer.retailer_id, req.params.memberId]
    );
    if (!customer || !orders.length) return res.status(404).json({ error: "Customer not found" });
    const reviews = await all(
      "SELECT rating, comment, created_at, order_id FROM reviews WHERE retailer_id = ? AND member_id = ? ORDER BY created_at DESC",
      [req.retailer.retailer_id, req.params.memberId]
    );
    res.json({ customer, orders, reviews });
  } catch (e) { next(e); }
});

// GET /retailer/reports?from=YYYY-MM-DD&to=YYYY-MM-DD — sales, order, payment and stock
// reports in one call (defaults to the last 30 days).
router.get("/reports", withRetailer, async (req, res, next) => {
  try {
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || "") ? req.query.to : new Date().toISOString().slice(0, 10);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || "") ? req.query.from : new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const rid = req.retailer.retailer_id;
    const range = "o.retailer_id = ? AND o.placed_at::date BETWEEN ?::date AND ?::date";

    const sales = await get(
      `SELECT COALESCE(SUM(o.order_total),0) as gross, COALESCE(SUM(o.commission_amt),0) as commission,
              COALESCE(SUM(o.payout_amt),0) as net, COUNT(*) as order_count
       FROM orders o WHERE ${range} AND o.status = 'fulfilled'`, [rid, from, to]
    );
    const byStatusRows = await all(`SELECT o.status, COUNT(*) as count FROM orders o WHERE ${range} GROUP BY o.status`, [rid, from, to]);
    const orders_by_status = { placed: 0, accepted: 0, fulfilled: 0, rejected: 0, cancelled: 0 };
    byStatusRows.forEach((r) => { orders_by_status[r.status] = Number(r.count); });

    const top_products = await all(
      `SELECT p.name, SUM(oi.quantity) as quantity, SUM(oi.line_total) as revenue
       FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id
       WHERE ${range} AND o.status = 'fulfilled'
       GROUP BY p.product_id, p.name ORDER BY revenue DESC LIMIT 5`, [rid, from, to]
    );

    const payments = await get(
      `SELECT COALESCE(SUM(o.order_total) FILTER (WHERE o.payment_method = 'cod'),0) as cod_total,
              COALESCE(SUM(o.order_total) FILTER (WHERE o.payment_method = 'upi'),0) as upi_total,
              COALESCE(SUM(o.commission_amt) FILTER (WHERE o.commission_settled = 0),0) as commission_owed,
              COALESCE(SUM(o.commission_amt) FILTER (WHERE o.commission_settled = 1),0) as commission_settled,
              COUNT(*) FILTER (WHERE o.payment_method = 'upi' AND o.payment_status = 'submitted' AND o.status NOT IN ('cancelled','rejected')) as upi_awaiting_confirmation
       FROM orders o WHERE ${range} AND o.status = 'fulfilled'`, [rid, from, to]
    );

    const stockRows = await all("SELECT product_id, name, stock FROM products WHERE retailer_id = ? AND stock IS NOT NULL AND item_type = 'product' ORDER BY stock, name", [rid]);
    const stock = {
      tracked_count: stockRows.length,
      threshold: LOW_STOCK_THRESHOLD,
      out_of_stock: stockRows.filter((s) => s.stock === 0),
      low_stock: stockRows.filter((s) => s.stock > 0 && s.stock <= LOW_STOCK_THRESHOLD),
    };

    res.json({ from, to, sales, orders_by_status, top_products, payments, stock });
  } catch (e) { next(e); }
});

// GET /retailer/support · POST /retailer/support { category?, description } — the retailer's
// own help channel; lands in Admin's Complaint Desk alongside customer complaints.
router.get("/support", async (req, res, next) => {
  try { res.json(await all("SELECT * FROM complaints WHERE raised_by = ? ORDER BY created_at DESC", [req.auth.user_id])); } catch (e) { next(e); }
});
router.post("/support", async (req, res, next) => {
  try {
    const { category, description } = req.body;
    if (!description || !description.trim()) return res.status(400).json({ error: "Please describe the issue" });
    const result = await run(
      "INSERT INTO complaints (raised_by, category, description) VALUES (?, ?, ?) RETURNING complaint_id",
      [req.auth.user_id, category || "Retailer support", description.trim()]
    );
    res.json({ complaint_id: result.lastInsertRowid });
  } catch (e) { next(e); }
});

// GET /retailer/stock — every tracked product, lowest first (drives the Products tab's stock view)
router.get("/stock", withRetailer, async (req, res, next) => {
  try {
    const rows = await all(
      "SELECT product_id, name, stock FROM products WHERE retailer_id = ? AND stock IS NOT NULL AND item_type = 'product' ORDER BY stock, name",
      [req.retailer.retailer_id]
    );
    res.json({ threshold: LOW_STOCK_THRESHOLD, products: rows });
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

// GET /retailer/earnings/trend?days=30 — daily fulfilled-order sales, oldest first,
// zero-filled for days with no orders so a chart doesn't have to guess at gaps.
router.get("/earnings/trend", withRetailer, async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const rows = await all(
      `SELECT TO_CHAR(placed_at, 'YYYY-MM-DD') as day, COALESCE(SUM(order_total),0) as gross, COUNT(*) as order_count
       FROM orders
       WHERE retailer_id = ? AND status = 'fulfilled' AND placed_at >= NOW() - (? || ' days')::interval
       GROUP BY day ORDER BY day`,
      [req.retailer.retailer_id, days]
    );
    const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      result.push(byDay[d] || { day: d, gross: 0, order_count: 0 });
    }
    res.json(result);
  } catch (e) { next(e); }
});

// GET /retailer/reviews — this retailer's own reviews
router.get("/reviews", withRetailer, async (req, res, next) => {
  try {
    res.json(await all(
      `SELECT rv.rating, rv.comment, rv.created_at, u.full_name as member_name
       FROM reviews rv JOIN users u ON u.user_id = rv.member_id
       WHERE rv.retailer_id = ? ORDER BY rv.created_at DESC LIMIT 50`,
      [req.retailer.retailer_id]
    ));
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

// PATCH /retailer/products/:id { name, price, is_available, stock }
// stock: a whole number to (re)set the live count, null/"" to stop tracking it.
router.patch("/products/:id", withRetailer, async (req, res, next) => {
  try {
    const { name, price, is_available } = req.body;
    if (price !== undefined && price !== null && !(Number(price) > 0)) return res.status(400).json({ error: "price must be greater than 0" });
    const stock = parseStock(req.body.stock);
    if (!stock.ok) return res.status(400).json({ error: "Stock must be a whole number, 0 or more" });
    const product = await get("SELECT * FROM products WHERE product_id = ? AND retailer_id = ?", [req.params.id, req.retailer.retailer_id]);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const changeStock = !stock.skip && product.item_type !== "service";
    await run(
      `UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), is_available = COALESCE(?, is_available),
       stock = CASE WHEN ?::boolean THEN ?::integer ELSE stock END WHERE product_id = ?`,
      [name, price, is_available === undefined ? undefined : (is_available ? 1 : 0), changeStock, changeStock ? stock.value : null, req.params.id]
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

// PATCH /retailer/profile { address, hours, description, phone, bank_account, bank_ifsc, upi_id, delivery_methods }
// delivery_methods: array of pickup | self_delivery | gvcda_delivery — what customers may pick at checkout.
router.patch("/profile", withRetailer, async (req, res, next) => {
  try {
    const { address, hours, description, phone, bank_account, bank_ifsc, upi_id } = req.body;
    let deliveryMethods = null;
    if (req.body.delivery_methods !== undefined) {
      const list = Array.isArray(req.body.delivery_methods) ? req.body.delivery_methods : String(req.body.delivery_methods).split(",");
      const clean = [...new Set(list.map((s) => String(s).trim()))];
      if (!clean.length || clean.some((m) => !DELIVERY_METHODS.includes(m))) {
        return res.status(400).json({ error: "Choose at least one valid delivery option" });
      }
      deliveryMethods = clean.join(",");
    }
    await run(
      `UPDATE retailers SET address = COALESCE(?, address), hours = COALESCE(?, hours),
       description = COALESCE(?, description), phone = COALESCE(?, phone),
       bank_account = COALESCE(?, bank_account), bank_ifsc = COALESCE(?, bank_ifsc), upi_id = COALESCE(?, upi_id),
       delivery_methods = COALESCE(?, delivery_methods)
       WHERE retailer_id = ?`,
      [address, hours, description, phone, bank_account, bank_ifsc, upi_id, deliveryMethods, req.retailer.retailer_id]
    );
    const updated = await get("SELECT * FROM retailers WHERE retailer_id = ?", [req.retailer.retailer_id]);
    res.json({ retailer: { ...updated, delivery_methods: parseDeliveryMethods(updated.delivery_methods) } });
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
