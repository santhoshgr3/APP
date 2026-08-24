import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { TopBar, Screen, Card, Btn, Chip, LoadingScreen } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

const NEXT_ACTION = { placed: [["accepted", "Accept"], ["rejected", "Reject"]], accepted: [["fulfilled", "Mark Fulfilled"]] };

// Screen Spec 3.5 — full view of a single order for fulfilment.
export default function OrderDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);

  const load = () => api.retailerOrderDetail(id).then(setData);
  useEffect(() => { load(); }, [id]);

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Order" onBack={() => navigation.goBack()} />
      <LoadingScreen />
    </View>
  );

  const { order, items } = data;
  const actions = NEXT_ACTION[order.status] || [];

  const act = async (status) => { await api.updateOrderStatus(id, status); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={`Order #${order.order_id}`} onBack={() => navigation.goBack()} />
      <Screen>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
          <Chip>{order.status}</Chip>
          <Text style={{ fontSize: 11, color: T.inkSoft }}>{new Date(order.placed_at).toLocaleString()}</Text>
        </View>

        <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Items</Text>
        {items.map((i) => (
          <Card key={i.order_item_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12.5 }}>{i.name} × {i.quantity}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: "700" }}>₹{i.line_total}</Text>
          </Card>
        ))}

        <Card style={{ marginTop: 8, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft }}>PAYMENT</Text>
            <Chip>Cash on Delivery</Chip>
          </View>
          <Row label="Collect from member" value={`₹${order.order_total}`} />
          <Row label={`You owe GVCDA (${order.commission_pct}% commission)`} value={`₹${order.commission_amt}`} muted />
          <Row label="You keep" value={`₹${order.payout_amt}`} bold />
        </Card>

        {actions.length > 0 && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {actions.map(([status, label]) => (
              <Btn key={status} full variant={status === "rejected" ? "danger" : "primary"} onPress={() => act(status)}>{label}</Btn>
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
