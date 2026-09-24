const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const DELIVERY_LABEL = { pickup: "Pickup", self_delivery: "Home delivery", gvcda_delivery: "GVCDA delivery" };
export const DELIVERY_TONE = { pickup: "blue", self_delivery: "terracotta", gvcda_delivery: "purple" };

// "24 Sep 2026" — DATE columns arrive as ISO strings, so read the calendar day straight
// off the string instead of round-tripping through the device timezone.
export function fmtDate(v) {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m && String(v).length <= 10) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}

export function fmtDateTime(v) {
  if (!v) return "";
  return `${fmtDate(new Date(v).toISOString())} ${fmtTime(v)}`;
}

// scheduled_for is stored as the raw "YYYY-MM-DDTHH:mm" IST wall-clock text the member picked.
export function fmtSlot(v) {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(v));
  if (!m) return String(v);
  let h = Number(m[4]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${h}:${m[5]} ${ap}`;
}

export function money(n) {
  const v = Number(n) || 0;
  return `₹${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function isoDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isValidIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !isNaN(d) && isoDate(d) === s;
}

// UPI payment state for an order, as a { label, tone } chip descriptor.
export function paymentChip(order) {
  if (order.payment_method !== "upi") return { label: "Cash on delivery", tone: "gold" };
  if (order.payment_status === "paid") return { label: "Paid", tone: "green" };
  if (order.payment_status === "submitted") return { label: "Awaiting retailer confirmation", tone: "blue" };
  return { label: "Payment pending", tone: "terracotta" };
}
