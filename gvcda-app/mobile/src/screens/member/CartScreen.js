import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, Btn, Field, Input, ErrorBanner, EmptyState, Chip, LoadingScreen } from "../../components/ui";
import SlotPicker, { defaultSlot, slotToString, slotIsFuture } from "../../components/SlotPicker";
import { api } from "../../api";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { DELIVERY_LABEL, fmtSlot } from "../../utils";
import { T } from "../../theme";

const DELIVERY_HELP = {
  pickup: "Collect the order from the shop yourself.",
  self_delivery: "The shop delivers to your address.",
  gvcda_delivery: "GVCDA's delivery partner collects from the shop and delivers to you.",
};

// Screen Spec 1.9 — completes the transaction: qty steppers, total, delivery + payment
// choices (limited to what this retailer offers), a booking slot when the cart holds a
// service, and place order.
export default function CartScreen({ navigation }) {
  const { session } = useAuth();
  const { cart, updateQty, total, clearCart } = useCart();
  const [address, setAddress] = useState(session?.user?.address || "");
  const [phone, setPhone] = useState(session?.user?.phone || "");
  const [notes, setNotes] = useState("");
  const [retailer, setRetailer] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [slot, setSlot] = useState(defaultSlot());
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const retailerId = cart[0]?.retailer_id;
  useEffect(() => {
    if (!retailerId) return;
    setLoadError("");
    api.memberRetailerDetail(retailerId)
      .then((d) => {
        setRetailer(d.retailer);
        const methods = d.retailer.delivery_methods || [];
        setDeliveryMethod((cur) => (cur && methods.includes(cur) ? cur : methods[0] || null));
        if (!d.retailer.accepts_upi) setPaymentMethod("cod");
      })
      .catch((e) => setLoadError(e.message));
  }, [retailerId]);

  const hasService = cart.some((i) => i.item_type === "service");
  const isPickup = deliveryMethod === "pickup";
  const methods = retailer?.delivery_methods || [];

  const place = async () => {
    if (!deliveryMethod) { setError("This shop hasn't enabled any delivery option yet"); return; }
    if (!isPickup && !address.trim()) { setError("Delivery address is required"); return; }
    if (hasService && !slotIsFuture(slot)) { setError("Pick a booking time in the future"); return; }
    setPlacing(true); setError("");
    try {
      const res = await api.placeOrder(
        retailerId,
        cart.map((i) => ({ product_id: i.product_id, quantity: i.qty })),
        isPickup ? undefined : address.trim(),
        phone.trim() || undefined,
        {
          delivery_method: deliveryMethod,
          payment_method: paymentMethod,
          scheduled_for: hasService ? slotToString(slot) : undefined,
          order_notes: notes.trim() || undefined,
        }
      );
      clearCart();
      if (paymentMethod === "upi" && res.order?.order_id) navigation.replace("OrderTracking", { id: res.order.order_id });
      else navigation.popTo("Main");
    } catch (e) { setError(e.message); }
    setPlacing(false);
  };

  const ready = cart.length === 0 || retailer || loadError;

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Your Cart" onBack={() => navigation.goBack()} />
      {!ready ? <LoadingScreen /> : (
        <Screen>
          <ErrorBanner message={error || loadError} />
          {cart.length === 0 && <EmptyState icon="shopping-cart" text="Your cart is empty." />}
          {cart.map((i) => (
            <Card key={i.product_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{i.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 11, color: T.inkSoft }}>₹{i.price} each</Text>
                  {i.item_type === "service" ? <Chip tone="purple">Service</Chip> : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity onPress={() => updateQty(i.product_id, i.qty - 1)} style={stepperBtn}><Feather name="minus" size={13} /></TouchableOpacity>
                <Text style={{ fontSize: 13, fontWeight: "700" }}>{i.qty}</Text>
                <TouchableOpacity onPress={() => updateQty(i.product_id, i.qty + 1)} style={stepperBtn}><Feather name="plus" size={13} /></TouchableOpacity>
              </View>
            </Card>
          ))}
          {cart.length > 0 && retailer && (
            <>
              <Card style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, fontWeight: "700" }}>Total</Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: T.teal }}>₹{total}</Text>
              </Card>

              <Text style={sectionLabel}>DELIVERY</Text>
              {methods.length === 0 && (
                <Text style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>This shop hasn't enabled any delivery option yet.</Text>
              )}
              {methods.map((m) => (
                <OptionRow key={m} selected={deliveryMethod === m} onPress={() => setDeliveryMethod(m)} title={DELIVERY_LABEL[m] || m} help={DELIVERY_HELP[m]} />
              ))}

              {hasService && (
                <>
                  <Text style={sectionLabel}>BOOKING SLOT</Text>
                  <Card style={{ marginBottom: 12 }}>
                    <SlotPicker value={slot} onChange={setSlot} />
                    <Text style={{ fontSize: 11.5, color: T.teal, fontWeight: "700" }}>{fmtSlot(slotToString(slot))}</Text>
                  </Card>
                </>
              )}

              {!isPickup && (
                <>
                  <Field label="Delivery address *">
                    <Input value={address} onChangeText={setAddress} placeholder="House no, street, landmark" multiline />
                  </Field>
                </>
              )}
              <Field label={isPickup ? "Contact phone" : "Contact phone for delivery"}>
                <Input value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} />
              </Field>
              <Field label="Notes for the shop (optional)">
                <Input value={notes} onChangeText={setNotes} placeholder="Any instructions" multiline maxLength={300} />
              </Field>

              <Text style={sectionLabel}>PAYMENT</Text>
              <OptionRow selected={paymentMethod === "cod"} onPress={() => setPaymentMethod("cod")} title="Cash on Delivery" help="Pay the retailer directly when you receive the order." />
              {retailer.accepts_upi && (
                <OptionRow selected={paymentMethod === "upi"} onPress={() => setPaymentMethod("upi")} title="UPI" help="Pay the retailer by UPI after placing the order." />
              )}
            </>
          )}
        </Screen>
      )}
      {cart.length > 0 && retailer && (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: "#fff" }}>
          <Btn full onPress={place} disabled={placing || !deliveryMethod || (!isPickup && !address.trim())}>
            {placing ? "Placing..." : `Place Order (${paymentMethod === "upi" ? "UPI" : "Cash on Delivery"})`}
          </Btn>
        </View>
      )}
    </View>
  );
}

function OptionRow({ selected, onPress, title, help }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row", alignItems: "center", gap: 10, padding: 11, marginBottom: 8, borderRadius: 10, borderWidth: 1.5,
        borderColor: selected ? T.teal : T.line, backgroundColor: selected ? T.tealLight : "#fff",
      }}
    >
      <Feather name={selected ? "check-circle" : "circle"} size={18} color={selected ? T.teal : T.inkSoft} />
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: T.ink }}>{title}</Text>
        {help ? <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>{help}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const sectionLabel = { fontSize: 11, fontWeight: "700", color: T.inkSoft, marginTop: 14, marginBottom: 8 };
const stepperBtn = { borderWidth: 1, borderColor: T.line, backgroundColor: "#fff", borderRadius: 6, width: 26, height: 26, alignItems: "center", justifyContent: "center" };
