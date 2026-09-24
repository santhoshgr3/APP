import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, ChangePasswordCard } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { photoUrl } from "../../api";
import RoleSwitcherCard from "../../components/RoleSwitcherCard";
import { T } from "../../theme";

const MENU = [
  ["IdCard", "ID Card & Profile", "credit-card", T.purple, T.purpleLight],
  ["Pay", "Pay — salary & incentives", "dollar-sign", T.green, T.greenLight],
  ["DailyReport", "Daily Work Report (Visits)", "map-pin", T.blue, T.blueLight],
  ["Support", "Help & Support", "life-buoy", T.terracotta, T.terracottaLight],
];

// Overflow menu for the Employee tab bar (kept to 5 tabs), plus account actions.
export default function MoreScreen({ navigation }) {
  const { session, logout } = useAuth();
  if (!session) return null; // mid-logout — navigation is about to swap to Login
  const { user } = session;
  const url = photoUrl(user.photo_filename);

  return (
    <Screen>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.tealLight, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {url ? <Image source={{ uri: url }} style={{ width: 44, height: 44 }} /> : (
            <Text style={{ fontWeight: "700", color: T.teal }}>{(user.full_name || "E").slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: "700" }}>{user.full_name}</Text>
          <Text style={{ fontSize: 11, color: T.inkSoft, textTransform: "capitalize" }}>{(user.designation || user.role).replaceAll("_", " ")}</Text>
        </View>
      </Card>

      {MENU.map(([route, label, icon, color, bg]) => (
        <Card key={route} onPress={() => navigation.navigate(route)} style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
            <Feather name={icon} size={16} color={color} />
          </View>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: "700" }}>{label}</Text>
          <Feather name="chevron-right" size={16} color={T.inkSoft} />
        </Card>
      ))}

      <View style={{ height: 8 }} />
      <RoleSwitcherCard />
      <ChangePasswordCard style={{ marginBottom: 8 }} />
      <Btn full variant="danger" icon="log-out" onPress={logout}>Log out</Btn>
    </Screen>
  );
}
