// Admin's Broadcast Tool (routes/admin.js) only ever wrote a row to `broadcasts`
// and computed a recipient count — nothing anywhere actually delivered that
// message to a Member/Employee/Retailer. This is the delivery side: any
// authenticated user can fetch the broadcasts that target them (their district/
// mandal, or "all"), most recent first, so the message is actually seen in-app
// instead of only existing in Admin's own send history.
const { all } = require("../db");

async function getVisibleBroadcasts(userId, limit = 10) {
  // A Member/Retailer's district/mandal comes from their village; an Employee's
  // comes from their assigned territory instead (they don't necessarily have a
  // village_id at all) — COALESCE so either kind of account matches correctly.
  return all(
    `SELECT b.broadcast_id, b.message, b.target_scope, b.created_at
     FROM broadcasts b
     LEFT JOIN users u ON u.user_id = ?
     LEFT JOIN villages v ON v.village_id = u.village_id
     LEFT JOIN mandals vm ON vm.mandal_id = v.mandal_id
     WHERE b.target_scope = 'all'
        OR (b.target_scope = 'district' AND b.target_district_id = COALESCE(vm.district_id, u.territory_district_id))
        OR (b.target_scope = 'mandal' AND b.target_mandal_id = COALESCE(v.mandal_id, u.territory_mandal_id))
     ORDER BY b.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
}

module.exports = { getVisibleBroadcasts };
