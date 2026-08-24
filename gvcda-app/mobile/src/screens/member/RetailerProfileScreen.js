import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { TopBar, Screen, Card, Btn, LoadingScreen, EmptyState, Chip } from "../../components/ui";
import { api } from "../../api";
import { useCart } from "../../context/CartContext";
import { T } from "../../theme";

// Screen Spec 1.8 — member-facing storefront: browse and order/book.
export default function RetailerProfileScreen({ navigation, route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const { cart, addToCart, total, count } = useCart();

  useEffect(() => { api.memberRetailerDetail(id).then(setData); }, [id]);

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Loading..." onBack={() => navigation.goBack()} />
      <LoadingScreen />
    </View>
  );

  const { retailer, products, promotions } = data;

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={retailer.business_name} subtitle={`${retailer.village_name} • ${retailer.category_name}`} onBack={() => navigation.goBack()} />
      <Screen>
        {retailer.description ? <Text style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>{retailer.description}</Text> : null}
        {retailer.hours ? <Text style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 12 }}>Hours: {retailer.hours}</Text> : null}

        {promotions?.length > 0 && (
          <Card style={{ marginBottom: 14, backgroundColor: T.goldLight, borderColor: T.goldLight }}>
            {promotions.map((p) => (
              <Text key={p.promotion_id} style={{ fontSize: 12, fontWeight: "700", color: "#8A6A0C" }}>
                🎉 {p.title} — {p.discount_pct}% off, valid till {p.end_date}
              </Text>
            ))}
          </Card>
        )}

        <Text style={{ fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Products & Services</Text>
        {products.length === 0 && <EmptyState icon="shopping-cart" text="No products listed yet." />}
        {products.map((p) => (
          <Card key={p.product_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{p.name}</Text>
              <Text style={{ fontSize: 11.5, color: T.terracotta, fontWeight: "700" }}>₹{p.price}</Text>
            </View>
            <Btn variant="secondary" icon="plus" onPress={() => addToCart({ ...p, retailer_id: retailer.retailer_id })}>Add</Btn>
          </Card>
        ))}
      </Screen>
      {count > 0 && (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: "#fff" }}>
          <Btn full icon="shopping-cart" onPress={() => navigation.navigate("Cart")}>
            View Cart • ₹{total} ({count})
          </Btn>
        </View>
      )}
    </View>
  );
}
