import React, { useEffect, useState } from "react";
import { Home, ClipboardList, ShoppingBag, Wallet, Store, Plus, ThumbsUp, ThumbsDown, CheckCircle2, Clock, LogOut, Camera, Banknote } from "lucide-react";
import { api, photoUrl } from "./api";
import { TopBar, BottomTabs, Card, Btn, Chip, Field, inputStyle, Screen, EmptyState, LoadingScreen, ChangePasswordCard, T } from "./ui";
import LocationCascade from "./LocationCascade";
import BankTransferQR from "./BankTransferQR";

export default function RetailerApp({ user, onLogout }) {
  const [status, setStatus] = useState(undefined); // undefined = loading, null = no profile, else retailer obj
  const [refreshKey, setRefreshKey] = useState(0);

  const load = () => api.retailerMe().then((r) => setStatus(r.retailer)).catch(() => setStatus(null));
  useEffect(() => { load(); }, [refreshKey]);

  if (status === undefined) return <LoadingScreen />;
  if (status === null) return <RegisterForm onDone={() => setRefreshKey((k) => k + 1)} />;
  if (status.status === "pending") return <PendingApproval retailer={status} onRefresh={() => setRefreshKey((k) => k + 1)} onLogout={onLogout} />;
  if (status.status === "rejected") return <RejectedScreen onLogout={onLogout} />;

  return <ApprovedRetailerApp retailer={status} user={user} onLogout={onLogout} />;
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

function RejectedScreen({ onLogout }) {
  return (
    <>
      <TopBar title="Listing rejected" />
      <Screen>
        <div style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Your listing was not approved</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 8 }}>Contact support for details.</div>
          <Btn variant="ghost" onClick={onLogout} style={{ marginTop: 20 }}><LogOut size={13} /> Log out</Btn>
        </div>
      </Screen>
    </>
  );
}

