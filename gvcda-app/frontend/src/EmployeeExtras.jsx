import React, { useState } from "react";
import {
  UserPlus, Plus, Wallet, CalendarCheck, ListChecks, LogIn, LogOut as LogOutIcon, Camera, Trash2,
  Users, MapPinned, LifeBuoy, ChevronRight, Target, TrendingUp,
} from "lucide-react";
import { api, photoUrl } from "./api";
import { TopBar, Card, Btn, Chip, Field, inputStyle, Screen, EmptyState, ErrorBanner, ChangePasswordCard, AnnouncementsCard, T } from "./ui";
import { inr, fmtDate, fmtTime, isoDay, isoMonth, monthLabel, dayStr, useLoad, Loaded, Pills, persistUser, EmailCard, SupportPanel } from "./shared";

const label = (s) => String(s || "").replaceAll("_", " ");

// ---------- Dashboard ----------
export function DashboardTab({ push, go, refreshKey, onTerritory }) {
  const q = useLoad(() => api.employeeDashboard().then((d) => { onTerritory?.(d.employee.mandal_name || d.employee.district_name || ""); return d; }), [refreshKey]);
  return (
    <Screen>
      <AnnouncementsCard fetchFn={api.employeeBroadcasts} />
      <Loaded q={q}>
        {(d) => {
          const target = Number(d.monthly_target) || 0;
          const done = Number(d.month_progress) || 0;
          const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
          const att = d.today_attendance;
          const attState = !att ? ["Not checked in", "gold"] : att.check_out_at ? [`Done for the day • ${fmtTime(att.check_in_at)} – ${fmtTime(att.check_out_at)}`, "green"] : [`Checked in at ${fmtTime(att.check_in_at)}`, "green"];
          return (
            <>
              {d.employee.employee_code && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>EMPLOYEE ID</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: T.tealDark, letterSpacing: 1 }}>{d.employee.employee_code}</span>
                </div>
              )}
              <Card style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, display: "flex", alignItems: "center", gap: 5 }}><Target size={12} /> THIS MONTH'S TARGET</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.teal }}>{Math.round(pct)}%</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: T.teal, marginTop: 4 }}>{done}<span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 600 }}> of {target}</span></div>
                <div style={{ height: 7, background: T.line, borderRadius: 4, marginTop: 8 }}><div style={{ width: `${pct}%`, height: 7, background: pct >= 100 ? T.green : T.teal, borderRadius: 4 }} /></div>
                <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>Memberships sold this month</div>
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Card onClick={() => go("tasks")} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>OPEN TASKS</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: Number(d.open_tasks) > 0 ? T.terracotta : T.green, marginTop: 4 }}>{Number(d.open_tasks) || 0}</div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 4 }}>Tap to view</div>
                </Card>
                <Card onClick={() => go("attendance")} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>TODAY</div>
                  <div style={{ marginTop: 6 }}><Chip tone={attState[1]}>{att ? (att.check_out_at ? "Checked out" : "Checked in") : "Not checked in"}</Chip></div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>{att ? attState[0] : "Tap to check in"}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>MEMBERSHIPS SOLD</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.purple, marginTop: 4 }}>{d.memberships_sold}</div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 4 }}>All time</div>
                </Card>
                <Card>
                  <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>RETAILERS LISTED</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.terracotta, marginTop: 4 }}>{d.retailers_listed}</div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 4 }}>{d.retailers_pending} pending approval</div>
                </Card>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <Btn full onClick={() => push("enrol")}><UserPlus size={14} /> Enrol Member</Btn>
                <Btn full variant="secondary" onClick={() => push("listRetailer")}><Plus size={14} /> List Retailer</Btn>
              </div>
              <Btn full variant="ghost" onClick={() => push("book")} style={{ marginTop: 10 }}><Users size={14} /> My Book</Btn>
            </>
          );
        }}
      </Loaded>
    </Screen>
  );
}

// ---------- Attendance + Leave ----------
function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}),
      { timeout: 6000, maximumAge: 60000 },
    );
  });
}

