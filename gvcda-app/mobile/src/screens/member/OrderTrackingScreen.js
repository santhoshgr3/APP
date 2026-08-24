import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, LoadingScreen } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

const STEPS = ["placed", "accepted", "fulfilled"];
const STEP_LABEL = { placed: "Placed", accepted: "Accepted", fulfilled: "Fulfilled" };

// Screen Spec 1.9 (tracking view) — status stepper: Placed -> Accepted -> Fulfilled.
export default function OrderTrackingScreen({ navigation, route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);

  useEffect(() => { api.memberOrderDetail(id).then(setData); }, [id]);

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Order" onBack={() => navigation.goBack()} />
      <LoadingScreen />
    </View>
  );

  const { order, items } = data;
  const isTerminalBad = order.status === "rejected" || order.status === "cancelled";
  const currentIdx = STEPS.indexOf(order.status);

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={`Order #${order.order_id}`} subtitle={order.business_name} onBack={() => navigation.goBack()} />
      <Screen>
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

        <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Items</Text>
        {items.map((i) => (
          <Card key={i.order_item_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12.5 }}>{i.name} × {i.quantity}</Text>
            <Text style={{ fontSize: 12.5, fontWeight: "700" }}>₹{i.line_total}</Text>
          </Card>
        ))}
        <Card style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700" }}>Total</Text>
          <Text style={{ fontWeight: "800", color: T.teal }}>₹{order.order_total}</Text>
        </Card>
      </Screen>
    </View>
  );
}
