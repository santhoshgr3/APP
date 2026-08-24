// Payee bank/UPI details shown to members paying for a membership (and to
// retailers settling commission owed to GVCDA). This is a merchant-style
// receiving account — meant to be shown publicly on the payment screen, same as
// any UPI QR code — so it's fine as plain config. Override via .env if the
// account ever changes; no code change needed either way.
module.exports = {
  accountName: process.env.BANK_ACCOUNT_NAME || "GLOB VILLAGE AND CITY DEVELOPMENT AGENCY LLP",
  accountNumber: process.env.BANK_ACCOUNT_NUMBER || "009720700001138",
  ifsc: process.env.BANK_IFSC || "YESB0000097",
  bankName: process.env.BANK_NAME || "YES Bank",
  upiId: process.env.BANK_UPI_ID || "yespay.smessi10169377@yesbankltd",
};