const LEAVE_TYPES = [["casual", "Casual"], ["sick", "Sick"], ["earned", "Earned"], ["unpaid", "Unpaid"]];
const leaveTone = { pending: "gold", approved: "green", rejected: "red" };

export function AttendanceTab({ refreshKey, onAction }) {
  const [month, setMonth] = useState(isoMonth());
  const q = useLoad(() => api.employeeAttendance(month), [month, refreshKey]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const punch = async (kind) => {
    setBusy(true); setError("");
    try {
      const coords = await getCoords();
      await (kind === "in" ? api.checkIn(coords) : api.checkOut(coords));
      q.reload(); onAction?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Screen>
      <ErrorBanner message={error} />
      <Loaded q={q}>
        {(d) => {
          const t = d.today;
          const checkedIn = !!t?.check_in_at;
          const checkedOut = !!t?.check_out_at;
          return (
            <>
              <Card style={{ marginBottom: 14, textAlign: "center", background: checkedOut ? T.greenLight : checkedIn ? T.blueLight : "#fff" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft }}>TODAY • {fmtDate(new Date())}</div>
                {!checkedIn && (
                  <>
                    <div style={{ fontSize: 13, color: T.inkSoft, margin: "10px 0" }}>You haven't checked in yet.</div>
                    <Btn full disabled={busy} onClick={() => punch("in")} style={{ padding: "16px 14px", fontSize: 15 }}><LogIn size={18} /> {busy ? "Checking in..." : "Check In"}</Btn>
                  </>
                )}
                {checkedIn && !checkedOut && (
                  <>
                    <div style={{ fontSize: 13, margin: "10px 0" }}>Checked in at <b>{fmtTime(t.check_in_at)}</b></div>
                    <Btn full disabled={busy} onClick={() => punch("out")} style={{ padding: "16px 14px", fontSize: 15, background: T.terracotta }}><LogOutIcon size={18} /> {busy ? "Checking out..." : "Check Out"}</Btn>
                  </>
                )}
                {checkedOut && (
                  <div style={{ fontSize: 13, margin: "10px 0 2px" }}>
                    <div style={{ color: T.green, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Day complete</div>
                    In {fmtTime(t.check_in_at)} • Out {fmtTime(t.check_out_at)}
                  </div>
                )}
                <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 8 }}>Your location is attached to check-ins when your browser allows it.</div>
              </Card>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{monthLabel(month)}</div>
                <input type="month" max={isoMonth()} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "5px 8px" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Card><div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft }}>DAYS PRESENT</div><div style={{ fontSize: 22, fontWeight: 800, color: T.green, marginTop: 3 }}>{d.summary?.days_present ?? 0}</div></Card>
                <Card><div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft }}>APPROVED LEAVE DAYS</div><div style={{ fontSize: 22, fontWeight: 800, color: T.purple, marginTop: 3 }}>{d.summary?.approved_leave_days ?? 0}</div></Card>
              </div>
              {d.records.length === 0 ? <EmptyState icon={CalendarCheck} text="No attendance recorded this month." /> : d.records.map((r) => (
                <Card key={r.attendance_id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{fmtDate(r.work_date)}</span>
                  <span style={{ fontSize: 11.5, color: T.inkSoft }}>{fmtTime(r.check_in_at)} – {r.check_out_at ? fmtTime(r.check_out_at) : <Chip tone="gold">no check-out</Chip>}</span>
                </Card>
              ))}
            </>
          );
        }}
      </Loaded>
      <LeaveSection />
    </Screen>
  );
}

