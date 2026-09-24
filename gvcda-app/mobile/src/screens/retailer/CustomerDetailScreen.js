import React, { useCallback, useState } from "react";
import { View, Text, Linking, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, Chip, ErrorBanner, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { fmtDate, money } from "../../utils";
import { T } from "../../theme";

const STATUS_TONE = { placed: "gold", accepted: "blue", fulfilled: "green", rejected: "red", cancelled: "red" };

// One customer's order history with this shop, plus the feedback they've left.
export default function CustomerDetailScreen({ navigation, route }) {
  const { memberId, name } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    setError("");
    api.retailerCustomerDetail(memberId).then(setData).catch((e) => setError(e.message));
  }, [memberId]));

  const c = data?.customer;

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={c?.full_name || name || "Customer"} subtitle={c?.phone} onBack={() => navigation.goBack()} />
      {!data ? (error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />) : (
        <Screen>
          <Card style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: "700" }}>{c.full_name}</Text>
            {c.phone ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                <Feather name="phone" size={13} color={T.teal} />
                <Text style={{ fontSize: 12.5, color: T.teal, fontWeight: "700" }}>{c.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {c.address ? <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6 }}>{c.address}</Text> : null}
          </Card>

          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Orders ({data.orders.length})</Text>
          {data.orders.length === 0 && <EmptyState icon="inbox" text="No orders yet." />}
          {data.orders.map((o) => (
            <Card key={o.order_id} onPress={() => navigation.navigate("OrderDetail", { id: o.order_id })} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 12.5, fontWeight: "700" }}>#{o.order_id} • {money(o.order_total)}</Text>
                <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{fmtDate(o.placed_at)}</Text>
              </View>
              <Chip tone={STATUS_TONE[o.status] || "gold"}>{o.status}</Chip>
            </Card>
          ))}

          <Text style={{ fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 10 }}>Feedback</Text>
          {data.reviews.length === 0 && <EmptyState icon="message-square" text="This customer hasn't left feedback yet." />}
          {data.reviews.map((r, i) => (
            <Card key={i} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 11, color: T.gold }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
                <Text style={{ fontSize: 10.5, color: T.inkSoft }}>Order #{r.order_id} • {fmtDate(r.created_at)}</Text>
              </View>
              {r.comment ? <Text style={{ fontSize: 12, color: T.ink, marginTop: 4 }}>{r.comment}</Text> : null}
            </Card>
          ))}
        </Screen>
      )}
    </View>
  );
}
