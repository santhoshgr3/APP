import React, { createContext, useContext, useState, useCallback } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]); // [{product_id, name, price, retailer_id, qty}]

  const addToCart = useCallback((product) => {
    setCart((c) =>
      c.find((i) => i.product_id === product.product_id)
        ? c.map((i) => (i.product_id === product.product_id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { ...product, qty: 1 }]
    );
  }, []);

  const updateQty = useCallback((product_id, qty) => {
    setCart((c) => (qty <= 0 ? c.filter((i) => i.product_id !== product_id) : c.map((i) => (i.product_id === product_id ? { ...i, qty } : i))));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
