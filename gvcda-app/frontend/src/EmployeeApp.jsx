import React, { useEffect, useState } from "react";
import { Home, Users, Wallet, MapPinned, UserPlus, Plus, CheckCircle2, LogOut, Camera, TrendingUp } from "lucide-react";
import { api } from "./api";
import { TopBar, BottomTabs, Card, Btn, Chip, Field, inputStyle, Screen, EmptyState, LoadingScreen, ChangePasswordCard, T } from "./ui";
import LocationCascade from "./LocationCascade";

export default function EmployeeApp({ user, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [stack, setStack] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const push = (screen, params) => setStack((s) => [...s, { screen, params }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const changeTab = (id) => { setTab(id); setStack([]); };
  const top = stack[stack.length - 1];
  const refresh = () => setRefreshKey((k) => k + 1);

  if (top?.screen === "enrol") return <EnrolForm onBack={() => { pop(); refresh(); setTab("dashboard"); }} />;
  if (top?.screen === "listRetailer") return <ListRetailerForm onBack={() => { pop(); refresh(); setTab("book"); }} />;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Home, Comp: () => <DashboardTab push={push} refreshKey={refreshKey} /> },
    { id: "book", label: "My Book", icon: Users, Comp: () => <BookTab push={push} refreshKey={refreshKey} /> },
    { id: "incentives", label: "Incentives", icon: TrendingUp, Comp: () => <IncentivesTab refreshKey={refreshKey} /> },
    { id: "visits", label: "Visits", icon: MapPinned, Comp: () => <VisitLogTab refreshKey={refreshKey} onAction={refresh} /> },
    { id: "profile", label: "Profile", icon: Wallet, Comp: () => <EmployeeProfile user={user} onLogout={onLogout} /> },
  ];
  const Active = tabs.find((t) => t.id === tab).Comp;

  return (
    <>
      <TopBar title={user.full_name} subtitle={`${(user.designation || "").replaceAll("_", " ")} • Amberpet`} />
      <Active />
      <BottomTabs tabs={tabs} active={tab} onChange={changeTab} />
    </>
  );
}

function DashboardTab({ push, refreshKey }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.employeeDashboard().then(setData); }, [refreshKey]);
  if (!data) return <LoadingScreen />;

  return (
    <Screen>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>MEMBERSHIPS SOLD</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.teal, marginTop: 4 }}>{data.memberships_sold}<span style={{ fontSize: 12, color: T.inkSoft }}> / {data.monthly_target}</span></div>
          <div style={{ height: 5, background: T.line, borderRadius: 3, marginTop: 6 }}><div style={{ width: `${Math.min(100, data.memberships_sold / data.monthly_target * 100)}%`, height: 5, background: T.teal, borderRadius: 3 }} /></div>
        </Card>
        <Card>
          <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>RETAILERS LISTED</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.terracotta, marginTop: 4 }}>{data.retailers_listed}</div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>{data.retailers_pending} pending approval</div>
        </Card>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn full onClick={() => push("enrol")}><UserPlus size={14} /> Enrol Member</Btn>
        <Btn full variant="secondary" onClick={() => push("listRetailer")}><Plus size={14} /> List Retailer</Btn>
      </div>
    </Screen>
  );
}

function BookTab({ push, refreshKey }) {
  const [sub, setSub] = useState("members");
  const [members, setMembers] = useState(null);
  const [retailers, setRetailers] = useState(null);
  useEffect(() => { api.employeeMembers().then(setMembers); api.employeeRetailers().then(setRetailers); }, [refreshKey]);

  return (
    <Screen>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["members", "retailers"].map((s) => (
          <button key={s} onClick={() => setSub(s)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: sub === s ? T.teal : "#fff", color: sub === s ? "#fff" : T.inkSoft, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
        ))}
      </div>
      {sub === "members" && (members === null ? <LoadingScreen text="" /> : members.length === 0 ? <EmptyState icon={Users} text="No members enrolled yet." /> :
        members.map((m) => (
          <Card key={m.user_id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{m.full_name}</div>
            <div style={{ fontSize: 11, color: T.inkSoft }}>{m.plan_name} • {m.village_name}</div>
          </Card>
        )))}
      {sub === "retailers" && (retailers === null ? <LoadingScreen text="" /> : retailers.length === 0 ? <EmptyState icon={Users} text="No retailers listed yet." /> :
        retailers.map((r) => (
          <Card key={r.retailer_id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{r.business_name}</div>
            <Chip tone={r.status === "pending" ? "gold" : r.status === "approved" ? "teal" : "red"}>{r.status}</Chip>
          </Card>
        )))}
      <Btn full variant="secondary" onClick={() => push("listRetailer")} style={{ marginTop: 8 }}><Plus size={13} /> List another retailer</Btn>
    </Screen>
  );
}

function EnrolForm({ onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [plans, setPlans] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.plans().then((p) => { setPlans(p); setPlanId(p[0]?.plan_id); }); }, []);

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      await api.enrolMember({ full_name: name, phone, village_id: loc.village_id, plan_id: planId, payment_method: "cash" });
      onBack();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <TopBar title="Enrol Member" onBack={onBack} />
      <Screen>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Field label="Full name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Member's name" /></Field>
        <Field label="Phone"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" /></Field>
        <Field label="Location"><LocationCascade value={loc} onChange={setLoc} /></Field>
        {plans && (
          <Field label="Plan">
            <div style={{ display: "flex", gap: 6 }}>
              {plans.map((p) => (
                <div key={p.plan_id} onClick={() => setPlanId(p.plan_id)} style={{ flex: 1, border: `2px solid ${planId === p.plan_id ? T.teal : T.line}`, borderRadius: 8, padding: 8, textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 10.5, color: T.teal, fontWeight: 700 }}>₹{p.price}</div>
                </div>
              ))}
            </div>
          </Field>
        )}
        <Field label="Payment collected via"><select style={inputStyle}><option>Cash (in person)</option><option>UPI (in person)</option></select></Field>
        <Btn full disabled={!name || !phone || submitting} onClick={submit}>{submitting ? "Submitting..." : "Submit & Issue Card"}</Btn>
      </Screen>
    </>
  );
}

