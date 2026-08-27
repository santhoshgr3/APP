const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const { get, all, run } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const paymentRequests = require("../lib/paymentRequests");

router.use(requireAuth, requireRole("admin"));

// GET /admin/overview
router.get("/overview", async (req, res, next) => {
  try {
    const members = (await get("SELECT COUNT(*) c FROM users WHERE role = 'member'")).c;
    const retailers = (await get("SELECT COUNT(*) c FROM retailers WHERE status = 'approved'")).c;
    const revenue = (await get("SELECT COALESCE(SUM(amount_paid),0) r FROM memberships")).r;
    const openComplaints = (await get("SELECT COUNT(*) c FROM complaints WHERE status = 'open'")).c;
    res.json({ members: Number(members), retailers: Number(retailers), revenue: Number(revenue), open_complaints: Number(openComplaints) });
  } catch (e) { next(e); }
});

// GET /admin/retailers/pending
router.get("/retailers/pending", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT r.*, v.name as village_name, c.name as category_name, u.phone,
              e.full_name as submitted_by_name
       FROM retailers r
       JOIN villages v ON v.village_id = r.village_id
       JOIN retailer_categories c ON c.category_id = r.category_id
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN users e ON e.user_id = r.onboarding_employee_id
       WHERE r.status = 'pending' ORDER BY r.created_at`
    );
    const photosByRetailer = await all("SELECT * FROM retailer_photos ORDER BY is_primary DESC, created_at");
    res.json(rows.map((r) => ({ ...r, photos: photosByRetailer.filter((p) => p.retailer_id === r.retailer_id) })));
  } catch (e) { next(e); }
});

// PATCH /admin/retailers/:id { status: approved|rejected, reason? }
router.patch("/retailers/:id", async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    await run("UPDATE retailers SET status = ?, rejection_reason = ? WHERE retailer_id = ?",
      [status, status === "rejected" ? (reason || null) : null, req.params.id]);
    res.json(await get("SELECT * FROM retailers WHERE retailer_id = ?", [req.params.id]));
  } catch (e) { next(e); }
});

// GET /admin/territory — district > mandal rollup of members, retailers, revenue
router.get("/territory", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT d.name as district, m.name as mandal,
              COUNT(DISTINCT u.user_id) as members,
              COUNT(DISTINCT r.retailer_id) as retailers,
              COALESCE(SUM(mem.amount_paid), 0) as revenue
       FROM mandals m
       JOIN districts d ON d.district_id = m.district_id
       LEFT JOIN villages v ON v.mandal_id = m.mandal_id
       LEFT JOIN users u ON u.village_id = v.village_id AND u.role = 'member'
       LEFT JOIN retailers r ON r.village_id = v.village_id AND r.status = 'approved'
       LEFT JOIN memberships mem ON mem.user_id = u.user_id
       GROUP BY d.name, m.name ORDER BY d.name, m.name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /admin/employees — performance leaderboard
router.get("/employees", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT u.user_id, u.full_name, u.designation,
              COUNT(DISTINCT mem.membership_id) as memberships_sold,
              COUNT(DISTINCT r.retailer_id) as retailers_onboarded
       FROM users u
       LEFT JOIN memberships mem ON mem.sold_by_employee_id = u.user_id
       LEFT JOIN retailers r ON r.onboarding_employee_id = u.user_id
       WHERE u.role = 'employee'
       GROUP BY u.user_id ORDER BY memberships_sold DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /admin/complaints
router.get("/complaints", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT c.*, u.full_name as raised_by_name, r.business_name as against_retailer_name
       FROM complaints c
       JOIN users u ON u.user_id = c.raised_by
       LEFT JOIN retailers r ON r.retailer_id = c.against_retailer_id
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// PATCH /admin/complaints/:id { status: in_review|resolved|closed, resolution_notes? }
router.patch("/complaints/:id", async (req, res, next) => {
  try {
    const { status, resolution_notes } = req.body;
    if (!["open", "in_review", "resolved", "closed"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    await run("UPDATE complaints SET status = ?, resolution_notes = COALESCE(?, resolution_notes), resolved_by = ? WHERE complaint_id = ?",
      [status, resolution_notes, req.auth.user_id, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /admin/revenue?from=&to= — membership vs commission revenue split
router.get("/revenue", async (req, res, next) => {
  try {
    const membership = await all(
      `SELECT mp.name as plan_name, COUNT(*) as count, COALESCE(SUM(m.amount_paid),0) as total
       FROM memberships m JOIN membership_plans mp ON mp.plan_id = m.plan_id
       GROUP BY mp.name`
    );
    const commission = await all(
      `SELECT c.name as category_name, COUNT(o.order_id) as order_count,
              COALESCE(SUM(o.order_total),0) as gross, COALESCE(SUM(o.commission_amt),0) as commission
       FROM orders o
       JOIN retailers r ON r.retailer_id = o.retailer_id
       JOIN retailer_categories c ON c.category_id = r.category_id
       WHERE o.status = 'fulfilled'
       GROUP BY c.name`
    );
    res.json({ membership, commission });
  } catch (e) { next(e); }
});

// GET /admin/sectors — sector-wise engagement (orders + retailer count per category)
router.get("/sectors", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT c.name as category_name,
              COUNT(DISTINCT r.retailer_id) as retailer_count,
              COUNT(DISTINCT o.order_id) as order_count
       FROM retailer_categories c
       LEFT JOIN retailers r ON r.category_id = c.category_id AND r.status = 'approved'
       LEFT JOIN orders o ON o.retailer_id = r.retailer_id
       GROUP BY c.name ORDER BY order_count DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /admin/broadcasts
router.get("/broadcasts", async (req, res, next) => {
  try {
    res.json(await all(
      `SELECT b.*, d.name as district_name, m.name as mandal_name FROM broadcasts b
       LEFT JOIN districts d ON d.district_id = b.target_district_id
       LEFT JOIN mandals m ON m.mandal_id = b.target_mandal_id
       ORDER BY b.created_at DESC`
    ));
  } catch (e) { next(e); }
});

// POST /admin/broadcasts { message, target_scope, target_district_id?, target_mandal_id? }
router.post("/broadcasts", async (req, res, next) => {
  try {
    const { message, target_scope, target_district_id, target_mandal_id } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    let recipientCount;
    if (target_scope === "district" && target_district_id) {
      recipientCount = (await get(
        `SELECT COUNT(*) c FROM users u JOIN villages v ON v.village_id = u.village_id
         JOIN mandals m ON m.mandal_id = v.mandal_id WHERE m.district_id = ?`,
        [target_district_id]
      )).c;
    } else if (target_scope === "mandal" && target_mandal_id) {
      recipientCount = (await get(
        `SELECT COUNT(*) c FROM users u JOIN villages v ON v.village_id = u.village_id WHERE v.mandal_id = ?`,
        [target_mandal_id]
      )).c;
    } else {
      recipientCount = (await get("SELECT COUNT(*) c FROM users")).c;
    }

    const result = await run(
      `INSERT INTO broadcasts (message, target_scope, target_district_id, target_mandal_id, sent_by, recipient_count)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING broadcast_id`,
      [message, target_scope || "all", target_district_id || null, target_mandal_id || null, req.auth.user_id, recipientCount]
    );

    res.json(await get("SELECT * FROM broadcasts WHERE broadcast_id = ?", [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

// GET /admin/users — user & role management list
router.get("/users", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT u.user_id, u.full_name, u.phone, u.role, u.designation, u.is_active, u.created_at,
              d.name as district_name, m.name as mandal_name
       FROM users u
       LEFT JOIN districts d ON d.district_id = u.territory_district_id
       LEFT JOIN mandals m ON m.mandal_id = u.territory_mandal_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /admin/users { phone, full_name, designation, territory_district_id, territory_mandal_id, village_id, password }
// Admin-created employee account. `password` is the temporary login password Admin
// hands to the new employee — they can change it later via /auth/change-password.
router.post("/users", async (req, res, next) => {
  try {
    const { phone, full_name, designation, territory_district_id, territory_mandal_id, village_id, password } = req.body;
    if (!phone || !full_name || !designation) return res.status(400).json({ error: "phone, full_name and designation required" });
    if (!password || password.length < 6) return res.status(400).json({ error: "A temporary password (min 6 characters) is required" });

    let user = await get("SELECT * FROM users WHERE phone = ?", [phone]);
    if (user) return res.status(409).json({ error: "An account with this phone number already exists" });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await run(
      `INSERT INTO users (phone, password_hash, full_name, role, village_id, designation, territory_district_id, territory_mandal_id)
       VALUES (?, ?, ?, 'employee', ?, ?, ?, ?) RETURNING user_id`,
      [phone, password_hash, full_name, village_id || null, designation, territory_district_id || null, territory_mandal_id || null]
    );
    await run("INSERT INTO user_roles (user_id, role) VALUES (?, 'employee') ON CONFLICT DO NOTHING", [result.lastInsertRowid]);

    res.json(await get("SELECT * FROM users WHERE user_id = ?", [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

// PATCH /admin/users/:id { is_active }
router.patch("/users/:id", async (req, res, next) => {
  try {
    const { is_active } = req.body;
    if (Number(req.params.id) === req.auth.user_id) return res.status(400).json({ error: "You can't deactivate your own account" });
    const existing = await get("SELECT 1 FROM users WHERE user_id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "User not found" });
    await run("UPDATE users SET is_active = ? WHERE user_id = ?", [is_active ? 1 : 0, req.params.id]);
    res.json(await get("SELECT * FROM users WHERE user_id = ?", [req.params.id]));
  } catch (e) { next(e); }
});

// GET /admin/payment-requests?status=submitted&type=membership
// The manual-verification queue: every membership and commission-settlement
// bank/UPI transfer waits here until an Admin cross-checks the reference
// code/UTR against the actual bank statement and approves it.
router.get("/payment-requests", async (req, res, next) => {
  try {
    const { status, type } = req.query;
    let sql = `SELECT pr.*, u.full_name as user_name, u.phone as user_phone,
                      mp.name as plan_name, r.business_name as retailer_name
               FROM payment_requests pr
               JOIN users u ON u.user_id = pr.user_id
               LEFT JOIN membership_plans mp ON mp.plan_id = pr.plan_id
               LEFT JOIN retailers r ON r.retailer_id = pr.retailer_id
               WHERE 1=1`;
    const params = [];
    if (status) { sql += " AND pr.status = ?"; params.push(status); }
    if (type) { sql += " AND pr.type = ?"; params.push(type); }
    sql += " ORDER BY pr.created_at DESC";
    res.json(await all(sql, params));
  } catch (e) { next(e); }
});

// PATCH /admin/payment-requests/:id { approve: boolean, reason? }
// Approving a membership request creates the membership; approving a
// commission-settlement request marks its orders as settled.
router.patch("/payment-requests/:id", async (req, res) => {
  const { approve, reason } = req.body;
  try {
    res.json(await paymentRequests.resolveRequest(req.params.id, req.auth.user_id, { approve: !!approve, reason }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
