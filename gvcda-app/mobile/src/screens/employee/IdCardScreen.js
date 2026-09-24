import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { TopBar, Screen, Card, ErrorBanner, LoadingScreen } from "../../components/ui";
import ProfilePhoto from "../../components/ProfilePhoto";
import EmailCard from "../../components/EmailCard";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";

// Employee ID card: photo (upload/change/remove), name, designation, employee code, contact
// and location, with an editable email underneath.
export default function IdCardScreen({ navigation }) {
  const { session } = useAuth();
  const [emp, setEmp] = useState(null);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    api.employeeDashboard().then((d) => { setError(""); setEmp(d.employee); }).catch((e) => setError(e.message));
  }, []));

  const user = session?.user;
  if (!user) return null;
  const place = emp ? [emp.mandal_name, emp.district_name].filter(Boolean).join(", ") : "";

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="ID Card" onBack={() => navigation.goBack()} />
      {!emp ? (error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />) : (
        <Screen>
          <ErrorBanner message={error} />
          <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: T.line, overflow: "hidden", marginBottom: 16 }}>
            <View style={{ backgroundColor: T.tealDark, paddingVertical: 12, paddingHorizontal: 16 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 1 }}>GVCDA</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5 }}>Employee Identity Card</Text>
            </View>
            <View style={{ padding: 18, alignItems: "center" }}>
              <ProfilePhoto size={96} />
              <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 12 }}>{user.full_name}</Text>
              <Text style={{ fontSize: 12, color: T.teal, fontWeight: "700", textTransform: "capitalize", marginTop: 2 }}>
                {(emp.designation || "Field employee").replaceAll("_", " ")}
              </Text>
              <View style={{ backgroundColor: T.purpleLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: T.purple, letterSpacing: 1 }}>{emp.employee_code || "ID pending"}</Text>
              </View>
              <View style={{ alignSelf: "stretch", marginTop: 14, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 10 }}>
                <Line label="Phone" value={emp.phone || user.phone} />
                {place ? <Line label="Area" value={place} /> : null}
                <Line label="Email" value={user.email || "Not added"} />
              </View>
            </View>
          </View>
          <EmailCard />
        </Screen>
      )}
    </View>
  );
}

function Line({ label, value }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</Text>
      <Text style={{ fontSize: 12.5, fontWeight: "700", flexShrink: 1, textAlign: "right", marginLeft: 12 }}>{value}</Text>
    </View>
  );
}