function LeaveSection() {
  const q = useLoad(() => api.employeeLeaves(), []);
  const [form, setForm] = useState({ from_date: "", to_date: "", leave_type: "casual", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const submit = async () => {
    setError(""); setOk(false);
    if (!form.from_date || !form.to_date) { setError("Choose both a from and a to date"); return; }
    if (form.to_date < form.from_date) { setError("The end date can't be before the start date"); return; }
    setBusy(true);
    try {
      await api.requestLeave({ ...form, reason: form.reason.trim() || undefined });
      setForm({ from_date: "", to_date: "", leave_type: "casual", reason: "" });
      setOk(true); q.reload();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const withdraw = async (id) => {
    if (!window.confirm("Withdraw this leave request?")) return;
    setError("");
    try { await api.withdrawLeave(id); q.reload(); } catch (e) { setError(e.message); }
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Request leave</div>
      <Card style={{ marginBottom: 14 }}>
        <ErrorBanner message={error} />
        {ok && <div style={{ background: T.greenLight, color: T.green, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>Leave request sent for approval.</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><Field label="From"><input style={inputStyle} type="date" min={isoDay()} value={form.from_date} onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value, to_date: f.to_date && f.to_date < e.target.value ? e.target.value : f.to_date }))} /></Field></div>
          <div style={{ flex: 1 }}><Field label="To"><input style={inputStyle} type="date" min={form.from_date || isoDay()} value={form.to_date} onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))} /></Field></div>
        </div>
        <Field label="Type">
          <select style={inputStyle} value={form.leave_type} onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value }))}>
            {LEAVE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Reason (optional)"><input style={inputStyle} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Short reason" /></Field>
        <Btn full onClick={submit} disabled={busy}>{busy ? "Sending..." : "Request leave"}</Btn>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>My leave requests</div>
      <Loaded q={q}>
        {(rows) => rows.length === 0 ? <EmptyState icon={CalendarCheck} text="No leave requests yet." /> : rows.map((l) => (
          <Card key={l.leave_id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmtDate(l.from_date)}{dayStr(l.from_date) !== dayStr(l.to_date) ? ` → ${fmtDate(l.to_date)}` : ""}</div>
                <div style={{ fontSize: 11, color: T.inkSoft, textTransform: "capitalize" }}>{label(l.leave_type)} leave</div>
              </div>
              <Chip tone={leaveTone[l.status] || "gray"}>{l.status}</Chip>
            </div>
            {l.reason && <div style={{ fontSize: 11.5, marginTop: 5 }}>{l.reason}</div>}
            {l.decision_note && <div style={{ fontSize: 11.5, color: T.teal, marginTop: 4 }}>Note: {l.decision_note}</div>}
            {l.status === "pending" && <Btn variant="danger" style={{ marginTop: 8, padding: "6px 12px", fontSize: 11.5 }} onClick={() => withdraw(l.leave_id)}>Withdraw</Btn>}
          </Card>
        ))}
      </Loaded>
    </div>
  );
}

// ---------- Tasks ----------
const PRIORITY_TONE = { high: "red", normal: "blue", low: "gray" };

export function TasksTab({ refreshKey, onAction }) {
  const q = useLoad(() => api.employeeTasks(), [refreshKey]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const setStatus = async (id, status) => {
    setBusyId(id); setError("");
    try { await api.updateTaskStatus(id, status); q.reload(); onAction?.(); } catch (e) { setError(e.message); }
    setBusyId(null);
  };

  const renderTask = (t) => {
    const done = t.status === "done";
    const overdue = !done && t.due_date && dayStr(t.due_date) < isoDay();
    return (
      <Card key={t.task_id} style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, textDecoration: done ? "line-through" : "none", color: done ? T.inkSoft : T.ink }}>{t.title}</div>
          <Chip tone={PRIORITY_TONE[t.priority] || "gray"}>{t.priority}</Chip>
        </div>
        {t.description && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>{t.description}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 10.5, marginTop: 6, color: T.inkSoft }}>
          {t.due_date && <span style={{ color: overdue ? T.red : T.inkSoft, fontWeight: overdue ? 700 : 500 }}>{overdue ? "Overdue • " : "Due "}{fmtDate(t.due_date)}</span>}
          {t.assigned_by_name && <span>From {t.assigned_by_name}</span>}
          {done && t.completed_at && <span>Done {fmtDate(t.completed_at)}</span>}
          {t.status === "in_progress" && <Chip tone="blue">In progress</Chip>}
        </div>
        {!done && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {t.status === "pending" && <Btn variant="secondary" disabled={busyId === t.task_id} style={{ padding: "6px 12px", fontSize: 11.5 }} onClick={() => setStatus(t.task_id, "in_progress")}>Start</Btn>}
            <Btn disabled={busyId === t.task_id} style={{ padding: "6px 12px", fontSize: 11.5 }} onClick={() => setStatus(t.task_id, "done")}>Mark done</Btn>
          </div>
        )}
      </Card>
    );
  };

  return (
    <Screen>
      <ErrorBanner message={error} />
      <Loaded q={q}>
        {(rows) => {
          const open = rows.filter((t) => t.status !== "done");
          const done = rows.filter((t) => t.status === "done");
          if (rows.length === 0) return <EmptyState icon={ListChecks} text="No tasks assigned to you yet." />;
          return (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Open ({open.length})</div>
              {open.length === 0 ? <EmptyState icon={ListChecks} text="All caught up — no open tasks." /> : open.map(renderTask)}
              {done.length > 0 && <div style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px" }}>Done ({done.length})</div>}
              {done.map(renderTask)}
            </>
          );
        }}
      </Loaded>
    </Screen>
  );
}

