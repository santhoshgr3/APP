import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { TopBar, Screen, Btn, LoadingScreen, Chip } from "../components/ui";
import { api } from "../api";
import { T } from "../theme";

// Screen Spec 1.4 — converts a registered user into a paying member.
export default function PlanSelectScreen({ navigation, route }) {
  const skippable = route?.params?.skippable !== false;
  const [plans, setPlans] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => { api.plans().then(setPlans); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Choose your membership" subtitle="Annual plan, renews yearly" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      {!plans ? <LoadingScreen /> : (
        <Screen>
          {plans.map((p, i) => (
            <TouchableOpacity
              key={p.plan_id}
              onPress={() => setSelected(p)}
              style={{
                borderWidth: 2, borderColor: selected?.plan_id === p.plan_id ? T.teal : T.line,
                borderRadius: 12, padding: 14, marginBottom: 10, backgroundColor: "#fff",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontWeight: "700", fontSize: 15 }}>{p.name}</Text>
                  {i === 1 ? <Chip tone="gold">Most Popular</Chip> : null}
                </View>
                <Text style={{ fontWeight: "800", fontSize: 16, color: T.teal }}>₹{p.price}</Text>
              </View>
              <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6 }}>{p.benefits.join(" • ")}</Text>
            </TouchableOpacity>
          ))}

          <Btn full disabled={!selected} onPress={() => navigation.navigate("Payment", { plan: selected })} style={{ marginTop: 8 }}>
            {selected ? `Continue to Payment — ₹${selected.price}` : "Select a plan"}
          </Btn>

          {skippable && (
            <Btn full variant="ghost" style={{ marginTop: 8 }} onPress={() => navigation.replace("Main")}>
              Skip for now (browse-only)
            </Btn>
          )}
        </Screen>
      )}
    </View>
  );
}
