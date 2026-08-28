import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, Chip, LoadingScreen, EmptyState, ErrorBanner } from "../../components/ui";
import BankTransferQR from "../../components/BankTransferQR";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 3.7 — financial transparency. Every order is Cash on Delivery, so
// the retailer collects the full amount directly and owes GVCDA the commission —
// settled the same way a member pays for membership: bank/UPI transfer + QR.
export default function EarningsScreen() {
  const [earnings, setEarnings] = useState(null);
  const [history, setHistory] = useState(null);
  const [trend, setTrend] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.retailerEarnings().then(setEarnings);
    api.commissionRequests().then(setHistory);
    api.retailerEarningsTrend(14).then(setTrend);
    api.retailerReviews().then(setReviews);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startSettlement = async () => {
    setStarting(true); setError("");
    try { setCheckout(await api.commissionCheckout()); }
    catch (e) { setError(e.message); }
    setStarting(false);
  };

  if (checkout) {
    return (
      <BankTransferQR
        title={`Settle ₹${checkout.amount}`}
        subtitle="Commission owed to GVCDA"
        checkout={checkout}
        onSubmitUtr={api.submitCommissionUtr}
        onBack={() => setCheckout(null)}
        onDone={() => { setCheckout(null); load(); }}
      />
    );
  }

  if (!earnings || !history) return <LoadingScreen />;

  return (
    <Screen>
      <Card style={{ marginBottom: 14 }}>
        <Row label="Cash collected (COD)" value={`₹${earnings.gross}`} />
        <Row label="Total commission" value={`₹${earnings.commission}`} muted />
        <Row label="You keep" value={`₹${earnings.net}`} bold />
        <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>{earnings.order_count} fulfilled order(s) to date.</Text>
      </Card>

      {trend && (
        <Card style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 10 }}>SALES — LAST 14 DAYS</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 60 }}>
            {trend.map((d) => {
              const max = Math.max(...trend.map((x) => x.gross), 1);
              return <View key={d.day} style={{ flex: 1, height: `${Math.max(4, (d.gross / max) * 100)}%`, backgroundColor: d.gross > 0 ? T.teal : T.line, borderRadius: 2 }} />;
            })}
          </View>
        </Card>
      )}

      <Card style={{ marginBottom: 14, backgroundColor: earnings.commission_owed > 0 ? T.terracottaLight : "#fff" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft }}>OWED TO GVCDA</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: earnings.commission_owed > 0 ? T.terracotta : T.teal }}>₹{earnings.commission_owed}</Text>
          </View>
          {earnings.commission_owed > 0 && (
            <Btn icon="dollar-sign" onPress={startSettlement} disabled={starting}>{starting ? "Preparing..." : "Settle Now"}</Btn>
          )}
        </View>
        <ErrorBanner message={error} />
      </Card>

      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Settlement History</Text>
      {history.length === 0 ? <EmptyState icon="dollar-sign" text="No settlements yet." /> : (
        history.map((h) => (
          <Card key={h.request_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: "700" }}>₹{h.amount} — {h.reference_code}</Text>
              <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>{new Date(h.created_at).toLocaleDateString()}</Text>
            </View>
            <Chip tone={h.status === "verified" ? "teal" : h.status === "rejected" ? "red" : "gold"}>{h.status}</Chip>
          </Card>
        ))
      )}

      {reviews && reviews.length > 0 && (
        <>
          <Text style={{ fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 10 }}>Customer Reviews</Text>
          {reviews.map((r, i) => (
            <Card key={i} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700" }}>{r.member_name}</Text>
                <Text style={{ fontSize: 11, color: T.gold }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
              </View>
              {r.comment ? <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>{r.comment}</Text> : null}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function Row({ label, value, muted, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, color: muted ? T.inkSoft : T.ink }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? "800" : "600", color: bold ? T.teal : T.ink }}>{value}</Text>
    </View>
  );
}
