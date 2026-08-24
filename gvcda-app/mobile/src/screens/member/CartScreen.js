import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, Btn, ErrorBanner, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { useCart } from "../../context/CartContext";
import { T } from "../../theme";

// Screen Spec 1.9 — completes the transaction: qty steppers, total, place order.
export default function CartScreen({ navigation }) {
  const { cart, updateQty, total, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const place = async () => {
    setPlacing(true); setError("");
    try {
      const retailerId = cart[0].retailer_id;
      await api.placeOrder(retailerId, cart.map((i) => ({ product_id: i.product_id, quantity: i.qty })));
      clearCart();
      navigation.navigate("Main");
    } catch (e) { setError(e.message); }
    setPlacing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Your Cart" onBack={() => navigation.goBack()} />
      <Screen>
        <ErrorBanner message={error} />
        {cart.length === 0 && <EmptyState icon="shopping-cart" text="Your cart is empty." />}
        {cart.map((i) => (
          <Card key={i.product_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{i.name}</Text>
              <Text style={{ fontSize: 11, color: T.inkSoft }}>₹{i.price} each</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity onPress={() => updateQty(i.product_id, i.qty - 1)} style={stepperBtn}><Feather name="minus" size={13} /></TouchableOpacity>
              <Text style={{ fontSize: 13, fontWeight: "700" }}>{i.qty}</Text>
              <TouchableOpacity onPress={() => updateQty(i.product_id, i.qty + 1)} style={stepperBtn}><Feather name="plus" size={13} /></TouchableOpacity>
            </View>
          </Card>
        ))}
        {cart.length > 0 && (
          <>
            <Card style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontWeight: "700" }}>Total</Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: T.teal }}>₹{total}</Text>
            </Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Feather name="truck" size={13} color={T.teal} />
              <Text style={{ fontSize: 11.5, color: T.inkSoft }}>Cash on Delivery — pay the retailer directly when your order arrives.</Text>
            </View>
          </>
        )}
      </Screen>
      {cart.length > 0 && (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: "#fff" }}>
          <Btn full onPress={place} disabled={placing}>{placing ? "Placing..." : "Place Order (Cash on Delivery)"}</Btn>
        </View>
      )}
    </View>
  );
}

const stepperBtn = { borderWidth: 1, borderColor: T.line, backgroundColor: "#fff", borderRadius: 6, width: 26, height: 26, alignItems: "center", justifyContent: "center" };
