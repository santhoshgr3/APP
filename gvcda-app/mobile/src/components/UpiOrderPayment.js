import React, { useState } from "react";
import { View, Text, Linking } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Card, Btn, Chip, Field, Input, ErrorBanner } from "./ui";
import { api } from "../api";
import { paymentChip, money } from "../utils";
import { T } from "../theme";

// Member-side UPI payment block for an order: pay the retailer directly (QR or a UPI app
// deep link), then report the UTR so the retailer can confirm receipt.
export default function UpiOrderPayment({ order, onChanged }) {
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const chip = paymentChip(order);
  const upiId = order.retailer_upi_id;
  const uri = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(order.business_name || "Retailer")}&am=${Number(order.order_total).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${order.order_id}`)}`
    : null;

  const copyUpi = async () => {
    await Clipboard.setStringAsync(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openApp = async () => {
    setError("");
    try { await Linking.openURL(uri); }
    catch (e) { setError("No UPI app found on this phone. Scan the QR code from another device or pay to the UPI ID."); }
  };

  const submit = async () => {
    if (!utr.trim()) { setError("Enter the UTR / transaction reference from your payment"); return; }
    setSubmitting(true); setError("");
    try {
      await api.submitOrderPayment(order.order_id, utr.trim());
      setUtr("");
      onChanged && onChanged();
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: T.inkSoft }}>UPI PAYMENT • {money(order.order_total)}</Text>
        <Chip tone={chip.tone}>{chip.label}</Chip>
      </View>

      {order.payment_status === "paid" ? (
        <Text style={{ fontSize: 12, color: T.green }}>The retailer has confirmed your payment.</Text>
      ) : order.payment_status === "submitted" ? (
        <Text style={{ fontSize: 12, color: T.inkSoft }}>
          You reported reference {order.payment_utr}. The retailer will confirm once it shows in their account.
        </Text>
      ) : !upiId ? (
        <Text style={{ fontSize: 12, color: T.red }}>This retailer hasn't set a UPI ID yet — contact them or ask to change the payment method.</Text>
      ) : (
        <>
          <View style={{ alignItems: "center", marginVertical: 8 }}>
            <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 14 }}>
              <QRCode value={uri} size={170} />
            </View>
            <Text style={{ fontSize: 11, color: T.inkSoft, marginTop: 8, textAlign: "center" }}>Scan with any UPI app (GPay, PhonePe, Paytm, BHIM...)</Text>
          </View>
          <Btn full icon="smartphone" onPress={openApp} style={{ marginBottom: 8 }}>Pay with UPI app</Btn>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
            <Text style={{ fontSize: 11.5, color: T.inkSoft }}>UPI ID</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "700" }}>{upiId}</Text>
              <Feather name="copy" size={13} color={T.teal} onPress={copyUpi} />
              {copied ? <Text style={{ fontSize: 10, color: T.teal }}>Copied</Text> : null}
            </View>
          </View>
          <ErrorBanner message={error} />
          <Field label="I've paid — enter UTR / transaction reference">
            <Input value={utr} onChangeText={setUtr} placeholder="e.g. 402812345678" autoCapitalize="characters" />
          </Field>
          <Btn full disabled={submitting} onPress={submit}>{submitting ? "Submitting..." : "Submit Payment Reference"}</Btn>
        </>
      )}
      {order.payment_status !== "pending" || !upiId ? <ErrorBanner message={error} /> : null}
    </Card>
  );
}
