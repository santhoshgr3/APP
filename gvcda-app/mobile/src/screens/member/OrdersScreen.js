import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Chip, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

const TONE = { fulfilled: "teal", rejected: "red", cancelled: "red" };

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState(null);

  useFocusEffect(useCallback(() => { api.memberOrders().then(setOrders); }, []));

  if (!orders) return <LoadingScreen />;

  return (
    <Screen>
      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Your Orders</Text>
      {orders.length === 0 && <EmptyState icon="clipboard" text="No orders yet." />}
      {orders.map((o) => (
        <Card key={o.order_id} onPress={() => navigation.navigate("OrderTracking", { id: o.order_id })} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 12.5, fontWeight: "700" }}>#{o.order_id} • {o.business_name}</Text>
            <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>₹{o.order_total} • {new Date(o.placed_at).toLocaleDateString()}</Text>
          </View>
          <Chip tone={TONE[o.status] || "gold"}>{o.status}</Chip>
        </Card>
      ))}
    </Screen>
  );
}
