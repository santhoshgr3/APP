import React, { useEffect, useState } from "react";
import { LayoutDashboard, ClipboardList, ShoppingBag, Wallet, Store, Users, Plus, ThumbsUp, ThumbsDown, CheckCircle2, Clock, LogOut, Camera, Banknote, Phone, CalendarClock, StickyNote, LifeBuoy, ShieldCheck } from "lucide-react";
import { api, photoUrl } from "./api";
import { TopBar, BottomTabs, Card, Btn, Chip, Field, inputStyle, Screen, EmptyState, LoadingScreen, ErrorBanner, ChangePasswordCard, AnnouncementsCard, T } from "./ui";
import { inr, fmtSlot, DeliveryBadge, PaymentChip, orderTone, EmailCard } from "./shared";
import { StockChip, StockEditor, CustomersTab, CustomerDetail, ReportsSection, RetailerSupport, DeliveryMethodToggles } from "./RetailerExtras";
import LocationCascade from "./LocationCascade";
import BankTransferQR from "./BankTransferQR";

export default function RetailerApp({ user, onLogout, onRoleChanged }) {
  const [status, setStatus] = useState(undefined); // undefined = loading, null = no profile, else retailer obj
  const [refreshKey, setRefreshKey] = useState(0);

  const load = () => api.retailerMe().then((r) => setStatus(r.retailer)).catch(() => setStatus(null));
  useEffect(() => { load(); }, [refreshKey]);

  if (status === undefined) return <LoadingScreen />;
  if (status === null) return <RegisterForm onDone={() => setRefreshKey((k) => k + 1)} />;
  if (status.status === "pending") return <PendingApproval retailer={status} onRefresh={() => setRefreshKey((k) => k + 1)} onLogout={onLogout} />;
  if (status.status === "rejected") return <RejectedScreen retailer={status} onLogout={onLogout} />;

  return <ApprovedRetailerApp retailer={status} user={user} onLogout={onLogout} onUserChanged={onRoleChanged} />;
}

function RegisterForm({ onDone }) {
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
      await api.retailerRegister({ business_name: name, category_id: catId, village_id: loc.village_id, phone });
      onDone();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <TopBar title="Register your business" />
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
        <Btn full disabled={!name || submitting} onClick={submit}>{submitting ? "Submitting..." : "Submit for Approval"}</Btn>
      </Screen>
    </>
  );
}

function PendingApproval({ retailer, onRefresh, onLogout }) {
  return (
    <>
      <TopBar title={retailer.business_name} subtitle="Under review" />
      <Screen>
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <Clock size={36} color={T.gold} style={{ margin: "0 auto 14px" }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Your listing is under review</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 8, maxWidth: 260, marginInline: "auto" }}>
            An admin needs to approve this listing before it goes live for members. Log in as the demo Admin (phone 9000000001) in another tab to approve it.
          </div>
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <Btn variant="secondary" onClick={onRefresh}>Check status again</Btn>
            <Btn variant="ghost" onClick={onLogout}><LogOut size={13} /> Log out</Btn>
          </div>
        </div>
      </Screen>
    </>
  );
}

function RejectedScreen({ retailer, onLogout }) {
  return (
    <>
      <TopBar title="Listing rejected" />
      <Screen>
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Your listing was not approved</div>
          {retailer.rejection_reason && (
            <Card style={{ margin: "14px auto 0", maxWidth: 280, background: T.redLight, borderColor: T.redLight, textAlign: "left" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.red, marginBottom: 3 }}>REASON</div>
              <div style={{ fontSize: 12.5 }}>{retailer.rejection_reason}</div>
            </Card>
          )}
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 10 }}>Contact GVCDA support for details.</div>
          <Btn variant="ghost" onClick={onLogout} style={{ marginTop: 20 }}><LogOut size={13} /> Log out</Btn>
        </div>
      </Screen>
    </>
  );
}

