import React, { useCallback, useState } from "react";
import { View, Text, Switch, Image, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, Field, Input, ErrorBanner, EmptyState } from "../../components/ui";
import { api, photoUrl } from "../../api";
import { useAuth } from "../../context/AuthContext";
import RoleSwitcherCard from "../../components/RoleSwitcherCard";
import { T } from "../../theme";

// Screen Spec 3.8 — storefront management + local marketing tool, plus account/logout.
export default function ProfilePromotionsScreen() {
  const { logout } = useAuth();
  const [retailer, setRetailer] = useState(null);
  const [promotions, setPromotions] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingPromo, setAddingPromo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({ address: "", hours: "", description: "", bank_account: "", bank_ifsc: "", upi_id: "" });
  const [promo, setPromo] = useState({ title: "", discount_pct: "", days: "14" });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.retailerMe().then((r) => { setRetailer(r.retailer); setForm({
      address: r.retailer.address || "", hours: r.retailer.hours || "", description: r.retailer.description || "",
      bank_account: r.retailer.bank_account || "", bank_ifsc: r.retailer.bank_ifsc || "", upi_id: r.retailer.upi_id || "",
    }); });
    api.retailerPromotions().then(setPromotions);
    api.retailerPhotos().then(setPhotos);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo library permission was denied"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsMultipleSelection: true, selectionLimit: 5 });
    if (result.canceled || !result.assets?.length) return;
    setUploadingPhotos(true); setError("");
    try { await api.uploadRetailerPhotos(result.assets); load(); }
    catch (e) { setError(e.message); }
    setUploadingPhotos(false);
  };
  const setPrimary = async (id) => { await api.setPrimaryPhoto(id); load(); };
  const removePhoto = async (id) => { await api.deleteRetailerPhoto(id); load(); };

  const saveProfile = async () => {
    setError("");
    try { await api.updateRetailerProfile(form); setEditingProfile(false); load(); }
    catch (e) { setError(e.message); }
  };

  const createPromo = async () => {
    if (!promo.title.trim() || !promo.discount_pct) { setError("Title and discount % are required"); return; }
    setError("");
    try {
      const start = new Date();
      const end = new Date(Date.now() + Number(promo.days || 14) * 86400000);
      await api.createPromotion({
        title: promo.title.trim(), discount_pct: Number(promo.discount_pct),
        start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10), scope: "all_products",
      });
      setPromo({ title: "", discount_pct: "", days: "14" }); setAddingPromo(false); load();
    } catch (e) { setError(e.message); }
  };

  const togglePromo = async (p) => { await api.togglePromotion(p.promotion_id, !p.is_active); load(); };

  if (!retailer || !promotions || !photos) return null;

  return (
    <Screen>
      <ErrorBanner message={error} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "700" }}>Business Profile</Text>
        <Btn variant="ghost" onPress={() => setEditingProfile((e) => !e)}>{editingProfile ? "Cancel" : "Edit"}</Btn>
      </View>
      {editingProfile ? (
        <Card style={{ marginBottom: 20 }}>
          <Field label="Address"><Input value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} /></Field>
          <Field label="Hours"><Input value={form.hours} onChangeText={(v) => setForm((f) => ({ ...f, hours: v }))} placeholder="e.g. 8:00 AM - 9:00 PM daily" /></Field>
          <Field label="Description"><Input value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline /></Field>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginTop: 6, marginBottom: 8 }}>PAYOUT DETAILS</Text>
          <Field label="Bank account number"><Input value={form.bank_account} onChangeText={(v) => setForm((f) => ({ ...f, bank_account: v }))} /></Field>
          <Field label="IFSC"><Input value={form.bank_ifsc} onChangeText={(v) => setForm((f) => ({ ...f, bank_ifsc: v }))} autoCapitalize="characters" /></Field>
          <Field label="UPI ID"><Input value={form.upi_id} onChangeText={(v) => setForm((f) => ({ ...f, upi_id: v }))} placeholder="name@upi" autoCapitalize="none" /></Field>
          <Btn full onPress={saveProfile}>Save Profile</Btn>
        </Card>
      ) : (
        <Card style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "700" }}>{retailer.business_name}</Text>
          <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>{retailer.address || "No address set"}</Text>
          {retailer.hours ? <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{retailer.hours}</Text> : null}
          {retailer.description ? <Text style={{ fontSize: 12, color: T.ink, marginTop: 8 }}>{retailer.description}</Text> : null}
        </Card>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "700" }}>Storefront Photos</Text>
        <Btn variant="ghost" icon="camera" onPress={addPhotos} disabled={uploadingPhotos}>{uploadingPhotos ? "Uploading..." : "Add Photos"}</Btn>
      </View>
      {photos.length === 0 ? (
        <EmptyState icon="camera" text="No photos yet — members see this listing without a storefront image." />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {photos.map((p) => (
            <View key={p.photo_id} style={{ width: "31%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", borderWidth: p.is_primary ? 2 : 1, borderColor: p.is_primary ? T.teal : T.line }}>
              <Image source={{ uri: photoUrl(p.filename) }} style={{ width: "100%", height: "100%" }} />
              {p.is_primary ? (
                <View style={{ position: "absolute", top: 3, left: 3, backgroundColor: T.teal, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 8, fontWeight: "700" }}>COVER</Text>
                </View>
              ) : null}
              <View style={{ position: "absolute", bottom: 3, right: 3, flexDirection: "row", gap: 3 }}>
                {!p.is_primary && (
                  <TouchableOpacity onPress={() => setPrimary(p.photo_id)} style={{ backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 4, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="star" size={11} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => removePhoto(p.photo_id)} style={{ backgroundColor: "rgba(178,58,72,0.85)", borderRadius: 4, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="x" size={11} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "700" }}>Promotions</Text>
        <Btn variant="ghost" icon="plus" onPress={() => setAddingPromo((a) => !a)}>{addingPromo ? "Cancel" : "New"}</Btn>
      </View>
      {addingPromo && (
        <Card style={{ marginBottom: 12 }}>
          <Field label="Title"><Input value={promo.title} onChangeText={(v) => setPromo((p) => ({ ...p, title: v }))} placeholder="Festival Sale" /></Field>
          <Field label="Discount %"><Input value={promo.discount_pct} onChangeText={(v) => setPromo((p) => ({ ...p, discount_pct: v }))} keyboardType="number-pad" /></Field>
          <Field label="Valid for (days)"><Input value={promo.days} onChangeText={(v) => setPromo((p) => ({ ...p, days: v }))} keyboardType="number-pad" /></Field>
          <Btn full onPress={createPromo}>Create Promotion</Btn>
        </Card>
      )}
      {promotions.length === 0 ? <EmptyState icon="tag" text="No active promotions." /> : (
        promotions.map((p) => (
          <Card key={p.promotion_id} style={{ marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{p.title} — {p.discount_pct}% off</Text>
              <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{p.start_date} → {p.end_date}</Text>
            </View>
            <Switch value={!!p.is_active} onValueChange={() => togglePromo(p)} trackColor={{ true: T.teal }} />
          </Card>
        ))
      )}

      <RoleSwitcherCard />
      <Btn full variant="danger" icon="log-out" style={{ marginTop: 4 }} onPress={logout}>Log out</Btn>
    </Screen>
  );
}
