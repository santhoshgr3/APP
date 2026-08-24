import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Screen, Card, Btn, Chip, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

const RETAILER_TONE = { approved: "teal", pending: "gold", rejected: "red", suspended: "red" };

// Screen Spec 2.4 — employee's own book of business, two tabs: Members / Retailers.
export default function MyBookScreen() {
  const [sub, setSub] = useState("members");
  const [members, setMembers] = useState(null);
  const [retailers, setRetailers] = useState(null);

  useFocusEffect(useCallback(() => {
    api.employeeMembers().then(setMembers);
    api.employeeRetailers().then(setRetailers);
  }, []));

  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        <Btn full variant={sub === "members" ? "primary" : "ghost"} onPress={() => setSub("members")}>Members</Btn>
        <Btn full variant={sub === "retailers" ? "primary" : "ghost"} onPress={() => setSub("retailers")}>Retailers</Btn>
      </View>

      {sub === "members" ? (
        members === null ? <LoadingScreen text="" /> : members.length === 0 ? <EmptyState icon="users" text="No members enrolled yet." /> : (
          members.map((m) => (
            <Card key={m.user_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{m.full_name}</Text>
                <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{m.plan_name} • {m.village_name || "—"}</Text>
              </View>
              <Chip>{m.status}</Chip>
            </Card>
          ))
        )
      ) : (
        retailers === null ? <LoadingScreen text="" /> : retailers.length === 0 ? <EmptyState icon="shopping-bag" text="No retailers listed yet." /> : (
          retailers.map((r) => (
            <Card key={r.retailer_id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{r.business_name}</Text>
                  <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{r.village_name}</Text>
                </View>
                <Chip tone={RETAILER_TONE[r.status]}>{r.status}</Chip>
              </View>
              {r.status === "rejected" && r.rejection_reason && (
                <Text style={{ fontSize: 11, color: T.red, marginTop: 6 }}>Reason: {r.rejection_reason}</Text>
              )}
            </Card>
          ))
        )
      )}
    </Screen>
  );
}
