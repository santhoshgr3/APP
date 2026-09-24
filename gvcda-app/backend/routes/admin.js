const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const { get, all, run } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const paymentRequests = require("../lib/paymentRequests");
const { getRecipientPushTokens } = require("../lib/broadcasts");
const { sendPush } = require("../lib/push");
const { notifyUser } = require("../lib/notify");
const { monthlyIncentive, employeeCode } = require("../lib/employees");
const { isDate, isEmail, MONTH_RE } = require("../lib/validate");

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
      `SELECT u.user_id, u.full_name, u.phone, u.designation, u.monthly_target, u.monthly_salary,
              COUNT(DISTINCT mem.membership_id) as memberships_sold,
              COUNT(DISTINCT r.retailer_id) as retailers_onboarded
       FROM users u
       LEFT JOIN memberships mem ON mem.sold_by_employee_id = u.user_id
       LEFT JOIN retailers r ON r.onboarding_employee_id = u.user_id
       WHERE u.role = 'employee'
       GROUP BY u.user_id ORDER BY memberships_sold DESC`
    );
    res.json(rows.map((r) => ({ ...r, employee_code: employeeCode(r.user_id) })));
  } catch (e) { next(e); }
});

// PATCH /admin/employees/:id { monthly_target?, monthly_salary? }
router.patch("/employees/:id", async (req, res, next) => {
  try {
    const { monthly_target, monthly_salary } = req.body;
    if (monthly_target !== undefined && !(Number.isInteger(Number(monthly_target)) && Number(monthly_target) >= 0)) return res.status(400).json({ error: "Target must be a whole number, 0 or more" });
    if (monthly_salary !== undefined && !(Number(monthly_salary) >= 0)) return res.status(400).json({ error: "Salary must be 0 or more" });
    const emp = await get("SELECT 1 FROM users WHERE user_id = ? AND role = 'employee'", [req.params.id]);
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    await run(
      "UPDATE users SET monthly_target = COALESCE(?, monthly_target), monthly_salary = COALESCE(?, monthly_salary) WHERE user_id = ?",
      [monthly_target ?? null, monthly_salary ?? null, req.params.id]
    );
    res.json(await get("SELECT user_id, full_name, monthly_target, monthly_salary FROM users WHERE user_id = ?", [req.params.id]));
  } catch (e) { next(e); }
});

// ---------------- Tasks ----------------

// GET /admin/tasks?employee_id=&status=
router.get("/tasks", async (req, res, next) => {
  try {
    const { employee_id, status } = req.query;
    let sql = `SELECT t.*, e.full_name as employee_name FROM tasks t JOIN users e ON e.user_id = t.assigned_to WHERE 1=1`;
    const params = [];
    if (employee_id) { sql += " AND t.assigned_to = ?"; params.push(employee_id); }
    if (status) { sql += " AND t.status = ?"; params.push(status); }
    sql += " ORDER BY (t.status = 'done'), t.due_date NULLS LAST, t.created_at DESC";
    res.json(await all(sql, params));
  } catch (e) { next(e); }
});

// POST /admin/tasks { assigned_to, title, description?, due_date?, priority? }
router.post("/tasks", async (req, res, next) => {
  try {
    const { assigned_to, title, description, due_date, priority } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ error: "Task title is required" });
    if (due_date && !isDate(due_date)) return res.status(400).json({ error: "Due date must be a valid date" });
    if (priority && !["low", "normal", "high"].includes(priority)) return res.status(400).json({ error: "Invalid priority" });
    const emp = await get("SELECT 1 FROM users WHERE user_id = ? AND role = 'employee' AND is_active = 1", [assigned_to]);
    if (!emp) return res.status(400).json({ error: "Choose an active employee to assign this to" });
    const r = await run(
      "INSERT INTO tasks (assigned_to, assigned_by, title, description, due_date, priority) VALUES (?, ?, ?, ?, ?, ?) RETURNING task_id",
      [assigned_to, req.auth.user_id, String(title).trim(), description ? String(description).trim() : null, due_date || null, priority || "normal"]
    );
    notifyUser(Number(assigned_to), { title: "New task assigned", body: `${String(title).trim()}${due_date ? ` — due ${due_date}` : ""}`, data: { type: "task" } });
    res.json(await get("SELECT * FROM tasks WHERE task_id = ?", [r.lastInsertRowid]));
  } catch (e) { next(e); }
});