// ---------- Pay (salary + incentives) ----------
export function PayTab({ refreshKey }) {
  const salaryQ = useLoad(() => api.employeeSalary(), [refreshKey]);
  const incQ = useLoad(() => api.employeeIncentives(), [refreshKey]);

  return (
    <Screen>
      <Loaded q={salaryQ}>
        {(s) => {
          const inc = s.current_incentive || {};
          return (
            <>
              <div style={{ background: T.tealDark, borderRadius: 14, padding: 16, color: "#fff", marginBottom: 12 }}>
                <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 700 }}>MONTHLY SALARY</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{inr(s.monthly_salary)}</div>
              </div>
              <Card style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: T.gold }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft }}>THIS MONTH'S INCENTIVE{inc.month ? ` • ${monthLabel(String(inc.month).slice(0, 7))}` : ""}</div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Running total, paid with your salary</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>{inr(inc.total)}</div>
              </Card>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Salary payments</div>
              {s.history.length === 0 ? <EmptyState icon={Wallet} text="No salary payments recorded yet." /> : s.history.map((p) => (
                <Card key={p.payment_id} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{monthLabel(p.month)}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.green }}>{inr(p.total)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 5, lineHeight: 1.6 }}>
                    Base {inr(p.base_amount)} + Incentive {inr(p.incentive_amount)}{Number(p.deductions) > 0 ? ` − Deductions ${inr(p.deductions)}` : ""}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 3 }}>
                    Paid {fmtDate(p.paid_on)}{p.reference ? ` • Ref ${p.reference}` : ""}{p.notes ? ` • ${p.notes}` : ""}
                  </div>
                </Card>
              ))}
            </>
          );
        }}
      </Loaded>

      <div style={{ fontSize: 13, fontWeight: 700, margin: "20px 0 8px", display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={14} color={T.teal} /> Incentives</div>
      <Loaded q={incQ}>
        {(data) => (
          <>
            <div style={{ background: T.tealLight, borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.teal, fontWeight: 700 }}>RUNNING TOTAL (ALL TIME)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.tealDark, marginTop: 4 }}>{inr(data.running_total)}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>This Month's Breakdown</div>
            <Card style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>Memberships sold</div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>{data.this_month.membership_count} × ₹{data.this_month.membership_rate}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.teal }}>₹{data.this_month.membership_amount}</div>
            </Card>
            <Card style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>Retailers onboarded</div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>{data.this_month.retailer_count} × ₹{data.this_month.retailer_rate}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.terracotta }}>₹{data.this_month.retailer_amount}</div>
            </Card>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Incentive payouts</div>
            {data.payout_history.length === 0 ? <EmptyState icon={Wallet} text="No payouts recorded yet." /> : data.payout_history.map((p) => (
              <Card key={p.payment_id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{monthLabel(p.month)}</div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>Paid {fmtDate(p.paid_on)}{p.reference ? ` • Ref ${p.reference}` : ""}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: T.teal }}>{inr(p.incentive_amount)}</div>
              </Card>
            ))}
          </>
        )}
      </Loaded>
    </Screen>
  );
}

