import React, { useCallback, useState } from "react";
import { View, Text, Switch } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, Field, Input, ErrorBanner, EmptyState, LoadingScreen } from "../../components/ui";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 3.6 — add/edit/remove products or services.
export default function CatalogueScreen() {
  const [products, setProducts] = useState(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => api.retailerProducts().then(setProducts), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!name.trim() || !price) { setError("Name and price are required"); return; }
    setError("");
    try {
      await api.addProduct(name.trim(), Number(price));
      setName(""); setPrice(""); setAdding(false);
      load();
    } catch (e) { setError(e.message); }
  };

  const toggleAvailable = async (p) => { await api.updateProduct(p.product_id, { is_available: !p.is_available }); load(); };
  const remove = async (p) => { await api.deleteProduct(p.product_id); load(); };

  if (!products) return <LoadingScreen />;

  return (
    <Screen>
      <Btn full icon="plus" onPress={() => setAdding((a) => !a)} style={{ marginBottom: 12 }}>
        {adding ? "Cancel" : "Add Product"}
      </Btn>

      {adding && (
        <Card style={{ marginBottom: 14 }}>
          <ErrorBanner message={error} />
          <Field label="Name"><Input value={name} onChangeText={setName} /></Field>
          <Field label="Price (₹)"><Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></Field>
          <Btn full onPress={submit}>Save Product</Btn>
        </Card>
      )}

      {products.length === 0 ? <EmptyState icon="package" text="No products yet — add your first one." /> : (
        products.map((p) => (
          <Card key={p.product_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: "700", opacity: p.is_available ? 1 : 0.5 }}>{p.name}</Text>
              <Text style={{ fontSize: 11.5, color: T.terracotta, fontWeight: "700" }}>₹{p.price}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Switch value={!!p.is_available} onValueChange={() => toggleAvailable(p)} trackColor={{ true: T.teal }} />
              <Feather name="trash-2" size={16} color={T.red} onPress={() => remove(p)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
