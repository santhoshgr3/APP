import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Card, Chip, LoadingScreen, EmptyState, ErrorBanner } from "../../components/ui";
import { api } from "../../api";
import { fmtDate, money } from "../../utils";
import { T } from "../../theme";

const STATUS_TONE = { paid: "green", verified: "green", pending: "gold", submitted: "blue", rejected: "red", cancelled: "red" };
const METHOD_LABEL = { cod: "Cash on delivery", upi: "UPI", bank_transfer: "Bank / UPI transfer" };

// Payment history — membership purchases and shop orders in one list, newest first.
export default function TransactionsScreen({ navigation }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    setError("");
    api.memberTransactions().then(setRows).catch((e) => { setError(e.message); setRows((r) => r || []); });
  }, []));

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Payment History" onBack={() => navigation.goBack()} />
      {rows === null ? <LoadingScreen /> : (
        <Screen>
          <ErrorBanner message={error} />
          {rows.length === 0 && !error && <EmptyState icon="credit-card" text="No transactions yet." />}
          {rows.map((t) => {
            const isOrder = t.kind === "order";
            return (
              <Card
                key={`${t.kind}-${t.id}`}
                onPress={isOrder ? () => navigation.navigate("OrderTracking", { id: t.id }) : undefined}
                style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: isOrder ? T.terracottaLight : T.purpleLight }}>
                  <Feather name={isOrder ? "shopping-bag" : "award"} size={16} color={isOrder ? T.terracotta : T.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700" }} numberOfLines={1}>{t.title}</Text>
                  <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    {fmtDate(t.date)}{t.method ? ` • ${METHOD_LABEL[t.method] || t.method}` : ""}
                  </Text>
                  {t.reference ? <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 1 }}>Ref: {t.reference}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: T.ink }}>{money(t.amount)}</Text>
                  <Chip tone={STATUS_TONE[t.status] || "gold"}>{t.status}</Chip>
                </View>
              </Card>
            );
          })}
        </Screen>
      )}
    </View>
  );
}
