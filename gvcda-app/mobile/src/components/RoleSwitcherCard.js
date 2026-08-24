import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

const ROLE_LABEL = { member: "Member", employee: "Employee", retailer: "Retailer", admin: "Admin" };
const ROLE_ICON = { member: "user", employee: "briefcase", retailer: "shopping-bag", admin: "shield" };

// Screen Spec A.1 — Role Switcher. Single-role accounts never see this (it renders
// nothing), matching the spec's "the switcher itself doesn't render" state.
export default function RoleSwitcherCard() {
  const { session, switchRole } = useAuth();
  const roles = session?.roles || [];
  if (roles.length < 2) return null;

  return (
    <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 12, marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 8 }}>SWITCH ROLE</Text>
      {roles.map((r) => (
        <TouchableOpacity
          key={r}
          onPress={() => r !== session.user.role && switchRole(r)}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8,
            backgroundColor: r === session.user.role ? T.tealLight : "transparent",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name={ROLE_ICON[r] || "user"} size={14} color={r === session.user.role ? T.teal : T.inkSoft} />
            <Text style={{ fontSize: 12.5, fontWeight: r === session.user.role ? "700" : "500", color: T.ink }}>{ROLE_LABEL[r] || r}</Text>
          </View>
          {r === session.user.role && <Text style={{ fontSize: 9, fontWeight: "700", color: T.teal }}>ACTIVE</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}
