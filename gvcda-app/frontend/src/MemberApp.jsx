import React, { useEffect, useState } from "react";
import {
  Home, Search, ClipboardList, Briefcase, User, MapPin, QrCode, Star, Plus, Minus,
  ShoppingCart, CheckCircle2, Clock, AlertCircle, Settings, LogOut, Send, Truck, Store
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, clearSession, saveSession, photoUrl } from "./api";
import { TopBar, BottomTabs, Card, Btn, Chip, Field, inputStyle, Screen, EmptyState, LoadingScreen, ChangePasswordCard, T } from "./ui";
import BankTransferQR from "./BankTransferQR";
import LocationCascade from "./LocationCascade";

function RetailerThumb({ photo, size = 44 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: T.tealLight, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {photo ? <img src={photoUrl(photo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Store size={size * 0.4} color={T.teal} />}
    </div>
  );
}

export default function MemberApp({ user, roles = [], onLogout, onRoleChanged }) {
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]);
  const [cart, setCart] = useState([]);
  const push = (screen, params) => setStack((s) => [...s, { screen, params }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const changeTab = (id) => { setTab(id); setStack([]); };
  const top = stack[stack.length - 1];

  const addToCart = (product) =>
    setCart((c) => c.find((i) => i.product_id === product.product_id)
      ? c.map((i) => i.product_id === product.product_id ? { ...i, qty: i.qty + 1 } : i)
      : [...c, { ...product, qty: 1 }]);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  if (top?.screen === "sector") return (
    <SectorDetail categoryId={top.params.id} categoryName={top.params.name} onBack={pop} onOpenRetailer={(id) => push("retailer", { id })} />
  );
  if (top?.screen === "retailer") return (
    <RetailerDetail id={top.params.id} onBack={pop} cart={cart} onAdd={addToCart}
      onViewCart={() => push("cart")} cartTotal={cartTotal} />
  );
  if (top?.screen === "cart") return (
    <CartScreen cart={cart} setCart={setCart} total={cartTotal}
      onBack={pop}
      onPlaced={() => { setCart([]); setStack([]); setTab("orders"); }} />
  );
  if (top?.screen === "jobDetail") return <JobDetail id={top.params.id} onBack={pop} />;
  if (top?.screen === "complaint") return <ComplaintForm onBack={pop} />;
  if (top?.screen === "buyPlan") return <BuyPlan onBack={pop} onDone={() => { pop(); changeTab("profile"); }} />;
  if (top?.screen === "becomeRetailer") return <BecomeRetailer onBack={pop} onDone={onRoleChanged} />;
  if (top?.screen === "digitalCard") return <DigitalCard user={user} onBack={pop} />;

  const tabs = [
    { id: "home", label: "Home", icon: Home, Comp: () => <HomeTab push={push} user={user} /> },
    { id: "orders", label: "Orders", icon: ClipboardList, Comp: OrdersTab },
    { id: "jobs", label: "Jobs", icon: Briefcase, Comp: () => <JobsTab push={push} /> },
    { id: "profile", label: "Profile", icon: User, Comp: () => <ProfileTab user={user} roles={roles} push={push} onLogout={onLogout} /> },
  ];
  const Active = tabs.find((t) => t.id === tab).Comp;

  return (
    <>
      <TopBar title={`Namaste, ${user.full_name?.split(" ")[0] || "Member"}`} subtitle="GVCDA Member" />
      <Active />
      <BottomTabs tabs={tabs} active={tab} onChange={changeTab} />
    </>
  );
}

function HomeTab({ push, user }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.memberHome().then(setData); }, []);
  if (!data) return <LoadingScreen />;

  return (
    <Screen>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
        <MapPin size={13} color={T.terracotta} />
        <span style={{ fontSize: 12, fontWeight: 700 }}>{data.user.village_id ? `${data.user.village_name}, ${data.user.mandal_name}` : "No location set"}</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Explore Sectors</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        {data.categories.map((c) => (
          <div key={c.category_id} onClick={() => push("sector", { id: c.category_id, name: c.name })}
            style={{ background: "#fff", borderRadius: 12, padding: "12px 6px", textAlign: "center", border: `1px solid ${T.line}`, cursor: "pointer" }}>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{c.name}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Nearby Retailers</div>
      {data.nearby.length === 0 && <EmptyState icon={Search} text="No approved retailers in your village yet." />}
      {data.nearby.map((r) => (
        <Card key={r.retailer_id} onClick={() => push("retailer", { id: r.retailer_id })} style={{ marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <RetailerThumb photo={r.primary_photo} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.business_name}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{r.village_name}</div>
          </div>
        </Card>
      ))}
    </Screen>
  );
}

function SectorDetail({ categoryId, categoryName, onBack, onOpenRetailer }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.memberRetailers({ category_id: categoryId }).then(setList); }, [categoryId]);
  if (!list) return <><TopBar title={categoryName} onBack={onBack} /><LoadingScreen /></>;
  return (
    <>
      <TopBar title={categoryName} subtitle="Your Mandal & nearby" onBack={onBack} />
      <Screen>
        {list.length === 0 && <EmptyState icon={Search} text={`No ${categoryName} retailers listed in your Mandal yet.`} />}
        {list.map((r) => (
          <Card key={r.retailer_id} onClick={() => onOpenRetailer(r.retailer_id)} style={{ marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <RetailerThumb photo={r.primary_photo} />
              <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{r.business_name}</div><div style={{ fontSize: 11, color: T.inkSoft }}>{r.village_name}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: T.gold }}><Star size={12} fill={T.gold} color={T.gold} />{r.rating_avg || "New"}</div>
          </Card>
        ))}
      </Screen>
    </>
  );
}

function RetailerDetail({ id, onBack, cart, onAdd, onViewCart, cartTotal }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.memberRetailerDetail(id).then(setData); }, [id]);
  if (!data) return <><TopBar title="Loading..." onBack={onBack} /><LoadingScreen /></>;

  return (
    <>
      <TopBar title={data.retailer.business_name} subtitle={`${data.retailer.village_name} • ${data.retailer.category_name}`} onBack={onBack} />
      <Screen>
        {data.photos?.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
            {data.photos.map((p) => (
              <img key={p.photo_id} src={photoUrl(p.filename)} alt="" style={{ width: 140, height: 100, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Products & Services</div>
        {data.products.length === 0 && <EmptyState icon={ShoppingCart} text="No products listed yet." />}
        {data.products.map((p) => (
          <Card key={p.product_id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {p.image_filename ? (
                <img src={photoUrl(p.image_filename)} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: T.tealLight, flexShrink: 0 }} />
              )}
              <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 11.5, color: T.terracotta, fontWeight: 700 }}>₹{p.price}</div></div>
            </div>
            <Btn variant="secondary" onClick={() => onAdd(p)}><Plus size={12} /> Add</Btn>
          </Card>
        ))}
      </Screen>
      {cart.length > 0 && (
        <div style={{ padding: 14, borderTop: `1px solid ${T.line}` }}>
          <Btn full onClick={onViewCart}><ShoppingCart size={13} /> View Cart • ₹{cartTotal} ({cart.reduce((s, i) => s + i.qty, 0)})</Btn>
        </div>
      )}
    </>
  );
}

function CartScreen({ cart, setCart, total, onBack, onPlaced }) {
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const place = async () => {
    setPlacing(true); setError("");
    try {
      const retailerId = cart[0].retailer_id;
      await api.placeOrder(retailerId, cart.map((i) => ({ product_id: i.product_id, quantity: i.qty })));
      onPlaced();
    } catch (e) { setError(e.message); }
    setPlacing(false);
  };

  return (
    <>
      <TopBar title="Your Cart" onBack={onBack} />
      <Screen>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {cart.map((i) => (
          <Card key={i.product_id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{i.name}</div><div style={{ fontSize: 11, color: T.inkSoft }}>₹{i.price} each</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setCart((c) => c.map((x) => x.product_id === i.product_id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 6, width: 24, height: 24, cursor: "pointer" }}><Minus size={12} /></button>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{i.qty}</span>
              <button onClick={() => setCart((c) => c.map((x) => x.product_id === i.product_id ? { ...x, qty: x.qty + 1 } : x))} style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 6, width: 24, height: 24, cursor: "pointer" }}><Plus size={12} /></button>
            </div>
          </Card>
        ))}
        <Card style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span><span style={{ fontSize: 14, fontWeight: 800, color: T.teal }}>₹{total}</span>
        </Card>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, color: T.inkSoft }}>
          <Truck size={13} color={T.teal} /> Cash on Delivery — pay the retailer directly when your order arrives.
        </div>
      </Screen>
      <div style={{ padding: 14, borderTop: `1px solid ${T.line}` }}>
        <Btn full onClick={place} disabled={placing}>{placing ? "Placing..." : "Place Order (Cash on Delivery)"}</Btn>
      </div>
    </>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.memberOrders().then(setOrders); }, []);
  if (!orders) return <LoadingScreen />;
  return (
    <Screen>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Your Orders</div>
      {orders.length === 0 && <EmptyState icon={ClipboardList} text="No orders yet." />}
      {orders.map((o) => (
        <Card key={o.order_id} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>#{o.order_id} • {o.business_name}</div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>₹{o.order_total} • {new Date(o.placed_at).toLocaleDateString()}</div>
          </div>
          <Chip tone={o.status === "fulfilled" ? "teal" : o.status === "rejected" ? "red" : "gold"}>{o.status}</Chip>
        </Card>
      ))}
    </Screen>
  );
}

