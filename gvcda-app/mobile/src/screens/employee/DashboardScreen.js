import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Btn, Chip, ErrorBanner, LoadingScreen, AnnouncementsCard } from "../../components/ui";
import { api } from "../../api";
import { fmtTime } from "../../utils";
import { T } from "../../theme";

// Screen Spec 2.1 — daily landing screen, targets vs achieved.
export default function DashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    api.employeeDashboard().then((d) => { setError(""); setData(d); }).catch((e) => setError(e.message));
  }, []));
  if (!data) return error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />;

  const target = Number(data.monthly_target) || 0;
  const progress = Number(data.month_progress) || 0;
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  const today = data.today_attendance;
  const attState = !today?.check_in_at ? "Not checked in" : today.check_out_at ? "Checked out" : "Checked in";
  const attTone = !today?.check_in_at ? "gold" : today.check_out_at ? "blue" : "green";

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: T.inkSoft, flexShrink: 1 }}>
          {(data.employee.designation || "").replaceAll("_", " ") || "Field employee"}
          {data.employee.mandal_name || data.employee.district_name ? ` • ${data.employee.mandal_name || data.employee.district_name}` : ""}
        </Text>
        {data.employee.employee_code ? <Chip tone="purple">{data.employee.employee_code}</Chip> : null}
      </View>

      <ErrorBanner message={error} />
      <AnnouncementsCard fetchFn={api.employeeBroadcasts} />

      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft }}>THIS MONTH'S TARGET</Text>
          <Text style={{ fontSize: 13, fontWeight: "800", color: T.teal }}>{progress} of {target}</Text>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: T.tealLight, marginTop: 8, overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: pct >= 100 ? T.green : T.teal, borderRadius: 5 }} />
        </View>
        <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>
          {target === 0 ? "No target set for you yet." : pct >= 100 ? "Target reached — great work!" : `${pct}% done • ${target - progress} to go`}
        </Text>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <Card style={{ flex: 1 }} onPress={() => navigation.navigate("Attendance")}>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "700", marginBottom: 6 }}>TODAY</Text>
          <Chip tone={attTone}>{attState}</Chip>
          {today?.check_in_at ? (
            <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>
              {fmtTime(today.check_in_at)}{today.check_out_at ? ` - ${fmtTime(today.check_out_at)}` : ""}
            </Text>
          ) : null}
        </Card>
        <Card style={{ flex: 1 }} onPress={() => navigation.navigate("Tasks")}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: data.open_tasks > 0 ? T.terracotta : T.green }}>{data.open_tasks}</Text>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "600" }}>Open task{data.open_tasks === 1 ? "" : "s"}</Text>
        </Card>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: T.teal }}>{data.memberships_sold}</Text>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "600" }}>Memberships sold</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: T.terracotta }}>{data.retailers_listed}</Text>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "600" }}>Retailers listed ({data.retailers_pending} pending)</Text>
        </Card>
      </View>

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Quick Actions</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn full icon="user-plus" onPress={() => navigation.navigate("EnrolMember")}>Enrol Member</Btn>
        <Btn full variant="secondary" icon="shopping-bag" onPress={() => navigation.navigate("ListRetailer")}>List Retailer</Btn>
      </View>
    </Screen>
  );
}
