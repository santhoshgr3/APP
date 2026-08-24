import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Field, Input, Btn, ErrorBanner } from "../components/ui";
import { api, getApiUrl, setApiUrl, DEFAULT_API_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

const DEMO_ACCOUNTS = [
  ["9000000001", "Admin — use the web dashboard for this one"],
  ["9000000002", "Employee (Mandal Sub Manager)"],
  ["9000000003", "Member (Ramesh, Standard plan)"],
  ["9000000004", "Retailer, approved"],
  ["9000000005", "Retailer, pending approval"],
  ["9000000006", "Member + Retailer — try the role switcher"],
];

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_API_URL);

  useEffect(() => { getApiUrl().then(setServerUrl); }, []);

  const saveServer = async (url) => { setServerUrl(url); await setApiUrl(url); };

  const sendOtp = async () => {
    setError(""); setLoading(true);
    try {
      const res = await api.requestOtp(phone);
      setDevOtp(res.dev_otp);
      setStep("otp");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const verify = async () => {
    setError(""); setLoading(true);
    try {
      const res = await api.verifyOtp(phone, otp);
      await login(res.token, res.user, res.roles);
      if (res.is_new_user) {
        navigation.replace("Registration");
      } else {
        navigation.replace("Main");
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <Screen>
      <View style={{ alignItems: "center", paddingTop: 30, marginBottom: 26 }}>
        <Text style={styles.logo}>GVCDA</Text>
        <Text style={styles.tagline}>One Platform for Village & City Development</Text>
      </View>

      <ErrorBanner message={error} />

      {step === "phone" ? (
        <>
          <Field label="Mobile number">
            <Input keyboardType="number-pad" maxLength={10} placeholder="9000000003 (demo member)" value={phone} onChangeText={setPhone} />
          </Field>
          <Btn full onPress={sendOtp} disabled={phone.length < 10 || loading}>{loading ? "Sending..." : "Send OTP"}</Btn>

          <TouchableOpacity onPress={() => setShowServer((s) => !s)} style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="server" size={12} color={T.inkSoft} />
            <Text style={{ fontSize: 11, color: T.inkSoft, fontWeight: "700" }}>Server: {serverUrl}</Text>
          </TouchableOpacity>
          {showServer && (
            <View style={{ marginTop: 8 }}>
              <Input value={serverUrl} onChangeText={saveServer} autoCapitalize="none" placeholder="http://<your-lan-ip>:4000" />
              <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>
                Expo Go can't reach "localhost" — point this at your computer's LAN IP where the backend is running.
              </Text>
            </View>
          )}

          <View style={{ marginTop: 18, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: T.line, padding: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: T.ink, marginBottom: 6 }}>Demo accounts (seeded)</Text>
            {DEMO_ACCOUNTS.map(([num, label]) => (
              <Text key={num} style={{ fontSize: 10.5, color: T.inkSoft, lineHeight: 17 }}>{num} — {label}</Text>
            ))}
            <Text style={{ fontSize: 10.5, color: T.inkSoft, lineHeight: 17, marginTop: 2 }}>Any new number — self-signup as a new Member</Text>
          </View>
        </>
      ) : (
        <>
          <Field label={`OTP sent to ${phone}`}>
            <Input keyboardType="number-pad" maxLength={6} placeholder="123456" value={otp} onChangeText={setOtp} />
          </Field>
          <Text style={{ fontSize: 11, color: T.gold, marginBottom: 14 }}>Dev mode — OTP is always {devOtp} (no real SMS sent).</Text>
          <Btn full onPress={verify} disabled={otp.length < 6 || loading}>{loading ? "Verifying..." : "Verify & Continue"}</Btn>
          <Btn full variant="ghost" onPress={() => setStep("phone")} style={{ marginTop: 8 }}>Change number</Btn>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { fontWeight: "800", fontSize: 30, color: T.tealDark },
  tagline: { fontSize: 12.5, color: T.inkSoft, marginTop: 6, textAlign: "center" },
});
