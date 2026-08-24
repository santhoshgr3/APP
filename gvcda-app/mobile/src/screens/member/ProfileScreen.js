import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Screen, Card, Btn, LoadingScreen } from "../../components/ui";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import RoleSwitcherCard from "../../components/RoleSwitcherCard";
import { T } from "../../theme";

// Screen Spec 1.10 — utility hub: account, membership renewal, complaints, help.
export default function ProfileScreen({ navigation }) {
  const { session, logout } = useAuth();
  const [membership, setMembership] = useState(undefined);

  useEffect(() => { api.memberMembership().then((r) => setMembership(r.membership)); }, []);

  if (!session) return null; // mid-logout — navigation is about to swap to Login
  const { user } = session;

  const daysLeft = membership ? Math.ceil((new Date(membership.end_date) - new Date()) / 86400000) : null;

  return (
    <Screen>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.tealLight, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "700", color: T.teal }}>{(user.full_name || "M").slice(0, 2).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: "700" }}>{user.full_name}</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft }}>{user.phone}</Text>
        </View>
      </Card>

      <RoleSwitcherCard />

      {membership === undefined && <LoadingScreen text="" />}
      {membership === null && (
        <Card style={{ marginBottom: 12, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>No active membership yet.</Text>
          <Btn full onPress={() => navigation.navigate("PlanSelect", { skippable: false })}>Buy Membership</Btn>
        </Card>
      )}
      {membership && daysLeft <= 30 && (
        <Card style={{ marginBottom: 12, backgroundColor: T.goldLight, borderColor: T.goldLight }}>
          <Text style={{ fontSize: 12, color: "#8A6A0C", fontWeight: "700" }}>
            Membership expires in {daysLeft} days — renew soon to avoid a lapse.
          </Text>
        </Card>
      )}

      <Btn full variant="ghost" icon="credit-card" style={{ marginBottom: 8 }} onPress={() => navigation.navigate("DigitalCard")}>
        Digital membership card
      </Btn>
      <Btn full variant="ghost" icon="alert-circle" style={{ marginBottom: 8 }} onPress={() => navigation.navigate("Complaint")}>
        Raise a complaint
      </Btn>
      {!session.roles?.includes("retailer") && (
        <Btn full variant="ghost" icon="shopping-bag" style={{ marginBottom: 8 }} onPress={() => navigation.navigate("RetailerRegister")}>
          Register your business (become a Retailer)
        </Btn>
      )}
      <Btn full variant="ghost" icon="phone" style={{ marginBottom: 16 }} onPress={() => {}}>
        Helpline: 1800-000-0000
      </Btn>
      <Btn full variant="danger" icon="log-out" onPress={logout}>Log out</Btn>
    </Screen>
  );
}
