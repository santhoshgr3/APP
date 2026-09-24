import React, { useState } from "react";
import { Users, Search, Phone, Star, BarChart3, Package, AlertTriangle, ClipboardList } from "lucide-react";
import { api } from "./api";
import { TopBar, Card, Btn, Chip, Field, inputStyle, Screen, EmptyState, ErrorBanner, T } from "./ui";
import { inr, fmtDate, fmtDateTime, fmtSlot, isoDay, useLoad, Loaded, Pills, DeliveryBadge, PaymentChip, DELIVERY_LABEL, orderTone, SupportPanel } from "./shared";

// ---------- Stock ----------
export function StockChip({ p }) {
  if (p.item_type === "service") return <Chip tone="purple">Service</Chip>;
  if (p.stock === null || p.stock === undefined) return <Chip tone="gray">Stock not tracked</Chip>;
  if (p.stock <= 0) return <Chip tone="red">Out of stock</Chip>;
  if (p.stock <= 5) return <Chip tone="gold">Low {p.stock}</Chip>;
  return <Chip tone="green">In stock {p.stock}</Chip>;
}

// Inline stock editor: whole number >= 0 to track, empty to stop tracking.
export function StockEditor({ product, onSaved }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (product.item_type === "service") return null;

  const save = async (stock) => {
    if (stock !== null && !(Number.isInteger(stock) && stock >= 0)) { setError("Enter a whole number, 0 or more"); return; }
    setBusy(true); setError("");
    try {
      await api.updateProduct(product.product_id, { stock });
      setOpen(false);
      onSaved();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (!open) {
    return (
      <button onClick={() => { setVal(product.stock ?? ""); setOpen(true); setError(""); }} style={{ marginTop: 6, background: "none", border: "none", color: T.teal, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
        Edit stock
      </button>
    );
  }
  return (
    <div style={{ marginTop: 6 }}>
      <input style={{ ...inputStyle, padding: "6px 8px" }} inputMode="numeric" value={val} placeholder="Blank = don't track" onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))} />
      {error && <div style={{ color: T.red, fontSize: 10.5, marginTop: 3 }}>{error}</div>}
      <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
        <Btn style={{ padding: "5px 10px", fontSize: 11 }} disabled={busy} onClick={() => save(val === "" ? null : Number(val))}>Save</Btn>
        <Btn variant="ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => setOpen(false)}>Cancel</Btn>
      </div>
    </div>
  );
}

// ---------- Customers ----------
export function CustomersTab({ push }) {
  const [term, setTerm] = useState("");
  const q = useLoad(() => api.retailerCustomers(), []);
  return (
    <Screen>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} color={T.inkSoft} style={{ position: "absolute", left: 10, top: 10 }} />
        <input style={{ ...inputStyle, paddingLeft: 30 }} placeholder="Search by name or phone..." value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      <Loaded q={q}>
        {(rows) => {
          const t = term.trim().toLowerCase();
          const list = t ? rows.filter((c) => c.full_name?.toLowerCase().includes(t) || c.phone?.includes(t)) : rows;
          if (rows.length === 0) return <EmptyState icon={Users} text="No customers yet — they appear here after their first order." />;
          if (list.length === 0) return <EmptyState icon={Search} text={`No customers match "${term}".`} />;
          return list.map((c) => (
            <Card key={c.member_id} onClick={() => push("customer", { id: c.member_id })} style={{ marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.full_name}</div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>{c.phone}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.teal }}>{inr(c.total_spent)}</div>
                  {c.avg_rating != null && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
                      <Star size={11} fill={T.gold} color={T.gold} />{Number(c.avg_rating).toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 6 }}>
                {c.order_count} order{Number(c.order_count) === 1 ? "" : "s"} ({c.fulfilled_count} fulfilled) • last {fmtDate(c.last_order_at)}
              </div>
            </Card>
          ));
        }}
      </Loaded>
    </Screen>
  );
}

