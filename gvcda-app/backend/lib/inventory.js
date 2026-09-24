const { run } = require("../db");

// Put back the stock an order had reserved — used when a member cancels or a
// retailer rejects. Untracked products (stock NULL) are left alone.
async function restockOrder(orderId) {
  await run(
    `UPDATE products p SET stock = p.stock + oi.quantity
     FROM order_items oi WHERE oi.order_id = ? AND oi.product_id = p.product_id AND p.stock IS NOT NULL`,
    [orderId]
  );
}

module.exports = { restockOrder };
