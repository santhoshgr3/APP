import React, { useState } from "react";
import { api, saveSession } from "./api";
import { Screen, Field, inputStyle, Btn, ErrorBanner, T } from "./ui";

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const res = mode === "login"
        ? await api.login(phone, password)
        : await api.register(phone, password, fullName, referralCode.trim() || undefined, email.trim() || undefined);
      saveSession(res.token, res.user, res.roles);
      onLoggedIn(res.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const canSubmit = phone.length === 10 && password.length >= 6 && (mode === "login" || fullName.trim()) && !loading;

  return (
    <Screen>
      <div style={{ textAlign: "center", paddingTop: 24, marginBottom: 24 }}>
        <img src="/logo.png" alt="GVCDA — Global Village & City Development Agency" style={{ width: 220, maxWidth: "70%", height: "auto" }} />
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 6 }}>All in one Sector Service Hub</div>
      </div>

      <ErrorBanner message={error} />

      {mode === "register" && (
        <>
          <Field label="Full name">
            <input style={inputStyle} placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Email (optional)">
            <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Referral code (optional)">
            <input style={inputStyle} placeholder="e.g. 4ABA41" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} />
          </Field>
        </>
      )}
      <Field label="Mobile number">
        <input style={inputStyle} placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
      </Field>
      <Field label="Password">
        <input style={inputStyle} type="password" placeholder={mode === "register" ? "At least 6 characters" : "••••••••"} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>

      <Btn full onClick={submit} disabled={!canSubmit}>
        {loading ? (mode === "login" ? "Logging in..." : "Creating account...") : (mode === "login" ? "Log In" : "Create Account")}
      </Btn>
      <Btn full variant="ghost" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ marginTop: 8 }}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </Btn>
    </Screen>
  );
}
