import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Btn, Chip, LoadingScreen, EmptyState } from "../../components/ui";
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

  const load = useCallback(() => api.retailerOrders(tab).then(setOrders), [tab]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (id, status) => { await api.updateOrderStatus(id, status); load(); };

  return (
    <Screen scroll={false} style={{ padding: 0 }}>
      <View style={{ flexDirection: "row", padding: 12, gap: 6 }}>
        {TABS.map(([id, label]) => (
          <Btn key={id} full variant={tab === id ? "primary" : "ghost"} onPress={() => setTab(id)} style={{ paddingHorizontal: 4 }}>
            {label}
          </Btn>
        ))}
      </View>
      <Screen>
        {orders === null ? <LoadingScreen text="" /> : orders.length === 0 ? <EmptyState icon="inbox" text="Nothing here yet." /> : (
          orders.map((o) => (
            <Card key={o.order_id} style={{ marginBottom: 8 }}>
              <TouchableOpacity onPress={() => navigation.navigate("OrderDetail", { id: o.order_id })} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: "700" }}>#{o.order_id} • {o.member_name}</Text>
                  <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>₹{o.order_total} • {new Date(o.placed_at).toLocaleDateString()}</Text>
                </View>
                <Chip>{o.status}</Chip>
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