// DELETE /admin/tasks/:id
router.delete("/tasks/:id", async (req, res, next) => {
  try {
    const r = await run("DELETE FROM tasks WHERE task_id = ?", [req.params.id]);
    if (!r.changes) return res.status(404).json({ error: "Task not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------------- Attendance & leave ----------------

// GET /admin/attendance?date=YYYY-MM-DD — every active employee's status for a day (default: today, IST)
router.get("/attendance", async (req, res, next) => {
  try {
    const date = isDate(req.query.date) ? req.query.date : null;
    const rows = await all(
      `SELECT u.user_id, u.full_name, u.designation, a.check_in_at, a.check_out_at, a.in_lat, a.in_lng,
              EXISTS(SELECT 1 FROM leave_requests l WHERE l.employee_id = u.user_id AND l.status = 'approved'
                     AND COALESCE(?::date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date) BETWEEN l.from_date AND l.to_date) as on_leave
       FROM users u
       LEFT JOIN attendance a ON a.employee_id = u.user_id AND a.work_date = COALESCE(?::date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
       WHERE u.role = 'employee' AND u.is_active = 1 ORDER BY u.full_name`,
      [date, date]
    );
    res.json(rows.map((r) => ({ ...r, status: r.check_in_at ? (r.check_out_at ? "checked_out" : "checked_in") : (r.on_leave ? "on_leave" : "absent") })));
  } catch (e) { next(e); }
});

// GET /admin/leaves?status=pending
router.get("/leaves", async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `SELECT l.*, e.full_name as employee_name FROM leave_requests l JOIN users e ON e.user_id = l.employee_id WHERE 1=1`;
    const params = [];
    if (status) { sql += " AND l.status = ?"; params.push(status); }
    sql += " ORDER BY (l.status = 'pending') DESC, l.created_at DESC";
    res.json(await all(sql, params));
  } catch (e) { next(e); }
});

// PATCH /admin/leaves/:id { status: approved|rejected, note? }
router.patch("/leaves/:id", async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Status must be approved or rejected" });
    const leave = await get("SELECT * FROM leave_requests WHERE leave_id = ?", [req.params.id]);
    if (!leave) return res.status(404).json({ error: "Leave request not found" });
    if (leave.status !== "pending") return res.status(400).json({ error: `This request was already ${leave.status}` });
    await run("UPDATE leave_requests SET status = ?, decided_by = ?, decision_note = ? WHERE leave_id = ?", [status, req.auth.user_id, note || null, leave.leave_id]);
    notifyUser(leave.employee_id, { title: `Leave ${status}`, body: `Your leave request is ${status}.${note ? ` Note: ${note}` : ""}`, data: { type: "leave" } });
    res.json(await get("SELECT * FROM leave_requests WHERE leave_id = ?", [leave.leave_id]));
  } catch (e) { next(e); }
});

// ---------------- Salary ----------------

// GET /admin/salary-payments?month=YYYY-MM — payments recorded (all months if omitted)
router.get("/salary-payments", async (req, res, next) => {
  try {
    const { month } = req.query;
    let sql = "SELECT sp.*, e.full_name as employee_name FROM salary_payments sp JOIN users e ON e.user_id = sp.employee_id WHERE 1=1";
    const params = [];
    if (month) { sql += " AND sp.month = ?"; params.push(month); }
    sql += " ORDER BY sp.month DESC, e.full_name";
    res.json(await all(sql, params));
  } catch (e) { next(e); }
});

// GET /admin/salary-preview?employee_id=&month= — what a payment for that month would be
// (fixed salary + that month's earned incentive), for Admin to review before recording it.
router.get("/salary-preview", async (req, res, next) => {
  try {
    const month = MONTH_RE.test(req.query.month || "") ? req.query.month : new Date().toISOString().slice(0, 7);
    const emp = await get("SELECT user_id, full_name, monthly_salary FROM users WHERE user_id = ? AND role = 'employee'", [req.query.employee_id]);
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    const inc = await monthlyIncentive(emp.user_id, month);
    const paid = await get("SELECT 1 FROM salary_payments WHERE employee_id = ? AND month = ?", [emp.user_id, month]);
    res.json({ employee: emp, month, base_amount: emp.monthly_salary, incentive_amount: inc.total, incentive: inc, already_paid: Boolean(paid) });
  } catch (e) { next(e); }
});

// POST /admin/salary-payments { employee_id, month, base_amount?, incentive_amount?, deductions?, reference?, notes?, paid_on? }
// Records that a month's salary was paid (outside the app — bank transfer/cash). Defaults
// come from the preview above; one payment per employee per month.
router.post("/salary-payments", async (req, res, next) => {
  try {
    const { employee_id, month, reference, notes, paid_on } = req.body;
    if (!MONTH_RE.test(month || "")) return res.status(400).json({ error: "Month must look like 2026-09" });
    if (paid_on && !isDate(paid_on)) return res.status(400).json({ error: "Paid-on date must be a valid date" });
    const emp = await get("SELECT user_id, full_name, monthly_salary FROM users WHERE user_id = ? AND role = 'employee'", [employee_id]);
    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const inc = await monthlyIncentive(emp.user_id, month);
    const base = req.body.base_amount !== undefined ? Number(req.body.base_amount) : emp.monthly_salary;
    const incentive = req.body.incentive_amount !== undefined ? Number(req.body.incentive_amount) : inc.total;
    const deductions = req.body.deductions !== undefined ? Number(req.body.deductions) : 0;
    if ([base, incentive, deductions].some((n) => !Number.isFinite(n) || n < 0)) return res.status(400).json({ error: "Amounts must be 0 or more" });
    const total = base + incentive - deductions;
    if (total < 0) return res.status(400).json({ error: "Deductions can't exceed the amount due" });

    const dupe = await get("SELECT 1 FROM salary_payments WHERE employee_id = ? AND month = ?", [emp.user_id, month]);
    if (dupe) return res.status(409).json({ error: `${emp.full_name}'s ${month} salary is already recorded` });

    const r = await run(
      `INSERT INTO salary_payments (employee_id, month, base_amount, incentive_amount, deductions, total, paid_on, reference, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?::date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date), ?, ?, ?) RETURNING payment_id`,
      [emp.user_id, month, base, incentive, deductions, total, paid_on || null, reference || null, notes || null, req.auth.user_id]
    );
    notifyUser(emp.user_id, { title: "Salary paid", body: `Your ${month} salary of ₹${total} has been recorded as paid.`, data: { type: "salary" } });
    res.json(await get("SELECT * FROM salary_payments WHERE payment_id = ?", [r.lastInsertRowid]));
  } catch (e) { next(e); }
});

// ---------------- GVCDA-delivery orders ----------------

// GET /admin/gvcda-deliveries — open orders customers chose "GVCDA Delivery" for,
// so whoever runs GVCDA's own delivery can see what needs collecting and dropping off.
router.get("/gvcda-deliveries", async (req, res, next) => {
  try {
    res.json(await all(
      `SELECT o.order_id, o.status, o.order_total, o.payment_method, o.delivery_address, o.delivery_phone, o.placed_at,
              r.business_name, r.address as pickup_address, r.phone as retailer_phone, u.full_name as member_name
       FROM orders o JOIN retailers r ON r.retailer_id = o.retailer_id JOIN users u ON u.user_id = o.member_id
       WHERE o.delivery_method = 'gvcda_delivery' AND o.status IN ('placed','accepted')
       ORDER BY o.placed_at`
    ));
  } catch (e) { next(e); }
});

// GET /admin/complaints
router.get("/complaints", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT c.*, u.full_name as raised_by_name, u.role as raised_by_role, u.phone as raised_by_phone, r.business_name as against_retailer_name
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

    // Push notification is on top of the in-app Announcements feed (see
    // lib/broadcasts.js) — best-effort, never blocks the response on failure.
    getRecipientPushTokens({ target_scope: target_scope || "all", target_district_id, target_mandal_id })
      .then((tokens) => sendPush(tokens, { title: "GVCDA Announcement", body: message, data: { type: "broadcast" } }))
      .catch((e) => console.error("Broadcast push failed:", e.message));

    res.json(await get("SELECT * FROM broadcasts WHERE broadcast_id = ?", [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

// GET /admin/users — user & role management list
router.get("/users", async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT u.user_id, u.full_name, u.phone, u.email, u.role, u.designation, u.is_active, u.created_at,
              d.name as district_name, m.name as mandal_name
       FROM users u
       LEFT JOIN districts d ON d.district_id = u.territory_district_id
       LEFT JOIN mandals m ON m.mandal_id = u.territory_mandal_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

const USER_PHONE_RE = /^\d{10}$/;

// POST /admin/users { phone, full_name, role, password, designation?, territory_district_id?, territory_mandal_id?, village_id? }
// Admin-created account for ANY role — Employee, Member, Retailer, or another
// Admin. `password` is the temporary login password Admin hands to the new
// user; they can change it later via /auth/change-password. `designation` is
// required only for role='employee' (territory fields stay optional there
// too — a District Manager might not have one mandal). For role='retailer',
// this only creates the login — no business listing exists yet, so the
// person lands on the same "register your business" form a self-signup
// retailer would see the first time they log in.
router.post("/users", async (req, res, next) => {
  try {
    const { phone, full_name, role, password, designation, territory_district_id, territory_mandal_id, village_id, email, monthly_salary } = req.body;
    if (!phone || !USER_PHONE_RE.test(phone)) return res.status(400).json({ error: "Valid 10-digit phone number required" });
    if (email && !isEmail(email)) return res.status(400).json({ error: "Enter a valid email address" });
    if (monthly_salary !== undefined && monthly_salary !== "" && !(Number(monthly_salary) >= 0)) return res.status(400).json({ error: "Salary must be 0 or more" });
    if (!full_name) return res.status(400).json({ error: "full_name required" });
    if (!["member", "employee", "retailer", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    if (role === "employee" && !designation) return res.status(400).json({ error: "designation required for an employee account" });
    if (!password || password.length < 6) return res.status(400).json({ error: "A temporary password (min 6 characters) is required" });

    const existing = await get("SELECT 1 FROM users WHERE phone = ?", [phone]);
    if (existing) return res.status(409).json({ error: "An account with this phone number already exists" });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await run(
      `INSERT INTO users (phone, password_hash, full_name, role, village_id, designation, territory_district_id, territory_mandal_id, email, monthly_salary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING user_id`,
      [phone, password_hash, full_name, role, village_id || null, role === "employee" ? designation : null, territory_district_id || null, territory_mandal_id || null,
       email ? email.trim().toLowerCase() : null, role === "employee" && monthly_salary ? Number(monthly_salary) : 0]
    );
    await run("INSERT INTO user_roles (user_id, role) VALUES (?, ?) ON CONFLICT DO NOTHING", [result.lastInsertRowid, role]);

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
