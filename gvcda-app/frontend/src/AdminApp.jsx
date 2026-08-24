import React, { useEffect, useState } from "react";
import {
  Home, Store, Users, MapPinned, TrendingUp, AlertCircle, LogOut, IndianRupee,
  Megaphone, UserCog, ChevronRight, Plus, Banknote, ExternalLink,
} from "lucide-react";
import { api } from "./api";
import { Card, Btn, Chip, EmptyState, LoadingScreen, ErrorBanner, Field, inputStyle, T } from "./ui";

// Admin is a separate, full-width web dashboard (not the phone-frame mobile shell) —
// per the PRD, it's a heavier data-table workflow better suited to a large screen.
export default function AdminApp({ user, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const NAV = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "payments", label: "Payment Verification", icon: Banknote },
    { id: "territory", label: "Territory Drill-down", icon: MapPinned },
    { id: "approvals", label: "Retailer Approvals", icon: Store },
    { id: "team", label: "Employee Performance", icon: Users },
    { id: "revenue", label: "Revenue & Commission", icon: IndianRupee },
    { id: "complaints", label: "Complaint Desk", icon: AlertCircle },
    { id: "broadcast", label: "Broadcast Tool", icon: Megaphone },
    { id: "users", label: "User & Role Management", icon: UserCog },
  ];

  const PANES = {
    overview: <OverviewTab refreshKey={refreshKey} onNav={setTab} />,
    payments: <PaymentVerificationTab refreshKey={refreshKey} onAction={refresh} />,
    territory: <TerritoryTab refreshKey={refreshKey} />,
    approvals: <ApprovalsTab refreshKey={refreshKey} onAction={refresh} />,
    team: <TeamTab refreshKey={refreshKey} />,
    revenue: <RevenueTab refreshKey={refreshKey} />,
    complaints: <ComplaintsTab refreshKey={refreshKey} onAction={refresh} />,
    broadcast: <BroadcastTab refreshKey={refreshKey} onAction={refresh} />,
    users: <UsersTab refreshKey={refreshKey} onAction={refresh} />,
  };

  return (
    <div style={{ display: "flex", height: "100%", background: T.cream }}>
      <div style={{ width: 230, flexShrink: 0, background: T.tealDark, color: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 18px 14px" }}>
          <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 800, fontSize: 17 }}>GVCDA Admin</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{user.full_name}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
              borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, textAlign: "left",
              background: tab === id ? "rgba(255,255,255,0.14)" : "transparent",
              color: tab === id ? "#fff" : "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: tab === id ? 700 : 500,
            }}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
        <div style={{ padding: 12 }}>
          <button onClick={onLogout} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "9px 0",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        <div style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 19, color: T.tealDark, marginBottom: 16 }}>
          {NAV.find((n) => n.id === tab)?.label}
        </div>
        {PANES[tab]}
      </div>
    </div>
  );
}

function Grid({ children, cols = 4 }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>{children}</div>;
}

