const { get } = require("../db");

// Per-designation rates live in one place so the employee's own incentive view and
// Admin's salary run always agree on the same number.
const INCENTIVE_PER_MEMBERSHIP = 50;
const INCENTIVE_PER_RETAILER = 150;

// month is 'YYYY-MM'; defaults to the current month.
async function monthlyIncentive(employeeId, month) {
  const m = month || new Date().toISOString().slice(0, 7);
  const memberships = Number((await get(
    "SELECT COUNT(*) c FROM memberships WHERE sold_by_employee_id = ? AND TO_CHAR(created_at, 'YYYY-MM') = ?",
    [employeeId, m]
  )).c);
  const retailers = Number((await get(
    "SELECT COUNT(*) c FROM retailers WHERE onboarding_employee_id = ? AND status = 'approved' AND TO_CHAR(created_at, 'YYYY-MM') = ?",
    [employeeId, m]
  )).c);
  return {
    month: m,
    membership_count: memberships,
    membership_rate: INCENTIVE_PER_MEMBERSHIP,
    membership_amount: memberships * INCENTIVE_PER_MEMBERSHIP,
    retailer_count: retailers,
    retailer_rate: INCENTIVE_PER_RETAILER,
    retailer_amount: retailers * INCENTIVE_PER_RETAILER,
    total: memberships * INCENTIVE_PER_MEMBERSHIP + retailers * INCENTIVE_PER_RETAILER,
  };
}

function employeeCode(userId) {
  return `GVCDA-E${String(userId).padStart(4, "0")}`;
}

module.exports = { monthlyIncentive, employeeCode, INCENTIVE_PER_MEMBERSHIP, INCENTIVE_PER_RETAILER };
