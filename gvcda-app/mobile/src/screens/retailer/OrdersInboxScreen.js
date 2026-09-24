import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Btn, Chip, LoadingScreen, EmptyState, ErrorBanner } from "../../components/ui";
import { DELIVERY_LABEL, DELIVERY_TONE, paymentChip, fmtSlot, fmtDate } from "../../utils";
import { api } from "../../api";
import { T } from "../../theme";

const TABS = [
  ["placed", "New"],
  ["accepted", "Accepted"],
  ["fulfilled", "Fulfilled"],
  ["rejected", "Rejected"],
];

// Screen Spec 3.4 — where retailers action incoming demand.
export default function OrdersInboxScreen({ navigation }) {
  const [tab, setTab] = useState("placed");
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => api.retailerOrders(tab).then((o) => { setError(""); setOrders(o); }).catch((e) => { setError(e.message); setOrders((cur) => cur || []); }), [tab]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (id, status) => {
    setError("");
    try { await api.updateOrderStatus(id, status); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <Screen scroll={false} style={{ padding: 0 }}>
      <View style={{ flexDirection: "row", padding: 12, gap: 6 }}>
        {TABS.map(([id, label]) => (
          <Btn key={id} full variant={tab === id ? "primary" : "ghost"} onPress={() => { setOrders(null); setTab(id); }} style={{ paddingHorizontal: 4 }}>
            {label}
          </Btn>
        ))}
      </View>
      <Screen>
        <ErrorBanner message={error} />
        {orders === null ? <LoadingScreen text="" /> : orders.length === 0 ? <EmptyState icon="inbox" text="Nothing here yet." /> : (
          orders.map((o) => (
            <Card key={o.order_id} style={{ marginBottom: 8 }}>
              <TouchableOpacity onPress={() => navigation.navigate("OrderDetail", { id: o.order_id })} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700" }}>#{o.order_id} • {o.member_name}</Text>
                  <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>₹{o.order_total} • {fmtDate(o.placed_at)}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                    {o.delivery_method ? <Chip tone={DELIVERY_TONE[o.delivery_method] || "teal"}>{DELIVERY_LABEL[o.delivery_method] || o.delivery_method}</Chip> : null}
                    <Chip tone={paymentChip(o).tone}>{paymentChip(o).label}</Chip>
                  </View>
                  {o.scheduled_for ? <Text style={{ fontSize: 10.5, color: T.purple, fontWeight: "700", marginTop: 4 }}>Booking: {fmtSlot(o.scheduled_for)}</Text> : null}
                  {o.delivery_address && o.delivery_method !== "pickup" ? <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }} numberOfLines={1}>📍 {o.delivery_address}</Text> : null}
                </View>
                <Chip tone={o.status === "fulfilled" ? "green" : o.status === "rejected" || o.status === "cancelled" ? "red" : o.status === "accepted" ? "blue" : "gold"}>{o.status}</Chip>
              </TouchableOpacity>
              {tab === "placed" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <Btn full onPress={() => act(o.order_id, "accepted")}>Accept</Btn>
                  <Btn full variant="danger" onPress={() => act(o.order_id, "rejected")}>Reject</Btn>
                </View>
              )}
              {tab === "accepted" && (
                <View style={{ marginTop: 10 }}>
                  <Btn full onPress={() => act(o.order_id, "fulfilled")}>Mark Fulfilled</Btn>
                </View>
              )}
            </Card>
          ))
        )}
      </Screen>
    </Screen>
  );
}
