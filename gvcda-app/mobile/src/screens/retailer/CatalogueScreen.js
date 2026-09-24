import React, { useCallback, useState } from "react";
import { View, Text, Switch, Image, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, Field, Input, ErrorBanner, EmptyState, LoadingScreen, Chip } from "../../components/ui";
import { api, photoUrl } from "../../api";
import { T } from "../../theme";

const LOW_STOCK = 5;

function stockChip(p) {
  if (p.item_type === "service") return null;
  if (p.stock === null || p.stock === undefined) return { label: "Stock not tracked", tone: "teal" };
  const n = Number(p.stock);
  if (n <= 0) return { label: "Out of stock", tone: "red" };
  if (n <= LOW_STOCK) return { label: `Low ${n}`, tone: "gold" };
  return { label: `In stock ${n}`, tone: "green" };
}

// Screen Spec 3.6 — add/edit/remove products or services (with optional stock tracking).
export default function CatalogueScreen() {
  const [products, setProducts] = useState(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [itemType, setItemType] = useState("product");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [editingStockId, setEditingStockId] = useState(null);
  const [stockDraft, setStockDraft] = useState("");

  const load = useCallback(() => api.retailerProducts().then(setProducts).catch((e) => { setError(e.message); setProducts((p) => p || []); }), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const wholeNumber = (v) => /^\d+$/.test(v.trim());

  const submit = async () => {
    if (!name.trim() || !price) { setError("Name and price are required"); return; }
    if (!(Number(price) > 0)) { setError("Price must be greater than zero"); return; }
    if (itemType === "product" && stock.trim() && !wholeNumber(stock)) { setError("Stock must be a whole number (or leave blank to not track)"); return; }
    setError(""); setSaving(true);
    try {
      const extra = { item_type: itemType };
      if (itemType === "product" && stock.trim()) extra.stock = Number(stock);
      await api.addProduct(name.trim(), Number(price), extra);
      setName(""); setPrice(""); setStock(""); setItemType("product"); setAdding(false);
      load();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const toggleAvailable = async (p) => {
    setError("");
    try { await api.updateProduct(p.product_id, { is_available: !p.is_available }); load(); }
    catch (e) { setError(e.message); }
  };
  const remove = async (p) => {
    setError("");
    try { await api.deleteProduct(p.product_id); load(); }
    catch (e) { setError(e.message); }
  };

  const saveStock = async (p, value) => {
    if (value !== null && !wholeNumber(String(value))) { setError("Stock must be a whole number, 0 or more"); return; }
    setError("");
    try {
      await api.updateProduct(p.product_id, { stock: value === null ? null : Number(value) });
      setEditingStockId(null);
      load();
    } catch (e) { setError(e.message); }
  };

  const changeImage = async (product) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo library permission was denied"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingId(product.product_id); setError("");
    try { await api.uploadProductImage(product.product_id, result.assets[0]); load(); }
    catch (e) { setError(e.message); }
    setUploadingId(null);
  };

  if (!products) return <LoadingScreen />;

  return (
    <Screen>
      <ErrorBanner message={error} />
      <Btn full icon="plus" onPress={() => setAdding((a) => !a)} style={{ marginBottom: 12 }}>
        {adding ? "Cancel" : "Add Product or Service"}
      </Btn>

      {adding && (
        <Card style={{ marginBottom: 14 }}>
          <Field label="Type">
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn full variant={itemType === "product" ? "primary" : "ghost"} icon="package" onPress={() => setItemType("product")}>Product</Btn>
              <Btn full variant={itemType === "service" ? "primary" : "ghost"} icon="tool" onPress={() => setItemType("service")}>Service</Btn>
            </View>
          </Field>
          <Field label="Name"><Input value={name} onChangeText={setName} /></Field>
          <Field label="Price (₹)"><Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></Field>
          {itemType === "product" ? (
            <Field label="Stock quantity (leave blank to not track)">
              <Input value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="e.g. 25" />
            </Field>
          ) : (
            <Text style={{ fontSize: 11, color: T.purple, marginBottom: 12 }}>Customers book a time slot for services — no stock to track.</Text>
          )}
          <Btn full onPress={submit} disabled={saving}>{saving ? "Saving..." : itemType === "service" ? "Save Service" : "Save Product"}</Btn>
        </Card>
      )}

      {products.length === 0 ? <EmptyState icon="package" text="No products yet — add your first one." /> : (
        products.map((p) => {
          const chip = stockChip(p);
          const isService = p.item_type === "service";
          return (
            <Card key={p.product_id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <TouchableOpacity onPress={() => changeImage(p)} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isService ? T.purpleLight : T.tealLight, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {p.image_filename ? (
                      <Image source={{ uri: photoUrl(p.image_filename) }} style={{ width: 44, height: 44 }} />
                    ) : (
                      <Feather name={uploadingId === p.product_id ? "loader" : "camera"} size={16} color={isService ? T.purple : T.teal} />
                    )}
                  </TouchableOpacity>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", opacity: p.is_available ? 1 : 0.5 }}>{p.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 11.5, color: T.terracotta, fontWeight: "700" }}>₹{p.price}</Text>
                      {isService ? <Chip tone="purple">Service</Chip> : null}
                      {chip ? (
                        <TouchableOpacity onPress={() => { setEditingStockId(p.product_id); setStockDraft(p.stock == null ? "" : String(p.stock)); }}>
                          <Chip tone={chip.tone}>{chip.label}</Chip>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Switch value={!!p.is_available} onValueChange={() => toggleAvailable(p)} trackColor={{ true: T.teal }} />
                  <Feather name="trash-2" size={16} color={T.red} onPress={() => remove(p)} />
                </View>
              </View>
              {editingStockId === p.product_id && !isService && (
                <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 6 }}>UNITS IN STOCK</Text>
                  <Input value={stockDraft} onChangeText={setStockDraft} keyboardType="number-pad" placeholder="Blank = don't track" style={{ marginBottom: 8 }} />
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Btn style={{ flex: 1 }} onPress={() => saveStock(p, stockDraft.trim() === "" ? null : stockDraft)}>Save</Btn>
                    {p.stock != null ? <Btn variant="ghost" style={{ flex: 1 }} onPress={() => saveStock(p, null)}>Stop tracking</Btn> : null}
                    <Btn variant="ghost" style={{ flex: 1 }} onPress={() => setEditingStockId(null)}>Cancel</Btn>
                  </View>
                </View>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