export function CustomerDetail({ memberId, onBack, onOpenOrder }) {
  const q = useLoad(() => api.retailerCustomerDetail(memberId), [memberId]);
  return (
    <>
      <TopBar title="Customer" onBack={onBack} />
      <Screen>
        <Loaded q={q}>
          {({ customer, orders, reviews }) => (
            <>
              <Card style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{customer.full_name}</div>
                <a href={`tel:${customer.phone}`} style={{ fontSize: 12.5, color: T.teal, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}><Phone size={12} /> {customer.phone}</a>
                {customer.address && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 5 }}>{customer.address}</div>}
              </Card>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Order history ({orders.length})</div>
              {orders.map((o) => (
                <Card key={o.order_id} onClick={() => onOpenOrder(o.order_id)} style={{ marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>#{o.order_id} • {inr(o.order_total)}</div>
                      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{fmtDateTime(o.placed_at)}</div>
                    </div>
                    <Chip tone={orderTone(o.status)}>{o.status}</Chip>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    <DeliveryBadge method={o.delivery_method} />
                    {o.payment_method && <PaymentChip method={o.payment_method} status={o.payment_status} />}
                  </div>
                </Card>
              ))}

              <div style={{ fontSize: 13, fontWeight: 700, margin: "16px 0 8px" }}>Feedback</div>
              {reviews.length === 0 ? <EmptyState icon={Star} text="This customer hasn't left feedback yet." /> : reviews.map((r) => (
                <Card key={r.order_id} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: T.inkSoft }}>Order #{r.order_id} • {fmtDate(r.created_at)}</span>
                    <span style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                  {r.comment && <div style={{ fontSize: 12, color: T.ink, marginTop: 5 }}>{r.comment}</div>}
                </Card>
              ))}
            </>
          )}
        </Loaded>
      </Screen>
    </>
  );
}

