// No payment gateway account exists yet, so payment collection is direct
// bank/UPI transfer: the payer scans a QR code (or taps a UPI link) built from
// GVCDA's real receiving account, pays, then submits the UTR (the reference
// number their bank/UPI app shows after a successful transfer) as proof — an
// Admin cross-checks it against the bank statement and approves. This needs no
// merchant account, no KYC, and no third-party API; it's a completely standard
// way small Indian organizations collect UPI payments before they have a
// payment-gateway account. See lib/bankDetails.js for the receiving account.
const crypto = require("crypto");
const bank = require("./bankDetails");

function generateReferenceCode(prefix) {
  return `GVCDA-${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// Standard UPI deep link — any UPI app (GPay, PhonePe, Paytm, BHIM, ...) can open
// this directly, and it's also what gets encoded into the QR code shown on-screen.
// The "tn" (transaction note) is what carries the reference code into the payer's
// bank statement remarks, so an Admin can match a bank-statement line back to a
// specific membership/settlement request even before the UTR is submitted.
function buildUpiUri({ amount, referenceCode, note }) {
  const params = new URLSearchParams({
    pa: bank.upiId,
    pn: bank.accountName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `${note} ${referenceCode}`,
  });
  return `upi://pay?${params.toString()}`;
}

function buildPaymentInstructions({ amount, referenceCode, note }) {
  return {
    reference_code: referenceCode,
    amount,
    upi_uri: buildUpiUri({ amount, referenceCode, note }),
    bank: {
      account_name: bank.accountName,
      account_number: bank.accountNumber,
      ifsc: bank.ifsc,
      bank_name: bank.bankName,
      upi_id: bank.upiId,
    },
    note: `Include "${referenceCode}" in the payment note/remarks if your UPI app asks for one.`,
  };
}

module.exports = { generateReferenceCode, buildPaymentInstructions };
