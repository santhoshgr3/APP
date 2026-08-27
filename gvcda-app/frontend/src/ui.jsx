import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { api } from "./api";

export const T = {
  teal: "#0E5E5C", tealDark: "#093F3E", tealLight: "#EAF3F2",
  terracotta: "#C1652F", terracottaLight: "#F7E7DB",
  gold: "#D4A017", goldLight: "#FBF1DA",
  red: "#B23A48", redLight: "#F7E4E6",
  cream: "#FBF7F0", ink: "#1E2523", inkSoft: "#5B655F", line: "#E7E0D3",
};

export function TopBar({ title, subtitle, onBack, right }) {
  return (
    <div style={{ background: T.tealDark, padding: "16px 20px 14px", color: "#fff", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {onBack && (
            <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ChevronLeft size={16} color="#fff" />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 17 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
        {right}
      </div>
    </div>
  );
}

export function BottomTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${T.line}`, background: "#fff", flexShrink: 0 }}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          flex: 1, border: "none", background: "none", cursor: "pointer", padding: "10px 0 9px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        }}>
          <Icon size={19} color={active === id ? T.teal : T.inkSoft} />
          <span style={{ fontSize: 10, fontWeight: active === id ? 700 : 500, color: active === id ? T.teal : T.inkSoft }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, tone = "teal" }) {
  const map = {
    teal: [T.tealLight, T.teal], gold: [T.goldLight, "#8A6A0C"],
    red: [T.redLight, T.red], terracotta: [T.terracottaLight, T.terracotta],
  };
  const [bg, fg] = map[tone];
  return <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 20, background: bg, color: fg, fontWeight: 700 }}>{children}</span>;
}

export function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, ...style }}>{children}</div>;
}

export function Btn({ children, onClick, variant = "primary", full, style, disabled, type = "button" }) {
  const styles = {
    primary: { background: disabled ? "#B7C6C5" : T.teal, color: "#fff", border: "none" },
    secondary: { background: "#fff", color: T.teal, border: `1px solid ${T.teal}` },
    danger: { background: "#fff", color: T.red, border: `1px solid ${T.red}` },
    ghost: { background: "#fff", color: T.inkSoft, border: `1px solid ${T.line}` },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} style={{
      ...styles[variant], borderRadius: 9, padding: "10px 14px", fontSize: 13, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", width: full ? "100%" : "auto",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...style,
    }}>{children}</button>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

export const inputStyle = { width: "100%", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: T.ink, background: "#fff", boxSizing: "border-box" };

export function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: T.inkSoft }}>
      <Icon size={28} color={T.line} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

export function Screen({ children }) {
  return <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>{children}</div>;
}

export function LoadingScreen({ text = "Loading..." }) {
  return <Screen><div style={{ textAlign: "center", padding: 60, color: T.inkSoft, fontSize: 13 }}>{text}</div></Screen>;
}

// Shared across Member/Employee/Retailer home screens — shows Admin's recent
// broadcasts targeted at this user (their district/mandal, or all of Telangana).
// See backend/lib/broadcasts.js for the delivery-side matching logic.
export function AnnouncementsCard({ fetchFn }) {
  const [items, setItems] = React.useState(null);
  React.useEffect(() => { fetchFn().then(setItems).catch(() => setItems([])); }, [fetchFn]);

  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>Announcements</div>
      {items.slice(0, 3).map((b) => (
        <div key={b.broadcast_id} style={{ background: T.goldLight, border: `1px solid ${T.goldLight}`, borderRadius: 10, padding: "9px 12px", marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: "#6b530d" }}>{b.message}</div>
          <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 3 }}>{new Date(b.created_at).toLocaleDateString()}</div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div style={{ background: T.redLight, color: T.red, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{message}</div>;
}

// Shared "Change Password" section — used in every role's Profile/Account
// screen so there's one place that calls POST /auth/change-password.
export function ChangePasswordCard({ style }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setCurrent(""); setNext(""); setConfirm(""); setError(""); setSuccess(false); };

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
    return (
      <Btn full variant="ghost" onClick={() => setOpen(true)} style={style}>Change Password</Btn>
    );
  }

  return (
    <Card style={{ marginBottom: 8, ...style }}>
      <ErrorBanner message={error} />
      {success && <div style={{ background: T.tealLight, color: T.teal, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>Password updated.</div>}
      <Field label="Current password"><input style={inputStyle} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
      <Field label="New password"><input style={inputStyle} type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 6 characters" /></Field>
      <Field label="Confirm new password"><input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={submit} disabled={saving || !current || !next || !confirm}>{saving ? "Saving..." : "Save"}</Btn>
        <Btn variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Btn>
      </div>
    </Card>
  );
}