function JobsTab({ push }) {
  const [jobs, setJobs] = useState(null);
  useEffect(() => { api.memberJobs().then(setJobs); }, []);
  if (!jobs) return <LoadingScreen />;
  return (
    <Screen>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Jobs Near You</div>
      {jobs.map((j) => (
        <Card key={j.job_id} onClick={() => push("jobDetail", { id: j.job_id })} style={{ marginBottom: 8, cursor: "pointer" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{j.title}</div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{j.job_type} • {j.village_name} • {j.pay}</div>
          {!!j.applied && <div style={{ marginTop: 6 }}><Chip>Applied</Chip></div>}
        </Card>
      ))}
    </Screen>
  );
}

function JobDetail({ id, onBack }) {
  const [jobs, setJobs] = useState(null);
  const [applied, setApplied] = useState(false);
  useEffect(() => { api.memberJobs().then(setJobs); }, []);
  if (!jobs) return <><TopBar title="Loading" onBack={onBack} /><LoadingScreen /></>;
  const j = jobs.find((x) => x.job_id === id);
  const isApplied = applied || !!j.applied;
  return (
    <>
      <TopBar title={j.title} onBack={onBack} />
      <Screen>
        <Card>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 6 }}>{j.job_type} • {j.village_name}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.teal }}>{j.pay}</div>
        </Card>
        <div style={{ marginTop: 16 }}>
          <Btn full disabled={isApplied} onClick={async () => { await api.applyJob(id); setApplied(true); }}>
            {isApplied ? <><CheckCircle2 size={13} /> Applied</> : "Apply Now"}
          </Btn>
        </div>
      </Screen>
    </>
  );
}

