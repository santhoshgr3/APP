import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Feather } from "@expo/vector-icons";
import { TopBar, Screen, Field, Input, Btn, ErrorBanner, Card } from "../../components/ui";
import LocationCascade from "../../components/LocationCascade";
import { api } from "../../api";
import { T } from "../../theme";

// Screen Spec 2.2 — field version of Member registration + payment, done on the
// member's behalf.
export default function EnrolMemberScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { api.plans().then((p) => { setPlans(p); setPlanId(p[0]?.plan_id); }); }, []);

  const submit = async () => {
    if (!fullName.trim() || phone.length < 10 || !loc.village_id || !planId) {
      setError("Full name, phone, location and plan are all required"); return;
    }
    setError(""); setSaving(true);
    try {
      const res = await api.enrolMember({ full_name: fullName.trim(), phone, village_id: loc.village_id, plan_id: planId, payment_method: paymentMethod });
      setResult(res);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: T.cream }}>
        <TopBar title="Member Enrolled" onBack={() => navigation.goBack()} />
        <Screen style={{ alignItems: "center", paddingTop: 30 }}>
          <Feather name="check-circle" size={44} color={T.teal} />
          <Text style={{ fontWeight: "700", fontSize: 15, marginTop: 12 }}>{result.user.full_name} enrolled</Text>
          <Card style={{ marginTop: 16, width: "100%" }}>
            <Text style={{ fontSize: 11, color: T.inkSoft, fontWeight: "700", marginBottom: 4 }}>DIGITAL CARD NUMBER</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: T.teal }}>{result.membership.card_number}</Text>
          </Card>
          <Btn full style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>Back to Dashboard</Btn>
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Enrol Member" onBack={() => navigation.goBack()} />
      <Screen>
        <ErrorBanner message={error} />
        <Field label="Full name *"><Input value={fullName} onChangeText={setFullName} /></Field>
        <Field label="Phone *"><Input value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} /></Field>
        <LocationCascade value={loc} onChange={setLoc} />
        <View style={{ height: 8 }} />
        <Field label="Membership plan">
          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
            <Picker selectedValue={planId ?? ""} onValueChange={setPlanId}>
              {plans.map((p) => <Picker.Item key={p.plan_id} label={`${p.name} — ₹${p.price}`} value={p.plan_id} />)}
            </Picker>
          </View>
        </Field>
        <Field label="Payment collection">
          <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
            <Picker selectedValue={paymentMethod} onValueChange={setPaymentMethod}>
              <Picker.Item label="Cash collected in field" value="cash" />
              <Picker.Item label="UPI collected in field" value="upi" />
              <Picker.Item label="Online payment link sent" value="link" />
            </Picker>
          </View>
        </Field>
        <Btn full disabled={saving} onPress={submit} style={{ marginTop: 8 }}>{saving ? "Submitting..." : "Submit & Issue Card"}</Btn>
      </Screen>
    </View>
  );
}
