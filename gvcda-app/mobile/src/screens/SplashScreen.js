import React, { useEffect } from "react";
import { View, Text, Image, StyleSheet, ActivityIndicator } from "react-native";
import { T } from "../theme";
import { useAuth } from "../context/AuthContext";

// First-launch screen. Skips straight past login if a session is already stored.
export default function SplashScreen({ navigation }) {
  const { session, booting } = useAuth();

  useEffect(() => {
    if (booting) return;
    const t = setTimeout(() => {
      navigation.replace(session ? "Main" : "Login");
    }, 900);
    return () => clearTimeout(t);
  }, [booting, session]);

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.tagline}>All in one Sector Service Hub</Text>
      <ActivityIndicator color={T.teal} style={{ marginTop: 30 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { width: 260, height: 230 },
  tagline: { fontSize: 13, color: T.inkSoft, marginTop: 8, textAlign: "center" },
});
