import React, { useEffect, useState } from "react";
import { CalendarCheck, Trash2 } from "lucide-react";
import { api } from "./api";
import { Card, Btn, Chip, EmptyState, ErrorBanner, Field, inputStyle, Grid, Table, LoadingScreenInline, T } from "./ui";
import { inr, fmtDate, fmtTime, fmtDateTime, isoDay, isoMonth, monthLabel, dayStr, useLoad, Loaded, Pills } from "./shared";

const td = { padding: "10px 14px" };
const label = (s) => String(s || "").replaceAll("_", " ");

// Admin "Team Operations": attendance board, leave approvals, task assignment, salary.
export function TeamOpsTab({ refreshKey, onAction }) {
  const [sub, setSub] = useState("attendance");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["attendance", "Attendance"], ["leave", "Leave"], ["tasks", "Tasks"], ["salary", "Salary"]].map(([id, l]) => (
          <Btn key={id} variant={sub === id ? "primary" : "ghost"} onClick={() => setSub(id)}>{l}</Btn>
        ))}
      </div>
      {sub === "attendance" && <AttendanceBoard refreshKey={refreshKey} />}
      {sub === "leave" && <LeaveBoard refreshKey={refreshKey} onAction={onAction} />}
      {sub === "tasks" && <TasksBoard refreshKey={refreshKey} />}
      {sub === "salary" && <SalaryBoard refreshKey={refreshKey} />}
    </div>
  );
}

const ATT_TONE = { checked_in: "teal", checked_out: "green", on_leave: "gold", absent: "red" };

function AttendanceBoard({ refreshKey }) {
  const [date, setDate] = useState(isoDay());
  const q = useLoad(() => api.adminAttendance(date), [date, refreshKey]);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <input type="date" style={{ ...inputStyle, width: "auto" }} max={isoDay()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Btn variant="ghost" onClick={() => setDate(isoDay())}>Today</Btn>
      </div>
      <Loaded q={q}>
        {(rows) => {
          const count = (k) => rows.filter((r) => r.status === k).length;
          return (
            <>
              <div style={{ maxWidth: 640, marginBottom: 14 }}>
                <Grid cols={4}>
                  {[["Present", count("checked_in") + count("checked_out"), T.green], ["Still checked in", count("checked_in"), T.teal], ["On leave", count("on_leave"), T.gold], ["Absent", count("absent"), T.red]].map(([l, v, c]) => (
                    <Card key={l}><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{l}</div></Card>
                  ))}
                </Grid>
              </div>
              <Table
                columns={["Employee", "Designation", "Check-in", "Check-out", "Status"]}
                rows={rows}
                emptyText="No active employees."
                renderRow={(r) => (
                  <tr key={r.user_id} style={{ borderTop: `1px solid ${T.line}` }}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.full_name}</td>
                    <td style={{ ...td, color: T.inkSoft, textTransform: "capitalize" }}>{label(r.designation) || "—"}</td>
                    <td style={td}>{r.check_in_at ? fmtTime(r.check_in_at) : "—"}</td>
                    <td style={td}>{r.check_out_at ? fmtTime(r.check_out_at) : "—"}</td>
                    <td style={td}><Chip tone={ATT_TONE[r.status] || "gray"}>{label(r.status)}</Chip></td>
                  </tr>
                )}
              />
            </>
          );
        }}
      </Loaded>
    </div>
  );
}

const LEAVE_TONE = { pending: "gold", approved: "green", rejected: "red" };