function ApprovedRetailerApp({ retailer, user, onLogout, onUserChanged }) {
  const [tab, setTab] = useState("dashboard");
  const [stack, setStack] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const push = (screen, params) => setStack((s) => [...s, { screen, params }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const changeTab = (id) => { setTab(id); setStack([]); };
  const top = stack[stack.length - 1];
  const refresh = () => setRefreshKey((k) => k + 1);

  if (top?.screen === "orderDetail") return <OrderDetail id={top.params.id} onBack={() => { pop(); refresh(); }} />;
  if (top?.screen === "addProduct") return <AddProductForm onBack={() => { pop(); refresh(); }} />;
  if (top?.screen === "customer") return <CustomerDetail memberId={top.params.id} onBack={pop} onOpenOrder={(id) => push("orderDetail", { id })} />;
  if (top?.screen === "support") return <RetailerSupport onBack={pop} />;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, Comp: () => <HomeTab push={push} refreshKey={refreshKey} /> },
    { id: "products", label: "Products", icon: ShoppingBag, Comp: () => <CatalogueTab push={push} refreshKey={refreshKey} /> },
    { id: "orders", label: "Orders", icon: ClipboardList, Comp: () => <OrdersTab push={push} refreshKey={refreshKey} /> },
    { id: "customers", label: "Customers", icon: Users, Comp: () => <CustomersTab push={push} /> },
    { id: "earnings", label: "Earnings", icon: Wallet, Comp: () => <EarningsTab refreshKey={refreshKey} /> },
    { id: "profile", label: "Profile", icon: Store, Comp: () => <RetailerProfile retailer={retailer} push={push} onLogout={onLogout} onUserChanged={onUserChanged} /> },
  ];
  const Active = tabs.find((t) => t.id === tab).Comp;

  return (
    <>
      <TopBar title={retailer.business_name} subtitle={retailer.status === "approved" ? "Approved" : retailer.status} />
      <Active />
      <BottomTabs tabs={tabs} active={tab} onChange={changeTab} />
    </>
  );
}

function OrderRow({ o, onClick }) {
  return (
    <Card onClick={onClick} style={{ marginBottom: 8, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>#{o.order_id} • {o.member_name}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.teal }}>₹{o.order_total}</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
        <DeliveryBadge method={o.delivery_method} />
        <PaymentChip method={o.payment_method} status={o.payment_status} />
      </div>
      {o.scheduled_for && <div style={{ fontSize: 11, color: T.purple, fontWeight: 700, marginTop: 5 }}>Booking: {fmtSlot(o.scheduled_for)}</div>}
      {o.delivery_address && o.delivery_method !== "pickup" && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>📍 {o.delivery_address}</div>}
    </Card>
  );
}

function HomeTab({ push, refreshKey }) {
  const [orders, setOrders] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setErr("");
    api.retailerOrders("placed").then(setOrders).catch((e) => setErr(e.message));
    api.retailerEarnings().then(setEarnings).catch((e) => setErr(e.message));
  }, [refreshKey]);
  if (!orders || !earnings) return err ? <Screen><ErrorBanner message={err} /></Screen> : <LoadingScreen />;

  return (
    <Screen>
      <AnnouncementsCard fetchFn={api.retailerBroadcasts} />
      <Card style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>SALES COLLECTED</div><div style={{ fontSize: 19, fontWeight: 800 }}>₹{earnings.gross}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>OWED TO GVCDA</div><div style={{ fontSize: 13, fontWeight: 700, color: T.terracotta }}>₹{earnings.commission_owed}</div></div>
      </Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>New Orders</div><Chip tone="gold">{orders.length} pending</Chip>
      </div>
      {orders.length === 0 && <EmptyState icon={ClipboardList} text="No new orders right now." />}
      {orders.map((o) => <OrderRow key={o.order_id} o={o} onClick={() => push("orderDetail", { id: o.order_id })} />)}
    </Screen>
  );
}

