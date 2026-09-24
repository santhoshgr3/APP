const express = require("express");
const router = express.Router();
const { get, all, run } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const broadcasts = require("../lib/broadcasts");
const { notifyUser } = require("../lib/notify");
const { isDate, MONTH_RE } = require("../lib/validate");
const { monthlyIncentive, employeeCode } = require("../lib/employees");

const PHONE_RE = /^\d{10}$/;
// "Today" for attendance is the Indian calendar day, not the server's (UTC) one.
const TODAY_IST = "(NOW() AT TIME ZONE 'Asia/Kolkata')::date";

function notifyAdmins(payload) {
  all("SELECT user_id FROM users WHERE role = 'admin' AND is_active = 1")
    .then((rows) => rows.forEach((a) => notifyUser(a.user_id, payload)))
    .catch((e) => console.error("notifyAdmins failed:", e.message));
}

router.use(requireAuth, requireRole("employee"));

// GET /employee/broadcasts — announcements targeted at this employee's territory, or all of Telangana
router.get("/broadcasts", async (req, res, next) => {
  try { res.json(await broadcasts.getVisibleBroadcasts(req.auth.user_id)); } catch (e) { next(e); }
});

// GET /employee/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    const empId = req.auth.user_id;
    const membershipsSold = (await get("SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ?", [empId])).c;
    const retailersListed = (await get("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ?", [empId])).c;
    const retailersPending = (await get("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'pending'", [empId])).c;
    const employee = await get(
      `SELECT u.*, d.name as district_name, m.name as mandal_name
       FROM users u
       LEFT JOIN districts d ON d.district_id = u.territory_district_id
       LEFT JOIN mandals m ON m.mandal_id = u.territory_mandal_id
       WHERE u.user_id = ?`,
      [empId]
    );
    const inc = await monthlyIncentive(empId);
    const retailersThisMonth = Number((await get(
      "SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND TO_CHAR(created_at, 'YYYY-MM') = ?",
      [empId, inc.month]
    )).c);
    const today = await get(`SELECT * FROM attendance WHERE employee_id = ? AND work_date = ${TODAY_IST}`, [empId]);
    const openTasks = Number((await get("SELECT COUNT(*) c FROM tasks WHERE assigned_to = ? AND status <> 'done'", [empId])).c);
    res.json({
      employee: { ...employee, employee_code: employeeCode(empId) },
      memberships_sold: Number(membershipsSold),
      retailers_listed: Number(retailersListed),
      retailers_pending: Number(retailersPending),
      monthly_target: employee.monthly_target,
      // Target progress counts what was achieved THIS month (memberships sold + retailers listed).
      month_progress: inc.membership_count + retailersThisMonth,
      today_attendance: today || null,
      open_tasks: openTasks,
    });
  } catch (e) { next(e); }
});

// ---------------- Attendance ----------------

// GET /employee/attendance?month=YYYY-MM — this month's log + today's status
router.get("/attendance", async (req, res, next) => {
  try {
    const month = MONTH_RE.test(req.query.month || "") ? req.query.month : new Date().toISOString().slice(0, 7);
    const records = await all(
      "SELECT * FROM attendance WHERE employee_id = ? AND TO_CHAR(work_date, 'YYYY-MM') = ? ORDER BY work_date DESC",
      [req.auth.user_id, month]
    );
    const today = await get(`SELECT * FROM attendance WHERE employee_id = ? AND work_date = ${TODAY_IST}`, [req.auth.user_id]);
    // Approved leave that overlaps this month, counted only for the days inside it.
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const leaves = await all(
      "SELECT TO_CHAR(from_date, 'YYYY-MM-DD') as f, TO_CHAR(to_date, 'YYYY-MM-DD') as t FROM leave_requests WHERE employee_id = ? AND status = 'approved' AND from_date <= ?::date AND to_date >= ?::date",
      [req.auth.user_id, monthEnd, monthStart]
    );
    const approvedLeaveDays = leaves.reduce((sum, l) => {
      const start = l.f > monthStart ? l.f : monthStart;
      const end = l.t < monthEnd ? l.t : monthEnd;
      return sum + Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    }, 0);
    res.json({ month, today: today || null, records, summary: { days_present: records.length, approved_leave_days: approvedLeaveDays } });
  } catch (e) { next(e); }
});

