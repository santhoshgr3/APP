import React, { useState } from "react";
import { api, saveSession } from "./api";
import { Screen, Field, inputStyle, Btn, ErrorBanner, T } from "./ui";

export default function Login({ onLoggedIn }) {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    setError(""); setLoading(true);
    try {
      const res = await api.requestOtp(phone);
      setDevOtp(res.dev_otp);
      setStep("otp");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const verify = async () => {
    setError(""); setLoading(true);
    try {
      const res = await api.verifyOtp(phone, otp);
      saveSession(res.token, res.user, res.roles);
      onLoggedIn(res.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <Screen>
      <div style={{ textAlign: "center", paddingTop: 40, marginBottom: 30 }}>
        <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 800, fontSize: 30, color: T.tealDark }}>GVCDA</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 6 }}>One Platform for Village & City Development</div>
      </div>

      <ErrorBanner message={error} />

      {step === "phone" && (
        <>
          <Field label="Mobile number">
            <input style={inputStyle} placeholder="9000000003 (demo member)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Btn full onClick={sendOtp} disabled={phone.length < 10 || loading}>{loading ? "Sending..." : "Send OTP"}</Btn>
          <div style={{ marginTop: 18, fontSize: 11, color: T.inkSoft, lineHeight: 1.6 }}>
            <b>Demo accounts (seeded):</b><br />
            9000000001 — Admin<br />
            9000000002 — Employee (Mandal Sub Manager)<br />
            9000000003 — Member (Ramesh, Standard plan)<br />
            9000000004 — Retailer, approved<br />
            9000000005 — Retailer, pending approval<br />
            9000000006 — Member + Retailer (try the role switcher)<br />
            Any new number — self-signup as a new Member
          </div>
        </>
      )}

      {step === "otp" && (
        <>
          <Field label={`OTP sent to ${phone}`}>
            <input style={inputStyle} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} />
          </Field>
          <div style={{ fontSize: 11, color: T.gold, marginBottom: 14 }}>Dev mode — OTP is always <b>{devOtp}</b> (no real SMS sent).</div>
          <Btn full onClick={verify} disabled={otp.length < 6 || loading}>{loading ? "Verifying..." : "Verify & Continue"}</Btn>
          <Btn full variant="ghost" onClick={() => setStep("phone")} style={{ marginTop: 8 }}>Change number</Btn>
        </>
      )}
    </Screen>
  );
}
