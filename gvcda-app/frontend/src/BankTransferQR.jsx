import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Clock } from "lucide-react";
import { TopBar, Card, Btn, Field, inputStyle, Screen, T } from "./ui";

// Shared by membership purchase (MemberApp) and commission settlement
// (RetailerApp) — both are "pay GVCDA directly by bank/UPI transfer, then report
// the UTR for Admin to verify" (see backend/lib/paymentRequests.js). No payment
// gateway account exists yet, so this is the real payment path, not a demo stub.
export default function BankTransferQR({ title, subtitle, checkout, onSubmitUtr, onBack, onDone }) {
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const copyUpi = () => {
    navigator.clipboard?.writeText(checkout.bank.upi_id);
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
      <>
        <TopBar title="Payment submitted" />
        <Screen style={{ textAlign: "center", paddingTop: 40 }}>
          <Clock size={40} color={T.gold} style={{ margin: "0 auto 14px" }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Awaiting verification</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 8, lineHeight: 1.6 }}>
            We've recorded your payment reference. Admin will verify it against the bank statement shortly.
          </div>
          <Btn full style={{ marginTop: 24 }} onClick={onDone}>Done</Btn>
        </Screen>
      </>
    );
  }

  return (
    <>
      <TopBar title={title} subtitle={subtitle} onBack={onBack} />
      <Screen style={{ textAlign: "center" }}>
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, display: "inline-block" }}>
          <QRCodeSVG value={checkout.upi_uri} size={180} />
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 10 }}>Scan with any UPI app (GPay, PhonePe, Paytm, BHIM...)</div>

        <Card style={{ marginTop: 18, textAlign: "left" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>OR PAY DIRECTLY</div>
          <Row label="UPI ID" value={checkout.bank.upi_id} onCopy={copyUpi} copied={copied} />
          <Row label="Account name" value={checkout.bank.account_name} />
          <Row label="Account number" value={checkout.bank.account_number} />
          <Row label="IFSC" value={checkout.bank.ifsc} />
          <div style={{ marginTop: 10, fontSize: 11, color: T.terracotta, fontWeight: 700 }}>
            Reference: {checkout.reference_code} — include this in the payment note if your app asks.
          </div>
        </Card>

        {error && <div style={{ color: T.red, fontSize: 12, marginTop: 14 }}>{error}</div>}
        <div style={{ marginTop: 18, textAlign: "left" }}>
          <Field label="UTR / Transaction reference (after paying)">
            <input style={inputStyle} placeholder="e.g. 402812345678" value={utr} onChange={(e) => setUtr(e.target.value)} />
          </Field>
          <Btn full disabled={submitting} onClick={submit}>{submitting ? "Submitting..." : "I've Paid — Submit Reference"}</Btn>
        </div>
      </Screen>
    </>
  );
}

function Row({ label, value, onCopy, copied }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
      <span style={{ fontSize: 11.5, color: T.inkSoft }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
        {value}
        {onCopy && <Copy size={12} color={T.teal} style={{ cursor: "pointer" }} onClick={onCopy} />}
        {copied && <span style={{ fontSize: 10, color: T.teal }}>Copied</span>}
      </span>
    </div>
  );
}