function OrdersTab({ push, refreshKey }) {
  const [f, setF] = useState("placed");
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setOrders(null); setErr("");
    api.retailerOrders(f).then(setOrders).catch((e) => { setErr(e.message); setOrders([]); });
  }, [f, refreshKey]);

  return (
    <Screen>
      <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
        {["placed", "accepted", "fulfilled", "rejected", "cancelled"].map((s) => (
          <button key={s} onClick={() => setF(s)} style={{ padding: "5px 10px", borderRadius: 16, border: `1px solid ${f === s ? T.teal : T.line}`, background: f === s ? T.teal : "#fff", color: f === s ? "#fff" : T.inkSoft, fontSize: 10.5, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
        ))}
      </div>
      <ErrorBanner message={err} />
      {orders === null ? <LoadingScreen text="" /> : orders.length === 0 ? (!err && <EmptyState icon={ClipboardList} text={`No ${f} orders.`} />) :
        orders.map((o) => <OrderRow key={o.order_id} o={o} onClick={() => push("orderDetail", { id: o.order_id })} />)}
    </Screen>
  );
}

function OrderDetail({ id, onBack }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = () => api.retailerOrderDetail(id).then(setData).catch((e) => setLoadErr(e.message));
  useEffect(() => { load(); }, [id]);
  if (!data) return <><TopBar title="Order" onBack={onBack} />{loadErr ? <Screen><ErrorBanner message={loadErr} /></Screen> : <LoadingScreen />}</>;
  const { order, items } = data;
  const isUpi = order.payment_method === "upi";
  const isPickup = order.delivery_method === "pickup";
  const finished = ["fulfilled", "rejected", "cancelled"].includes(order.status);

  const act = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const setStatus = (status) => act(() => api.updateOrderStatus(id, status));
  const confirmPayment = (received) => act(() => api.updateOrderPayment(id, received));

  return (
    <>
      <TopBar title={`Order #${order.order_id}`} onBack={onBack} />
      <Screen>
        <ErrorBanner message={error} />
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft }}>CUSTOMER</span>
            <Chip tone={orderTone(order.status)}>{order.status}</Chip>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{order.member_name}</div>
          {order.member_phone && (
            <a href={`tel:${order.member_phone}`} style={{ fontSize: 12.5, color: T.teal, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4 }}>
              <Phone size={12} /> {order.member_phone}
            </a>
          )}
        </Card>
        <Card style={{ marginBottom: 10, background: T.tealLight, borderColor: T.tealLight }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.teal }}>{isPickup ? "CUSTOMER PICKS UP" : order.delivery_method === "gvcda_delivery" ? "GVCDA PARTNER DELIVERS TO" : "DELIVER TO"}</div>
            <DeliveryBadge method={order.delivery_method} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{isPickup ? "Pickup at your store" : order.delivery_address || "No address provided"}</div>
          {order.delivery_phone && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>📞 {order.delivery_phone}</div>}
        </Card>
        {order.scheduled_for && (
          <Card style={{ marginBottom: 10, background: T.purpleLight, borderColor: T.purpleLight }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.purple, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}><CalendarClock size={12} /> BOOKING SLOT</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtSlot(order.scheduled_for)}</div>
          </Card>
        )}
        {order.order_notes && (
          <Card style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}><StickyNote size={12} /> CUSTOMER NOTES</div>
            <div style={{ fontSize: 12.5 }}>{order.order_notes}</div>
          </Card>
        )}
        <Card style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Items</div>
          {items.map((it) => (
            <div key={it.order_item_id || it.name} style={{ fontSize: 12, color: T.inkSoft, marginBottom: 3 }}>
              {it.quantity} × {it.name} — ₹{it.line_total} {it.item_type === "service" && <Chip tone="purple">Service</Chip>}
            </div>
          ))}
        </Card>
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft }}>PAYMENT</span>
            <PaymentChip method={order.payment_method} status={order.payment_status} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{isUpi ? "Customer pays via UPI" : "Collect from customer"}</span><span style={{ fontWeight: 700 }}>₹{order.order_total}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.terracotta }}><span>You owe GVCDA ({order.commission_pct}% commission)</span><span>₹{order.commission_amt}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginTop: 4, borderTop: `1px solid ${T.line}`, paddingTop: 6 }}><span>You keep</span><span>₹{order.payout_amt}</span></div>

          {isUpi && order.payment_status === "submitted" && (
            <div style={{ marginTop: 10, background: T.blueLight, borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11.5, color: T.blue, fontWeight: 700 }}>Customer says they paid</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 3, wordBreak: "break-all" }}>UTR: {order.payment_utr}</div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Check your UPI app for ₹{order.order_total} with this reference before confirming.</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn full disabled={busy} onClick={() => confirmPayment(true)}><CheckCircle2 size={13} /> Payment received</Btn>
                <Btn full variant="danger" disabled={busy} onClick={() => confirmPayment(false)}>Not received</Btn>
              </div>
            </div>
          )}
          {isUpi && order.payment_status === "pending" && !finished && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: T.inkSoft }}>Waiting for the customer to pay and share their UTR.</div>
          )}
        </Card>

        {order.status === "placed" && (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn full disabled={busy} onClick={() => setStatus("accepted")}><ThumbsUp size={13} /> Accept</Btn>
            <Btn full variant="danger" disabled={busy} onClick={() => setStatus("rejected")}><ThumbsDown size={13} /> Reject</Btn>
          </div>
        )}
        {order.status === "accepted" && (
          <>
            <Btn full disabled={busy || (isUpi && order.payment_status !== "paid")} onClick={() => setStatus("fulfilled")}><CheckCircle2 size={13} /> Mark Fulfilled</Btn>
            {isUpi && order.payment_status !== "paid" && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 6, textAlign: "center" }}>Confirm the UPI payment first to complete this order.</div>}
          </>
        )}
      </Screen>
    </>
  );
}

