import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Field, Input, Btn, ErrorBanner } from "../components/ui";
import { api, getApiUrl, setApiUrl, DEFAULT_API_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_API_URL);

  useEffect(() => { getApiUrl().then(setServerUrl); }, []);

  const saveServer = async (url) => { setServerUrl(url); await setApiUrl(url); };

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const res = mode === "login" ? await api.login(phone, password) : await api.register(phone, password, fullName);
      await login(res.token, res.user, res.roles);
      if (res.is_new_user) {
        navigation.replace("Registration");
      } else {
        navigation.replace("Main");
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const canSubmit = phone.length === 10 && password.length >= 6 && (mode === "login" || fullName.trim()) && !loading;

  return (
    <Screen>
      <View style={{ alignItems: "center", paddingTop: 30, marginBottom: 26 }}>
        <Text style={styles.logo}>GVCDA</Text>
        <Text style={styles.tagline}>One Platform for Village & City Development</Text>
      </View>

      <ErrorBanner message={error} />

      {mode === "register" && (
        <Field label="Full name">
          <Input value={fullName} onChangeText={setFullName} placeholder="Your name" />
        </Field>
      )}
      <Field label="Mobile number">
        <Input keyboardType="number-pad" maxLength={10} placeholder="10-digit mobile number" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))} />
      </Field>
      <Field label="Password">
        <Input secureTextEntry placeholder={mode === "register" ? "At least 6 characters" : "••••••••"} value={password} onChangeText={setPassword} />
      </Field>

      <Btn full onPress={submit} disabled={!canSubmit}>
        {loading ? (mode === "login" ? "Logging in..." : "Creating account...") : (mode === "login" ? "Log In" : "Create Account")}
      </Btn>
      <Btn full variant="ghost" onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ marginTop: 8 }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </Btn>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { fontWeight: "800", fontSize: 30, color: T.tealDark },
  tagline: { fontSize: 12.5, color: T.inkSoft, marginTop: 6, textAlign: "center" },
});
