import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import { TopBar, Screen, Card, Btn, Chip, Field, Input, ErrorBanner, LoadingScreen, EmptyState } from "../components/ui";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { fmtDate } from "../utils";
import { T } from "../theme";

const CATEGORIES = ["General", "Payments", "Orders", "Account", "App problem", "Other"];
const STATUS_TONE = { open: "gold", in_review: "blue", resolved: "green", closed: "teal" };
const STATUS_LABEL = { open: "Open", in_review: "In review", resolved: "Resolved", closed: "Closed" };

// Help & Support — shared by retailer and employee; tickets land in Admin's Complaint Desk.
export default function SupportScreen({ navigation }) {
  const { session } = useAuth();
  const isEmployee = session?.user?.role === "employee";
  const [tickets, setTickets] = useState(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const load = useCallback(() => {
    const fn = isEmployee ? api.employeeSupport : api.retailerSupport;
    return fn().then(setTickets).catch((e) => { setError(e.message); setTickets((t) => t || []); });
  }, [isEmployee]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (description.trim().length < 5) { setError("Please describe the problem (a few words at least)"); return; }
    setSending(true); setError(""); setSent(false);
    try {
      const fn = isEmployee ? api.createEmployeeSupport : api.createRetailerSupport;
      await fn(category, description.trim());
      setDescription(""); setSent(true);
      await load();
    } catch (e) { setError(e.message); }
    setSending(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title="Help & Support" subtitle="Tell us what went wrong — the GVCDA team will respond" onBack={() => navigation.goBack()} />
      {tickets === null ? <LoadingScreen /> : (
        <Screen>
          <Card style={{ marginBottom: 16 }}>
            <ErrorBanner message={error} />
            {sent ? (
              <View style={{ backgroundColor: T.greenLight, borderRadius: 8, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: T.green, fontSize: 12 }}>Ticket sent. We'll update its status here.</Text>
              </View>
            ) : null}
            <Field label="Topic">
              <View style={{ borderWidth: 1, borderColor: T.line, borderRadius: 8, backgroundColor: "#fff" }}>
                <Picker style={{ color: T.ink }} selectedValue={category} onValueChange={setCategory}>
                  {CATEGORIES.map((c) => <Picker.Item key={c} label={c} value={c} color={T.ink} />)}
                </Picker>
              </View>
            </Field>
            <Field label="Describe the issue">
              <Input value={description} onChangeText={setDescription} multiline placeholder="What happened?" style={{ minHeight: 80, textAlignVertical: "top" }} />
            </Field>
            <Btn full icon="send" onPress={submit} disabled={sending}>{sending ? "Sending..." : "Submit Ticket"}</Btn>
          </Card>

          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 10 }}>Your Tickets</Text>
          {tickets.length === 0 ? <EmptyState icon="life-buoy" text="No tickets yet." /> : tickets.map((t) => (
            <Card key={t.complaint_id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700" }}>#{t.complaint_id} • {t.category}</Text>
                <Chip tone={STATUS_TONE[t.status] || "gold"}>{STATUS_LABEL[t.status] || t.status}</Chip>
              </View>
              <Text style={{ fontSize: 12, color: T.ink }}>{t.description}</Text>
              <Text style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 4 }}>{fmtDate(t.created_at)}</Text>
              {t.resolution_notes ? (
                <View style={{ backgroundColor: T.tealLight, borderRadius: 8, padding: 8, marginTop: 8 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "700", color: T.teal, marginBottom: 2 }}>RESPONSE</Text>
                  <Text style={{ fontSize: 12 }}>{t.resolution_notes}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </Screen>
      )}
    </View>
  );
}
