import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../theme";
import { api } from "../api";

export function TopBar({ title, subtitle, onBack, right }) {
  return (
    <View style={styles.topBar}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Feather name="chevron-left" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.topBarTitle}>{title}</Text>
          {subtitle ? <Text style={styles.topBarSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function Screen({ children, style, scroll = true }) {
  if (!scroll) return <View style={[{ flex: 1, padding: 16 }, style]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ padding: 16 }, style]}>
      {children}
    </ScrollView>
  );
}

export function LoadingScreen({ text = "Loading..." }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 60 }}>
      <ActivityIndicator color={T.teal} />
      <Text style={{ color: T.inkSoft, fontSize: 13, marginTop: 10 }}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon = "inbox", text, action }) {
  return (
    <View style={{ alignItems: "center", padding: 40 }}>
      <Feather name={icon} size={28} color={T.line} style={{ marginBottom: 10 }} />
      <Text style={{ fontSize: 13, color: T.inkSoft, textAlign: "center" }}>{text}</Text>
      {action}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return <Wrap onPress={onPress} style={[styles.card, style]} activeOpacity={0.7}>{children}</Wrap>;
}

const VARIANT_STYLES = {
  primary: { backgroundColor: T.teal, borderColor: T.teal },
  secondary: { backgroundColor: "#fff", borderColor: T.teal },
  danger: { backgroundColor: "#fff", borderColor: T.red },
  ghost: { backgroundColor: "#fff", borderColor: T.line },
};
const VARIANT_TEXT = { primary: "#fff", secondary: T.teal, danger: T.red, ghost: T.inkSoft };

export function Btn({ children, onPress, variant = "primary", full, style, disabled, icon }) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={0.75}
      style={[
        styles.btn,
        VARIANT_STYLES[variant],
        full && { width: "100%" },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={14} color={VARIANT_TEXT[variant]} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: VARIANT_TEXT[variant], fontWeight: "700", fontSize: 13 }}>{children}</Text>
    </TouchableOpacity>
  );
}

export function Chip({ children, tone = "teal" }) {
  const map = {
    teal: [T.tealLight, T.teal],
    gold: [T.goldLight, "#8A6A0C"],
    red: [T.redLight, T.red],
    terracotta: [T.terracottaLight, T.terracotta],
  };
  const [bg, fg] = map[tone] || map.teal;
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 10.5, fontWeight: "700", color: fg, textTransform: "capitalize" }}>{children}</Text>
    </View>
  );
}

export function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props) {
  return <TextInput placeholderTextColor="#9AA39D" style={[styles.input, props.style]} {...props} />;
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View style={{ backgroundColor: T.redLight, borderRadius: 8, padding: 10, marginBottom: 12 }}>
      <Text style={{ color: T.red, fontSize: 12 }}>{message}</Text>
    </View>
  );
}

export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

// Shared across Member/Employee/Retailer home screens — shows Admin's recent
// broadcasts targeted at this user (their district/mandal, or all of Telangana).
// See backend/lib/broadcasts.js for the delivery-side matching logic.
export function AnnouncementsCard({ fetchFn }) {
  const [items, setItems] = useState(null);
  useEffect(() => { fetchFn().then(setItems).catch(() => setItems([])); }, [fetchFn]);

  if (!items || items.length === 0) return null;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: T.inkSoft, marginBottom: 6 }}>Announcements</Text>
      {items.slice(0, 3).map((b) => (
        <View key={b.broadcast_id} style={{ backgroundColor: T.goldLight, borderWidth: 1, borderColor: T.goldLight, borderRadius: 10, padding: 10, marginBottom: 6 }}>
          <Text style={{ fontSize: 12, color: "#6b530d" }}>{b.message}</Text>
          <Text style={{ fontSize: 10, color: T.inkSoft, marginTop: 3 }}>{new Date(b.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  );
}

// Shared "Change Password" section — used in every role's Profile screen so
// there's one place that calls POST /auth/change-password.
export function ChangePasswordCard({ style }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(""); setSuccess(false);
    if (next.length < 6) return setError("New password must be at least 6 characters");
    if (next !== confirm) return setError("New passwords don't match");
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  if (!open) {
    return <Btn full variant="ghost" icon="lock" style={style} onPress={() => setOpen(true)}>Change Password</Btn>;
  }

  return (
    <Card style={[{ marginBottom: 8 }, style]}>
      <ErrorBanner message={error} />
      {success ? (
        <View style={{ backgroundColor: T.tealLight, borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <Text style={{ color: T.teal, fontSize: 12 }}>Password updated.</Text>
        </View>
      ) : null}
      <Field label="Current password"><Input secureTextEntry value={current} onChangeText={setCurrent} /></Field>
      <Field label="New password"><Input secureTextEntry value={next} onChangeText={setNext} placeholder="At least 6 characters" /></Field>
      <Field label="Confirm new password"><Input secureTextEntry value={confirm} onChangeText={setConfirm} /></Field>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn onPress={submit} disabled={saving || !current || !next || !confirm} style={{ flex: 1 }}>{saving ? "Saving..." : "Save"}</Btn>
        <Btn variant="ghost" onPress={() => { setOpen(false); setCurrent(""); setNext(""); setConfirm(""); setError(""); setSuccess(false); }} style={{ flex: 1 }}>Cancel</Btn>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: T.tealDark,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: { color: "#fff", fontWeight: "700", fontSize: 17 },
  topBarSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    padding: 12,
  },
  btn: {
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
    color: T.ink,
    backgroundColor: "#fff",
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 10 },
});
