// Retailer rows are `SELECT r.*` in several member-facing queries, which would hand
// every member the retailer's bank account, IFSC and UPI ID. Strip those before
// anything goes to a customer, and expose only what the UI needs: whether UPI is
// accepted and which delivery options are offered. (The member gets the actual UPI
// ID only on their own order — see GET /member/orders/:id.)
const DELIVERY_METHODS = ["pickup", "self_delivery", "gvcda_delivery"];

function parseDeliveryMethods(csv) {
  const list = String(csv || "").split(",").map((s) => s.trim()).filter((s) => DELIVERY_METHODS.includes(s));
  return list.length ? list : ["pickup", "self_delivery"];
}

function publicRetailer(r) {
  if (!r) return r;
  const { bank_account, bank_ifsc, upi_id, delivery_methods, ...rest } = r;
  return { ...rest, accepts_upi: Boolean(upi_id), delivery_methods: parseDeliveryMethods(delivery_methods) };
}

module.exports = { publicRetailer, parseDeliveryMethods, DELIVERY_METHODS };
