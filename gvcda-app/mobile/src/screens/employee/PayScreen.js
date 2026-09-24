import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { TopBar, Screen, Card, ErrorBanner, LoadingScreen, EmptyState } from "../../components/ui";
import IncentivesSection from "./IncentivesScreen";
import { api } from "../../api";
import { fmtDate, money } from "../../utils";
import { T } from "../../theme";

// Pay = monthly salary + this month's running incentive + payslip-style payment history,
// followed by the full incentive breakdown.
export default function PayScreen({ navigation }) {
  const [salary, setSalary] = useState(null);
  const [incentives, setIncentives] = useState(null);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    const fail = (e) => setError(e.message);
    api.employeeSalary().then(setSalary).catch(fail);
    api.employeeIncentives().then(setIncentives).catch(fail);
  }, []));

  const ready = salary && incentives;
  const cur = salary?.current_incentive;

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Pay" subtitle="Salary, incentives and payments" onBack={() => navigation.goBack()} />
      {!ready ? (error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />) : (
        <Screen>
          <ErrorBanner message={error} />
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <Card style={{ flex: 1, borderLeftWidth: 4, borderLeftColor: T.teal }}>
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: T.inkSoft }}>MONTHLY SALARY</Text>
              <Text style={{ fontSize: 19, fontWeight: "800", color: T.teal, marginTop: 4 }}>{money(salary.monthly_salary)}</Text>
            </Card>
            <Card style={{ flex: 1, borderLeftWidth: 4, borderLeftColor: T.terracotta }}>
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: T.inkSoft }}>INCENTIVE THIS MONTH</Text>
              <Text style={{ fontSize: 19, fontWeight: "800", color: T.terracotta, marginTop: 4 }}>{money(cur?.total)}</Text>
            </Card>
          </View>

          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Payment History</Text>
          {salary.history.length === 0 && <EmptyState icon="file-text" text="No salary payments recorded yet." />}
          {salary.history.map((h) => (
            <Card key={h.payment_id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "700" }}>{h.month}</Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: T.green }}>{money(h.total)}</Text>
              </View>
              <Line label="Base salary" value={money(h.base_amount)} />
              <Line label="Incentive" value={money(h.incentive_amount)} />
              {Number(h.deductions) > 0 ? <Line label="Deductions" value={`- ${money(h.deductions)}`} red /> : null}
              <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>
                {h.paid_on ? `Paid ${fmtDate(h.paid_on)}` : "Paid"}{h.reference ? ` • Ref ${h.reference}` : ""}
              </Text>
              {h.notes ? <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{h.notes}</Text> : null}
            </Card>
          ))}

          <View style={{ height: 14 }} />
          <IncentivesSection data={incentives} />
        </Screen>
      )}
    </View>
  );
}

function Line({ label, value, red }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
      <Text style={{ fontSize: 12, color: T.inkSoft }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: red ? T.red : T.ink }}>{value}</Text>
    </View>
  );
}