// POST /employee/attendance/check-in { lat?, lng? }
router.post("/attendance/check-in", async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const existing = await get(`SELECT 1 FROM attendance WHERE employee_id = ? AND work_date = ${TODAY_IST}`, [req.auth.user_id]);
    if (existing) return res.status(409).json({ error: "You've already checked in today" });
    const r = await run(
      `INSERT INTO attendance (employee_id, work_date, in_lat, in_lng) VALUES (?, ${TODAY_IST}, ?, ?) RETURNING attendance_id`,
      [req.auth.user_id, lat ?? null, lng ?? null]
    );
    res.json(await get("SELECT * FROM attendance WHERE attendance_id = ?", [r.lastInsertRowid]));
  } catch (e) { next(e); }
});

// POST /employee/attendance/check-out { lat?, lng? }
router.post("/attendance/check-out", async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const today = await get(`SELECT * FROM attendance WHERE employee_id = ? AND work_date = ${TODAY_IST}`, [req.auth.user_id]);
    if (!today) return res.status(400).json({ error: "You haven't checked in today" });
    if (today.check_out_at) return res.status(409).json({ error: "You've already checked out today" });
    await run("UPDATE attendance SET check_out_at = NOW(), out_lat = ?, out_lng = ? WHERE attendance_id = ?", [lat ?? null, lng ?? null, today.attendance_id]);
    res.json(await get("SELECT * FROM attendance WHERE attendance_id = ?", [today.attendance_id]));
  } catch (e) { next(e); }
});

// ---------------- Leave ----------------

// GET /employee/leaves
router.get("/leaves", async (req, res, next) => {
  try { res.json(await all("SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC", [req.auth.user_id])); } catch (e) { next(e); }
});

// POST /employee/leaves { from_date, to_date, leave_type?, reason? }
router.post("/leaves", async (req, res, next) => {
  try {
    const { from_date, to_date, leave_type, reason } = req.body;
    if (!isDate(from_date) || !isDate(to_date)) return res.status(400).json({ error: "Choose valid from and to dates" });
    if (to_date < from_date) return res.status(400).json({ error: "The end date can't be before the start date" });
    if ((Date.parse(to_date) - Date.parse(from_date)) / 86400000 > 60) return res.status(400).json({ error: "A single leave request can cover at most 60 days" });
    const type = leave_type || "casual";
    if (!["casual", "sick", "earned", "unpaid"].includes(type)) return res.status(400).json({ error: "Invalid leave type" });

    const overlap = await get(
      "SELECT 1 FROM leave_requests WHERE employee_id = ? AND status IN ('pending','approved') AND from_date <= ?::date AND to_date >= ?::date",
      [req.auth.user_id, to_date, from_date]
    );
    if (overlap) return res.status(409).json({ error: "You already have a leave request covering some of these dates" });

    const r = await run(
      "INSERT INTO leave_requests (employee_id, from_date, to_date, leave_type, reason) VALUES (?, ?, ?, ?, ?) RETURNING leave_id",
      [req.auth.user_id, from_date, to_date, type, reason ? String(reason).trim().slice(0, 500) : null]
    );
    const me = await get("SELECT full_name FROM users WHERE user_id = ?", [req.auth.user_id]);
    notifyAdmins({ title: "Leave request", body: `${me.full_name} requested ${type} leave: ${from_date} to ${to_date}.`, data: { type: "leave_request" } });
    res.json(await get("SELECT * FROM leave_requests WHERE leave_id = ?", [r.lastInsertRowid]));
  } catch (e) { next(e); }
});

