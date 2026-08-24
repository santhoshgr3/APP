const { db } = require("../db");
const { generateReferenceCode, buildPaymentInstructions } = require("./payments");
const { createMembership } = require("./memberships");

// POST-side: start a membership payment request and return what the client needs
// to show a QR code / UPI link for it.
function startMembershipRequest(userId, planId) {
  const plan = db.prepare("SELECT * FROM membership_plans WHERE plan_id = ?").get(planId);
  if (!plan) throw new Error("Plan not found");

  const referenceCode = generateReferenceCode("MEM");
  const result = db.prepare(
    "INSERT INTO payment_requests (type, user_id, plan_id, amount, reference_code) VALUES ('membership', ?, ?, ?, ?)"
  ).run(userId, planId, plan.price, referenceCode);

  return {
    request_id: result.lastInsertRowid,
    plan,
    ...buildPaymentInstructions({ amount: plan.price, referenceCode, note: `${plan.name} Membership` }),
  };
}

// Sum of commission on fulfilled orders this retailer hasn't settled yet AND
// isn't already tied to an in-flight (pending/submitted) settlement request —
// otherwise clicking "Settle Now" twice would double-count the same orders.
function unsettledCommission(retailerId) {
  return db.prepare(
    "SELECT COALESCE(SUM(commission_amt),0) as total FROM orders WHERE retailer_id = ? AND status = 'fulfilled' AND commission_settled = 0 AND settlement_request_id IS NULL"
  ).get(retailerId).total;
}

function findOpenSettlementRequest(retailerId) {
  return db.prepare(
    "SELECT * FROM payment_requests WHERE type = 'commission_settlement' AND retailer_id = ? AND status IN ('pending','submitted') ORDER BY created_at DESC LIMIT 1"
  ).get(retailerId);
}

function startCommissionSettlement(retailerUserId, retailerId) {
  // Idempotent: re-clicking "Settle Now" while a request is already awaiting
  // verification resumes that same request (same QR/reference) instead of
  // opening a second one and double-counting the same orders.
  const open = findOpenSettlementRequest(retailerId);
  if (open) {
    return {
      request_id: open.request_id,
      resumed: true,
      ...buildPaymentInstructions({ amount: open.amount, referenceCode: open.reference_code, note: "Commission Settlement" }),
    };
  }

  const amount = unsettledCommission(retailerId);
  if (amount <= 0) throw new Error("Nothing owed right now — commission settles as orders are fulfilled.");

  const referenceCode = generateReferenceCode("SET");
  const result = db.prepare(
    "INSERT INTO payment_requests (type, user_id, retailer_id, amount, reference_code) VALUES ('commission_settlement', ?, ?, ?, ?)"
  ).run(retailerUserId, retailerId, amount, referenceCode);

  db.prepare(
    "UPDATE orders SET settlement_request_id = ? WHERE retailer_id = ? AND status = 'fulfilled' AND commission_settled = 0 AND settlement_request_id IS NULL"
  ).run(result.lastInsertRowid, retailerId);

  return {
    request_id: result.lastInsertRowid,
    ...buildPaymentInstructions({ amount, referenceCode, note: "Commission Settlement" }),
  };
}

function submitUtr(requestId, userId, utr) {
  const request = db.prepare("SELECT * FROM payment_requests WHERE request_id = ? AND user_id = ?").get(requestId, userId);
  if (!request) throw new Error("Payment request not found");
  if (request.status !== "pending") throw new Error("This request has already been submitted or resolved");
  db.prepare("UPDATE payment_requests SET status = 'submitted', utr = ? WHERE request_id = ?").run(utr, requestId);
  return db.prepare("SELECT * FROM payment_requests WHERE request_id = ?").get(requestId);
}

// Admin-side: approve or reject a submitted request. Approving a membership
// request creates the membership; approving a settlement marks its orders paid.
function resolveRequest(requestId, adminUserId, { approve, reason }) {
  const request = db.prepare("SELECT * FROM payment_requests WHERE request_id = ?").get(requestId);
  if (!request) throw new Error("Payment request not found");

  if (!approve) {
    db.prepare("UPDATE payment_requests SET status = 'rejected', rejection_reason = ?, verified_by = ?, verified_at = datetime('now') WHERE request_id = ?")
      .run(reason || null, adminUserId, requestId);
    if (request.type === "commission_settlement") {
      db.prepare("UPDATE orders SET settlement_request_id = NULL WHERE settlement_request_id = ?").run(requestId);
    }
    return db.prepare("SELECT * FROM payment_requests WHERE request_id = ?").get(requestId);
  }

  db.prepare("UPDATE payment_requests SET status = 'verified', verified_by = ?, verified_at = datetime('now') WHERE request_id = ?")
    .run(adminUserId, requestId);

  if (request.type === "membership") {
    createMembership({ userId: request.user_id, planId: request.plan_id, paymentRef: request.reference_code });
  } else if (request.type === "commission_settlement") {
    db.prepare("UPDATE orders SET commission_settled = 1 WHERE settlement_request_id = ?").run(requestId);
  }

  return db.prepare("SELECT * FROM payment_requests WHERE request_id = ?").get(requestId);
}

module.exports = { startMembershipRequest, unsettledCommission, startCommissionSettlement, submitUtr, resolveRequest };
