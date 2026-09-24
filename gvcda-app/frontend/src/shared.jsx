import React, { useEffect, useState } from "react";
import { User as UserIcon, Send, LifeBuoy, Mail } from "lucide-react";
import { api, photoUrl, getSession, saveSession } from "./api";
import { Card, Btn, Chip, Field, inputStyle, EmptyState, ErrorBanner, T } from "./ui";

// ---------- formatting ----------
export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function fmtDate(d) {
  if (!d) return "—";
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  const dt = bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) : new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function fmtTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}
export function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return `${fmtDate(dt)}, ${fmtTime(dt)}`;
}
// A booking slot is stored as an absolute timestamp of an IST wall-clock time — always render it in IST.
export function fmtSlot(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (dt = new Date()) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
export const isoMonth = (dt = new Date()) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
// Normalises a DATE column value (bare "YYYY-MM-DD" or an ISO timestamp) to a local YYYY-MM-DD string.
export const dayStr = (d) => {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return String(d);
  const dt = new Date(d);
  return isNaN(dt) ? "" : isoDay(dt);
};
export function monthLabel(m) {
  const [y, mo] = String(m).split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// ---------- order vocabulary ----------
export const DELIVERY_LABEL = { pickup: "Pickup", self_delivery: "Home delivery", gvcda_delivery: "GVCDA delivery" };
export const DELIVERY_TONE = { pickup: "purple", self_delivery: "blue", gvcda_delivery: "teal" };
export function DeliveryBadge({ method }) {
  if (!method) return null;
  return <Chip tone={DELIVERY_TONE[method] || "gray"}>{DELIVERY_LABEL[method] || method}</Chip>;
}
export function PaymentChip({ method, status }) {
  if (method === "upi") {
    if (status === "paid") return <Chip tone="green">UPI • Paid</Chip>;
    if (status === "submitted") return <Chip tone="blue">UPI • Awaiting confirmation</Chip>;
    return <Chip tone="gold">UPI • Payment pending</Chip>;
  }
  return <Chip tone={status === "paid" ? "green" : "gray"}>{status === "paid" ? "COD • Paid" : "Cash on delivery"}</Chip>;
}
export function orderTone(status) {
  return status === "fulfilled" ? "green" : ["rejected", "cancelled"].includes(status) ? "red" : status === "accepted" ? "blue" : "gold";
}

// ---------- data loading ----------
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fn()
      .then((data) => alive && setState({ data, error: "", loading: false }))
      .catch((e) => alive && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

// Renders loading / error+retry until data exists, then hands it to children().
export function Loaded({ q, children }) {
  if (q.data === null && q.loading) return <div style={{ textAlign: "center", padding: 40, color: T.inkSoft, fontSize: 13 }}>Loading...</div>;
  if (q.data === null) {
    return (
      <div style={{ padding: "20px 0" }}>
        <ErrorBanner message={q.error || "Could not load"} />
        <Btn variant="ghost" onClick={q.reload}>Retry</Btn>
      </div>
    );
  }
  return children(q.data);
}

export function Pills({ options, value, onChange, style }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", ...style }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding: "5px 11px", borderRadius: 16, border: `1px solid ${value === v ? T.teal : T.line}`,
          background: value === v ? T.teal : "#fff", color: value === v ? "#fff" : T.inkSoft,
          fontSize: 10.5, fontWeight: 700, cursor: "pointer",
        }}>{label}</button>
      ))}
    </div>
  );
}

export function Avatar({ filename, name, size = 44, tone = "teal" }) {
  const url = photoUrl(filename);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: T[`${tone}Light`], color: T[tone], flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.34 }}>
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name ? name.slice(0, 2).toUpperCase() : <UserIcon size={size * 0.45} />)}
    </div>
  );
}

// ---------- session helpers ----------
export function persistUser(u) {
  const s = getSession();
  if (s && u) saveSession(s.token, { ...s.user, ...u }, s.roles);
}

// ---------- shared profile blocks ----------
export function EmailCard({ onSaved, style }) {
  const [saved, setSaved] = useState(null); // null = still loading
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.me().then((r) => { setSaved(r.user.email || ""); setEmail(r.user.email || ""); }).catch((e) => { setSaved(""); setError(e.message); });
  }, []);

  const save = async () => {
    setBusy(true); setError(""); setOk(false);
    try {
      const r = await api.updateEmail(email.trim());
      persistUser(r.user);
      setSaved(r.user.email || ""); setEmail(r.user.email || "");
      setOk(true);
      onSaved?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Card style={{ marginBottom: 12, ...style }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Mail size={12} /> EMAIL</div>
      <ErrorBanner message={error} />
      <input style={inputStyle} type="email" value={email} disabled={saved === null} placeholder="you@example.com (optional)" onChange={(e) => { setEmail(e.target.value); setOk(false); }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <Btn onClick={save} disabled={busy || saved === null || email.trim() === saved}>{busy ? "Saving..." : "Save email"}</Btn>
        {ok && <span style={{ fontSize: 11.5, color: T.green, fontWeight: 700 }}>Saved</span>}
      </div>
    </Card>
  );
}

const TICKET_CATEGORIES = ["General", "Payments", "Orders", "Account", "App issue", "Other"];
const ticketTone = (s) => ({ open: "red", in_review: "gold", resolved: "green", closed: "gray" }[s] || "gray");

// Help & Support — raises a complaint the Admin sees in Complaint Desk, and lists
// the user's own tickets with any resolution notes.
export function SupportPanel({ fetchFn, createFn }) {
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const q = useLoad(fetchFn, []);

  const submit = async () => {
    if (description.trim().length < 5) { setError("Please describe the issue (at least a few words)"); return; }
    setBusy(true); setError(""); setSent(false);
    try {
      await createFn(category, description.trim());
      setDescription(""); setSent(true); q.reload();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <ErrorBanner message={error} />
        {sent && <div style={{ background: T.greenLight, color: T.green, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>Ticket submitted. We'll get back to you.</div>}
        <Field label="Category">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Describe the issue">
          <textarea style={{ ...inputStyle, minHeight: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What do you need help with?" />
        </Field>
        <Btn full onClick={submit} disabled={busy || !description.trim()}><Send size={13} /> {busy ? "Submitting..." : "Submit ticket"}</Btn>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Your tickets</div>
      <Loaded q={q}>
        {(rows) => rows.length === 0 ? <EmptyState icon={LifeBuoy} text="No tickets raised yet." /> : rows.map((t) => (
          <Card key={t.complaint_id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.category || "General"}</span>
              <Chip tone={ticketTone(t.status)}>{String(t.status).replace("_", " ")}</Chip>
            </div>
            <div style={{ fontSize: 12, color: T.ink, marginTop: 5 }}>{t.description}</div>
            {t.resolution_notes && <div style={{ fontSize: 11.5, color: T.teal, marginTop: 5 }}>Response: {t.resolution_notes}</div>}
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 5 }}>{fmtDateTime(t.created_at)}</div>
          </Card>
        ))}
      </Loaded>
    </>
  );
}