function CatalogueTab({ push, refreshKey }) {
  const [products, setProducts] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    api.retailerProducts().then(setProducts).catch((e) => { setError(e.message); setProducts([]); });
  }, [refreshKey, refresh]);

  const changeImage = async (product, file) => {
    if (!file) return;
    setError("");
    try { await api.uploadProductImage(product.product_id, file); setRefresh((r) => r + 1); }
    catch (e) { setError(e.message); }
  };

  return (
    <Screen>
      <Btn full variant="secondary" onClick={() => push("addProduct")} style={{ marginBottom: 12 }}><Plus size={13} /> Add Product or Service</Btn>
      <ErrorBanner message={error} />
      {products === null ? <LoadingScreen text="" /> : products.length === 0 ? (
        <EmptyState icon={ShoppingBag} text="No products yet. Add your first product or service." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {products.map((p) => (
            <Card key={p.product_id} style={{ padding: 0, overflow: "hidden" }}>
              <label style={{ display: "block", height: 90, background: T.tealLight, cursor: "pointer", position: "relative" }}>
                {p.image_filename ? (
                  <img src={photoUrl(p.image_filename)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: T.teal }}>
                    <Camera size={20} />
                  </div>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => changeImage(p, e.target.files[0])} />
              </label>
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.terracotta, margin: "4px 0 6px" }}>₹{p.price}</div>
                <StockChip p={p} />
                <StockEditor product={p} onSaved={() => setRefresh((r) => r + 1)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

function AddProductForm({ onBack }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [itemType, setItemType] = useState("product");
  const [stock, setStock] = useState("");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const pickPhoto = (file) => {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async () => {
    if (!(Number(price) > 0)) { setError("Enter a price greater than 0"); return; }
    setSubmitting(true); setError("");
    try {
      const extra = { item_type: itemType };
      if (itemType === "product" && stock !== "") extra.stock = Number(stock);
      const product = await api.addProduct(name.trim(), Number(price), extra);
      if (photo) await api.uploadProductImage(product.product_id, photo);
      onBack();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <TopBar title="Add Product or Service" onBack={onBack} />
      <Screen>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Field label="Type">
          <div style={{ display: "flex", gap: 6 }}>
            {[["product", "Product"], ["service", "Service"]].map(([v, l]) => (
              <div key={v} onClick={() => setItemType(v)} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 700, border: `2px solid ${itemType === v ? T.teal : T.line}`, background: itemType === v ? T.tealLight : "#fff", color: itemType === v ? T.teal : T.inkSoft }}>{l}</div>
            ))}
          </div>
          {itemType === "service" && <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 5 }}>Customers pick a date and time when booking a service.</div>}
        </Field>
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={itemType === "service" ? "e.g. Tractor repair visit" : "e.g. Wheat Flour 5kg"} /></Field>
        <Field label="Price (₹)"><input style={inputStyle} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 220" /></Field>
        {itemType === "product" && (
          <Field label="Stock quantity (optional)">
            <input style={inputStyle} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} placeholder="Leave blank if you don't track stock" />
          </Field>
        )}
        <Field label="Photo (optional)">
          <label style={{ display: "block", border: `1px dashed ${T.line}`, borderRadius: 8, padding: preview ? 0 : 14, textAlign: "center", color: T.inkSoft, cursor: "pointer", overflow: "hidden" }}>
            {preview ? (
              <img src={preview} alt="Preview" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
            ) : (
              <><Camera size={16} style={{ margin: "0 auto 4px" }} /><div style={{ fontSize: 10.5 }}>Tap to choose a photo</div></>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => pickPhoto(e.target.files[0])} />
          </label>
        </Field>
        <Btn full disabled={!name || !price || submitting} onClick={submit}>{submitting ? "Saving..." : "Save Product"}</Btn>
      </Screen>
    </>
  );
}

function EarningsTab({ refreshKey }) {
  const [e, setE] = useState(null);
  const [history, setHistory] = useState(null);
  const [trend, setTrend] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const load = () => {
    api.retailerEarnings().then(setE);
    api.commissionRequests().then(setHistory);
    api.retailerEarningsTrend(14).then(setTrend);
    api.retailerReviews().then(setReviews);
  };
  useEffect(load, [refreshKey]);

  const startSettlement = async () => {
    setStarting(true); setError("");
    try { setCheckout(await api.commissionCheckout()); }
    catch (err) { setError(err.message); }
    setStarting(false);
  };

  if (checkout) {
    return (
      <BankTransferQR
        title={`Settle ₹${checkout.amount}`}
        subtitle="Commission owed to GVCDA"
        checkout={checkout}
        onSubmitUtr={api.submitCommissionUtr}
        onBack={() => setCheckout(null)}
        onDone={() => { setCheckout(null); load(); }}
      />
    );
  }

  if (!e || !history) return <LoadingScreen />;

  return (
    <Screen>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>Sales collected</span><span style={{ fontWeight: 700 }}>₹{e.gross}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.terracotta }}><span>Total commission</span><span>₹{e.commission}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginTop: 4, borderTop: `1px solid ${T.line}`, paddingTop: 6 }}><span>You keep</span><span>₹{e.net}</span></div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>{e.order_count} fulfilled order(s) to date.</div>
      </Card>

      {trend && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>SALES — LAST 14 DAYS</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
            {trend.map((d) => {
              const max = Math.max(...trend.map((x) => x.gross), 1);
              return (
                <div key={d.day} title={`${d.day}: ₹${d.gross}`} style={{ flex: 1, height: `${Math.max(4, (d.gross / max) * 100)}%`, background: d.gross > 0 ? T.teal : T.line, borderRadius: 2 }} />
              );
            })}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 14, background: e.commission_owed > 0 ? T.terracottaLight : undefined }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft }}>OWED TO GVCDA</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: e.commission_owed > 0 ? T.terracotta : T.teal }}>₹{e.commission_owed}</div>
          </div>
          {e.commission_owed > 0 && (
            <Btn onClick={startSettlement} disabled={starting}><Banknote size={13} /> {starting ? "Preparing..." : "Settle Now"}</Btn>
          )}
        </div>
        {error && <div style={{ color: T.red, fontSize: 11.5, marginTop: 8 }}>{error}</div>}
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Settlement History</div>
      {history.length === 0 ? <EmptyState icon={Wallet} text="No settlements yet." /> : (
        history.map((h) => (
          <Card key={h.request_id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>₹{h.amount} — {h.reference_code}</div>
              <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>{new Date(h.created_at).toLocaleDateString()}</div>
            </div>
            <Chip tone={h.status === "verified" ? "teal" : h.status === "rejected" ? "red" : "gold"}>{h.status}</Chip>
          </Card>
        ))
      )}

      <ReportsSection />

      {reviews && reviews.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Customer Reviews</div>
          {reviews.map((r, i) => (
            <Card key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{r.member_name}</span>
                <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              {r.comment && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>{r.comment}</div>}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const DEFAULT_DELIVERY = ["pickup", "self_delivery"];
const STATUS_INFO = {
  approved: ["green", "Verified — your shop is live for customers."],
  pending: ["gold", "Under review — not yet visible to customers."],
  rejected: ["red", "Not approved."],
  suspended: ["red", "Suspended — your shop is hidden from customers."],
};

function RetailerProfile({ retailer: initialRetailer, push, onLogout, onUserChanged }) {
  const [retailer, setRetailer] = useState(initialRetailer);
  const [promotions, setPromotions] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingPromo, setAddingPromo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({
    address: initialRetailer.address || "", hours: initialRetailer.hours || "", description: initialRetailer.description || "",
    bank_account: initialRetailer.bank_account || "", bank_ifsc: initialRetailer.bank_ifsc || "", upi_id: initialRetailer.upi_id || "",
    delivery_methods: initialRetailer.delivery_methods?.length ? initialRetailer.delivery_methods : DEFAULT_DELIVERY,
  });
  const [promo, setPromo] = useState({ title: "", discount_pct: "", days: "14" });
  const [error, setError] = useState("");

  const load = () => {
    api.retailerMe().then((r) => {
      setRetailer(r.retailer);
      setForm({
        address: r.retailer.address || "", hours: r.retailer.hours || "", description: r.retailer.description || "",
        bank_account: r.retailer.bank_account || "", bank_ifsc: r.retailer.bank_ifsc || "", upi_id: r.retailer.upi_id || "",
        delivery_methods: r.retailer.delivery_methods?.length ? r.retailer.delivery_methods : DEFAULT_DELIVERY,
      });
    }).catch((e) => setError(e.message));
    api.retailerPromotions().then(setPromotions);
    api.retailerPhotos().then(setPhotos);
  };
  useEffect(load, []);

  const uploadPhotos = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingPhotos(true); setError("");
    try { await api.uploadRetailerPhotos(files); load(); }
    catch (e) { setError(e.message); }
    setUploadingPhotos(false);
  };
  const setPrimary = async (id) => { try { await api.setPrimaryPhoto(id); load(); } catch (e) { setError(e.message); } };
  const removePhoto = async (id) => { try { await api.deleteRetailerPhoto(id); load(); } catch (e) { setError(e.message); } };

  const saveProfile = async () => {
    setError("");
    if (form.delivery_methods.length === 0) { setError("Pick at least one delivery option"); return; }
    try { await api.updateRetailerProfile(form); setEditingProfile(false); load(); }
    catch (e) { setError(e.message); }
  };

  const createPromo = async () => {
    if (!promo.title.trim() || !promo.discount_pct) { setError("Title and discount % are required"); return; }
    setError("");
    try {
      const start = new Date();
      const end = new Date(Date.now() + Number(promo.days || 14) * 86400000);
      await api.createPromotion({
        title: promo.title.trim(), discount_pct: Number(promo.discount_pct),
        start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10), scope: "all_products",
      });
      setPromo({ title: "", discount_pct: "", days: "14" }); setAddingPromo(false); load();
    } catch (e) { setError(e.message); }
  };

  const togglePromo = async (p) => { await api.togglePromotion(p.promotion_id, !p.is_active); load(); };

  return (
    <Screen>
      {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <Card style={{ marginBottom: 14, background: T[`${(STATUS_INFO[retailer.status] || STATUS_INFO.pending)[0]}Light`], borderColor: T[`${(STATUS_INFO[retailer.status] || STATUS_INFO.pending)[0]}Light`] }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={18} color={T[(STATUS_INFO[retailer.status] || STATUS_INFO.pending)[0]]} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: "capitalize" }}>Verification: {retailer.status}</div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 1 }}>{(STATUS_INFO[retailer.status] || STATUS_INFO.pending)[1]}</div>
          </div>
        </div>
        {retailer.rejection_reason && <div style={{ fontSize: 11.5, color: T.red, marginTop: 8 }}>Reason: {retailer.rejection_reason}</div>}
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Business Profile</div>
        <Btn variant="ghost" onClick={() => setEditingProfile((e) => !e)}>{editingProfile ? "Cancel" : "Edit"}</Btn>
      </div>
      {editingProfile ? (
        <Card style={{ marginBottom: 20 }}>
          <Field label="Address"><input style={inputStyle} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="Hours"><input style={inputStyle} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="e.g. 8:00 AM - 9:00 PM daily" /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What your shop sells or offers" /></Field>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginTop: 6, marginBottom: 4 }}>DELIVERY OPTIONS</div>
          <DeliveryMethodToggles value={form.delivery_methods} onChange={(v) => setForm((f) => ({ ...f, delivery_methods: v }))} />
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginTop: 10, marginBottom: 8 }}>PAYMENT DETAILS</div>
          <Field label="Bank account number"><input style={inputStyle} value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} /></Field>
          <Field label="IFSC"><input style={inputStyle} value={form.bank_ifsc} onChange={(e) => setForm((f) => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))} /></Field>
          <Field label="UPI ID">
            <input style={inputStyle} value={form.upi_id} onChange={(e) => setForm((f) => ({ ...f, upi_id: e.target.value.trim() }))} placeholder="name@upi" />
            <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 4 }}>Add your UPI ID to let customers pay you by UPI. Without it, only cash on delivery is offered.</div>
          </Field>
          <Btn full onClick={saveProfile}>Save Profile</Btn>
        </Card>
      ) : (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{retailer.business_name}</div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Commission rate: {retailer.commission_pct}%</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6 }}>{retailer.address || "No address set"}</div>
          {retailer.hours && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{retailer.hours}</div>}
          {retailer.description && <div style={{ fontSize: 12, color: T.ink, marginTop: 8 }}>{retailer.description}</div>}
          <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 10, paddingTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(retailer.delivery_methods?.length ? retailer.delivery_methods : DEFAULT_DELIVERY).map((m) => <DeliveryBadge key={m} method={m} />)}
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 8 }}>
            UPI: {retailer.upi_id ? <b style={{ color: T.ink }}>{retailer.upi_id}</b> : <span style={{ color: T.terracotta }}>not set — customers can't pay by UPI</span>}
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>
            Bank: {retailer.bank_account ? <b style={{ color: T.ink }}>••••{String(retailer.bank_account).slice(-4)} {retailer.bank_ifsc || ""}</b> : "not set"}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Storefront Photos</div>
        <label style={{ display: "inline-block" }}>
          <div style={{ pointerEvents: "none" }}>
            <Btn variant="ghost"><Camera size={13} /> {uploadingPhotos ? "Uploading..." : "Add Photos"}</Btn>
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} disabled={uploadingPhotos}
            onChange={(e) => { uploadPhotos(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {photos === null ? <LoadingScreen text="" /> : photos.length === 0 ? (
        <EmptyState icon={Camera} text="No photos yet — members see this listing without a storefront image." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
          {photos.map((p) => (
            <div key={p.photo_id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: p.is_primary ? `2px solid ${T.teal}` : `1px solid ${T.line}` }}>
              <img src={photoUrl(p.filename)} alt="" style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
              {p.is_primary && (
                <div style={{ position: "absolute", top: 3, left: 3, background: T.teal, color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>COVER</div>
              )}
              <div style={{ position: "absolute", bottom: 3, right: 3, display: "flex", gap: 3 }}>
                {!p.is_primary && (
                  <button onClick={() => setPrimary(p.photo_id)} title="Set as cover" style={{ background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 4, width: 20, height: 20, color: "#fff", fontSize: 10, cursor: "pointer" }}>★</button>
                )}
                <button onClick={() => removePhoto(p.photo_id)} title="Delete" style={{ background: "rgba(178,58,72,0.85)", border: "none", borderRadius: 4, width: 20, height: 20, color: "#fff", fontSize: 10, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Promotions</div>
        <Btn variant="ghost" onClick={() => setAddingPromo((a) => !a)}><Plus size={13} /> {addingPromo ? "Cancel" : "New"}</Btn>
      </div>
      {addingPromo && (
        <Card style={{ marginBottom: 12 }}>
          <Field label="Title"><input style={inputStyle} value={promo.title} onChange={(e) => setPromo((p) => ({ ...p, title: e.target.value }))} placeholder="Festival Sale" /></Field>
          <Field label="Discount %"><input style={inputStyle} value={promo.discount_pct} onChange={(e) => setPromo((p) => ({ ...p, discount_pct: e.target.value }))} /></Field>
          <Field label="Valid for (days)"><input style={inputStyle} value={promo.days} onChange={(e) => setPromo((p) => ({ ...p, days: e.target.value }))} /></Field>
          <Btn full onClick={createPromo}>Create Promotion</Btn>
        </Card>
      )}
      {promotions === null ? <LoadingScreen text="" /> : promotions.length === 0 ? <EmptyState icon={ClipboardList} text="No active promotions." /> : (
        promotions.map((p) => (
          <Card key={p.promotion_id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.title} — {p.discount_pct}% off</div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{p.start_date} → {p.end_date}</div>
            </div>
            <input type="checkbox" checked={!!p.is_active} onChange={() => togglePromo(p)} style={{ width: 18, height: 18 }} />
          </Card>
        ))
      )}

      <EmailCard onSaved={onUserChanged} style={{ marginTop: 16 }} />
      <Btn full variant="ghost" onClick={() => push("support")} style={{ marginBottom: 8 }}><LifeBuoy size={13} /> Help & Support</Btn>
      <ChangePasswordCard style={{ marginBottom: 8 }} />
      <Btn full variant="danger" onClick={onLogout}><LogOut size={13} /> Log out</Btn>
    </Screen>
  );
}
