const { db } = require("../db");

// Shared by the mock/dev path (no bank details configured) and the Admin-verified
// bank-transfer path (lib/paymentRequests.js) — both end up creating a membership
// the same way. payment_ref (when set) makes this idempotent: verifying the same
// request twice won't create a duplicate membership.
function createMembership({ userId, planId, soldByEmployeeId = null, paymentRef = null }) {
  if (paymentRef) {
    const existing = db.prepare("SELECT * FROM memberships WHERE payment_ref = ?").get(paymentRef);
    if (existing) return existing;
  }

  const plan = db.prepare("SELECT * FROM membership_plans WHERE plan_id = ?").get(planId);
  if (!plan) throw new Error("Plan not found");

  const cardNumber = "GVC-" + Math.floor(100000 + Math.random() * 900000);
  const result = db.prepare(
    `INSERT INTO memberships (user_id, plan_id, card_number, start_date, end_date, amount_paid, sold_by_employee_id, payment_ref)
     VALUES (?, ?, ?, date('now'), date('now', '+365 days'), ?, ?, ?)`
  ).run(userId, planId, cardNumber, plan.price, soldByEmployeeId, paymentRef);

  return db.prepare("SELECT * FROM memberships WHERE membership_id = ?").get(result.lastInsertRowid);
}

module.exports = { createMembership };
