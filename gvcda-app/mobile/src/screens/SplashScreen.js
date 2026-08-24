import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { T } from "../theme";
import { useAuth } from "../context/AuthContext";

// First-launch screen. Skips straight past login if a session is already stored.
export default function SplashScreen({ navigation }) {
  const { session, booting } = useAuth();

  useEffect(() => {
    if (booting) return;
    const t = setTimeout(() => {
      navigation.replace(session ? "Main" : "Login");
    }, 600);
    return () => clearTimeout(t);
  }, [booting, session]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>GVCDA</Text>
      <Text style={styles.tagline}>One Platform for Village & City Development</Text>
      <ActivityIndicator color={T.teal} style={{ marginTop: 30 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { fontWeight: "800", fontSize: 34, color: T.tealDark, letterSpacing: 1 },
  tagline: { fontSize: 13, color: T.inkSoft, marginTop: 8, textAlign: "center" },
});