// ---------- Reports (under Earnings) ----------
const STATUS_TONE = { placed: "gold", accepted: "blue", fulfilled: "green", rejected: "red", cancelled: "gray" };

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: T.inkSoft, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || T.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function ReportCard({ title, icon: Icon, color, children }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T[color], marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} /> {title}
      </div>
      {children}
    </Card>
  );
}
function Row({ label, value, color, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 13 : 12, fontWeight: strong ? 800 : 500, color, padding: "3px 0" }}>
      <span>{label}</span><span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export function ReportsSection() {
  const [range, setRange] = useState("30");
  const [custom, setCustom] = useState({ from: isoDay(new Date(Date.now() - 29 * 864e5)), to: isoDay() });
  const span = range === "custom" ? custom : { from: isoDay(new Date(Date.now() - (Number(range) - 1) * 864e5)), to: isoDay() };
  const invalid = range === "custom" && (!custom.from || !custom.to || custom.from > custom.to);
  const q = useLoad(() => (invalid ? Promise.reject(new Error("Start date must be on or before end date")) : api.retailerReports(span.from, span.to)), [span.from, span.to]);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Reports</div>
      <Pills value={range} onChange={setRange} options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["custom", "Custom"]]} style={{ marginBottom: 10 }} />
      {range === "custom" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input style={inputStyle} type="date" max={isoDay()} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <input style={inputStyle} type="date" max={isoDay()} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}
      <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 10 }}>{fmtDate(span.from)} → {fmtDate(span.to)}</div>
      {invalid ? <ErrorBanner message="Start date must be on or before end date" /> : (
        <Loaded q={q}>
          {(r) => {
            const num = (v) => Number(v || 0);
            const statuses = ["placed", "accepted", "fulfilled", "rejected", "cancelled"];
            const total = statuses.reduce((s, k) => s + num(r.orders_by_status?.[k]), 0);
            const stock = r.stock || { out_of_stock: [], low_stock: [] };
            return (
              <>
                <ReportCard title="SALES (FULFILLED ORDERS)" icon={BarChart3} color="teal">
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <Stat label="GROSS" value={inr(r.sales.gross)} color={T.teal} />
                    <Stat label="COMMISSION" value={inr(r.sales.commission)} color={T.terracotta} />
                    <Stat label="YOU KEEP" value={inr(r.sales.net)} color={T.green} />
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft }}>{num(r.sales.order_count)} fulfilled order(s)</div>
                  {r.top_products?.length > 0 && (
                    <div style={{ marginTop: 10, borderTop: `1px solid ${T.line}`, paddingTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, marginBottom: 4 }}>TOP PRODUCTS</div>
                      {r.top_products.map((p) => <Row key={p.name} label={`${p.name} × ${num(p.quantity)}`} value={inr(p.revenue)} />)}
                    </div>
                  )}
                </ReportCard>

                <ReportCard title="ORDERS" icon={ClipboardList} color="blue">
                  {total === 0 ? <div style={{ fontSize: 12, color: T.inkSoft }}>No orders in this period.</div> : (
                    <>
                      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 10, background: T.line }}>
                        {statuses.map((k) => num(r.orders_by_status?.[k]) > 0 && (
                          <div key={k} style={{ width: `${(num(r.orders_by_status[k]) / total) * 100}%`, background: { placed: T.gold, accepted: T.blue, fulfilled: T.green, rejected: T.red, cancelled: T.inkSoft }[k] }} />
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {statuses.map((k) => <Chip key={k} tone={STATUS_TONE[k]}>{k} {num(r.orders_by_status?.[k])}</Chip>)}
                      </div>
                    </>
                  )}
                </ReportCard>

                <ReportCard title="PAYMENTS" icon={ClipboardList} color="purple">
                  <Row label="Cash on delivery collected" value={inr(r.payments.cod_total)} />
                  <Row label="UPI received" value={inr(r.payments.upi_total)} />
                  <Row label="Commission owed to GVCDA" value={inr(r.payments.commission_owed)} color={T.terracotta} />
                  <Row label="Commission settled" value={inr(r.payments.commission_settled)} color={T.green} />
                  {num(r.payments.upi_awaiting_confirmation) > 0 && (
                    <div style={{ marginTop: 8, background: T.goldLight, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, color: "#6b530d", fontWeight: 700 }}>
                      {num(r.payments.upi_awaiting_confirmation)} UPI payment(s) awaiting your confirmation
                    </div>
                  )}
                </ReportCard>

                <ReportCard title="STOCK" icon={Package} color="terracotta">
                  {num(stock.tracked_count) === 0 ? (
                    <div style={{ fontSize: 12, color: T.inkSoft }}>No products are tracking stock yet. Set a stock quantity on a product to see alerts here.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 8 }}>{num(stock.tracked_count)} product(s) tracked • low stock at {num(stock.threshold)} or fewer</div>
                      {stock.out_of_stock.length === 0 && stock.low_stock.length === 0 && (
                        <div style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>All tracked products are well stocked.</div>
                      )}
                      {stock.out_of_stock.map((p) => (
                        <div key={p.product_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", fontSize: 12 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} color={T.red} />{p.name}</span><Chip tone="red">Out of stock</Chip>
                        </div>
                      ))}
                      {stock.low_stock.map((p) => (
                        <div key={p.product_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", fontSize: 12 }}>
                          <span>{p.name}</span><Chip tone="gold">Low {num(p.stock)}</Chip>
                        </div>
                      ))}
                    </>
                  )}
                </ReportCard>
              </>
            );
          }}
        </Loaded>
      )}
    </div>
  );
}

// ---------- Help & Support ----------
export function RetailerSupport({ onBack }) {
  return (
    <>
      <TopBar title="Help & Support" subtitle="Raise a ticket with GVCDA" onBack={onBack} />
      <Screen><SupportPanel fetchFn={api.retailerSupport} createFn={api.createRetailerSupport} /></Screen>
    </>
  );
}

// ---------- Delivery options ----------
const DELIVERY_HELP = {
  pickup: "Customers collect the order from your shop.",
  self_delivery: "You or your staff deliver to the customer's address.",
  gvcda_delivery: "GVCDA's delivery partner collects from your shop.",
};
export function DeliveryMethodToggles({ value, onChange }) {
  const toggle = (m) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m]);
  return (
    <>
      {["pickup", "self_delivery", "gvcda_delivery"].map((m) => (
        <label key={m} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", cursor: "pointer" }}>
          <input type="checkbox" checked={value.includes(m)} onChange={() => toggle(m)} style={{ width: 18, height: 18, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{DELIVERY_LABEL[m]}</div>
            <div style={{ fontSize: 11, color: T.inkSoft }}>{DELIVERY_HELP[m]}</div>
          </div>
        </label>
      ))}
    </>
  );
}