function ApprovedRetailerApp({ retailer, user, onLogout }) {
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const push = (screen, params) => setStack((s) => [...s, { screen, params }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const changeTab = (id) => { setTab(id); setStack([]); };
  const top = stack[stack.length - 1];
  const refresh = () => setRefreshKey((k) => k + 1);

  if (top?.screen === "orderDetail") return <OrderDetail id={top.params.id} onBack={() => { pop(); refresh(); }} />;
  if (top?.screen === "addProduct") return <AddProductForm onBack={() => { pop(); refresh(); }} />;

  const tabs = [
    { id: "home", label: "Home", icon: Home, Comp: () => <HomeTab push={push} refreshKey={refreshKey} /> },
    { id: "orders", label: "Orders", icon: ClipboardList, Comp: () => <OrdersTab push={push} refreshKey={refreshKey} /> },
    { id: "catalogue", label: "Catalogue", icon: ShoppingBag, Comp: () => <CatalogueTab push={push} refreshKey={refreshKey} /> },
    { id: "earnings", label: "Earnings", icon: Wallet, Comp: () => <EarningsTab refreshKey={refreshKey} /> },
    { id: "profile", label: "Profile", icon: Store, Comp: () => <RetailerProfile retailer={retailer} onLogout={onLogout} /> },
  ];
  const Active = tabs.find((t) => t.id === tab).Comp;

  return (
    <>
      <TopBar title={retailer.business_name} subtitle="Approved" />
      <Active />
      <BottomTabs tabs={tabs} active={tab} onChange={changeTab} />
    </>
  );
}

function HomeTab({ push, refreshKey }) {
  const [orders, setOrders] = useState(null);
  const [earnings, setEarnings] = useState(null);
  useEffect(() => { api.retailerOrders("placed").then(setOrders); api.retailerEarnings().then(setEarnings); }, [refreshKey]);
  if (!orders || !earnings) return <LoadingScreen />;

  return (
    <Screen>
      <Card style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>CASH COLLECTED (COD)</div><div style={{ fontSize: 19, fontWeight: 800 }}>₹{earnings.gross}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>OWED TO GVCDA</div><div style={{ fontSize: 13, fontWeight: 700, color: T.terracotta }}>₹{earnings.commission_owed}</div></div>
      </Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>New Orders</div><Chip tone="gold">{orders.length} pending</Chip>
      </div>
      {orders.length === 0 && <EmptyState icon={ClipboardList} text="No new orders right now." />}
      {orders.map((o) => (
        <Card key={o.order_id} onClick={() => push("orderDetail", { id: o.order_id })} style={{ marginBottom: 8, cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>#{o.order_id} • {o.member_name}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: T.teal }}>₹{o.order_total}</span></div>
        </Card>
      ))}
    </Screen>
  );
}

function OrdersTab({ push, refreshKey }) {
  const [f, setF] = useState("placed");
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.retailerOrders(f).then(setOrders); }, [f, refreshKey]);

  return (
    <Screen>
      <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
        {["placed", "accepted", "fulfilled", "rejected"].map((s) => (
          <button key={s} onClick={() => setF(s)} style={{ padding: "5px 10px", borderRadius: 16, border: `1px solid ${f === s ? T.teal : T.line}`, background: f === s ? T.teal : "#fff", color: f === s ? "#fff" : T.inkSoft, fontSize: 10.5, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{s}</button>
        ))}
      </div>
      {orders === null ? <LoadingScreen text="" /> : orders.length === 0 ? <EmptyState icon={ClipboardList} text={`No ${f} orders.`} /> :
        orders.map((o) => (
          <Card key={o.order_id} onClick={() => push("orderDetail", { id: o.order_id })} style={{ marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>#{o.order_id} • {o.member_name}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: T.teal }}>₹{o.order_total}</span></div>
          </Card>
        ))}
    </Screen>
  );
}

function OrderDetail({ id, onBack }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.retailerOrderDetail(id).then(setData); }, [id]);
  if (!data) return <><TopBar title="Loading" onBack={onBack} /><LoadingScreen /></>;
  const { order, items } = data;

  const setStatus = async (status) => { await api.updateOrderStatus(id, status); onBack(); };

  return (
    <>
      <TopBar title={`Order #${order.order_id}`} onBack={onBack} />
      <Screen>
        <Card style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Items</div>
          {items.map((it) => (
            <div key={it.order_item_id} style={{ fontSize: 12, color: T.inkSoft, marginBottom: 3 }}>{it.quantity} × {it.name} — ₹{it.line_total}</div>
          ))}
        </Card>
        <Card style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft }}>PAYMENT</span>
            <Chip>Cash on Delivery</Chip>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>Collect from member</span><span style={{ fontWeight: 700 }}>₹{order.order_total}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.terracotta }}><span>You owe GVCDA ({order.commission_pct}% commission)</span><span>₹{order.commission_amt}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginTop: 4, borderTop: `1px solid ${T.line}`, paddingTop: 6 }}><span>You keep</span><span>₹{order.payout_amt}</span></div>
        </Card>
        {order.status === "placed" && (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn full onClick={() => setStatus("accepted")}><ThumbsUp size={13} /> Accept</Btn>
            <Btn full variant="danger" onClick={() => setStatus("rejected")}><ThumbsDown size={13} /> Reject</Btn>
          </div>
        )}
        {order.status === "accepted" && <Btn full onClick={() => setStatus("fulfilled")}><CheckCircle2 size={13} /> Mark Fulfilled</Btn>}
        {["fulfilled", "rejected"].includes(order.status) && <Chip tone={order.status === "fulfilled" ? "teal" : "red"}>{order.status}</Chip>}
      </Screen>
    </>
  );
}