function Table({ columns, rows, rowKey, renderRow }) {
  if (rows === null) return <LoadingScreenInline />;
  if (rows.length === 0) return <EmptyState icon={AlertCircle} text="Nothing here yet." />;
  return (
    <div style={{ overflowX: "auto", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: T.tealLight }}>
            {columns.map((c) => (
              <th key={c} style={{ textAlign: "left", padding: "10px 14px", color: T.tealDark, fontWeight: 700, fontSize: 11.5, whiteSpace: "nowrap" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((r) => renderRow(r))}</tbody>
      </table>
    </div>
  );
}

function LoadingScreenInline() {
  return <div style={{ padding: 40, textAlign: "center", color: T.inkSoft, fontSize: 13 }}>Loading...</div>;
}

function OverviewTab({ refreshKey, onNav }) {
  const [data, setData] = useState(null);
  const [pendingPayments, setPendingPayments] = useState(null);
  useEffect(() => {
    api.adminOverview().then(setData);
    api.paymentRequests({ status: "submitted" }).then((r) => setPendingPayments(r.length));
  }, [refreshKey]);
  if (!data) return <LoadingScreenInline />;
  const cards = [
    ["Members", data.members, TrendingUp, T.teal, "territory"],
    ["Approved Retailers", data.retailers, Store, T.terracotta, "approvals"],
    ["Revenue (all-time)", `₹${data.revenue.toLocaleString("en-IN")}`, IndianRupee, T.gold, "revenue"],
    ["Payments Awaiting Verification", pendingPayments ?? "…", Banknote, T.terracotta, "payments"],
    ["Open Complaints", data.open_complaints, AlertCircle, T.red, "complaints"],
  ];
  return (
    <Grid>
      {cards.map(([label, val, Icon, color, nav]) => (
        <Card key={label} onClick={() => onNav(nav)} style={{ cursor: "pointer" }}>
          <Icon size={17} color={color} />
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{val}</div>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600, marginTop: 2 }}>{label}</div>
        </Card>
      ))}
    </Grid>
  );
}

// Every membership purchase and retailer commission settlement lands here — a
// direct bank/UPI transfer (no payment gateway account exists yet, see
// backend/lib/paymentRequests.js) that Admin verifies by hand against the actual
// bank statement before anything is marked paid.
function PaymentVerificationTab({ refreshKey, onAction }) {
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [rows, setRows] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  useEffect(() => { api.paymentRequests({ status: statusFilter }).then(setRows); }, [refreshKey, statusFilter]);

  const approve = async (id) => { await api.resolvePaymentRequest(id, true); onAction(); };
  const reject = async (id) => { await api.resolvePaymentRequest(id, false, reason); setRejecting(null); setReason(""); onAction(); };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["submitted", "pending", "verified", "rejected"].map((s) => (
          <Btn key={s} variant={statusFilter === s ? "primary" : "ghost"} onClick={() => setStatusFilter(s)}>{s}</Btn>
        ))}
      </div>

      {rows === null ? <LoadingScreenInline /> : rows.length === 0 ? (
        <EmptyState icon={Banknote} text={`No ${statusFilter} payment requests.`} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <Card key={r.request_id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    ₹{r.amount} — {r.type === "membership" ? `${r.plan_name} Membership` : "Commission Settlement"}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
                    {r.user_name} ({r.user_phone}){r.retailer_name ? ` — ${r.retailer_name}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: T.teal, fontWeight: 700, marginTop: 4 }}>Ref: {r.reference_code}</div>
                  {r.utr && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>UTR: {r.utr}</div>}
                  {r.rejection_reason && <div style={{ fontSize: 11, color: T.red, marginTop: 2 }}>Rejected: {r.rejection_reason}</div>}
                </div>
                <Chip tone={r.status === "verified" ? "teal" : r.status === "rejected" ? "red" : r.status === "submitted" ? "gold" : "terracotta"}>{r.status}</Chip>
              </div>

              {r.status === "submitted" && (
                rejecting === r.request_id ? (
                  <div style={{ marginTop: 10 }}>
                    <input style={inputStyle} placeholder="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Btn full variant="danger" onClick={() => reject(r.request_id)}>Confirm Reject</Btn>
                      <Btn full variant="ghost" onClick={() => setRejecting(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 320 }}>
                    <Btn full onClick={() => approve(r.request_id)}>Verify & Approve</Btn>
                    <Btn full variant="danger" onClick={() => setRejecting(r.request_id)}>Reject</Btn>
                  </div>
                )
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalsTab({ refreshKey, onAction }) {
  const [queue, setQueue] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  useEffect(() => { api.pendingRetailers().then(setQueue); }, [refreshKey]);

  const approve = async (id) => { await api.reviewRetailer(id, "approved"); onAction(); };
  const reject = async (id) => { await api.reviewRetailer(id, "rejected", reason); setRejecting(null); setReason(""); onAction(); };

  if (queue === null) return <LoadingScreenInline />;
  if (queue.length === 0) return <EmptyState icon={Store} text="Approval queue is clear." />;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {queue.map((r) => (
        <Card key={r.retailer_id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.business_name}</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{r.category_name} • {r.village_name} • {r.phone}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>
                Submitted by: {r.submitted_by_name ? `${r.submitted_by_name} (field employee)` : "self-registration"}
              </div>
            </div>
            <Chip tone="gold">Pending</Chip>
          </div>
          {rejecting === r.retailer_id ? (
            <div style={{ marginTop: 10 }}>
              <input style={inputStyle} placeholder="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn full variant="danger" onClick={() => reject(r.retailer_id)}>Confirm Reject</Btn>
                <Btn full variant="ghost" onClick={() => setRejecting(null)}>Cancel</Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 320 }}>
              <Btn full onClick={() => approve(r.retailer_id)}>Approve</Btn>
              <Btn full variant="danger" onClick={() => setRejecting(r.retailer_id)}>Reject</Btn>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function TeamTab({ refreshKey }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.employeePerformance().then(setRows); }, [refreshKey]);
  return (
    <Table
      columns={["Name", "Designation", "Memberships Sold", "Retailers Onboarded"]}
      rows={rows}
      renderRow={(r) => (
        <tr key={r.user_id} style={{ borderTop: `1px solid ${T.line}` }}>
          <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.full_name}</td>
          <td style={{ padding: "10px 14px", color: T.inkSoft, textTransform: "capitalize" }}>{(r.designation || "—").replaceAll("_", " ")}</td>
          <td style={{ padding: "10px 14px", color: T.teal, fontWeight: 700 }}>{r.memberships_sold}</td>
          <td style={{ padding: "10px 14px", color: T.terracotta, fontWeight: 700 }}>{r.retailers_onboarded}</td>
        </tr>
      )}
    />
  );
}

function TerritoryTab({ refreshKey }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.territory().then(setRows); }, [refreshKey]);
  return (
    <Table
      columns={["District", "Mandal", "Members", "Retailers", "Revenue"]}
      rows={rows}
      renderRow={(r) => (
        <tr key={r.district + r.mandal} style={{ borderTop: `1px solid ${T.line}` }}>
          <td style={{ padding: "10px 14px" }}>{r.district}</td>
          <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.mandal}</td>
          <td style={{ padding: "10px 14px" }}>{r.members}</td>
          <td style={{ padding: "10px 14px" }}>{r.retailers}</td>
          <td style={{ padding: "10px 14px", color: T.gold, fontWeight: 700 }}>₹{r.revenue.toLocaleString("en-IN")}</td>
        </tr>
      )}
    />
  );
}

function RevenueTab({ refreshKey }) {
  const [data, setData] = useState(null);
  const [subTab, setSubTab] = useState("membership");
  useEffect(() => { api.adminRevenue().then(setData); }, [refreshKey]);
  if (!data) return <LoadingScreenInline />;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn variant={subTab === "membership" ? "primary" : "ghost"} onClick={() => setSubTab("membership")}>Membership Revenue</Btn>
        <Btn variant={subTab === "commission" ? "primary" : "ghost"} onClick={() => setSubTab("commission")}>Retailer Commission</Btn>
      </div>
      {subTab === "membership" ? (
        <Table
          columns={["Plan", "Count", "Total Revenue"]}
          rows={data.membership}
          renderRow={(r) => (
            <tr key={r.plan_name} style={{ borderTop: `1px solid ${T.line}` }}>
              <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.plan_name}</td>
              <td style={{ padding: "10px 14px" }}>{r.count}</td>
              <td style={{ padding: "10px 14px", color: T.gold, fontWeight: 700 }}>₹{r.total.toLocaleString("en-IN")}</td>
            </tr>
          )}
        />
      ) : (
        <Table
          columns={["Sector", "Fulfilled Orders", "Gross Sales", "Commission Earned"]}
          rows={data.commission}
          renderRow={(r) => (
            <tr key={r.category_name} style={{ borderTop: `1px solid ${T.line}` }}>
              <td style={{ padding: "10px 14px", fontWeight: 700 }}>{r.category_name}</td>
              <td style={{ padding: "10px 14px" }}>{r.order_count}</td>
              <td style={{ padding: "10px 14px" }}>₹{r.gross.toLocaleString("en-IN")}</td>
              <td style={{ padding: "10px 14px", color: T.gold, fontWeight: 700 }}>₹{r.commission.toLocaleString("en-IN")}</td>
            </tr>
          )}
        />
      )}
    </div>
  );
}

function ComplaintsTab({ refreshKey, onAction }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [notes, setNotes] = useState("");
  useEffect(() => { api.complaints().then(setRows); }, [refreshKey]);

  const resolve = async (id, status) => { await api.updateComplaint(id, status, notes); setOpen(null); setNotes(""); onAction(); };
  const toneFor = (s) => ({ open: "red", in_review: "gold", resolved: "teal", closed: "teal" }[s] || "teal");

  if (rows === null) return <LoadingScreenInline />;
  if (rows.length === 0) return <EmptyState icon={AlertCircle} text="No complaints raised." />;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((c) => (
        <Card key={c.complaint_id}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.category || "General"} — {c.raised_by_name}</div>
              {c.against_retailer_name && <div style={{ fontSize: 11, color: T.inkSoft }}>Against: {c.against_retailer_name}</div>}
              <div style={{ fontSize: 12, color: T.ink, marginTop: 4 }}>{c.description}</div>
              {c.resolution_notes && <div style={{ fontSize: 11, color: T.teal, marginTop: 4 }}>Resolution: {c.resolution_notes}</div>}
            </div>
            <Chip tone={toneFor(c.status)}>{c.status.replace("_", " ")}</Chip>
          </div>
          {c.status !== "resolved" && c.status !== "closed" && (
            open === c.complaint_id ? (
              <div style={{ marginTop: 10 }}>
                <input style={inputStyle} placeholder="Resolution notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, maxWidth: 400 }}>
                  <Btn full onClick={() => resolve(c.complaint_id, "resolved")}>Mark Resolved</Btn>
                  <Btn full variant="secondary" onClick={() => resolve(c.complaint_id, "in_review")}>In Review</Btn>
                  <Btn full variant="ghost" onClick={() => setOpen(null)}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <Btn onClick={() => setOpen(c.complaint_id)}>Assign / Resolve</Btn>
              </div>
            )
          )}
        </Card>
      ))}
    </div>
  );
}

function BroadcastTab({ refreshKey, onAction }) {
  const [history, setHistory] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("all");
  const [districtId, setDistrictId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { api.broadcasts().then(setHistory); api.districts().then(setDistricts); }, [refreshKey]);

  const send = async () => {
    if (!message.trim()) return;
    setError(""); setSending(true);
    try {
      await api.sendBroadcast({ message, target_scope: scope, target_district_id: scope === "district" ? districtId : undefined });
      setMessage(""); onAction();
    } catch (e) { setError(e.message); }
    setSending(false);
  };

  return (
    <div>
      <Card style={{ maxWidth: 480, marginBottom: 20 }}>
        <ErrorBanner message={error} />
        <Field label="Message">
          <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announce an offer, health camp, or job drive..." />
        </Field>
        <Field label="Target">
          <select style={inputStyle} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All Telangana</option>
            <option value="district">Specific district</option>
          </select>
        </Field>
        {scope === "district" && (
          <Field label="District">
            <select style={inputStyle} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
              <option value="">Select district</option>
              {districts.map((d) => <option key={d.district_id} value={d.district_id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <Btn full onClick={send} disabled={sending || !message.trim()}>{sending ? "Sending..." : "Send Now"}</Btn>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Send History</div>
      <Table
        columns={["Message", "Target", "Recipients", "Sent"]}
        rows={history}
        renderRow={(b) => (
          <tr key={b.broadcast_id} style={{ borderTop: `1px solid ${T.line}` }}>
            <td style={{ padding: "10px 14px", maxWidth: 320 }}>{b.message}</td>
            <td style={{ padding: "10px 14px" }}>{b.target_scope === "all" ? "All Telangana" : b.district_name || b.mandal_name}</td>
            <td style={{ padding: "10px 14px" }}>{b.recipient_count}</td>
            <td style={{ padding: "10px 14px", color: T.inkSoft, fontSize: 11 }}>{new Date(b.created_at).toLocaleString()}</td>
          </tr>
        )}
      />
    </div>
  );
}

function UsersTab({ refreshKey, onAction }) {
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => { api.adminUsers().then(setRows); }, [refreshKey]);

  const toggle = async (id, active) => { await api.toggleUser(id, !active); onAction(); };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Btn onClick={() => setAdding((a) => !a)}><Plus size={14} /> Add Employee</Btn>
      </div>
      {adding && <AddEmployeeForm onDone={() => { setAdding(false); onAction(); }} />}
      <Table
        columns={["Name", "Phone", "Role", "Designation", "Territory", "Status", "Action"]}
        rows={rows}
        renderRow={(u) => (
          <tr key={u.user_id} style={{ borderTop: `1px solid ${T.line}` }}>
            <td style={{ padding: "10px 14px", fontWeight: 700 }}>{u.full_name}</td>
            <td style={{ padding: "10px 14px" }}>{u.phone}</td>
            <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>{u.role}</td>
            <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>{(u.designation || "—").replaceAll("_", " ")}</td>
            <td style={{ padding: "10px 14px" }}>{[u.district_name, u.mandal_name].filter(Boolean).join(" → ") || "—"}</td>
            <td style={{ padding: "10px 14px" }}><Chip tone={u.is_active ? "teal" : "red"}>{u.is_active ? "Active" : "Deactivated"}</Chip></td>
            <td style={{ padding: "10px 14px" }}>
              <Btn variant={u.is_active ? "danger" : "secondary"} onClick={() => toggle(u.user_id, u.is_active)}>
                {u.is_active ? "Deactivate" : "Reactivate"}
              </Btn>
            </td>
          </tr>
        )}
      />
    </div>
  );
}

function AddEmployeeForm({ onDone }) {
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("volunteer");
  const [districts, setDistricts] = useState([]);
  const [mandals, setMandals] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [mandalId, setMandalId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.districts().then(setDistricts); }, []);
  useEffect(() => { setMandalId(""); setMandals([]); if (districtId) api.mandals(districtId).then(setMandals); }, [districtId]);

  const submit = async () => {
    if (!phone || !fullName) { setError("Phone and name are required"); return; }
    setError(""); setSaving(true);
    try {
      await api.addEmployee({ phone, full_name: fullName, designation, territory_district_id: districtId || null, territory_mandal_id: mandalId || null });
      onDone();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <Card style={{ maxWidth: 480, marginBottom: 18 }}>
      <ErrorBanner message={error} />
      <Grid cols={2}>
        <Field label="Phone"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" /></Field>
        <Field label="Full name"><input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
        <Field label="Designation">
          <select style={inputStyle} value={designation} onChange={(e) => setDesignation(e.target.value)}>
            <option value="district_manager">District Manager</option>
            <option value="mandal_sub_manager">Mandal Sub Manager</option>
            <option value="zonal_manager">Zonal Manager</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </Field>
        <Field label="District">
          <select style={inputStyle} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">Select</option>
            {districts.map((d) => <option key={d.district_id} value={d.district_id}>{d.name}</option>)}
          </select>
        </Field>
        {designation === "mandal_sub_manager" && (
          <Field label="Mandal">
            <select style={inputStyle} value={mandalId} onChange={(e) => setMandalId(e.target.value)} disabled={!districtId}>
              <option value="">Select</option>
              {mandals.map((m) => <option key={m.mandal_id} value={m.mandal_id}>{m.name}</option>)}
            </select>
          </Field>
        )}
      </Grid>
      <div style={{ marginTop: 10 }}>
        <Btn onClick={submit} disabled={saving}>{saving ? "Saving..." : "Create Employee Account"}</Btn>
      </div>
    </Card>
  );
}
