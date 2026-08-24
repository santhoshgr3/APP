import React from "react";
import { View, Text } from "react-native";
import { Screen, Card, Btn } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import RoleSwitcherCard from "../../components/RoleSwitcherCard";
import { T } from "../../theme";

// Not one of the spec's 6 numbered Employee screens, but every role needs somewhere
// to log out and (for dual-role accounts) reach the Role Switcher.
export default function MoreScreen() {
  const { session, logout } = useAuth();
  if (!session) return null; // mid-logout — navigation is about to swap to Login
  const { user } = session;

  return (
    <Screen>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.tealLight, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "700", color: T.teal }}>{(user.full_name || "E").slice(0, 2).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: "700" }}>{user.full_name}</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft, textTransform: "capitalize" }}>{(user.designation || user.role).replaceAll("_", " ")}</Text>
        </View>
      </Card>
      <RoleSwitcherCard />
      <Btn full variant="danger" icon="log-out" onPress={logout}>Log out</Btn>
    </Screen>
  );
}
