const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth, requireRole("employee"));

// GET /employee/dashboard
router.get("/dashboard", (req, res) => {
  const empId = req.auth.user_id;
  const membershipsSold = db.prepare("SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ?").get(empId).c;
  const retailersListed = db.prepare("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ?").get(empId).c;
  const retailersPending = db.prepare("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'pending'").get(empId).c;
  const employee = db.prepare("SELECT * FROM users WHERE user_id = ?").get(empId);
  res.json({
    employee,
    memberships_sold: membershipsSold,
    retailers_listed: retailersListed,
    retailers_pending: retailersPending,
    monthly_target: 50, // static demo target; real build stores this per-employee
  });
});

// POST /employee/enrol-member { full_name, phone, village_id, plan_id, payment_method }
router.post("/enrol-member", (req, res) => {
  const { full_name, phone, village_id, plan_id, payment_method } = req.body;
  if (!full_name || !phone || !village_id || !plan_id) return res.status(400).json({ error: "Missing required fields" });

  let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
  if (!user) {
    const r = db.prepare("INSERT INTO users (phone, full_name, role, village_id) VALUES (?, ?, 'member', ?)").run(phone, full_name, village_id);
    user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(r.lastInsertRowid);
    db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'member')").run(user.user_id);
  }

  const plan = db.prepare("SELECT * FROM membership_plans WHERE plan_id = ?").get(plan_id);
  const cardNumber = "GVC-" + Math.floor(100000 + Math.random() * 900000);
  const result = db.prepare(
    `INSERT INTO memberships (user_id, plan_id, card_number, start_date, end_date, amount_paid, sold_by_employee_id)
     VALUES (?, ?, ?, date('now'), date('now', '+365 days'), ?, ?)`
  ).run(user.user_id, plan_id, cardNumber, plan.price, req.auth.user_id);

  const membership = db.prepare("SELECT * FROM memberships WHERE membership_id = ?").get(result.lastInsertRowid);
  res.json({ user, membership, payment_method });
});

// POST /employee/list-retailer { business_name, category_id, village_id, phone }
router.post("/list-retailer", (req, res) => {
  const { business_name, category_id, village_id, phone } = req.body;
  if (!business_name || !category_id || !village_id) return res.status(400).json({ error: "Missing required fields" });

  let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
  if (!user) {
    const r = db.prepare("INSERT INTO users (phone, full_name, role, village_id) VALUES (?, ?, 'retailer', ?)").run(phone, business_name, village_id);
    user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(r.lastInsertRowid);
  }
  db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'retailer')").run(user.user_id);

  const result = db.prepare(
    `INSERT INTO retailers (user_id, business_name, category_id, village_id, phone, onboarded_by, onboarding_employee_id, status)
     VALUES (?, ?, ?, ?, ?, 'employee', ?, 'pending')`
  ).run(user.user_id, business_name, category_id, village_id, phone, req.auth.user_id);

  const retailer = db.prepare("SELECT * FROM retailers WHERE retailer_id = ?").get(result.lastInsertRowid);
  res.json({ retailer });
});

// GET /employee/members — members this employee enrolled
router.get("/members", (req, res) => {
  const members = db.prepare(
    `SELECT u.user_id, u.full_name, u.phone, v.name as village_name, m.status, mp.name as plan_name, m.created_at
     FROM memberships m
     JOIN users u ON u.user_id = m.user_id
     JOIN membership_plans mp ON mp.plan_id = m.plan_id
     LEFT JOIN villages v ON v.village_id = u.village_id
     WHERE m.sold_by_employee_id = ? ORDER BY m.created_at DESC`
  ).all(req.auth.user_id);
  res.json(members);
});

// GET /employee/retailers — retailers this employee listed
router.get("/retailers", (req, res) => {
  const retailers = db.prepare(
    `SELECT r.*, v.name as village_name FROM retailers r
     JOIN villages v ON v.village_id = r.village_id
     WHERE r.onboarding_employee_id = ? ORDER BY r.created_at DESC`
  ).all(req.auth.user_id);
  res.json(retailers);
});

// Incentive rates — real build stores these per-designation in a settings table.
const INCENTIVE_PER_MEMBERSHIP = 50;
const INCENTIVE_PER_RETAILER = 150;

// GET /employee/incentives — this month's breakdown + running total + payout history
router.get("/incentives", (req, res) => {
  const empId = req.auth.user_id;
  const membershipsThisMonth = db.prepare(
    `SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  ).get(empId).c;
  const retailersThisMonth = db.prepare(
    `SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'approved' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
  ).get(empId).c;
  const membershipsTotal = db.prepare("SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ?").get(empId).c;
  const retailersTotal = db.prepare("SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'approved'").get(empId).c;

  res.json({
    this_month: {
      membership_count: membershipsThisMonth,
      membership_rate: INCENTIVE_PER_MEMBERSHIP,
      membership_amount: membershipsThisMonth * INCENTIVE_PER_MEMBERSHIP,
      retailer_count: retailersThisMonth,
      retailer_rate: INCENTIVE_PER_RETAILER,
      retailer_amount: retailersThisMonth * INCENTIVE_PER_RETAILER,
      total: membershipsThisMonth * INCENTIVE_PER_MEMBERSHIP + retailersThisMonth * INCENTIVE_PER_RETAILER,
    },
    running_total: membershipsTotal * INCENTIVE_PER_MEMBERSHIP + retailersTotal * INCENTIVE_PER_RETAILER,
    // Employee incentive payout isn't tracked with the same payment_requests
    // mechanism retailers/members use (those are payer-initiated bank transfers;
    // incentive payouts run the other way — GVCDA pays the employee — so this
    // needs its own settlement flow, e.g. a payroll run, before it's real).
    payout_history: [],
  });
});

// GET /employee/visits — this employee's field visit log
router.get("/visits", (req, res) => {
  const visits = db.prepare(
    `SELECT fv.*, v.name as village_name FROM field_visits fv
     LEFT JOIN villages v ON v.village_id = fv.village_id
     WHERE fv.employee_id = ? ORDER BY fv.created_at DESC`
  ).all(req.auth.user_id);
  res.json(visits);
});

// POST /employee/visits { village_id, purpose, notes, lat, lng }
router.post("/visits", (req, res) => {
  const { village_id, purpose, notes, lat, lng } = req.body;
  if (!purpose) return res.status(400).json({ error: "purpose required" });
  const result = db.prepare(
    "INSERT INTO field_visits (employee_id, village_id, purpose, notes, lat, lng) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(req.auth.user_id, village_id || null, purpose, notes || null, lat ?? null, lng ?? null);
  res.json(db.prepare("SELECT fv.*, v.name as village_name FROM field_visits fv LEFT JOIN villages v ON v.village_id = fv.village_id WHERE fv.visit_id = ?").get(result.lastInsertRowid));
});

module.exports = router;
