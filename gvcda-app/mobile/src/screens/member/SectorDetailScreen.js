import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "react-native";
import { TopBar, Screen, Card, LoadingScreen, EmptyState } from "../../components/ui";
import RetailerThumb from "../../components/RetailerThumb";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 1.7 — retailers/providers within a chosen sector, filtered to the
// member's Mandal by default (the backend already scopes /member/retailers this way).
export default function SectorDetailScreen({ navigation, route }) {
  const { id, name } = route.params;
  const [list, setList] = useState(null);

  useEffect(() => { api.memberRetailers({ category_id: id }).then(setList); }, [id]);

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={name} subtitle="Your Mandal & nearby" onBack={() => navigation.goBack()} />
      {!list ? <LoadingScreen /> : (
        <Screen>
          {list.length === 0 && <EmptyState icon="search" text={`No ${name} retailers listed in your Mandal yet.`} />}
          {list.map((r) => (
            <Card key={r.retailer_id} onPress={() => navigation.navigate("RetailerProfile", { id: r.retailer_id })} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <RetailerThumb photo={r.primary_photo} />
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{r.business_name}</Text>
                  <Text style={{ fontSize: 11, color: T.inkSoft }}>{r.village_name}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Feather name="star" size={12} color={T.gold} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: T.gold }}>{r.rating_avg || "New"}</Text>
              </View>
            </Card>
          ))}
        </Screen>
      )}
    </View>
  );
}
