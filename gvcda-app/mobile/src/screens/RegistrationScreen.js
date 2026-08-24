import React, { useState } from "react";
import { View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { TopBar, Screen, Field, Input, Btn, ErrorBanner } from "../components/ui";
import LocationCascade from "../components/LocationCascade";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

// Screen Spec 1.3 — captures identity + the location hierarchy that drives everything
// downstream. Shown once, right after OTP, to a brand-new self-signup Member.
export default function RegistrationScreen({ navigation }) {
  const { refreshUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("female");
  const [address, setAddress] = useState("");
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!fullName.trim()) { setError("Full name is required"); return; }
    if (!loc.village_id) { setError("Please select District, Mandal and Village/Town"); return; }
    setError(""); setSaving(true);
    try {
      await api.memberProfile({ full_name: fullName.trim(), village_id: loc.village_id });
      await refreshUser();
      navigation.replace("PlanSelect");
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Complete your profile" subtitle="A few details before you continue" />
      <Screen>
        <ErrorBanner message={error} />
        <Field label="Full name *">
          <Input value={fullName} onChangeText={setFullName} placeholder="Your name" />
        </Field>
        <Field label="Age">
          <Input value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Optional" />
        </Field>
        <Field label="Gender">
          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
            <Picker selectedValue={gender} onValueChange={setGender}>
              <Picker.Item label="Female" value="female" />
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Prefer not to say" value="unspecified" />
            </Picker>
          </View>
        </Field>
        <LocationCascade value={loc} onChange={setLoc} />
        <View style={{ height: 12 }} />
        <Field label="Address (optional)">
          <Input value={address} onChangeText={setAddress} placeholder="House no, street, landmark" />
        </Field>
        <Btn full onPress={save} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? "Saving..." : "Save & Continue"}
        </Btn>
      </Screen>
    </View>
  );
}
