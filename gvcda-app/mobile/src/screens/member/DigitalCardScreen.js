import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { TopBar, Screen, Btn, LoadingScreen, Chip } from "../../components/ui";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";

// Screen Spec Component 0 — digital membership card with QR code, shown at
// retailer point-of-sale for discount verification. Encodes member_id + card
// number + expiry as JSON — a retailer-side scanner just needs to parse that.
export default function DigitalCardScreen({ navigation }) {
  const { session } = useAuth();
  const [membership, setMembership] = useState(undefined);

  useEffect(() => { api.memberMembership().then((r) => setMembership(r.membership)); }, []);

  if (!session) return null; // mid-logout — navigation is about to swap to Login

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Digital Membership Card" onBack={() => navigation.goBack()} />
      {membership === undefined ? <LoadingScreen /> : membership === null ? (
        <Screen style={{ alignItems: "center", paddingTop: 60 }}>
          <Feather name="credit-card" size={40} color={T.line} />
          <Text style={{ color: T.inkSoft, marginTop: 12, marginBottom: 16 }}>No active membership yet</Text>
          <Btn onPress={() => navigation.navigate("PlanSelect", { skippable: false })}>Buy Membership</Btn>
        </Screen>
      ) : (
        <Screen style={{ alignItems: "center" }}>
          <View style={{ width: "100%", backgroundColor: T.tealDark, borderRadius: 20, padding: 22 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, letterSpacing: 1.5 }}>
                GVCDA {membership.plan_name?.toUpperCase()}
              </Text>
              <Chip>{membership.status}</Chip>
            </View>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 26, letterSpacing: 1.5 }}>
              {membership.card_number}
            </Text>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 18 }}>{session.user.full_name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 4 }}>
              Valid: {membership.start_date} → {membership.end_date}
            </Text>
          </View>

          <View style={{ width: 170, height: 170, backgroundColor: "#fff", borderRadius: 14, marginTop: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: T.line }}>
            <QRCode
              value={JSON.stringify({ member_id: session.user.user_id, card_number: membership.card_number, expiry: membership.end_date })}
              size={140}
            />
          </View>
          <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 14, textAlign: "center" }}>
            Show this to a retailer to verify your membership discount at checkout.
          </Text>
        </Screen>
      )}
    </View>
  );
}
