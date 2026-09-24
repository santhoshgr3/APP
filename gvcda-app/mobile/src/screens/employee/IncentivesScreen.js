import React from "react";
import { View, Text } from "react-native";
import { Card, EmptyState } from "../../components/ui";
import { fmtDate, money } from "../../utils";
import { T } from "../../theme";

// Screen Spec 2.5 — this month's incentive breakdown, running total, payout history.
// Rendered inside the Pay screen (see PayScreen.js), fed by GET /employee/incentives.
export default function IncentivesSection({ data }) {
  return (
    <View>
      <Card style={{ backgroundColor: T.tealDark, borderColor: T.tealDark, marginBottom: 16 }}>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" }}>INCENTIVES RUNNING TOTAL (ALL TIME)</Text>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 }}>{money(data.running_total)}</Text>
      </Card>

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>This Month's Incentive Breakdown</Text>
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

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Incentive Payout History</Text>
      {data.payout_history.length === 0 && <EmptyState icon="inbox" text="No payouts recorded yet." />}
      {data.payout_history.map((p) => (
        <Card key={p.payment_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{p.month}</Text>
            <Text style={{ fontSize: 11, color: T.inkSoft }}>{p.paid_on ? `Paid ${fmtDate(p.paid_on)}` : "Paid"}{p.reference ? ` • ${p.reference}` : ""}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: T.green }}>{money(p.incentive_amount)}</Text>
        </Card>
      ))}
    </View>
  );
}
