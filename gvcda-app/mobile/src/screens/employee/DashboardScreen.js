import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Btn, LoadingScreen, AnnouncementsCard } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 2.1 — daily landing screen, targets vs achieved.
export default function DashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  useFocusEffect(useCallback(() => { api.employeeDashboard().then(setData); }, []));
  if (!data) return <LoadingScreen />;

  return (
    <Screen>
      <Text style={{ fontSize: 12, color: T.inkSoft, marginBottom: 16 }}>
        {(data.employee.designation || "").replaceAll("_", " ") || "Field employee"}
        {data.employee.mandal_name || data.employee.district_name ? ` • ${data.employee.mandal_name || data.employee.district_name}` : ""}
      </Text>

      <AnnouncementsCard fetchFn={api.employeeBroadcasts} />

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: T.teal }}>{data.memberships_sold}</Text>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: "600" }}>Memberships / target {data.monthly_target}</Text>
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
