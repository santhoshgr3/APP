import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, Btn, Input, ErrorBanner, LoadingScreen, Chip } from "../../components/ui";
import UpiOrderPayment from "../../components/UpiOrderPayment";
import { DELIVERY_LABEL, DELIVERY_TONE, paymentChip, fmtSlot } from "../../utils";
import { api } from "../../api";
import { T } from "../../theme";

const STEPS = ["placed", "accepted", "fulfilled"];
const STEP_LABEL = { placed: "Placed", accepted: "Accepted", fulfilled: "Fulfilled" };

// Screen Spec 1.9 (tracking view) — status stepper: Placed -> Accepted -> Fulfilled.
export default function OrderTrackingScreen({ navigation, route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.memberOrderDetail(id).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Order" onBack={() => navigation.goBack()} />
      {error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />}
    </View>
  );

  const { order, items } = data;
  const isTerminalBad = order.status === "rejected" || order.status === "cancelled";
  const currentIdx = STEPS.indexOf(order.status);
  const isPickup = order.delivery_method === "pickup";
  const chip = paymentChip(order);
  const needsUpi = order.payment_method === "upi" && order.payment_status !== "paid" && !isTerminalBad;

  const cancel = () => {
    Alert.alert("Cancel order?", "This can't be undone.", [
      { text: "No", style: "cancel" },
      { text: "Yes, cancel", style: "destructive", onPress: async () => {
        setCancelling(true); setError("");
        try { await api.cancelOrder(id); await load(); }
        catch (e) { setError(e.message); }
        setCancelling(false);
      } },
    ]);
  };

  const submitReview = async () => {
    if (!rating) { setError("Pick a star rating"); return; }
    setSubmittingReview(true); setError("");
    try { await api.submitReview(id, rating, comment.trim() || undefined); await load(); }
    catch (e) { setError(e.message); }
    setSubmittingReview(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={`Order #${order.order_id}`} subtitle={order.business_name} onBack={() => navigation.goBack()} />
      <Screen>
        <ErrorBanner message={error} />
        {isTerminalBad ? (
          <Card style={{ backgroundColor: T.redLight, borderColor: T.redLight, marginBottom: 16 }}>
            <Text style={{ color: T.red, fontWeight: "700", fontSize: 13 }}>
              Order {order.status === "rejected" ? "rejected by retailer" : "cancelled"}
            </Text>
          </Card>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingHorizontal: 4 }}>
            {STEPS.map((s, i) => (
              <View key={s} style={{ alignItems: "center", flex: 1 }}>
                <View style={{
                  width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                  backgroundColor: i <= currentIdx ? T.teal : T.line,
                }}>
                  {i <= currentIdx ? <Feather name="check" size={13} color="#fff" /> : null}
                </View>
                <Text style={{ fontSize: 10, marginTop: 5, fontWeight: i === currentIdx ? "700" : "500", color: i <= currentIdx ? T.teal : T.inkSoft }}>
                  {STEP_LABEL[s]}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {order.delivery_method ? <Chip tone={DELIVERY_TONE[order.delivery_method] || "teal"}>{DELIVERY_LABEL[order.delivery_method] || order.delivery_method}</Chip> : null}
          <Chip tone={chip.tone}>{chip.label}</Chip>
        </View>

        <Card style={{ marginBottom: 10, backgroundColor: T.tealLight, borderColor: T.tealLight }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.teal, marginBottom: 4 }}>{isPickup ? "PICK UP AT" : "DELIVER TO"}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700" }}>{isPickup ? order.business_name || "Pickup at store" : order.delivery_address || "No address provided"}</Text>
          {order.retailer_phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.retailer_phone}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Feather name="phone" size={12} color={T.teal} />
              <Text style={{ fontSize: 12, color: T.teal, fontWeight: "700" }}>Call shop: {order.retailer_phone}</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {order.scheduled_for ? (
          <Card style={{ marginBottom: 10, backgroundColor: T.purpleLight, borderColor: T.purpleLight }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: T.purple, marginBottom: 4 }}>BOOKING SLOT</Text>
            <Text style={{ fontSize: 13, fontWeight: "700" }}>{fmtSlot(order.scheduled_for)}</Text>
          </Card>
        ) : null}
        {order.order_notes ? (
          <Card style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 4 }}>YOUR NOTES</Text>
            <Text style={{ fontSize: 12.5 }}>{order.order_notes}</Text>
          </Card>
        ) : null}

        {(order.payment_method === "upi" && (needsUpi || order.payment_status === "paid")) ? <UpiOrderPayment order={order} onChanged={load} /> : null}

        <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Items</Text>
        {items.map((i) => (
          <Card key={i.order_item_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12.5, flexShrink: 1 }}>{i.name} × {i.quantity}{i.item_type === "service" ? " (service)" : ""}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: "700" }}>₹{i.line_total}</Text>
          </Card>
        ))}
        <Card style={{ marginTop: 6, marginBottom: 16, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700" }}>Total</Text>
          <Text style={{ fontWeight: "800", color: T.teal }}>₹{order.order_total}</Text>
        </Card>

        {order.status === "placed" && (
          <Btn full variant="danger" onPress={cancel} disabled={cancelling}>{cancelling ? "Cancelling..." : "Cancel Order"}</Btn>
        )}

        {order.status === "fulfilled" && !order.reviewed && (
          <Card>
            <Text style={{ fontSize: 12.5, fontWeight: "700", marginBottom: 8 }}>Rate this order</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)}>
                  <Feather name="star" size={24} color={n <= rating ? T.gold : T.line} />
                </TouchableOpacity>
              ))}
            </View>
            <Input placeholder="Optional comment" value={comment} onChangeText={setComment} style={{ marginBottom: 10 }} />
            <Btn full onPress={submitReview} disabled={submittingReview}>{submittingReview ? "Submitting..." : "Submit Review"}</Btn>
          </Card>
        )}
        {order.status === "fulfilled" && order.reviewed && (
          <Text style={{ fontSize: 12, color: T.inkSoft, textAlign: "center" }}>You've already reviewed this order. Thanks!</Text>
        )}
      </Screen>
    </View>
  );
}