// ---------- More / Profile ----------
function IdCard({ onChanged }) {
  const dashQ = useLoad(() => api.employeeDashboard(), []);
  const meQ = useLoad(() => api.me(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const changePhoto = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError("Choose a JPEG, PNG or WebP image"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be 5 MB or smaller"); return; }
    setBusy(true); setError("");
    try { const r = await api.uploadProfilePhoto(file); persistUser(r.user); meQ.reload(); onChanged?.(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };
  const removePhoto = async () => {
    if (!window.confirm("Remove your profile photo?")) return;
    setBusy(true); setError("");
    try { const r = await api.deleteProfilePhoto(); persistUser(r.user); meQ.reload(); onChanged?.(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Loaded q={dashQ}>
      {(d) => {
        const e = d.employee;
        const photo = meQ.data?.user?.photo_filename ?? e.photo_filename;
        const url = photoUrl(photo);
        const territory = [e.mandal_name, e.district_name].filter(Boolean).join(", ");
        return (
          <>
            <ErrorBanner message={error} />
            <div style={{ background: `linear-gradient(135deg, ${T.tealDark}, ${T.teal})`, borderRadius: 16, padding: 16, color: "#fff", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 800, letterSpacing: 1.5, fontSize: 13 }}>GVCDA</span>
                <span style={{ fontSize: 10, opacity: 0.8, letterSpacing: 1 }}>EMPLOYEE ID CARD</span>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 76, height: 92, borderRadius: 10, background: "rgba(255,255,255,0.18)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.5)" }}>
                  {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IdCard_Placeholder name={e.full_name} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{e.full_name}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.85, textTransform: "capitalize", marginTop: 2 }}>{label(e.designation) || "Employee"}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1, marginTop: 8, background: "rgba(255,255,255,0.16)", display: "inline-block", padding: "3px 9px", borderRadius: 6 }}>{e.employee_code || "—"}</div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 8 }}>{e.phone}</div>
                  {territory && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{territory}</div>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <label style={{ flex: 1 }}>
                <div style={{ pointerEvents: "none" }}><Btn full variant="secondary" disabled={busy}><Camera size={13} /> {busy ? "Working..." : photo ? "Change photo" : "Upload photo"}</Btn></div>
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={busy} onChange={(ev) => { changePhoto(ev.target.files[0]); ev.target.value = ""; }} />
              </label>
              {photo && <Btn variant="danger" disabled={busy} onClick={removePhoto}><Trash2 size={13} /> Remove</Btn>}
            </div>
          </>
        );
      }}
    </Loaded>
  );
}

function IdCard_Placeholder({ name }) {
  return <span style={{ fontSize: 26, fontWeight: 800, opacity: 0.8 }}>{(name || "E").slice(0, 2).toUpperCase()}</span>;
}

function MenuRow({ icon: Icon, color, title, sub, onClick }) {
  return (
    <Card onClick={onClick} style={{ marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: T[`${color}Light`], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={16} color={T[color]} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, color: T.inkSoft }}>{sub}</div>
      </div>
      <ChevronRight size={16} color={T.inkSoft} />
    </Card>
  );
}

export function MoreTab({ push, onLogout, onUserChanged }) {
  return (
    <Screen>
      <IdCard onChanged={onUserChanged} />
      <EmailCard onSaved={onUserChanged} />
      <MenuRow icon={Users} color="teal" title="My Book" sub="Members you enrolled and retailers you listed" onClick={() => push("book")} />
      <MenuRow icon={MapPinned} color="terracotta" title="Daily Work Report" sub="Log your village visits and see your history" onClick={() => push("visits")} />
      <MenuRow icon={LifeBuoy} color="blue" title="Help & Support" sub="Raise a ticket with GVCDA" onClick={() => push("support")} />
      <div style={{ height: 6 }} />
      <ChangePasswordCard style={{ marginBottom: 8 }} />
      <Btn full variant="danger" onClick={onLogout}><LogOutIcon size={13} /> Log out</Btn>
    </Screen>
  );
}

export function EmployeeSupport({ onBack }) {
  return (
    <>
      <TopBar title="Help & Support" subtitle="Raise a ticket with GVCDA" onBack={onBack} />
      <Screen><SupportPanel fetchFn={api.employeeSupport} createFn={api.createEmployeeSupport} /></Screen>
    </>
  );
}
