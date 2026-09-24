import React, { useState } from "react";
import { View, Text } from "react-native";
import { Card, Btn, Input, ErrorBanner } from "./ui";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared editable email row (PATCH /auth/email) — works for every role.
export default function EmailCard({ style }) {
  const { session, refreshUser } = useAuth();
  const current = session?.user?.email || "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const v = value.trim();
    if (v && !EMAIL_RE.test(v)) { setError("Enter a valid email address"); return; }
    setSaving(true); setError("");
    try {
      await api.updateEmail(v);
      await refreshUser();
      setEditing(false);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <Card style={[{ marginBottom: 12 }, style]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 2 }}>EMAIL</Text>
          {!editing && <Text style={{ fontSize: 13, fontWeight: "600", color: current ? T.ink : T.inkSoft }}>{current || "Not added yet"}</Text>}
        </View>
        {!editing && <Btn variant="ghost" onPress={() => { setValue(current); setEditing(true); }}>{current ? "Edit" : "Add"}</Btn>}
      </View>
      {editing && (
        <View style={{ marginTop: 8 }}>
          <ErrorBanner message={error} />
          <Input value={value} onChangeText={setValue} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" style={{ marginBottom: 10 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn onPress={save} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving..." : "Save"}</Btn>
            <Btn variant="ghost" onPress={() => { setEditing(false); setError(""); }} style={{ flex: 1 }}>Cancel</Btn>
          </View>
        </View>
      )}
    </Card>
  );
}
