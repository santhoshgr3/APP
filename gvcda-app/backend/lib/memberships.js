const { get, run } = require("../db");

// Shared by the mock/dev path (no bank details configured) and the Admin-verified
// bank-transfer path (lib/paymentRequests.js) — both end up creating a membership
// the same way. payment_ref (when set) makes this idempotent: verifying the same
// request twice won't create a duplicate membership.
async function createMembership({ userId, planId, soldByEmployeeId = null, paymentRef = null }) {
  if (paymentRef) {
    const existing = await get("SELECT * FROM memberships WHERE payment_ref = ?", [paymentRef]);
    if (existing) return existing;
  }

  const plan = await get("SELECT * FROM membership_plans WHERE plan_id = ?", [planId]);
  if (!plan) throw new Error("Plan not found");

  const cardNumber = "GVC-" + Math.floor(100000 + Math.random() * 900000);
  const result = await run(
    `INSERT INTO memberships (user_id, plan_id, card_number, start_date, end_date, amount_paid, sold_by_employee_id, payment_ref)
     VALUES (?, ?, ?, CURRENT_DATE, (CURRENT_DATE + INTERVAL '365 days')::date, ?, ?, ?) RETURNING membership_id`,
    [userId, planId, cardNumber, plan.price, soldByEmployeeId, paymentRef]
  );

  return await get("SELECT * FROM memberships WHERE membership_id = ?", [result.lastInsertRowid]);
}

module.exports = { createMembership };
