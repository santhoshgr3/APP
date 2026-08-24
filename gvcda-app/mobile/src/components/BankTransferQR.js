import React, { useState } from "react";
import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { TopBar, Screen, Card, Btn, Field, Input, ErrorBanner } from "./ui";
import { T } from "../theme";

// Shared by membership purchase (member) and commission settlement (retailer) —
// both are "pay GVCDA directly by bank/UPI transfer, then report the UTR for
// Admin to verify" (see backend/lib/paymentRequests.js). No payment gateway
// account exists yet, so this is the real payment path, not a demo stub.
export default function BankTransferQR({ title, subtitle, checkout, onSubmitUtr, onBack, onDone }) {
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const copyUpi = async () => {
    await Clipboard.setStringAsync(checkout.bank.upi_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submit = async () => {
    if (!utr.trim()) { setError("Enter the UTR / transaction reference from your payment"); return; }
    setSubmitting(true); setError("");
    try {
      await onSubmitUtr(checkout.request_id, utr.trim());
      setSubmitted(true);
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: T.cream }}>
        <TopBar title="Payment submitted" />
        <Screen style={{ alignItems: "center", paddingTop: 40 }}>
          <Feather name="clock" size={40} color={T.gold} />
          <Text style={{ fontWeight: "700", fontSize: 15, marginTop: 14 }}>Awaiting verification</Text>
          <Text style={{ fontSize: 12, color: T.inkSoft, marginTop: 8, textAlign: "center", lineHeight: 18 }}>
            We've recorded your payment reference. Admin will verify it against the bank statement shortly.
          </Text>
          <Btn full style={{ marginTop: 24 }} onPress={onDone}>Done</Btn>
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.cream }}>
      <TopBar title={title} subtitle={subtitle} onBack={onBack} />
      <Screen style={{ alignItems: "center" }}>
        <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 16 }}>
          <QRCode value={checkout.upi_uri} size={180} />
        </View>
        <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 10, textAlign: "center" }}>
          Scan with any UPI app (GPay, PhonePe, Paytm, BHIM...)
        </Text>

        <Card style={{ marginTop: 18, width: "100%" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft, marginBottom: 8 }}>OR PAY DIRECTLY</Text>
          <Row label="UPI ID" value={checkout.bank.upi_id} onCopy={copyUpi} copied={copied} />
          <Row label="Account name" value={checkout.bank.account_name} />
          <Row label="Account number" value={checkout.bank.account_number} />
          <Row label="IFSC" value={checkout.bank.ifsc} />
          <Text style={{ marginTop: 10, fontSize: 11, color: T.terracotta, fontWeight: "700" }}>
            Reference: {checkout.reference_code} — include this in the payment note if your app asks.
          </Text>
        </Card>

        <ErrorBanner message={error} />
        <View style={{ width: "100%", marginTop: 4 }}>
          <Field label="UTR / Transaction reference (after paying)">
            <Input value={utr} onChangeText={setUtr} placeholder="e.g. 402812345678" />
          </Field>
          <Btn full disabled={submitting} onPress={submit}>{submitting ? "Submitting..." : "I've Paid — Submit Reference"}</Btn>
        </View>
      </Screen>
    </View>
  );
}

function Row({ label, value, onCopy, copied }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 }}>
      <Text style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: "700" }}>{value}</Text>
        {onCopy && <Feather name="copy" size={12} color={T.teal} onPress={onCopy} />}
        {copied && <Text style={{ fontSize: 10, color: T.teal }}>Copied</Text>}
      </View>
    </View>
  );
}
