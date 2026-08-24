import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, LoadingScreen, EmptyState } from "../../components/ui";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";

// Screen Spec 1.6 — main landing screen, auto-filtered to the member's own village.
export default function HomeScreen({ navigation }) {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [membership, setMembership] = useState(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [home, mem] = await Promise.all([api.memberHome(), api.memberMembership()]);
    setData(home);
    setMembership(mem.membership);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!data) return <LoadingScreen />;

  return (
    <Screen scroll={false}>
      <FlatList
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Feather name="map-pin" size={13} color={T.terracotta} />
              <Text style={{ fontSize: 12, fontWeight: "700" }}>
                {data.user.village_id ? "Your village" : "No location set — complete your profile"}
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: T.tealDark, marginBottom: 14 }}>
              Namaste, {(data.user.full_name || "Member").split(" ")[0]}
            </Text>

            <TouchableOpacity onPress={() => navigation.navigate("DigitalCard")} style={{ marginBottom: 18 }}>
              {membership ? (
                <View style={{ backgroundColor: T.tealDark, borderRadius: 16, padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, letterSpacing: 1.5 }}>
                      GVCDA {membership.plan_name?.toUpperCase()}
                    </Text>
                    <Feather name="credit-card" size={18} color="#fff" />
                  </View>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 16, letterSpacing: 1.2 }}>
                    {membership.card_number}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5, marginTop: 8 }}>
                    Valid till {membership.end_date}
                  </Text>
                </View>
              ) : (
                <Card style={{ alignItems: "center", paddingVertical: 18 }}>
                  <Text style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>No active membership yet</Text>
                  <Text style={{ fontSize: 12, color: T.teal, fontWeight: "700" }}>Tap to buy a plan →</Text>
                </Card>
              )}
            </TouchableOpacity>

            <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Explore Sectors</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              {data.categories.map((c) => (
                <TouchableOpacity
                  key={c.category_id}
                  onPress={() => navigation.navigate("SectorDetail", { id: c.category_id, name: c.name })}
                  style={{ width: "22%", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: T.line, paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", textAlign: "center" }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Nearby Retailers</Text>
            {data.nearby.length === 0 && <EmptyState icon="search" text="No approved retailers in your village yet." />}
            {data.nearby.map((r) => (
              <Card key={r.retailer_id} onPress={() => navigation.navigate("RetailerProfile", { id: r.retailer_id })} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "700" }}>{r.business_name}</Text>
                <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{r.village_name}</Text>
              </Card>
            ))}
          </View>
        }
      />
    </Screen>
  );
}
