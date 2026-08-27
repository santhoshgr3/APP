const { get, run } = require("../db");

// Recompute a retailer's rating_avg from its actual reviews — called right
// after every new review is inserted so the displayed number is never stale.
async function recomputeRating(retailerId) {
  const row = await get("SELECT AVG(rating) as avg FROM reviews WHERE retailer_id = ?", [retailerId]);
  await run("UPDATE retailers SET rating_avg = ? WHERE retailer_id = ?", [row.avg ? Number(row.avg) : 0, retailerId]);
}

module.exports = { recomputeRating };
