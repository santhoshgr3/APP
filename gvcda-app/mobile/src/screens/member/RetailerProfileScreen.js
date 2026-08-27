import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Alert } from "react-native";
import { TopBar, Screen, Card, Btn, LoadingScreen, EmptyState, Chip } from "../../components/ui";
import { api, photoUrl } from "../../api";
import { useCart } from "../../context/CartContext";
import { T } from "../../theme";

// Screen Spec 1.8 — member-facing storefront: browse and order/book.
export default function RetailerProfileScreen({ navigation, route }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const { cart, addToCart, clearCart, total, count } = useCart();

  useEffect(() => { api.memberRetailerDetail(id).then(setData); }, [id]);

  // An order can only ever belong to one retailer (CartScreen sends the whole
  // cart under one retailer_id), so adding a product from a different shop than
  // what's already in the cart would silently corrupt the order at checkout
  // instead of failing clearly. Confirm and start fresh instead.
  const handleAdd = (product) => {
    if (cart.length > 0 && cart[0].retailer_id !== product.retailer_id) {
      Alert.alert(
        "Start a new order?",
        "Your cart has items from a different shop. Adding this will clear your cart.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Clear & Add", style: "destructive", onPress: () => { clearCart(); addToCart(product); } },
        ]
      );
      return;
    }
    addToCart(product);
  };

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Loading..." onBack={() => navigation.goBack()} />
      <LoadingScreen />
    </View>
  );

  const { retailer, products, promotions, photos } = data;

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={retailer.business_name} subtitle={`${retailer.village_name} • ${retailer.category_name}`} onBack={() => navigation.goBack()} />
      <Screen>
        {photos?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {photos.map((p) => (
              <Image key={p.photo_id} source={{ uri: photoUrl(p.filename) }} style={{ width: 140, height: 100, borderRadius: 10, marginRight: 8 }} />
            ))}
          </ScrollView>
        )}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
              {p.image_filename ? (
                <Image source={{ uri: photoUrl(p.image_filename) }} style={{ width: 44, height: 44, borderRadius: 8 }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: T.tealLight }} />
              )}
              <View>
                <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{p.name}</Text>
                <Text style={{ fontSize: 11.5, color: T.terracotta, fontWeight: "700" }}>₹{p.price}</Text>
              </View>
            </View>
            <Btn variant="secondary" icon="plus" onPress={() => handleAdd({ ...p, retailer_id: retailer.retailer_id })}>Add</Btn>
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
