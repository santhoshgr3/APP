import React, { useEffect, useState } from "react";
import { View, Text, Linking, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, Btn, Chip, LoadingScreen, ErrorBanner } from "../../components/ui";
import { DELIVERY_LABEL, DELIVERY_TONE, paymentChip, fmtSlot } from "../../utils";
import { api } from "../../api";
import { T } from "../../theme";

const NEXT_ACTION = { placed: [["accepted", "Accept"], ["rejected", "Reject"]], accepted: [["fulfilled", "Mark Fulfilled"]] };

// Screen Spec 3.5 — full view of a single order for fulfilment.
export default function OrderDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.retailerOrderDetail(id).then((d) => { setError(""); setData(d); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Order" onBack={() => navigation.goBack()} />
      {error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />}
    </View>
  );

  const { order, items } = data;
  const actions = NEXT_ACTION[order.status] || [];

  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); await load(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };
  const act = (status) => run(() => api.updateOrderStatus(id, status));
  const markPayment = (received) => run(() => api.updateRetailerOrderPayment(id, received));

  const isPickup = order.delivery_method === "pickup";
  const isUpi = order.payment_method === "upi";
  const chip = paymentChip(order);
  const closed = order.status === "rejected" || order.status === "cancelled";

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={`Order #${order.order_id}`} onBack={() => navigation.goBack()} />
      <Screen>
        <ErrorBanner message={error} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Chip tone={order.status === "fulfilled" ? "green" : closed ? "red" : order.status === "accepted" ? "blue" : "gold"}>{order.status}</Chip>
          <Text style={{ fontSize: 11, color: T.inkSoft }}>{new Date(order.placed_at).toLocaleString()}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {order.delivery_method ? <Chip tone={DELIVERY_TONE[order.delivery_method] || "teal"}>{DELIVERY_LABEL[order.delivery_method] || order.delivery_method}</Chip> : null}
          <Chip tone={chip.tone}>{chip.label}</Chip>
        </View>

        <Card style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 4 }}>CUSTOMER</Text>
          <Text style={{ fontSize: 13, fontWeight: "700" }}>{order.member_name}</Text>
          {order.member_phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.member_phone}`).catch(() => {})} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Feather name="phone" size={13} color={T.teal} />
              <Text style={{ fontSize: 12.5, color: T.teal, fontWeight: "700" }}>{order.member_phone}</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        <Card style={{ marginBottom: 10, backgroundColor: T.tealLight, borderColor: T.tealLight }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.teal, marginBottom: 4 }}>{isPickup ? "CUSTOMER PICKS UP" : "DELIVER TO"}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700" }}>{isPickup ? "Pickup at store" : order.delivery_address || "No address provided"}</Text>
          {order.delivery_phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.delivery_phone}`).catch(() => {})} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Feather name="phone-call" size={12} color={T.teal} />
              <Text style={{ fontSize: 12, color: T.teal, fontWeight: "700" }}>Contact: {order.delivery_phone}</Text>
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
          <Card style={{ marginBottom: 10, backgroundColor: T.goldLight, borderColor: T.goldLight }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#8A6A0C", marginBottom: 4 }}>CUSTOMER NOTES</Text>
            <Text style={{ fontSize: 12.5 }}>{order.order_notes}</Text>
          </Card>
        ) : null}

        <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Items</Text>
        {items.map((i) => (
          <Card key={i.order_item_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12.5, flexShrink: 1 }}>{i.name} × {i.quantity}{i.item_type === "service" ? " (service)" : ""}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: "700" }}>₹{i.line_total}</Text>
          </Card>
        ))}

        <Card style={{ marginTop: 8, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft }}>PAYMENT</Text>
            <Chip tone={isUpi ? "blue" : "gold"}>{isUpi ? "UPI" : "Cash on Delivery"}</Chip>
          </View>
          <Row label={isUpi ? "Customer pays by UPI" : "Collect from member"} value={`₹${order.order_total}`} />
          {isUpi && (
            <View style={{ marginVertical: 6 }}>
              <Text style={{ fontSize: 12, color: T.inkSoft }}>
                {order.payment_utr ? `Customer's UTR: ${order.payment_utr}` : "Customer hasn't submitted a UTR yet."}
              </Text>
              {!closed && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <Btn full icon="check" disabled={busy || order.payment_status === "paid"} onPress={() => markPayment(true)}>Payment received</Btn>
                  <Btn full variant="danger" disabled={busy || order.payment_status === "pending"} onPress={() => markPayment(false)}>Not received</Btn>
                </View>
              )}
            </View>
          )}
          <Row label={`You owe GVCDA (${order.commission_pct}% commission)`} value={`₹${order.commission_amt}`} muted />
          <Row label="You keep" value={`₹${order.payout_amt}`} bold />
        </Card>

        {actions.length > 0 && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {actions.map(([status, label]) => (
              <Btn key={status} full disabled={busy} variant={status === "rejected" ? "danger" : "primary"} onPress={() => act(status)}>{label}</Btn>
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

function Row({ label, value, muted, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, color: muted ? T.inkSoft : T.ink }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? "800" : "600", color: bold ? T.teal : T.ink }}>{value}</Text>
    </View>
  );
}
