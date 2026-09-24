import React, { useState } from "react";
import { View, Text, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Btn, ErrorBanner } from "./ui";
import { api, photoUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

// Circular profile photo with upload / change / remove (POST/DELETE /auth/photo).
export default function ProfilePhoto({ size = 84, light }) {
  const { session, refreshUser } = useAuth();
  const user = session?.user;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = photoUrl(user?.photo_filename);

  const pick = async () => {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo library permission was denied"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    setBusy(true);
    try { await api.uploadProfilePhoto(result.assets[0]); await refreshUser(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true); setError("");
    try { await api.deleteProfilePhoto(); await refreshUser(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: T.tealLight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: light ? "#fff" : T.teal }}>
        {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} /> : (
          <Text style={{ fontWeight: "800", color: T.teal, fontSize: size / 3 }}>{(user?.full_name || "E").slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
        <Btn variant={light ? "secondary" : "ghost"} icon="camera" disabled={busy} onPress={pick} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
          {busy ? "Working..." : url ? "Change" : "Add photo"}
        </Btn>
        {url ? <Btn variant="danger" icon="trash-2" disabled={busy} onPress={remove} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>Remove</Btn> : null}
      </View>
      <View style={{ marginTop: 6, alignSelf: "stretch" }}><ErrorBanner message={error} /></View>
    </View>
  );
}