function ComplaintForm({ onBack }) {
  const [category, setCategory] = useState("Retailer issue");
  const [description, setDescription] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <>
      <TopBar title="Raise a complaint" onBack={onBack} />
      <Screen>
        {sent ? (
          <div style={{ textAlign: "center", paddingTop: 50 }}>
            <CheckCircle2 size={32} color={T.teal} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontWeight: 700 }}>Complaint submitted</div>
            <Btn full onClick={onBack} style={{ marginTop: 20 }}>Back to Profile</Btn>
          </div>
        ) : (
          <>
            <Field label="Category">
              <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Retailer issue</option><option>Membership issue</option><option>App issue</option>
              </select>
            </Field>
            <Field label="Describe the issue">
              <textarea style={{ ...inputStyle, height: 90 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened?" />
            </Field>
            <Btn full onClick={async () => { await api.raiseComplaint(category, description); setSent(true); }} disabled={!description}>
              <Send size={13} /> Submit
            </Btn>
          </>
        )}
      </Screen>
    </>
  );
}

function BuyPlan({ onBack, onDone }) {
  const [plans, setPlans] = useState(null);
  const [selected, setSelected] = useState(null);
  const [checkout, setCheckout] = useState(null); // the payment-request response, once a plan is picked
  const [error, setError] = useState("");
  useEffect(() => { api.plans().then(setPlans); }, []);
  if (!plans) return <><TopBar title="Loading" onBack={onBack} /><LoadingScreen /></>;

  const choose = async (plan) => {
    setSelected(plan); setError("");
    try {
      setCheckout(await api.membershipCheckout(plan.plan_id));
    } catch (e) { setError(e.message); }
  };

  if (checkout) {
    return (
      <BankTransferQR
        title={`Pay ₹${checkout.amount}`}
        subtitle={checkout.plan.name + " Membership"}
        checkout={checkout}
        onSubmitUtr={api.submitMembershipUtr}
        onBack={() => { setCheckout(null); setSelected(null); }}
        onDone={onDone}
      />
    );
  }

  return (
    <>
      <TopBar title="Choose your membership" onBack={onBack} />
      <Screen>
        {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {plans.map((p) => (
          <div key={p.plan_id} onClick={() => choose(p)} style={{ border: `2px solid ${T.line}`, borderRadius: 12, padding: 13, marginBottom: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: T.teal }}>₹{p.price}</div>
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 5 }}>{p.benefits.join(" • ")}</div>
          </div>
        ))}
      </Screen>
    </>
  );
}


