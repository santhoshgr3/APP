const { get, run } = require("../db");
const { generateReferenceCode, buildPaymentInstructions } = require("./payments");
const { createMembership } = require("./memberships");

// POST-side: start a membership payment request and return what the client needs
// to show a QR code / UPI link for it.
async function startMembershipRequest(userId, planId) {
  const plan = await get("SELECT * FROM membership_plans WHERE plan_id = ?", [planId]);
  if (!plan) throw new Error("Plan not found");

  const referenceCode = generateReferenceCode("MEM");
  const result = await run(
    "INSERT INTO payment_requests (type, user_id, plan_id, amount, reference_code) VALUES ('membership', ?, ?, ?, ?) RETURNING request_id",
    [userId, planId, plan.price, referenceCode]
  );

  return {
    request_id: result.lastInsertRowid,
    plan,
    ...buildPaymentInstructions({ amount: plan.price, referenceCode, note: `${plan.name} Membership` }),
  };
}

// Sum of commission on fulfilled orders this retailer hasn't settled yet AND
// isn't already tied to an in-flight (pending/submitted) settlement request —
// otherwise clicking "Settle Now" twice would double-count the same orders.
async function unsettledCommission(retailerId) {
  const row = await get(
    "SELECT COALESCE(SUM(commission_amt),0) as total FROM orders WHERE retailer_id = ? AND status = 'fulfilled' AND commission_settled = 0 AND settlement_request_id IS NULL",
    [retailerId]
  );
  return row.total;
}

async function findOpenSettlementRequest(retailerId) {
  return await get(
    "SELECT * FROM payment_requests WHERE type = 'commission_settlement' AND retailer_id = ? AND status IN ('pending','submitted') ORDER BY created_at DESC LIMIT 1",
    [retailerId]
  );
}

async function startCommissionSettlement(retailerUserId, retailerId) {
  // Idempotent: re-clicking "Settle Now" while a request is already awaiting
  // verification resumes that same request (same QR/reference) instead of
  // opening a second one and double-counting the same orders.
  const open = await findOpenSettlementRequest(retailerId);
  if (open) {
    return {
      request_id: open.request_id,
      resumed: true,
      ...buildPaymentInstructions({ amount: open.amount, referenceCode: open.reference_code, note: "Commission Settlement" }),
    };
  }

  const amount = await unsettledCommission(retailerId);
  if (amount <= 0) throw new Error("Nothing owed right now — commission settles as orders are fulfilled.");

  const referenceCode = generateReferenceCode("SET");
  const result = await run(
    "INSERT INTO payment_requests (type, user_id, retailer_id, amount, reference_code) VALUES ('commission_settlement', ?, ?, ?, ?) RETURNING request_id",
    [retailerUserId, retailerId, amount, referenceCode]
  );

  await run(
    "UPDATE orders SET settlement_request_id = ? WHERE retailer_id = ? AND status = 'fulfilled' AND commission_settled = 0 AND settlement_request_id IS NULL",
    [result.lastInsertRowid, retailerId]
  );

  return {
    request_id: result.lastInsertRowid,
    ...buildPaymentInstructions({ amount, referenceCode, note: "Commission Settlement" }),
  };
}

async function submitUtr(requestId, userId, utr) {
  const request = await get("SELECT * FROM payment_requests WHERE request_id = ? AND user_id = ?", [requestId, userId]);
  if (!request) throw new Error("Payment request not found");
  if (request.status !== "pending") throw new Error("This request has already been submitted or resolved");
  await run("UPDATE payment_requests SET status = 'submitted', utr = ? WHERE request_id = ?", [utr, requestId]);
  return await get("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
}

// Admin-side: approve or reject a submitted request. Approving a membership
// request creates the membership; approving a settlement marks its orders paid.
async function resolveRequest(requestId, adminUserId, { approve, reason }) {
  const request = await get("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
  if (!request) throw new Error("Payment request not found");

  if (!approve) {
    await run(
      "UPDATE payment_requests SET status = 'rejected', rejection_reason = ?, verified_by = ?, verified_at = NOW() WHERE request_id = ?",
      [reason || null, adminUserId, requestId]
    );
    if (request.type === "commission_settlement") {
      await run("UPDATE orders SET settlement_request_id = NULL WHERE settlement_request_id = ?", [requestId]);
    }
    return await get("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
  }

  await run(
    "UPDATE payment_requests SET status = 'verified', verified_by = ?, verified_at = NOW() WHERE request_id = ?",
    [adminUserId, requestId]
  );

  if (request.type === "membership") {
    await createMembership({ userId: request.user_id, planId: request.plan_id, paymentRef: request.reference_code });
  } else if (request.type === "commission_settlement") {
    await run("UPDATE orders SET commission_settled = 1 WHERE settlement_request_id = ?", [requestId]);
  }

  return await get("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
}

module.exports = { startMembershipRequest, unsettledCommission, startCommissionSettlement, submitUtr, resolveRequest };
