import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 2.5 — this month's incentive breakdown, running total, payout history.
export default function IncentivesScreen() {
  const [data, setData] = useState(null);
  useFocusEffect(useCallback(() => { api.employeeIncentives().then(setData); }, []));
  if (!data) return <LoadingScreen />;

  return (
    <Screen>
      <Card style={{ backgroundColor: T.tealDark, borderColor: T.tealDark, marginBottom: 16 }}>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" }}>RUNNING TOTAL (ALL TIME)</Text>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 }}>₹{data.running_total}</Text>
      </Card>

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>This Month's Breakdown</Text>
      <Card style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 12.5, fontWeight: "700" }}>Memberships sold</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft }}>{data.this_month.membership_count} × ₹{data.this_month.membership_rate}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: "800", color: T.teal }}>₹{data.this_month.membership_amount}</Text>
      </Card>
      <Card style={{ marginBottom: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 12.5, fontWeight: "700" }}>Retailers onboarded</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft }}>{data.this_month.retailer_count} × ₹{data.this_month.retailer_rate}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: "800", color: T.terracotta }}>₹{data.this_month.retailer_amount}</Text>
      </Card>

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Payout History</Text>
      {data.payout_history.length === 0 && <EmptyState icon="inbox" text="No payouts recorded yet." />}
    </Screen>
  );
}
