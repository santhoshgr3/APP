import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, Btn, Input, ErrorBanner, LoadingScreen } from "../../components/ui";
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

  const load = () => api.memberOrderDetail(id).then(setData);
  useEffect(() => { load(); }, [id]);

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Order" onBack={() => navigation.goBack()} />
      <LoadingScreen />
    </View>
  );

  const { order, items } = data;
  const isTerminalBad = order.status === "rejected" || order.status === "cancelled";
  const currentIdx = STEPS.indexOf(order.status);

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

        <Card style={{ marginBottom: 10, backgroundColor: T.tealLight, borderColor: T.tealLight }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.teal, marginBottom: 4 }}>DELIVER TO</Text>
          <Text style={{ fontSize: 13, fontWeight: "700" }}>{order.delivery_address || "No address provided"}</Text>
        </Card>

        <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Items</Text>
        {items.map((i) => (
          <Card key={i.order_item_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12.5 }}>{i.name} × {i.quantity}</Text>
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
