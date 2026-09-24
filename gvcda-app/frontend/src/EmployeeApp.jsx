import React, { useState } from "react";
import { Home, Users, Wallet, CalendarCheck, ListChecks, Menu, Plus, MapPinned, Camera } from "lucide-react";
import { api } from "./api";
import { TopBar, BottomTabs, Card, Btn, Chip, Field, inputStyle, Screen, EmptyState, LoadingScreen, ErrorBanner, T } from "./ui";
import LocationCascade from "./LocationCascade";
import { DashboardTab, AttendanceTab, TasksTab, PayTab, MoreTab, EmployeeSupport } from "./EmployeeExtras";

export default function EmployeeApp({ user, onLogout, onRoleChanged }) {
  const [tab, setTab] = useState("dashboard");
  const [stack, setStack] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [territory, setTerritory] = useState(null);
  const push = (screen, params) => setStack((s) => [...s, { screen, params }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const changeTab = (id) => { setTab(id); setStack([]); };
  const top = stack[stack.length - 1];
  const refresh = () => setRefreshKey((k) => k + 1);

  if (top?.screen === "enrol") return <EnrolForm onBack={() => { pop(); refresh(); }} />;
  if (top?.screen === "listRetailer") return <ListRetailerForm onBack={() => { pop(); refresh(); }} />;
  if (top?.screen === "book") return (
    <>
      <TopBar title="My Book" subtitle="Members & retailers you brought in" onBack={pop} />
      <BookTab push={push} refreshKey={refreshKey} />
    </>
  );
  if (top?.screen === "visits") return (
    <>
      <TopBar title="Daily Work Report" subtitle="Log your visits" onBack={pop} />
      <VisitLogTab refreshKey={refreshKey} onAction={refresh} />
    </>
  );
  if (top?.screen === "support") return <EmployeeSupport onBack={pop} />;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Home, Comp: () => <DashboardTab push={push} go={changeTab} refreshKey={refreshKey} onTerritory={setTerritory} /> },
    { id: "attendance", label: "Attendance", icon: CalendarCheck, Comp: () => <AttendanceTab refreshKey={refreshKey} onAction={refresh} /> },
    { id: "tasks", label: "Tasks", icon: ListChecks, Comp: () => <TasksTab refreshKey={refreshKey} onAction={refresh} /> },
    { id: "pay", label: "Pay", icon: Wallet, Comp: () => <PayTab refreshKey={refreshKey} /> },
    { id: "more", label: "More", icon: Menu, Comp: () => <MoreTab push={push} onLogout={onLogout} onUserChanged={onRoleChanged} /> },
  ];
  const Active = tabs.find((t) => t.id === tab).Comp;

  return (
    <>
      <TopBar title={user.full_name} subtitle={`${(user.designation || "").replaceAll("_", " ")}${territory ? " • " + territory : ""}`} />
      <Active />
      <BottomTabs tabs={tabs} active={tab} onChange={changeTab} />
    </>
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
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.plans().then((p) => { setPlans(p); setPlanId(p[0]?.plan_id); }); }, []);

  const submit = async () => {
    if (!name.trim() || phone.length !== 10 || !loc.village_id || !planId) {
      setError("Full name, phone, location and plan are all required"); return;
    }
    setSubmitting(true); setError("");
    try {
      await api.enrolMember({ full_name: name.trim(), phone, village_id: loc.village_id, plan_id: planId, payment_method: paymentMethod });
      onBack();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <TopBar title="Enrol Member" onBack={onBack} />
      <Screen>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Field label="Full name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Member's name" /></Field>
        <Field label="Phone *"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98xxxxxxxx" /></Field>
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
        <Field label="Payment collected via">
          <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash (in person)</option>
            <option value="upi">UPI (in person)</option>
          </select>
        </Field>
        <Btn full disabled={!name || phone.length !== 10 || submitting} onClick={submit}>{submitting ? "Submitting..." : "Submit & Issue Card"}</Btn>
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

  const canSubmit = name.trim() && catId && loc.village_id && phone.length === 10;

  const submit = async () => {
    if (!canSubmit) { setError("Business name, phone, category and location are all required"); return; }
    setSubmitting(true); setError("");
    try {
      await api.listRetailer({ business_name: name.trim(), category_id: catId, village_id: loc.village_id, phone });
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
        <Field label="Phone *"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98xxxxxxxx" /></Field>
        <Field label="Photos">
          <div style={{ border: `1px dashed ${T.line}`, borderRadius: 8, padding: 16, textAlign: "center", color: T.inkSoft }}><Camera size={18} style={{ margin: "0 auto 4px" }} /><div style={{ fontSize: 10.5 }}>Add storefront photos (not wired in this demo)</div></div>
        </Field>
        <Btn full disabled={!canSubmit || submitting} onClick={submit}>{submitting ? "Submitting..." : "Submit for Approval"}</Btn>
      </Screen>
    </>
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