function CatalogueTab({ push, refreshKey }) {
  const [products, setProducts] = useState(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { api.retailerProducts().then(setProducts); }, [refreshKey, refresh]);

  const changeImage = async (product, file) => {
    if (!file) return;
    await api.uploadProductImage(product.product_id, file);
    setRefresh((r) => r + 1);
  };

  return (
    <Screen>
      <Btn full variant="secondary" onClick={() => push("addProduct")} style={{ marginBottom: 12 }}><Plus size={13} /> Add Product</Btn>
      {products === null ? <LoadingScreen text="" /> : (
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
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.terracotta, marginTop: 4 }}>₹{p.price}</div>
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
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const pickPhoto = (file) => {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const product = await api.addProduct(name, Number(price));
      if (photo) await api.uploadProductImage(product.product_id, photo);
      onBack();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <TopBar title="Add Product" onBack={onBack} />
      <Screen>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wheat Flour 5kg" /></Field>
        <Field label="Price (₹)"><input style={inputStyle} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 220" /></Field>
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
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const load = () => {
    api.retailerEarnings().then(setE);
    api.commissionRequests().then(setHistory);
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
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>Cash collected (COD)</span><span style={{ fontWeight: 700 }}>₹{e.gross}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.terracotta }}><span>Total commission</span><span>₹{e.commission}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, marginTop: 4, borderTop: `1px solid ${T.line}`, paddingTop: 6 }}><span>You keep</span><span>₹{e.net}</span></div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>{e.order_count} fulfilled order(s) to date.</div>
      </Card>

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
    </Screen>
  );
}

function RetailerProfile({ retailer: initialRetailer, onLogout }) {
  const [retailer, setRetailer] = useState(initialRetailer);
  const [promotions, setPromotions] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingPromo, setAddingPromo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({
    address: initialRetailer.address || "", hours: initialRetailer.hours || "", description: initialRetailer.description || "",
    bank_account: initialRetailer.bank_account || "", bank_ifsc: initialRetailer.bank_ifsc || "", upi_id: initialRetailer.upi_id || "",
  });
  const [promo, setPromo] = useState({ title: "", discount_pct: "", days: "14" });
  const [error, setError] = useState("");

  const load = () => {
    api.retailerMe().then((r) => {
      setRetailer(r.retailer);
      setForm({
        address: r.retailer.address || "", hours: r.retailer.hours || "", description: r.retailer.description || "",
        bank_account: r.retailer.bank_account || "", bank_ifsc: r.retailer.bank_ifsc || "", upi_id: r.retailer.upi_id || "",
      });
    });
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
  const setPrimary = async (id) => { await api.setPrimaryPhoto(id); load(); };
  const removePhoto = async (id) => { await api.deleteRetailerPhoto(id); load(); };

  const saveProfile = async () => {
    setError("");
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Business Profile</div>
        <Btn variant="ghost" onClick={() => setEditingProfile((e) => !e)}>{editingProfile ? "Cancel" : "Edit"}</Btn>
      </div>
      {editingProfile ? (
        <Card style={{ marginBottom: 20 }}>
          <Field label="Address"><input style={inputStyle} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="Hours"><input style={inputStyle} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="e.g. 8:00 AM - 9:00 PM daily" /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, marginTop: 6, marginBottom: 8 }}>PAYOUT DETAILS</div>
          <Field label="Bank account number"><input style={inputStyle} value={form.bank_account} onChange={(e) => setForm((f) => ({ ...f, bank_account: e.target.value }))} /></Field>
          <Field label="IFSC"><input style={inputStyle} value={form.bank_ifsc} onChange={(e) => setForm((f) => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))} /></Field>
          <Field label="UPI ID"><input style={inputStyle} value={form.upi_id} onChange={(e) => setForm((f) => ({ ...f, upi_id: e.target.value }))} placeholder="name@upi" /></Field>
          <Btn full onClick={saveProfile}>Save Profile</Btn>
        </Card>
      ) : (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{retailer.business_name}</div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>Commission rate: {retailer.commission_pct}%</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6 }}>{retailer.address || "No address set"}</div>
          {retailer.hours && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{retailer.hours}</div>}
          {retailer.description && <div style={{ fontSize: 12, color: T.ink, marginTop: 8 }}>{retailer.description}</div>}
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

      <ChangePasswordCard style={{ marginTop: 16, marginBottom: 8 }} />
      <Btn full variant="danger" onClick={onLogout}><LogOut size={13} /> Log out</Btn>
    </Screen>
  );
}
