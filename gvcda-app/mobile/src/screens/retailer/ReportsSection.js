import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Card, Btn, Chip, ErrorBanner } from "../../components/ui";
import { api } from "../../api";
import { isoDate, fmtDate, money } from "../../utils";
import { T } from "../../theme";

const RANGES = [7, 30, 90];
const STATUS_ORDER = [["placed", "gold"], ["accepted", "blue"], ["fulfilled", "green"], ["rejected", "red"], ["cancelled", "terracotta"]];

// Reports under Earnings: date-range chips + Sales / Orders / Payments / Stock cards.
export default function ReportsSection() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setReport(null); setError("");
    api.retailerReports(isoDate(from), isoDate(to))
      .then((r) => live && setReport(r))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [days]);

  const n = (v) => Number(v) || 0;

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Reports</Text>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
        {RANGES.map((d) => (
          <Btn key={d} full variant={days === d ? "primary" : "ghost"} onPress={() => setDays(d)} style={{ paddingVertical: 8 }}>{`${d} days`}</Btn>
        ))}
      </View>
      <ErrorBanner message={error} />
      {!report && !error && <ActivityIndicator color={T.teal} style={{ marginVertical: 20 }} />}
      {report && (
        <>
          <Text style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 8 }}>{fmtDate(report.from)} to {fmtDate(report.to)}</Text>

          <Card style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: T.green }}>
            <Title color={T.green}>SALES</Title>
            <Row label="Gross sales" value={money(report.sales.gross)} />
            <Row label="GVCDA commission" value={money(report.sales.commission)} muted />
            <Row label="You keep" value={money(report.sales.net)} bold />
            <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 4 }}>{n(report.sales.order_count)} fulfilled order(s)</Text>
            {report.top_products?.length > 0 && (
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 8 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "700", color: T.inkSoft, marginBottom: 4 }}>TOP SELLERS</Text>
                {report.top_products.map((p, i) => (
                  <Row key={i} label={`${p.name} × ${n(p.quantity)}`} value={money(p.revenue)} />
                ))}
              </View>
            )}
          </Card>

          <Card style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: T.blue }}>
            <Title color={T.blue}>ORDERS</Title>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {STATUS_ORDER.map(([k, tone]) => (
                <View key={k} style={{ alignItems: "center", minWidth: 58 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: T.ink }}>{n(report.orders_by_status?.[k])}</Text>
                  <Chip tone={tone}>{k}</Chip>
                </View>
              ))}
            </View>
          </Card>

          <Card style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: T.terracotta }}>
            <Title color={T.terracotta}>PAYMENTS</Title>
            <Row label="Cash on delivery collected" value={money(report.payments.cod_total)} />
            <Row label="UPI received" value={money(report.payments.upi_total)} />
            <Row label="Commission owed to GVCDA" value={money(report.payments.commission_owed)} muted />
            <Row label="Commission settled" value={money(report.payments.commission_settled)} muted />
            {n(report.payments.upi_awaiting_confirmation) > 0 && (
              <Text style={{ fontSize: 11.5, color: T.blue, fontWeight: "700", marginTop: 6 }}>
                {n(report.payments.upi_awaiting_confirmation)} UPI payment(s) awaiting your confirmation
              </Text>
            )}
          </Card>

          <Card style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: T.purple }}>
            <Title color={T.purple}>STOCK</Title>
            {n(report.stock.tracked_count) === 0 ? (
              <Text style={{ fontSize: 12, color: T.inkSoft }}>No products have stock tracking turned on. Set a stock quantity in Products to see alerts here.</Text>
            ) : (
              <>
                <Text style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>
                  {n(report.stock.tracked_count)} tracked product(s) • low-stock alert at {n(report.stock.threshold)} or fewer
                </Text>
                {report.stock.out_of_stock.length === 0 && report.stock.low_stock.length === 0 && (
                  <Text style={{ fontSize: 12, color: T.green, fontWeight: "700" }}>All tracked products are well stocked.</Text>
                )}
                {report.stock.out_of_stock.map((p) => (
                  <View key={`o${p.product_id}`} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 }}>
                    <Text style={{ fontSize: 12.5 }}>{p.name}</Text><Chip tone="red">Out of stock</Chip>
                  </View>
                ))}
                {report.stock.low_stock.map((p) => (
                  <View key={`l${p.product_id}`} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 }}>
                    <Text style={{ fontSize: 12.5 }}>{p.name}</Text><Chip tone="gold">{`Low ${n(p.stock)}`}</Chip>
                  </View>
                ))}
              </>
            )}
          </Card>
        </>
      )}
    </View>
  );
}

function Title({ children, color }) {
  return <Text style={{ fontSize: 11, fontWeight: "800", color, marginBottom: 6 }}>{children}</Text>;
}

function Row({ label, value, muted, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ fontSize: 12, color: muted ? T.inkSoft : T.ink, flexShrink: 1, marginRight: 8 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? "800" : "600", color: bold ? T.teal : T.ink }}>{value}</Text>
    </View>
  );
}
