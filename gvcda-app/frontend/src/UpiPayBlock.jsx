import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Clock, Smartphone } from "lucide-react";
import { api } from "./api";
import { Card, Btn, Field, inputStyle, ErrorBanner, T } from "./ui";
import { PaymentChip } from "./shared";

// Pay-the-retailer-directly-by-UPI block for a member's UPI order. Same pay-then-report-UTR
// flow as BankTransferQR (membership/commission), but the payee is the retailer and the
// retailer (not Admin) confirms receipt.
export default function UpiPayBlock({ order, upiId, businessName, onSubmitted }) {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (order.payment_status === "paid") return null;

  const uri = upiId
    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName || "Retailer")}&am=${Number(order.order_total).toFixed(2)}&cu=INR&tn=Order%20${order.order_id}`
    : null;

  const copy = () => {
    navigator.clipboard?.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submit = async () => {
    if (!utr.trim()) { setError("Enter the UTR / transaction reference from your payment"); return; }
    setBusy(true); setError("");
    try {
      await api.submitOrderPayment(order.order_id, utr.trim());
      setUtr("");
      onSubmitted?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Card style={{ marginBottom: 12, borderColor: T.gold }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft }}>PAY VIA UPI</span>
        <PaymentChip method="upi" status={order.payment_status} />
      </div>

      {order.payment_status === "submitted" ? (
        <div style={{ textAlign: "center", padding: "6px 0" }}>
          <Clock size={26} color={T.gold} style={{ margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>Awaiting retailer confirmation</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
            You reported UTR <b>{order.payment_utr}</b>. {businessName} will confirm once the money shows up.
          </div>
        </div>
      ) : !upiId ? (
        <div style={{ fontSize: 12, color: T.red }}>
          This retailer hasn't set up a UPI ID yet. Please contact them{order.retailer_phone ? ` on ${order.retailer_phone}` : ""} or ask to switch to cash on delivery.
        </div>
      ) : (
        <>
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "inline-block", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 12 }}>
              <QRCodeSVG value={uri} size={160} />
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>Scan with any UPI app to pay <b>₹{order.order_total}</b></div>
            <a href={uri} style={{ textDecoration: "none", display: "block", marginTop: 10 }}>
              <Btn full variant="secondary"><Smartphone size={13} /> Pay with UPI app</Btn>
            </a>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 4px" }}>
            <span style={{ fontSize: 11.5, color: T.inkSoft }}>UPI ID</span>
            <span style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              {upiId}
              <Copy size={13} color={T.teal} style={{ cursor: "pointer" }} onClick={copy} />
              {copied && <span style={{ fontSize: 10, color: T.teal }}>Copied</span>}
            </span>
          </div>
          <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 10, paddingTop: 12 }}>
            <ErrorBanner message={error} />
            <Field label="I've paid — enter UTR / transaction reference">
              <input style={inputStyle} placeholder="e.g. 402812345678" value={utr} onChange={(e) => setUtr(e.target.value)} />
            </Field>
            <Btn full disabled={busy} onClick={submit}>{busy ? "Submitting..." : "Submit payment reference"}</Btn>
          </div>
        </>
      )}
    </Card>
  );
}
