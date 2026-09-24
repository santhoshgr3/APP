import React, { useCallback, useState } from "react";
import { View, Text, Switch, Image, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { Screen, Card, Btn, Chip, Field, Input, ErrorBanner, EmptyState, ChangePasswordCard, LoadingScreen } from "../../components/ui";
import EmailCard from "../../components/EmailCard";
import { api, photoUrl } from "../../api";
import { useAuth } from "../../context/AuthContext";
import RoleSwitcherCard from "../../components/RoleSwitcherCard";
import { DELIVERY_LABEL } from "../../utils";
import { T } from "../../theme";

const METHODS = [
  ["pickup", "Customers collect the order from your shop."],
  ["self_delivery", "You deliver to the customer's address."],
  ["gvcda_delivery", "GVCDA's delivery partner collects from your shop."],
];
const STATUS_TONE = { approved: "green", pending: "gold", rejected: "red", suspended: "red" };
const STATUS_TEXT = {
  approved: "Your shop is verified and visible to members.",
  pending: "GVCDA is reviewing your listing.",
  suspended: "Your listing is suspended. Contact support for help.",
  rejected: "Your listing was not approved.",
};
const DEFAULT_METHODS = ["pickup", "self_delivery"];

// Screen Spec 3.8 — storefront management + local marketing tool, plus account/logout.
export default function ProfilePromotionsScreen({ navigation }) {
  const { logout } = useAuth();
  const [retailer, setRetailer] = useState(null);
  const [promotions, setPromotions] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingPromo, setAddingPromo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({ address: "", hours: "", description: "", phone: "", bank_account: "", bank_ifsc: "", upi_id: "", delivery_methods: DEFAULT_METHODS });
  const [promo, setPromo] = useState({ title: "", discount_pct: "", days: "14" });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const fail = (e) => setError(e.message);
    api.retailerMe().then((r) => {
      setRetailer(r.retailer);
      setForm({
        address: r.retailer.address || "", hours: r.retailer.hours || "", description: r.retailer.description || "", phone: r.retailer.phone || "",
        bank_account: r.retailer.bank_account || "", bank_ifsc: r.retailer.bank_ifsc || "", upi_id: r.retailer.upi_id || "",
        delivery_methods: r.retailer.delivery_methods?.length ? r.retailer.delivery_methods : DEFAULT_METHODS,
      });
    }).catch(fail);
    api.retailerPromotions().then(setPromotions).catch(fail);
    api.retailerPhotos().then(setPhotos).catch(fail);
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
  const setPrimary = async (id) => { try { await api.setPrimaryPhoto(id); load(); } catch (e) { setError(e.message); } };
  const removePhoto = async (id) => { try { await api.deleteRetailerPhoto(id); load(); } catch (e) { setError(e.message); } };

  const toggleMethod = (m) => setForm((f) => ({
    ...f,
    delivery_methods: f.delivery_methods.includes(m) ? f.delivery_methods.filter((x) => x !== m) : [...f.delivery_methods, m],
  }));

  const saveProfile = async () => {
    if (form.delivery_methods.length === 0) { setError("Choose at least one delivery option"); return; }
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

  const togglePromo = async (p) => { try { await api.togglePromotion(p.promotion_id, !p.is_active); load(); } catch (e) { setError(e.message); } };

  if (!retailer || !promotions || !photos) {
    return error ? <Screen><ErrorBanner message={error} /></Screen> : <LoadingScreen />;
  }

  const statusBg = retailer.status === "approved" ? T.greenLight : retailer.status === "pending" ? T.goldLight : T.redLight;

  return (
    <Screen>
      <ErrorBanner message={error} />

      <Card style={{ marginBottom: 14, backgroundColor: statusBg, borderColor: statusBg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft }}>VERIFICATION STATUS</Text>
          <Chip tone={STATUS_TONE[retailer.status] || "gold"}>{retailer.status}</Chip>
        </View>
        <Text style={{ fontSize: 12, color: T.ink, marginTop: 6 }}>{STATUS_TEXT[retailer.status] || ""}</Text>
        {retailer.rejection_reason ? <Text style={{ fontSize: 12, color: T.red, marginTop: 4, fontWeight: "700" }}>Reason: {retailer.rejection_reason}</Text> : null}
      </Card>

      <EmailCard />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "700" }}>Business Profile</Text>
        <Btn variant="ghost" onPress={() => setEditingProfile((e) => !e)}>{editingProfile ? "Cancel" : "Edit"}</Btn>
      </View>
      {editingProfile ? (
        <Card style={{ marginBottom: 20 }}>
          <Field label="Shop phone"><Input value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v.replace(/\D/g, "").slice(0, 10) }))} keyboardType="number-pad" /></Field>
          <Field label="Address"><Input value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} /></Field>
          <Field label="Hours"><Input value={form.hours} onChangeText={(v) => setForm((f) => ({ ...f, hours: v }))} placeholder="e.g. 8:00 AM - 9:00 PM daily" /></Field>
          <Field label="Description"><Input value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline /></Field>

          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginTop: 6, marginBottom: 8 }}>DELIVERY OPTIONS</Text>
          {METHODS.map(([m, help]) => (
            <View key={m} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700" }}>{DELIVERY_LABEL[m]}</Text>
                <Text style={{ fontSize: 11, color: T.inkSoft }}>{help}</Text>
              </View>
              <Switch value={form.delivery_methods.includes(m)} onValueChange={() => toggleMethod(m)} trackColor={{ true: T.teal }} />
            </View>
          ))}

          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginTop: 6, marginBottom: 8 }}>PAYMENT DETAILS</Text>
          <Field label="UPI ID"><Input value={form.upi_id} onChangeText={(v) => setForm((f) => ({ ...f, upi_id: v }))} placeholder="name@upi" autoCapitalize="none" /></Field>
          <Text style={{ fontSize: 11, color: T.inkSoft, marginBottom: 12, marginTop: -6 }}>Members only see the UPI payment option once your UPI ID is set.</Text>
          <Field label="Bank account number"><Input value={form.bank_account} onChangeText={(v) => setForm((f) => ({ ...f, bank_account: v }))} keyboardType="number-pad" /></Field>
          <Field label="IFSC"><Input value={form.bank_ifsc} onChangeText={(v) => setForm((f) => ({ ...f, bank_ifsc: v }))} autoCapitalize="characters" /></Field>
          <Btn full onPress={saveProfile}>Save Profile</Btn>
        </Card>
      ) : (
        <Card style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "700" }}>{retailer.business_name}</Text>
          <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>{retailer.address || "No address set"}</Text>
          {retailer.phone ? <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Phone: {retailer.phone}</Text> : null}
          {retailer.hours ? <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Hours: {retailer.hours}</Text> : null}
          {retailer.description ? <Text style={{ fontSize: 12, color: T.ink, marginTop: 8 }}>{retailer.description}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {(retailer.delivery_methods || []).map((m) => <Chip key={m} tone="blue">{DELIVERY_LABEL[m] || m}</Chip>)}
          </View>
          <Text style={{ fontSize: 11.5, color: retailer.upi_id ? T.ink : T.terracotta, marginTop: 8 }}>
            UPI ID: {retailer.upi_id || "not set — UPI payments stay off until you add one"}
          </Text>
          <Text style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
            Bank: {retailer.bank_account ? `${retailer.bank_account} (${retailer.bank_ifsc || "no IFSC"})` : "not added"}
          </Text>
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

      <Btn full variant="ghost" icon="life-buoy" style={{ marginTop: 8, marginBottom: 8 }} onPress={() => navigation.navigate("Support")}>Help & Support</Btn>
      <RoleSwitcherCard />
      <ChangePasswordCard style={{ marginTop: 4, marginBottom: 8 }} />
      <Btn full variant="danger" icon="log-out" onPress={logout}>Log out</Btn>
    </Screen>
  );
}
