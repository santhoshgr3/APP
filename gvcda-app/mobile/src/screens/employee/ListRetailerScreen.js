import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Field, Input, Btn, ErrorBanner } from "../../components/ui";
import LocationCascade from "../../components/LocationCascade";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 2.3 — field version of retailer registration, submitted for admin approval.
export default function ListRetailerScreen({ navigation }) {
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { api.categories().then((c) => { setCategories(c); setCategoryId(c[0]?.category_id); }); }, []);

  const submit = async () => {
    if (!businessName.trim() || !categoryId || !loc.village_id) { setError("Business name, category and location are required"); return; }
    setError(""); setSaving(true);
    try {
      await api.listRetailer({ business_name: businessName.trim(), category_id: categoryId, village_id: loc.village_id, phone });
      setDone(true);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: T.cream }}>
        <TopBar title="Retailer Submitted" onBack={() => navigation.goBack()} />
        <Screen style={{ alignItems: "center", paddingTop: 40 }}>
          <Feather name="check-circle" size={44} color={T.teal} />
          <Text style={{ fontWeight: "700", marginTop: 12 }}>Submitted for Admin approval</Text>
          <Btn full style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>Back to Dashboard</Btn>
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="List Retailer" onBack={() => navigation.goBack()} />
      <Screen>
        <ErrorBanner message={error} />
        <Field label="Business name *"><Input value={businessName} onChangeText={setBusinessName} /></Field>
        <Field label="Category *">
          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
            <Picker selectedValue={categoryId ?? ""} onValueChange={setCategoryId}>
              {categories.map((c) => <Picker.Item key={c.category_id} label={c.name} value={c.category_id} />)}
            </Picker>
          </View>
        </Field>
        <Field label="Phone"><Input value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} /></Field>
        <LocationCascade value={loc} onChange={setLoc} />
        <Btn full disabled={saving} onPress={submit} style={{ marginTop: 14 }}>{saving ? "Submitting..." : "Submit for Approval"}</Btn>
      </Screen>
    </View>
  );
}
