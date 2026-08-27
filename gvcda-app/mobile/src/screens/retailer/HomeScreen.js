import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Chip, LoadingScreen, EmptyState, AnnouncementsCard } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 3.3 — daily landing screen for an active retailer.
export default function RetailerHomeScreen({ navigation }) {
  const [retailer, setRetailer] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [newOrders, setNewOrders] = useState(null);

  useFocusEffect(useCallback(() => {
    api.retailerMe().then((r) => setRetailer(r.retailer));
    api.retailerEarnings().then(setEarnings);
    api.retailerOrders("placed").then(setNewOrders);
  }, []));

  if (!retailer || !earnings || !newOrders) return <LoadingScreen />;

  return (
    <Screen>
      <AnnouncementsCard fetchFn={api.retailerBroadcasts} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "800" }}>{retailer.business_name}</Text>
        <Chip tone="teal">{retailer.status}</Chip>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "700" }}>CASH COLLECTED (COD)</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 4 }}>₹{earnings.gross}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "700" }}>OWED TO GVCDA</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 4, color: T.terracotta }}>₹{earnings.commission_owed}</Text>
        </Card>
      </View>

      <Card onPress={() => navigation.navigate("Orders")} style={{ marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ fontSize: 13, fontWeight: "700" }}>New Orders</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft }}>{newOrders.length} pending</Text>
        </View>
        {newOrders.length > 0 && <Chip tone="gold">{newOrders.length}</Chip>}
      </Card>

      {newOrders.length === 0 && <EmptyState icon="inbox" text="No new orders right now." />}
      {newOrders.slice(0, 3).map((o) => (
        <Card key={o.order_id} onPress={() => navigation.navigate("OrderDetail", { id: o.order_id })} style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700" }}>#{o.order_id} • {o.member_name}</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>₹{o.order_total}</Text>
        </Card>
      ))}
    </Screen>
  );
}