function ListRetailerForm({ onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [categories, setCategories] = useState(null);
  const [catId, setCatId] = useState(null);
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.categories().then((c) => { setCategories(c); setCatId(c[0]?.category_id); }); }, []);

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      await api.listRetailer({ business_name: name, category_id: catId, village_id: loc.village_id, phone });
      onBack();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <TopBar title="List Retailer" onBack={onBack} />
      <Screen>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Field label="Business name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sri Lakshmi Grocery" /></Field>
        <Field label="Category">
          <select style={inputStyle} value={catId || ""} onChange={(e) => setCatId(Number(e.target.value))}>
            {categories?.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Location"><LocationCascade value={loc} onChange={setLoc} /></Field>
        <Field label="Phone"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" /></Field>
        <Field label="Photos">
          <div style={{ border: `1px dashed ${T.line}`, borderRadius: 8, padding: 16, textAlign: "center", color: T.inkSoft }}><Camera size={18} style={{ margin: "0 auto 4px" }} /><div style={{ fontSize: 10.5 }}>Add storefront photos (not wired in this demo)</div></div>
        </Field>
        <Btn full disabled={!name || submitting} onClick={submit}>{submitting ? "Submitting..." : "Submit for Approval"}</Btn>
      </Screen>
    </>
  );
}

function IncentivesTab({ refreshKey }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.employeeIncentives().then(setData); }, [refreshKey]);
  if (!data) return <LoadingScreen />;

  return (
    <Screen>
      <div style={{ background: T.tealDark, borderRadius: 14, padding: 16, color: "#fff", marginBottom: 16 }}>
        <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 700 }}>RUNNING TOTAL (ALL TIME)</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>₹{data.running_total}</div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>This Month's Breakdown</div>
      <Card style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Memberships sold</div>
          <div style={{ fontSize: 11, color: T.inkSoft }}>{data.this_month.membership_count} × ₹{data.this_month.membership_rate}</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.teal }}>₹{data.this_month.membership_amount}</div>
      </Card>
      <Card style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Retailers onboarded</div>
          <div style={{ fontSize: 11, color: T.inkSoft }}>{data.this_month.retailer_count} × ₹{data.this_month.retailer_rate}</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.terracotta }}>₹{data.this_month.retailer_amount}</div>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Payout History</div>
      {data.payout_history.length === 0 && <EmptyState icon={Wallet} text="No payouts recorded yet." />}
    </Screen>
  );
}

const VISIT_PURPOSES = [
  ["enrolment", "Enrolment"], ["retailer", "Retailer"], ["follow_up", "Follow-up"], ["complaint", "Complaint"],
];

function VisitLogTab({ refreshKey, onAction }) {
  const [visits, setVisits] = useState(null);
  const [purpose, setPurpose] = useState("enrolment");
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState({ district_id: null, mandal_id: null, village_id: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.employeeVisits().then(setVisits); }, [refreshKey]);

  const checkIn = async () => {
    setSaving(true); setError("");
    try {
      await api.logVisit({ village_id: loc.village_id, purpose, notes });
      setNotes("");
      onAction();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <Screen>
      <Card style={{ marginBottom: 16 }}>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Field label="Purpose">
          <select style={inputStyle} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {VISIT_PURPOSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Village"><LocationCascade value={loc} onChange={setLoc} /></Field>
        <Field label="Notes">
          <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you do on this visit?" />
        </Field>
        <Btn full onClick={checkIn} disabled={saving}><MapPinned size={13} /> {saving ? "Checking in..." : "Check In"}</Btn>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Visit History</div>
      {visits === null ? <LoadingScreen text="" /> : visits.length === 0 ? <EmptyState icon={MapPinned} text="No visits logged yet." /> : (
        visits.map((v) => (
          <Card key={v.visit_id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "capitalize" }}>{v.purpose.replace("_", " ")}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
              {v.village_name || "No location"} • {new Date(v.created_at).toLocaleString()}
            </div>
            {v.notes && <div style={{ fontSize: 11.5, color: T.ink, marginTop: 4 }}>{v.notes}</div>}
          </Card>
        ))
      )}
    </Screen>
  );
}

function EmployeeProfile({ user, onLogout }) {
  return (
    <Screen>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{user.full_name}</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{user.phone}</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3, textTransform: "capitalize" }}>{(user.designation || "").replaceAll("_", " ")}</div>
      </Card>
      <ChangePasswordCard style={{ marginBottom: 8 }} />
      <Btn full variant="danger" onClick={onLogout}><LogOut size={13} /> Log out</Btn>
    </Screen>
  );
}
