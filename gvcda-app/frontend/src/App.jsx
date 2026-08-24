import React, { useState } from "react";
import { Repeat, X } from "lucide-react";
import Login from "./Login";
import MemberApp from "./MemberApp";
import EmployeeApp from "./EmployeeApp";
import RetailerApp from "./RetailerApp";
import AdminApp from "./AdminApp";
import { api, getSession, saveSession, clearSession } from "./api";
import { T } from "./ui";

function PhoneFrame({ children }) {
  return (
    <div style={{ width: 390, height: 780, borderRadius: 38, background: "#0B0B0B", padding: 10, boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 30, background: T.cream, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

const ROLE_LABEL = { member: "Member", employee: "Employee", retailer: "Retailer", admin: "Admin" };

// A dual-role account (e.g. Member + Retailer) gets a switcher instead of a second login —
// see PRD 8.1 and Screen Spec A.1. It re-issues the auth token with the new active role.
function RoleSwitcher({ roles, activeRole, onSwitched }) {
  const [open, setOpen] = useState(false);
  if (roles.length < 2) return null;

  const pick = async (role) => {
    if (role === activeRole) { setOpen(false); return; }
    const res = await api.switchRole(role);
    // Save the new token first — /auth/me below needs it to be the one already
    // stored, otherwise it'd fetch roles under the role we just switched away from.
    saveSession(res.token, res.user);
    const me = await api.me();
    saveSession(res.token, me.user, me.roles);
    onSwitched();
  };

  return (
    <div style={{ position: "absolute", top: 14, right: 14, zIndex: 5 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        {open ? <X size={15} color="#fff" /> : <Repeat size={14} color="#fff" />}
      </button>
      {open && (
        <div style={{ position: "absolute", top: 36, right: 0, background: "#fff", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", overflow: "hidden", width: 170 }}>
          {roles.map((r) => (
            <button key={r} onClick={() => pick(r)} style={{
              width: "100%", textAlign: "left", padding: "10px 14px", border: "none", cursor: "pointer",
              background: r === activeRole ? T.tealLight : "#fff", fontSize: 12.5, fontWeight: r === activeRole ? 700 : 500, color: T.ink,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              {ROLE_LABEL[r] || r}
              {r === activeRole && <span style={{ fontSize: 9, color: T.teal, fontWeight: 700 }}>ACTIVE</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(getSession());

  const handleLogout = () => { clearSession(); setSession(null); };
  const refreshSession = () => setSession(getSession());

  // Admin is a separate web dashboard (heavier tables, large-screen workflow) — it does
  // not run inside the mobile phone-frame shell that Member/Employee/Retailer share.
  if (session && session.user.role === "admin") {
    return (
      <div style={{ height: "100vh", width: "100vw" }}>
        <AdminApp user={session.user} onLogout={handleLogout} />
      </div>
    );
  }

  const RoleApp = session ? { member: MemberApp, employee: EmployeeApp, retailer: RetailerApp }[session.user.role] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#F1ECE1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 800, fontSize: 22, color: T.tealDark }}>GVCDA App</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
          One app for Member, Employee and Retailer — role resolves after OTP login. Admin is a separate web dashboard.
        </div>
      </div>
      <PhoneFrame>
        {!session ? (
          <Login onLoggedIn={() => setSession(getSession())} />
        ) : (
          <>
            <RoleSwitcher roles={session.roles || [session.user.role]} activeRole={session.user.role} onSwitched={refreshSession} />
            <RoleApp user={session.user} roles={session.roles || [session.user.role]} onLogout={handleLogout} onRoleChanged={refreshSession} />
          </>
        )}
      </PhoneFrame>
    </div>
  );
}