// DELETE /employee/leaves/:id — withdraw a request that hasn't been decided yet
router.delete("/leaves/:id", async (req, res, next) => {
  try {
    const leave = await get("SELECT * FROM leave_requests WHERE leave_id = ? AND employee_id = ?", [req.params.id, req.auth.user_id]);
    if (!leave) return res.status(404).json({ error: "Leave request not found" });
    if (leave.status !== "pending") return res.status(400).json({ error: "Only a pending request can be withdrawn" });
    await run("DELETE FROM leave_requests WHERE leave_id = ?", [leave.leave_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------------- Tasks ----------------

// GET /employee/tasks — assigned to me, open first, then by due date
router.get("/tasks", async (req, res, next) => {
  try {
    res.json(await all(
      `SELECT t.*, a.full_name as assigned_by_name FROM tasks t LEFT JOIN users a ON a.user_id = t.assigned_by
       WHERE t.assigned_to = ?
       ORDER BY (t.status = 'done'), t.due_date NULLS LAST, t.created_at DESC`,
      [req.auth.user_id]
    ));
  } catch (e) { next(e); }
});

// PATCH /employee/tasks/:id { status: pending|in_progress|done }
router.patch("/tasks/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["pending", "in_progress", "done"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const task = await get("SELECT * FROM tasks WHERE task_id = ? AND assigned_to = ?", [req.params.id, req.auth.user_id]);
    if (!task) return res.status(404).json({ error: "Task not found" });
    await run("UPDATE tasks SET status = ?, completed_at = CASE WHEN ? = 'done' THEN NOW() ELSE NULL END WHERE task_id = ?", [status, status, task.task_id]);
    res.json(await get("SELECT * FROM tasks WHERE task_id = ?", [task.task_id]));
  } catch (e) { next(e); }
});

// ---------------- Salary ----------------

// GET /employee/salary — fixed monthly salary, this month's running incentive, and every payment made
router.get("/salary", async (req, res, next) => {
  try {
    const me = await get("SELECT monthly_salary FROM users WHERE user_id = ?", [req.auth.user_id]);
    const history = await all("SELECT * FROM salary_payments WHERE employee_id = ? ORDER BY month DESC", [req.auth.user_id]);
    res.json({ monthly_salary: me.monthly_salary, current_incentive: await monthlyIncentive(req.auth.user_id), history });
  } catch (e) { next(e); }
});

// ---------------- Help & support ----------------

// GET /employee/support · POST /employee/support { category?, description } — lands in Admin's Complaint Desk
router.get("/support", async (req, res, next) => {
  try { res.json(await all("SELECT * FROM complaints WHERE raised_by = ? ORDER BY created_at DESC", [req.auth.user_id])); } catch (e) { next(e); }
});
router.post("/support", async (req, res, next) => {
  try {
    const { category, description } = req.body;
    if (!description || !description.trim()) return res.status(400).json({ error: "Please describe the issue" });
    const r = await run(
      "INSERT INTO complaints (raised_by, category, description) VALUES (?, ?, ?) RETURNING complaint_id",
      [req.auth.user_id, category || "Employee support", description.trim()]
    );
    res.json({ complaint_id: r.lastInsertRowid });
  } catch (e) { next(e); }
});

// POST /employee/enrol-member { full_name, phone, village_id, plan_id, payment_method }
router.post("/enrol-member", async (req, res, next) => {
  try {
    const { full_name, phone, village_id, plan_id, payment_method } = req.body;
    if (!full_name || !phone || !village_id || !plan_id) return res.status(400).json({ error: "Missing required fields" });
    if (!PHONE_RE.test(phone)) return res.status(400).json({ error: "Valid 10-digit phone number required" });

    const plan = await get("SELECT * FROM membership_plans WHERE plan_id = ?", [plan_id]);
    if (!plan) return res.status(400).json({ error: "Invalid membership plan" });
    const village = await get("SELECT 1 FROM villages WHERE village_id = ?", [village_id]);
    if (!village) return res.status(400).json({ error: "Invalid village" });

    let user = await get("SELECT * FROM users WHERE phone = ?", [phone]);
    if (!user) {
      const r = await run("INSERT INTO users (phone, full_name, role, village_id) VALUES (?, ?, 'member', ?) RETURNING user_id", [phone, full_name, village_id]);
      user = await get("SELECT * FROM users WHERE user_id = ?", [r.lastInsertRowid]);
    }
    // Grant the member role even if this phone already belonged to someone with a
    // different role (e.g. an existing Retailer buying a membership too) — without
    // this, their membership row would exist but they'd have no way to reach the
    // Member screens or see it in the Role Switcher.
    await run("INSERT INTO user_roles (user_id, role) VALUES (?, 'member') ON CONFLICT DO NOTHING", [user.user_id]);

    const cardNumber = "GVC-" + Math.floor(100000 + Math.random() * 900000);
    const result = await run(
      `INSERT INTO memberships (user_id, plan_id, card_number, start_date, end_date, amount_paid, sold_by_employee_id)
       VALUES (?, ?, ?, CURRENT_DATE, (CURRENT_DATE + INTERVAL '365 days')::date, ?, ?) RETURNING membership_id`,
      [user.user_id, plan_id, cardNumber, plan.price, req.auth.user_id]
    );

    const membership = await get("SELECT * FROM memberships WHERE membership_id = ?", [result.lastInsertRowid]);
    res.json({ user, membership, payment_method });
  } catch (e) { next(e); }
});

// POST /employee/list-retailer { business_name, category_id, village_id, phone }
router.post("/list-retailer", async (req, res, next) => {
  try {
    const { business_name, category_id, village_id, phone } = req.body;
    if (!business_name || !category_id || !village_id || !phone) return res.status(400).json({ error: "Missing required fields" });
    if (!PHONE_RE.test(phone)) return res.status(400).json({ error: "Valid 10-digit phone number required" });

    const category = await get("SELECT 1 FROM retailer_categories WHERE category_id = ?", [category_id]);
    if (!category) return res.status(400).json({ error: "Invalid category" });
    const village = await get("SELECT 1 FROM villages WHERE village_id = ?", [village_id]);
    if (!village) return res.status(400).json({ error: "Invalid village" });

    // Reuse an existing account if this phone already belongs to one (e.g. an
    // existing Member also being onboarded as a Retailer) — same dual-role
    // pattern as /retailer/register's self-service path.
    let user = await get("SELECT * FROM users WHERE phone = ?", [phone]);
    if (!user) {
      const r = await run("INSERT INTO users (phone, full_name, role, village_id) VALUES (?, ?, 'retailer', ?) RETURNING user_id", [phone, business_name, village_id]);
      user = await get("SELECT * FROM users WHERE user_id = ?", [r.lastInsertRowid]);
    }
    await run("INSERT INTO user_roles (user_id, role) VALUES (?, 'retailer') ON CONFLICT DO NOTHING", [user.user_id]);

    const result = await run(
      `INSERT INTO retailers (user_id, business_name, category_id, village_id, phone, onboarded_by, onboarding_employee_id, status)
       VALUES (?, ?, ?, ?, ?, 'employee', ?, 'pending') RETURNING retailer_id`,
      [user.user_id, business_name, category_id, village_id, phone, req.auth.user_id]
    );

    const retailer = await get("SELECT * FROM retailers WHERE retailer_id = ?", [result.lastInsertRowid]);
    res.json({ retailer });
  } catch (e) { next(e); }
});

// GET /employee/members — members this employee enrolled
router.get("/members", async (req, res, next) => {
  try {
    const members = await all(
      `SELECT u.user_id, u.full_name, u.phone, v.name as village_name, m.status, mp.name as plan_name, m.created_at
       FROM memberships m
       JOIN users u ON u.user_id = m.user_id
       JOIN membership_plans mp ON mp.plan_id = m.plan_id
       LEFT JOIN villages v ON v.village_id = u.village_id
       WHERE m.sold_by_employee_id = ? ORDER BY m.created_at DESC`,
      [req.auth.user_id]
    );
    res.json(members);
  } catch (e) { next(e); }
});

// GET /employee/retailers — retailers this employee listed
router.get("/retailers", async (req, res, next) => {
  try {
    const retailers = await all(
      `SELECT r.*, v.name as village_name FROM retailers r
       JOIN villages v ON v.village_id = r.village_id
       WHERE r.onboarding_employee_id = ? ORDER BY r.created_at DESC`,
      [req.auth.user_id]
    );
    res.json(retailers);
  } catch (e) { next(e); }
});

// GET /employee/incentives — this month's breakdown + running total + payout history
// (payout_history is every salary payment that included an incentive component —
// Admin records those from the Salary tab, see routes/admin.js.)
router.get("/incentives", async (req, res, next) => {
  try {
    const empId = req.auth.user_id;
    const thisMonth = await monthlyIncentive(empId);
    const mTotal = Number((await get("SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ?", [empId])).c);
    const rTotal = Number((await get("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'approved'", [empId])).c);
    const payout_history = await all(
      "SELECT payment_id, month, incentive_amount, paid_on, reference FROM salary_payments WHERE employee_id = ? AND incentive_amount > 0 ORDER BY month DESC",
      [empId]
    );
    res.json({
      this_month: thisMonth,
      running_total: mTotal * thisMonth.membership_rate + rTotal * thisMonth.retailer_rate,
      payout_history,
    });
  } catch (e) { next(e); }
});

// GET /employee/visits — this employee's field visit log
router.get("/visits", async (req, res, next) => {
  try {
    const visits = await all(
      `SELECT fv.*, v.name as village_name FROM field_visits fv
       LEFT JOIN villages v ON v.village_id = fv.village_id
       WHERE fv.employee_id = ? ORDER BY fv.created_at DESC`,
      [req.auth.user_id]
    );
    res.json(visits);
  } catch (e) { next(e); }
});

// POST /employee/visits { village_id, purpose, notes, lat, lng }
router.post("/visits", async (req, res, next) => {
  try {
    const { village_id, purpose, notes, lat, lng } = req.body;
    if (!purpose) return res.status(400).json({ error: "purpose required" });
    const result = await run(
      "INSERT INTO field_visits (employee_id, village_id, purpose, notes, lat, lng) VALUES (?, ?, ?, ?, ?, ?) RETURNING visit_id",
      [req.auth.user_id, village_id || null, purpose, notes || null, lat ?? null, lng ?? null]
    );
    res.json(await get("SELECT fv.*, v.name as village_name FROM field_visits fv LEFT JOIN villages v ON v.village_id = fv.village_id WHERE fv.visit_id = ?", [result.lastInsertRowid]));
  } catch (e) { next(e); }
});

module.exports = router;
