const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isEmail(v) { return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v.trim()); }
function isDate(v) { return typeof v === "string" && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)); }

// Telangana is IST (+05:30): a customer picking "3:00 PM" means 3 PM there, not on
// the server's clock, so a bare local date-time is interpreted at +05:30.
function parseIstDateTime(s) {
  if (typeof s !== "string" || !s.trim()) return NaN;
  const hasOffset = /(Z|[+-]\d\d:?\d\d)$/i.test(s.trim()) && s.includes("T");
  return Date.parse(hasOffset ? s : `${s.trim()}+05:30`);
}

module.exports = { isEmail, isDate, MONTH_RE, parseIstDateTime };
