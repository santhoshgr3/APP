import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { TopBar, Screen, Field, Input, Btn, ErrorBanner } from "../../components/ui";
import LocationCascade from "../../components/LocationCascade";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";

// Screen Spec 3.1 — shown once, right after OTP, to any account registering as a
// retailer for the first time (self-signup or claiming an employee-created listing).
export default function RetailerRegisterScreen({ navigation }) {
  const { refreshUser, switchRole } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.categories().then((c) => { setCategories(c); setCategoryId(c[0]?.category_id); }); }, []);

  const submit = async () => {
    if (!businessName.trim() || !categoryId || !loc.village_id) { setError("Business name, category and location are required"); return; }
    setError(""); setSaving(true);
    try {
      await api.retailerRegister({ business_name: businessName.trim(), category_id: categoryId, village_id: loc.village_id, phone });
      // The backend flips the account's active role to 'retailer' — re-issue our
      // token with that claim so /retailer/* calls authorize correctly.
      await switchRole("retailer").catch(() => refreshUser());
      navigation.replace("RetailerPending");
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Register your business" subtitle="Join the GVCDA retailer network" />
      <Screen>
        <ErrorBanner message={error} />
        <Field label="Business name *"><Input value={businessName} onChangeText={setBusinessName} /></Field>
        <Field label="Category *">
          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
            <Picker style={{ color: T.ink }} selectedValue={categoryId ?? ""} onValueChange={setCategoryId}>
              {categories.map((c) => <Picker.Item key={c.category_id} label={c.name} value={c.category_id} color={T.ink} />)}
            </Picker>
          </View>
        </Field>
        <Field label="Phone"><Input value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} /></Field>
        <LocationCascade value={loc} onChange={setLoc} />
        <Btn full disabled={saving} onPress={submit} style={{ marginTop: 14 }}>{saving ? "Submitting..." : "Submit"}</Btn>
      </Screen>
    </View>
  );
}
