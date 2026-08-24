import AsyncStorage from "@react-native-async-storage/async-storage";

// EXPO_PUBLIC_API_URL is baked in at build time (set it in eas.json per profile —
// see mobile/eas.json) so a real app-store build points at your production
// backend by default. Without it, this falls back to a guess at the dev machine's
// LAN IP so Expo Go on a phone can reach a locally-running backend out of the box.
// If that guess is wrong, open the Login screen's "Server" field and change it —
// it's saved on-device and always wins over both of these.
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.20:4000";

let cachedBase = null;
export async function getApiUrl() {
  if (cachedBase) return cachedBase;
  const stored = await AsyncStorage.getItem("gvcda_api_url");
  cachedBase = stored || DEFAULT_API_URL;
  return cachedBase;
}
export async function setApiUrl(url) {
  cachedBase = url;
  await AsyncStorage.setItem("gvcda_api_url", url);
}

async function getToken() {
  return AsyncStorage.getItem("gvcda_token");
}

// AuthContext registers a callback here on mount. A 401 means the token itself is
// invalid/expired — every screen must treat that as "log out", never as "this
// resource doesn't exist yet" (a retailer's expired session used to get silently
// redirected to re-registration instead of back to Login — this is what fixes that).
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const base = await getApiUrl();
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`Can't reach the server at ${base}. Check the Server address on the login screen and that the backend is running.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth && onUnauthorized) onUnauthorized();
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  requestOtp: (phone) => request("/auth/request-otp", { method: "POST", body: { phone }, auth: false }),
  verifyOtp: (phone, otp, full_name) => request("/auth/verify-otp", { method: "POST", body: { phone, otp, full_name }, auth: false }),
  me: () => request("/auth/me"),
  switchRole: (role) => request("/auth/switch-role", { method: "POST", body: { role } }),

  // locations
  districts: () => request("/locations/districts", { auth: false }),
  mandals: (district_id) => request(`/locations/mandals?district_id=${district_id}`, { auth: false }),
  villages: (mandal_id) => request(`/locations/villages?mandal_id=${mandal_id}`, { auth: false }),
  categories: () => request("/locations/categories", { auth: false }),
  plans: () => request("/locations/plans", { auth: false }),

  // member
  memberProfile: (payload) => request("/member/profile", { method: "PATCH", body: payload }),
  memberHome: () => request("/member/home"),
  memberMembership: () => request("/member/membership"),
  membershipCheckout: (plan_id) => request("/member/membership/checkout", { method: "POST", body: { plan_id } }),
  submitMembershipUtr: (request_id, utr) => request("/member/membership/submit-utr", { method: "POST", body: { request_id, utr } }),
  memberRetailers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/member/retailers${qs ? "?" + qs : ""}`);
  },
  memberRetailerDetail: (id) => request(`/member/retailers/${id}`),
  placeOrder: (retailer_id, items) => request("/member/orders", { method: "POST", body: { retailer_id, items } }),
  memberOrders: () => request("/member/orders"),
  memberOrderDetail: (id) => request(`/member/orders/${id}`),
  memberJobs: () => request("/member/jobs"),
  applyJob: (id) => request(`/member/jobs/${id}/apply`, { method: "POST" }),
  raiseComplaint: (category, description, against_retailer_id) =>
    request("/member/complaints", { method: "POST", body: { category, description, against_retailer_id } }),
  memberComplaints: () => request("/member/complaints"),

  // employee
  employeeDashboard: () => request("/employee/dashboard"),
  enrolMember: (payload) => request("/employee/enrol-member", { method: "POST", body: payload }),
  listRetailer: (payload) => request("/employee/list-retailer", { method: "POST", body: payload }),
  employeeMembers: () => request("/employee/members"),
  employeeRetailers: () => request("/employee/retailers"),
  employeeIncentives: () => request("/employee/incentives"),
  employeeVisits: () => request("/employee/visits"),
  logVisit: (payload) => request("/employee/visits", { method: "POST", body: payload }),

  // retailer
  retailerRegister: (payload) => request("/retailer/register", { method: "POST", body: payload }),
  retailerMe: () => request("/retailer/me"),
  retailerProducts: () => request("/retailer/products"),
  addProduct: (name, price) => request("/retailer/products", { method: "POST", body: { name, price } }),
  updateProduct: (id, payload) => request(`/retailer/products/${id}`, { method: "PATCH", body: payload }),
  deleteProduct: (id) => request(`/retailer/products/${id}`, { method: "DELETE" }),
  retailerOrders: (status) => request(`/retailer/orders${status ? "?status=" + status : ""}`),
  retailerOrderDetail: (id) => request(`/retailer/orders/${id}`),
  updateOrderStatus: (id, status) => request(`/retailer/orders/${id}`, { method: "PATCH", body: { status } }),
  retailerEarnings: () => request("/retailer/earnings"),
  commissionCheckout: () => request("/retailer/commission/checkout", { method: "POST" }),
  submitCommissionUtr: (request_id, utr) => request("/retailer/commission/submit-utr", { method: "POST", body: { request_id, utr } }),
  commissionRequests: () => request("/retailer/commission/requests"),
  updateRetailerProfile: (payload) => request("/retailer/profile", { method: "PATCH", body: payload }),
  retailerPromotions: () => request("/retailer/promotions"),
  createPromotion: (payload) => request("/retailer/promotions", { method: "POST", body: payload }),
  togglePromotion: (id, is_active) => request(`/retailer/promotions/${id}`, { method: "PATCH", body: { is_active } }),
};

export async function saveSession(token, user, roles) {
  await AsyncStorage.setItem("gvcda_token", token);
  await AsyncStorage.setItem("gvcda_user", JSON.stringify(user));
  if (roles) await AsyncStorage.setItem("gvcda_roles", JSON.stringify(roles));
}
export async function getSession() {
  const token = await AsyncStorage.getItem("gvcda_token");
  const userRaw = await AsyncStorage.getItem("gvcda_user");
  const rolesRaw = await AsyncStorage.getItem("gvcda_roles");
  if (!token || !userRaw) return null;
  const user = JSON.parse(userRaw);
  return { token, user, roles: rolesRaw ? JSON.parse(rolesRaw) : [user.role] };
}
export async function clearSession() {
  await AsyncStorage.multiRemove(["gvcda_token", "gvcda_user", "gvcda_roles"]);
}
