import React, { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, LoadingScreen } from "../../components/ui";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";

// Screen Spec 3.2 — holding screen until Admin approves.
export default function PendingApprovalScreen({ navigation }) {
  const { logout } = useAuth();
  const [retailer, setRetailer] = useState(undefined);

  const load = useCallback(() => api.retailerMe().then((r) => setRetailer(r.retailer)), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (retailer?.status === "approved") {
      navigation.replace("Main");
    }
  }, [retailer]);

  if (retailer === undefined) return <LoadingScreen />;

  return (
    <Screen style={{ alignItems: "center", paddingTop: 60 }}>
      {retailer.status === "rejected" ? (
        <>
          <Feather name="x-circle" size={48} color={T.red} />
          <Text style={{ fontWeight: "700", fontSize: 15, marginTop: 14 }}>Listing rejected</Text>
          {retailer.rejection_reason ? (
            <Text style={{ color: T.inkSoft, fontSize: 12, marginTop: 6, textAlign: "center" }}>Reason: {retailer.rejection_reason}</Text>
          ) : null}
        </>
      ) : (
        <>
          <Feather name="clock" size={48} color={T.gold} />
          <Text style={{ fontWeight: "700", fontSize: 15, marginTop: 14 }}>Your listing is under review</Text>
          <Text style={{ color: T.inkSoft, fontSize: 12, marginTop: 6, textAlign: "center" }}>
            Estimated review time: 1–2 business days. We'll unlock your dashboard as soon as Admin approves {retailer.business_name}.
          </Text>
        </>
      )}
      <Card style={{ marginTop: 24, width: "100%" }}>
        <Text style={{ fontSize: 11, color: T.inkSoft, fontWeight: "700", marginBottom: 4 }}>BUSINESS</Text>
        <Text style={{ fontSize: 14, fontWeight: "700" }}>{retailer.business_name}</Text>
      </Card>
      <Btn full variant="ghost" style={{ marginTop: 16 }} onPress={load}>Refresh status</Btn>
      <Btn full variant="ghost" style={{ marginTop: 8 }} icon="phone" onPress={() => {}}>Contact support: 1800-000-0000</Btn>
      <Btn full variant="danger" style={{ marginTop: 8 }} icon="log-out" onPress={logout}>Log out</Btn>
    </Screen>
  );
}
