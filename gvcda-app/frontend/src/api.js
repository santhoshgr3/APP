// In dev, Vite's proxy (vite.config.js) forwards /api -> the local backend, so the
// default is fine as-is. In a production build there's no dev proxy, so set
// VITE_API_URL to your real backend's URL (e.g. https://api.gvcdaservicehub.com)
// at build time — see README.md "Go-Live Checklist".
const BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("gvcda_token");
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// Separate from request() because file uploads must NOT set a JSON Content-Type —
// the browser needs to set its own multipart boundary on the FormData body.
async function requestForm(path, formData, method = "POST") {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// Photos are stored as either a full Supabase Storage URL (production) or a
// bare filename served by the backend's own /uploads route (local dev fallback
// — see backend/lib/uploads.js). Handle both without the caller needing to care.
export function photoUrl(filename) {
  if (!filename) return null;
  return /^https?:\/\//.test(filename) ? filename : `${BASE}/uploads/${filename}`;
}

export const api = {
  // auth
  register: (phone, password, full_name) => request("/auth/register", { method: "POST", body: { phone, password, full_name }, auth: false }),
  login: (phone, password) => request("/auth/login", { method: "POST", body: { phone, password }, auth: false }),
  me: () => request("/auth/me"),
  switchRole: (role) => request("/auth/switch-role", { method: "POST", body: { role } }),
  changePassword: (current_password, new_password) => request("/auth/change-password", { method: "POST", body: { current_password, new_password } }),

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
  membershipRequests: () => request("/member/membership/requests"),
  memberRetailers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/member/retailers${qs ? "?" + qs : ""}`);
  },
  memberRetailerDetail: (id) => request(`/member/retailers/${id}`),
  placeOrder: (retailer_id, items) => request("/member/orders", { method: "POST", body: { retailer_id, items } }),
  memberOrders: () => request("/member/orders"),
  memberJobs: () => request("/member/jobs"),
  applyJob: (id) => request(`/member/jobs/${id}/apply`, { method: "POST" }),
  raiseComplaint: (category, description, against_retailer_id) => request("/member/complaints", { method: "POST", body: { category, description, against_retailer_id } }),
  memberComplaints: () => request("/member/complaints"),
  memberOrderDetail: (id) => request(`/member/orders/${id}`),

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
  retailerPhotos: () => request("/retailer/photos"),
  uploadRetailerPhotos: (files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append("photos", f));
    return requestForm("/retailer/photos", fd);
  },
  setPrimaryPhoto: (id) => request(`/retailer/photos/${id}`, { method: "PATCH", body: { is_primary: true } }),
  deleteRetailerPhoto: (id) => request(`/retailer/photos/${id}`, { method: "DELETE" }),
  uploadProductImage: (productId, file) => {
    const fd = new FormData();
    fd.append("image", file);
    return requestForm(`/retailer/products/${productId}/image`, fd);
  },
  deleteProductImage: (productId) => request(`/retailer/products/${productId}/image`, { method: "DELETE" }),

  // admin
  adminOverview: () => request("/admin/overview"),
  pendingRetailers: () => request("/admin/retailers/pending"),
  reviewRetailer: (id, status, reason) => request(`/admin/retailers/${id}`, { method: "PATCH", body: { status, reason } }),
  territory: () => request("/admin/territory"),
  employeePerformance: () => request("/admin/employees"),
  complaints: () => request("/admin/complaints"),
  updateComplaint: (id, status, resolution_notes) => request(`/admin/complaints/${id}`, { method: "PATCH", body: { status, resolution_notes } }),
  adminRevenue: () => request("/admin/revenue"),
  adminSectors: () => request("/admin/sectors"),
  broadcasts: () => request("/admin/broadcasts"),
  sendBroadcast: (payload) => request("/admin/broadcasts", { method: "POST", body: payload }),
  adminUsers: () => request("/admin/users"),
  addEmployee: (payload) => request("/admin/users", { method: "POST", body: payload }),
  paymentRequests: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/payment-requests${qs ? "?" + qs : ""}`);
  },
  resolvePaymentRequest: (id, approve, reason) => request(`/admin/payment-requests/${id}`, { method: "PATCH", body: { approve, reason } }),
  toggleUser: (id, is_active) => request(`/admin/users/${id}`, { method: "PATCH", body: { is_active } }),
};

export function saveSession(token, user, roles) {
  localStorage.setItem("gvcda_token", token);
  localStorage.setItem("gvcda_user", JSON.stringify(user));
  if (roles) localStorage.setItem("gvcda_roles", JSON.stringify(roles));
}
export function getSession() {
  const token = localStorage.getItem("gvcda_token");
  const userRaw = localStorage.getItem("gvcda_user");
  const rolesRaw = localStorage.getItem("gvcda_roles");
  return token && userRaw ? { token, user: JSON.parse(userRaw), roles: rolesRaw ? JSON.parse(rolesRaw) : [JSON.parse(userRaw).role] } : null;
}
export function clearSession() {
  localStorage.removeItem("gvcda_token");
  localStorage.removeItem("gvcda_user");
}