function ProfileTab({ user, roles, push, onLogout }) {
  const [membership, setMembership] = useState(undefined);
  useEffect(() => { api.memberMembership().then((r) => setMembership(r.membership)); }, []);

  return (
    <Screen>
      <Card style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: T.tealLight, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: T.teal }}>
          {(user.full_name || "M").slice(0, 2).toUpperCase()}
        </div>
        <div><div style={{ fontSize: 14, fontWeight: 700 }}>{user.full_name}</div><div style={{ fontSize: 11, color: T.inkSoft }}>{user.phone}</div></div>
      </Card>

      {membership === undefined && <LoadingScreen text="" />}
      {membership === null && (
        <Card style={{ marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>No active membership yet.</div>
          <Btn full onClick={() => push("buyPlan")}>Buy Membership</Btn>
        </Card>
      )}
      {membership && (
        <div onClick={() => push("digitalCard")} style={{ cursor: "pointer", background: `linear-gradient(135deg, ${T.tealDark}, ${T.teal})`, borderRadius: 16, padding: 18, color: "#fff", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, opacity: 0.8 }}>GVCDA {membership.plan_name?.toUpperCase()}</div>
            <QrCode size={22} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 18, letterSpacing: 1.5 }}>{membership.card_number}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Valid till {membership.end_date}</div>
            <Chip>{membership.status}</Chip>
          </div>
        </div>
      )}

      <Btn full variant="ghost" onClick={() => push("complaint")} style={{ marginBottom: 8 }}><AlertCircle size={13} /> Raise a complaint</Btn>
      {!roles.includes("retailer") && (
        <Btn full variant="ghost" onClick={() => push("becomeRetailer")} style={{ marginBottom: 8 }}>
          <ShoppingCart size={13} /> Register your business (become a Retailer)
        </Btn>
      )}
      <ChangePasswordCard style={{ marginBottom: 8 }} />
      <Btn full variant="danger" onClick={onLogout}><LogOut size={13} /> Log out</Btn>
    </Screen>
  );
}

// Screen Spec 3.1 — self-service retailer onboarding path (the other path is
// employee-assisted, via EmployeeApp's List Retailer form). Reachable from any
// Member's Profile tab — the backend flips this account's active role to
// 'retailer' on submit, so onDone() (App.jsx's refreshSession) re-renders the
// whole app as RetailerApp, landing on its Pending Approval screen.
// Screen Spec Component 0 — full digital membership card with a real scannable
// QR code, shown at retailer point-of-sale for discount verification.
function DigitalCard({ user, onBack }) {
  const [membership, setMembership] = useState(undefined);
  useEffect(() => { api.memberMembership().then((r) => setMembership(r.membership)); }, []);

  if (membership === undefined) return <><TopBar title="Digital Membership Card" onBack={onBack} /><LoadingScreen /></>;

  return (
    <>
      <TopBar title="Digital Membership Card" onBack={onBack} />
      <Screen style={{ textAlign: "center" }}>
        <div style={{ background: T.tealDark, borderRadius: 20, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, letterSpacing: 1.5 }}>
              GVCDA {membership.plan_name?.toUpperCase()}
            </div>
            <Chip>{membership.status}</Chip>
          </div>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginTop: 26, letterSpacing: 1.5 }}>
            {membership.card_number}
          </div>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginTop: 18 }}>{user.full_name}</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 4 }}>
            Valid: {membership.start_date} → {membership.end_date}
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, marginTop: 24, display: "inline-block" }}>
          <QRCodeSVG value={JSON.stringify({ member_id: user.user_id, card_number: membership.card_number, expiry: membership.end_date })} size={140} />
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 14 }}>
          Show this to a retailer to verify your membership discount at checkout.
        </div>
      </Screen>
    </>
  );
}

function BecomeRetailer({ onBack, onDone }) {
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
      // Backend flipped this account's active role to 'retailer' and granted the
      // role — re-issue our token with that claim, then refetch roles so the
      // Role Switcher picks up 'retailer' too (not just the app shell).
      const res = await api.switchRole("retailer");
      saveSession(res.token, res.user);
      const me = await api.me();
      saveSession(res.token, me.user, me.roles);
      onDone();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };

  return (
    <>
      <TopBar title="Register your business" subtitle="Join the GVCDA retailer network" onBack={onBack} />
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
