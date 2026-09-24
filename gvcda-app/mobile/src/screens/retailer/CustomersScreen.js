import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Input, ErrorBanner, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { fmtDate, money } from "../../utils";
import { T } from "../../theme";

// Customers who have ordered from this shop — searchable by name or phone.
export default function CustomersScreen({ navigation }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    setError("");
    api.retailerCustomers().then(setRows).catch((e) => { setError(e.message); setRows((r) => r || []); });
  }, []));

  if (rows === null) return <LoadingScreen />;

  const needle = q.trim().toLowerCase();
  const list = needle ? rows.filter((c) => (c.full_name || "").toLowerCase().includes(needle) || (c.phone || "").includes(needle)) : rows;

  return (
    <Screen>
      <ErrorBanner message={error} />
      <Input placeholder="Search by name or phone..." value={q} onChangeText={setQ} style={{ marginBottom: 12 }} />
      {list.length === 0 && !error && (
        <EmptyState icon="users" text={q ? `No customers match "${q}".` : "No customers yet — they appear here after their first order."} />
      )}
      {list.map((c) => (
        <Card key={c.member_id} onPress={() => navigation.navigate("CustomerDetail", { memberId: c.member_id, name: c.full_name })} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700" }}>{c.full_name}</Text>
              <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>{c.phone}</Text>
            </View>
            {c.avg_rating != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Feather name="star" size={12} color={T.gold} />
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: T.gold }}>{Number(c.avg_rating).toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Stat label="Orders" value={`${c.order_count}${Number(c.fulfilled_count) !== Number(c.order_count) ? ` (${c.fulfilled_count} done)` : ""}`} color={T.blue} />
            <Stat label="Spent" value={money(c.total_spent)} color={T.green} />
            <Stat label="Last order" value={c.last_order_at ? fmtDate(c.last_order_at) : "-"} color={T.terracotta} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function Stat({ label, value, color }) {
  return (
    <View>
      <Text style={{ fontSize: 10, color: T.inkSoft, fontWeight: "700" }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 12.5, fontWeight: "800", color, marginTop: 1 }}>{value}</Text>
    </View>
  );
}