function LeaveBoard({ refreshKey, onAction }) {
  const [status, setStatus] = useState("pending");
  const q = useLoad(() => api.adminLeaves(status === "all" ? undefined : status), [status, refreshKey]);
  const [deciding, setDeciding] = useState(null); // { id, status }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const decide = async () => {
    setBusy(true); setError("");
    try {
      await api.decideLeave(deciding.id, deciding.status, note.trim() || undefined);
      setDeciding(null); setNote(""); q.reload(); onAction?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div>
      <Pills style={{ marginBottom: 14 }} value={status} onChange={setStatus} options={[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]]} />
      <ErrorBanner message={error} />
      <Loaded q={q}>
        {(rows) => rows.length === 0 ? <EmptyState icon={CalendarCheck} text={`No ${status === "all" ? "" : status + " "}leave requests.`} /> : (
          <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
            {rows.map((l) => (
              <Card key={l.leave_id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{l.employee_name}</div>
                    <div style={{ fontSize: 12, marginTop: 3 }}>{fmtDate(l.from_date)}{dayStr(l.from_date) !== dayStr(l.to_date) ? ` → ${fmtDate(l.to_date)}` : ""} • <span style={{ textTransform: "capitalize" }}>{label(l.leave_type)}</span></div>
                    {l.reason && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>{l.reason}</div>}
                    {l.decision_note && <div style={{ fontSize: 11.5, color: T.teal, marginTop: 3 }}>Note: {l.decision_note}</div>}
                    <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 3 }}>Requested {fmtDateTime(l.created_at)}</div>
                  </div>
                  <Chip tone={LEAVE_TONE[l.status] || "gray"}>{l.status}</Chip>
                </div>
                {l.status === "pending" && (deciding?.id === l.leave_id ? (
                  <div style={{ marginTop: 10 }}>
                    <input style={inputStyle} placeholder="Note to employee (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, maxWidth: 360 }}>
                      <Btn full variant={deciding.status === "approved" ? "primary" : "danger"} disabled={busy} onClick={decide}>{busy ? "Saving..." : deciding.status === "approved" ? "Confirm approve" : "Confirm reject"}</Btn>
                      <Btn full variant="ghost" onClick={() => setDeciding(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 320 }}>
                    <Btn full onClick={() => { setDeciding({ id: l.leave_id, status: "approved" }); setNote(""); }}>Approve</Btn>
                    <Btn full variant="danger" onClick={() => { setDeciding({ id: l.leave_id, status: "rejected" }); setNote(""); }}>Reject</Btn>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
      </Loaded>
    </div>
  );
}

const PRIORITY_TONE = { high: "red", normal: "blue", low: "gray" };
const TASK_TONE = { pending: "gold", in_progress: "blue", done: "green" };

function TasksBoard({ refreshKey }) {
  const emps = useLoad(() => api.employeePerformance(), []);
  const [filterEmp, setFilterEmp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const q = useLoad(() => api.adminTasks({ ...(filterEmp ? { employee_id: filterEmp } : {}), ...(filterStatus ? { status: filterStatus } : {}) }), [filterEmp, filterStatus, refreshKey]);
  const [form, setForm] = useState({ assigned_to: "", title: "", description: "", due_date: "", priority: "normal" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const create = async () => {
    setError(""); setOk(false);
    if (!form.assigned_to) { setError("Choose an employee"); return; }
    if (!form.title.trim()) { setError("Task title is required"); return; }
    setBusy(true);
    try {
      await api.createAdminTask({ assigned_to: Number(form.assigned_to), title: form.title.trim(), description: form.description.trim() || undefined, due_date: form.due_date || undefined, priority: form.priority });
      setForm((f) => ({ ...f, title: "", description: "", due_date: "" }));
      setOk(true); q.reload();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    setError("");
    try { await api.deleteAdminTask(id); q.reload(); } catch (e) { setError(e.message); }
  };
  const employees = emps.data || [];

  return (
    <div>
      <Card style={{ maxWidth: 560, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Assign a task</div>
        <ErrorBanner message={error} />
        {ok && <div style={{ background: T.greenLight, color: T.green, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>Task assigned.</div>}
        <Grid cols={2}>
          <Field label="Employee">
            <select style={inputStyle} value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">Select employee</option>
              {employees.map((e) => <option key={e.user_id} value={e.user_id}>{e.full_name}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select style={inputStyle} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
            </select>
          </Field>
          <Field label="Title"><input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Visit 5 shops in Kodad" /></Field>
          <Field label="Due date (optional)"><input style={inputStyle} type="date" min={isoDay()} value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} /></Field>
        </Grid>
        <Field label="Description (optional)"><textarea style={{ ...inputStyle, minHeight: 50 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
        <Btn onClick={create} disabled={busy}>{busy ? "Assigning..." : "Assign task"}</Btn>
      </Card>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <select style={{ ...inputStyle, width: "auto" }} value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
          <option value="">All employees</option>
          {employees.map((e) => <option key={e.user_id} value={e.user_id}>{e.full_name}</option>)}
        </select>
        <select style={{ ...inputStyle, width: "auto" }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="done">Done</option>
        </select>
      </div>
      <Loaded q={q}>
        {(rows) => (
          <Table
            columns={["Employee", "Task", "Priority", "Due", "Status", ""]}
            rows={rows}
            emptyText="No tasks match."
            renderRow={(t) => {
              const overdue = t.status !== "done" && t.due_date && dayStr(t.due_date) < isoDay();
              return (
                <tr key={t.task_id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ ...td, fontWeight: 700 }}>{t.employee_name}</td>
                  <td style={{ ...td, maxWidth: 320 }}>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    {t.description && <div style={{ fontSize: 11.5, color: T.inkSoft }}>{t.description}</div>}
                  </td>
                  <td style={td}><Chip tone={PRIORITY_TONE[t.priority] || "gray"}>{t.priority}</Chip></td>
                  <td style={{ ...td, color: overdue ? T.red : T.ink, fontWeight: overdue ? 700 : 400 }}>{t.due_date ? fmtDate(t.due_date) : "—"}{overdue ? " (overdue)" : ""}</td>
                  <td style={td}><Chip tone={TASK_TONE[t.status] || "gray"}>{label(t.status)}</Chip></td>
                  <td style={td}><Btn variant="danger" style={{ padding: "6px 10px" }} onClick={() => remove(t.task_id)}><Trash2 size={13} /></Btn></td>
                </tr>
              );
            }}
          />
        )}
      </Loaded>
    </div>
  );
}

function SalaryBoard({ refreshKey }) {
  const emps = useLoad(() => api.employeePerformance(), [refreshKey]);
  const [payFor, setPayFor] = useState(null);
  const [histMonth, setHistMonth] = useState(isoMonth());
  const [histKey, setHistKey] = useState(0);
  const hist = useLoad(() => api.salaryPayments(histMonth), [histMonth, histKey]);

  return (
    <div>
      <Loaded q={emps}>
        {(rows) => (
          <Table
            columns={["Employee", "Designation", "Monthly target", "Monthly salary (₹)", ""]}
            rows={rows}
            emptyText="No employees yet."
            renderRow={(e) => <EmployeeSalaryRow key={e.user_id} e={e} onSaved={emps.reload} onPay={() => setPayFor(e)} />}
          />
        )}
      </Loaded>

      {payFor && <RecordPayment employee={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); setHistKey((k) => k + 1); }} />}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 10px" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Payment history</div>
        <input type="month" style={{ ...inputStyle, width: "auto" }} value={histMonth} onChange={(e) => e.target.value && setHistMonth(e.target.value)} />
      </div>
      <Loaded q={hist}>
        {(rows) => (
          <Table
            columns={["Employee", "Month", "Base", "Incentive", "Deductions", "Total paid", "Paid on", "Reference"]}
            rows={rows}
            emptyText={`No salary payments recorded for ${monthLabel(histMonth)}.`}
            renderRow={(p) => (
              <tr key={p.payment_id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ ...td, fontWeight: 700 }}>{p.employee_name}</td>
                <td style={td}>{monthLabel(p.month)}</td>
                <td style={td}>{inr(p.base_amount)}</td>
                <td style={td}>{inr(p.incentive_amount)}</td>
                <td style={td}>{Number(p.deductions) > 0 ? inr(p.deductions) : "—"}</td>
                <td style={{ ...td, fontWeight: 800, color: T.green }}>{inr(p.total)}</td>
                <td style={td}>{fmtDate(p.paid_on)}</td>
                <td style={{ ...td, color: T.inkSoft }}>{p.reference || "—"}</td>
              </tr>
            )}
          />
        )}
      </Loaded>
    </div>
  );
}

function EmployeeSalaryRow({ e, onSaved, onPay }) {
  const [target, setTarget] = useState(String(e.monthly_target ?? ""));
  const [salary, setSalary] = useState(String(e.monthly_salary ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = target !== String(e.monthly_target ?? "") || salary !== String(e.monthly_salary ?? "");

  const save = async () => {
    setError("");
    if (target === "" || !(Number(target) >= 0) || salary === "" || !(Number(salary) >= 0)) { setError("Enter valid numbers"); return; }
    setBusy(true);
    try { await api.updateEmployee(e.user_id, { monthly_target: Number(target), monthly_salary: Number(salary) }); onSaved(); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <tr style={{ borderTop: `1px solid ${T.line}`, verticalAlign: "top" }}>
      <td style={td}><div style={{ fontWeight: 700 }}>{e.full_name}</div><div style={{ fontSize: 11, color: T.inkSoft }}>{e.employee_code || e.phone}</div></td>
      <td style={{ ...td, color: T.inkSoft, textTransform: "capitalize" }}>{label(e.designation) || "—"}</td>
      <td style={td}><input style={{ ...inputStyle, width: 90 }} inputMode="numeric" value={target} onChange={(ev) => setTarget(ev.target.value.replace(/\D/g, ""))} /></td>
      <td style={td}>
        <input style={{ ...inputStyle, width: 120 }} inputMode="numeric" value={salary} onChange={(ev) => setSalary(ev.target.value.replace(/\D/g, ""))} />
        {error && <div style={{ color: T.red, fontSize: 11, marginTop: 3 }}>{error}</div>}
      </td>
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="secondary" disabled={!dirty || busy} onClick={save}>{busy ? "Saving..." : "Save"}</Btn>
          <Btn onClick={onPay}>Record payment</Btn>
        </div>
      </td>
    </tr>
  );
}

function RecordPayment({ employee, onClose, onDone }) {
  const [month, setMonth] = useState(isoMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));
  const [preview, setPreview] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [form, setForm] = useState({ base_amount: "", incentive_amount: "", deductions: "0", reference: "", notes: "", paid_on: isoDay() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setPreview(null); setLoadErr("");
    api.salaryPreview(employee.user_id, month).then((p) => {
      if (!alive) return;
      setPreview(p);
      setForm((f) => ({ ...f, base_amount: String(p.base_amount ?? 0), incentive_amount: String(p.incentive_amount ?? 0) }));
    }).catch((e) => alive && setLoadErr(e.message));
    return () => { alive = false; };
  }, [employee.user_id, month]);

  const total = Math.max(0, (Number(form.base_amount) || 0) + (Number(form.incentive_amount) || 0) - (Number(form.deductions) || 0));
  const inc = preview?.incentive;

  const confirm = async () => {
    setError("");
    for (const k of ["base_amount", "incentive_amount", "deductions"]) {
      if (form[k] === "" || !(Number(form[k]) >= 0)) { setError("Amounts must be numbers, 0 or more"); return; }
    }
    if (!window.confirm(`Record ${inr(total)} as paid to ${employee.full_name} for ${monthLabel(month)}?`)) return;
    setBusy(true);
    try {
      await api.recordSalaryPayment({
        employee_id: employee.user_id, month,
        base_amount: Number(form.base_amount), incentive_amount: Number(form.incentive_amount), deductions: Number(form.deductions),
        reference: form.reference.trim() || undefined, notes: form.notes.trim() || undefined, paid_on: form.paid_on || undefined,
      });
      onDone();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Card style={{ maxWidth: 620, marginTop: 18, borderColor: T.teal }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Record salary payment — {employee.full_name}</div>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
      <Field label="Month"><input type="month" style={{ ...inputStyle, width: "auto" }} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
      <ErrorBanner message={loadErr} />
      {!preview && !loadErr && <LoadingScreenInline />}
      {preview && (
        <>
          {preview.already_paid && (
            <div style={{ background: T.goldLight, color: "#6b530d", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
              {monthLabel(month)} has already been recorded for this employee — a second payment will be rejected.
            </div>
          )}
          {inc && (
            <div style={{ background: T.tealLight, borderRadius: 10, padding: "10px 12px", fontSize: 12, marginBottom: 14, lineHeight: 1.7 }}>
              <b>Incentive earned in {monthLabel(month)}</b><br />
              Memberships: {inc.membership_count} × {inr(inc.membership_rate)} = {inr(inc.membership_amount)}<br />
              Retailers: {inc.retailer_count} × {inr(inc.retailer_rate)} = {inr(inc.retailer_amount)}<br />
              Total incentive: <b>{inr(inc.total)}</b>
            </div>
          )}
          <ErrorBanner message={error} />
          <Grid cols={3}>
            <Field label="Base salary (₹)"><input style={inputStyle} inputMode="numeric" value={form.base_amount} onChange={(e) => setForm((f) => ({ ...f, base_amount: e.target.value.replace(/[^\d.]/g, "") }))} /></Field>
            <Field label="Incentive (₹)"><input style={inputStyle} inputMode="numeric" value={form.incentive_amount} onChange={(e) => setForm((f) => ({ ...f, incentive_amount: e.target.value.replace(/[^\d.]/g, "") }))} /></Field>
            <Field label="Deductions (₹)"><input style={inputStyle} inputMode="numeric" value={form.deductions} onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value.replace(/[^\d.]/g, "") }))} /></Field>
            <Field label="Paid on"><input style={inputStyle} type="date" value={form.paid_on} onChange={(e) => setForm((f) => ({ ...f, paid_on: e.target.value }))} /></Field>
            <Field label="Reference / UTR"><input style={inputStyle} value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Bank transfer ref" /></Field>
            <Field label="Notes"><input style={inputStyle} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
          </Grid>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.teal }}>Total: {inr(total)}</div>
            <Btn onClick={confirm} disabled={busy}>{busy ? "Recording..." : "Confirm & record payment"}</Btn>
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>This records a payment made outside the app (bank transfer or cash). The employee is notified.</div>
        </>
      )}
    </Card>
  );
}

// Orders customers chose "GVCDA Delivery" for — Admin dispatches a delivery partner to the shop.
export function DeliveriesTab({ refreshKey }) {
  const q = useLoad(() => api.gvcdaDeliveries(), [refreshKey]);
  return (
    <div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>Open orders where the customer chose GVCDA Delivery — pick up from the shop, deliver to the customer.</div>
      <Loaded q={q}>
        {(rows) => (
          <Table
            columns={["Order", "Placed", "Status", "Pick up from", "Deliver to", "Payment", "Total"]}
            rows={rows}
            emptyText="No open GVCDA deliveries."
            renderRow={(o) => (
              <tr key={o.order_id} style={{ borderTop: `1px solid ${T.line}`, verticalAlign: "top" }}>
                <td style={{ ...td, fontWeight: 700 }}>#{o.order_id}</td>
                <td style={{ ...td, whiteSpace: "nowrap", color: T.inkSoft }}>{fmtDateTime(o.placed_at)}</td>
                <td style={td}><Chip tone={o.status === "accepted" ? "blue" : "gold"}>{o.status}</Chip></td>
                <td style={{ ...td, maxWidth: 240 }}>
                  <div style={{ fontWeight: 700 }}>{o.business_name}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft }}>{o.pickup_address || "No address on file"}</div>
                  {o.retailer_phone && <div style={{ fontSize: 11.5 }}><a href={`tel:${o.retailer_phone}`} style={{ color: T.teal, textDecoration: "none", fontWeight: 700 }}>{o.retailer_phone}</a></div>}
                </td>
                <td style={{ ...td, maxWidth: 240 }}>
                  <div style={{ fontWeight: 700 }}>{o.member_name}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft }}>{o.delivery_address}</div>
                  {o.delivery_phone && <div style={{ fontSize: 11.5 }}><a href={`tel:${o.delivery_phone}`} style={{ color: T.teal, textDecoration: "none", fontWeight: 700 }}>{o.delivery_phone}</a></div>}
                </td>
                <td style={td}><Chip tone={o.payment_method === "upi" ? "green" : "gray"}>{o.payment_method === "upi" ? "UPI" : "Cash on delivery"}</Chip></td>
                <td style={{ ...td, fontWeight: 800, color: T.teal }}>{inr(o.order_total)}</td>
              </tr>
            )}
          />
        )}
      </Loaded>
    </div>
  );
}
