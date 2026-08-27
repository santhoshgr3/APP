const express = require("express");
const router = express.Router();
const { get, all, run } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const PHONE_RE = /^\d{10}$/;

router.use(requireAuth, requireRole("employee"));

// GET /employee/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    const empId = req.auth.user_id;
    const membershipsSold = (await get("SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ?", [empId])).c;
    const retailersListed = (await get("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ?", [empId])).c;
    const retailersPending = (await get("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'pending'", [empId])).c;
    const employee = await get("SELECT * FROM users WHERE user_id = ?", [empId]);
    res.json({
      employee,
      memberships_sold: Number(membershipsSold),
      retailers_listed: Number(retailersListed),
      retailers_pending: Number(retailersPending),
      monthly_target: 50, // static demo target; real build stores this per-employee
    });
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

// Incentive rates — real build stores these per-designation in a settings table.
const INCENTIVE_PER_MEMBERSHIP = 50;
const INCENTIVE_PER_RETAILER = 150;

// GET /employee/incentives — this month's breakdown + running total + payout history
router.get("/incentives", async (req, res, next) => {
  try {
    const empId = req.auth.user_id;
    const membershipsThisMonth = (await get(
      `SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ? AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`,
      [empId]
    )).c;
    const retailersThisMonth = (await get(
      `SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'approved' AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`,
      [empId]
    )).c;
    const membershipsTotal = (await get("SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ?", [empId])).c;
    const retailersTotal = (await get("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'approved'", [empId])).c;

    const mMonth = Number(membershipsThisMonth), rMonth = Number(retailersThisMonth);
    const mTotal = Number(membershipsTotal), rTotal = Number(retailersTotal);

    res.json({
      this_month: {
        membership_count: mMonth,
        membership_rate: INCENTIVE_PER_MEMBERSHIP,
        membership_amount: mMonth * INCENTIVE_PER_MEMBERSHIP,
        retailer_count: rMonth,
        retailer_rate: INCENTIVE_PER_RETAILER,
        retailer_amount: rMonth * INCENTIVE_PER_RETAILER,
        total: mMonth * INCENTIVE_PER_MEMBERSHIP + rMonth * INCENTIVE_PER_RETAILER,
      },
      running_total: mTotal * INCENTIVE_PER_MEMBERSHIP + rTotal * INCENTIVE_PER_RETAILER,
      // Employee incentive payout isn't tracked with the same payment_requests
      // mechanism retailers/members use (those are payer-initiated bank transfers;
      // incentive payouts run the other way — GVCDA pays the employee — so this
      // needs its own settlement flow, e.g. a payroll run, before it's real).
      payout_history: [],
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
