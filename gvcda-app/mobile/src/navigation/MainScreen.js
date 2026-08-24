import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import MemberTabs from "./MemberTabs";
import EmployeeTabs from "./EmployeeTabs";
import RetailerTabs from "./RetailerTabs";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

// Resolves to the right role-based tab shell after login — the "one app, role-based
// after login" architecture from PRD section 8. A retailer whose profile isn't
// approved yet gets redirected to the registration/pending flow instead.
export default function MainScreen({ navigation }) {
  const { session } = useAuth();
  const [checking, setChecking] = useState(session?.user.role === "retailer");

  useEffect(() => {
    if (!session || session.user.role !== "retailer") return;
    api.retailerMe()
      .then((r) => {
        if (r.retailer.status !== "approved") navigation.replace("RetailerPending");
        else setChecking(false);
      })
      .catch((e) => {
        // 401 already triggered a global logout (see api.js's onUnauthorized) — the
        // root navigator will swap to Login on its own, so do nothing here. Only a
        // real 404 ("no retailer profile for this account yet") means registration.
        if (e.status === 401) return;
        navigation.replace("RetailerRegister");
      });
  }, [session?.user.role]);

  // A forced logout (401) or manual "Log out" can unmount this mid-render, right
  // before navigation swaps to Login — render nothing for that one frame rather
  // than crash on session.user.
  if (!session || checking) {
    return (
      <View style={{ flex: 1, backgroundColor: T.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={T.teal} />
      </View>
    );
  }

  if (session.user.role === "employee") return <EmployeeTabs />;
  if (session.user.role === "retailer") return <RetailerTabs />;
  return <MemberTabs />;
}
