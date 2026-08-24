const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "gvcda.db"));
db.pragma("foreign_keys = ON");

// ---------- SCHEMA ----------
db.exec(`
CREATE TABLE IF NOT EXISTS districts (
  district_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS mandals (
  mandal_id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id INTEGER NOT NULL REFERENCES districts(district_id),
  name TEXT NOT NULL,
  UNIQUE(district_id, name)
);

CREATE TABLE IF NOT EXISTS villages (
  village_id INTEGER PRIMARY KEY AUTOINCREMENT,
  mandal_id INTEGER NOT NULL REFERENCES mandals(mandal_id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'village',
  UNIQUE(mandal_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','employee','retailer','admin')),
  village_id INTEGER REFERENCES villages(village_id),
  designation TEXT,               -- for employees: district_manager/mandal_sub_manager/zonal_manager/volunteer
  territory_district_id INTEGER REFERENCES districts(district_id),
  territory_mandal_id INTEGER REFERENCES mandals(mandal_id),
  monthly_target INTEGER NOT NULL DEFAULT 50,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A user's phone/OTP session is one login, but the account can hold more than one
-- role at once (e.g. Member + Retailer). users.role is the "default/active" role
-- used for JWT claims after login; user_roles is the full set for the role switcher.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  role TEXT NOT NULL CHECK(role IN ('member','employee','retailer','admin')),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS membership_plans (
  plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  benefits TEXT   -- JSON array as text
);

CREATE TABLE IF NOT EXISTS memberships (
  membership_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  plan_id INTEGER NOT NULL REFERENCES membership_plans(plan_id),
  card_number TEXT UNIQUE NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','cancelled')),
  sold_by_employee_id INTEGER REFERENCES users(user_id),
  amount_paid REAL NOT NULL,
  payment_ref TEXT UNIQUE,   -- bank-transfer reference code (see payment_requests) — NULL for field-collected cash/UPI
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS retailer_categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS retailers (
  retailer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  business_name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES retailer_categories(category_id),
  village_id INTEGER NOT NULL REFERENCES villages(village_id),
  phone TEXT,
  address TEXT,
  hours TEXT,
  description TEXT,
  gstin TEXT,
  bank_account TEXT,
  bank_ifsc TEXT,
  upi_id TEXT,
  rejection_reason TEXT,
  onboarded_by TEXT NOT NULL DEFAULT 'self' CHECK(onboarded_by IN ('self','employee')),
  onboarding_employee_id INTEGER REFERENCES users(user_id),
  commission_pct REAL NOT NULL DEFAULT 8.0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
  rating_avg REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Storefront photos for a retailer listing (List Retailer / Business Registration
-- screens call for "photos", plural — Admin's approval queue and the member-facing
-- profile both show them). is_primary marks the one used as the listing's cover
-- image in retailer grids; if none is marked, the frontend just falls back to the
-- first row. Files themselves live on disk under backend/uploads/ (see lib/uploads.js).
CREATE TABLE IF NOT EXISTS retailer_photos (
  photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer_id INTEGER NOT NULL REFERENCES retailers(retailer_id),
  filename TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promotions (
  promotion_id INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer_id INTEGER NOT NULL REFERENCES retailers(retailer_id),
  title TEXT NOT NULL,
  discount_pct REAL NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all_products',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every order is Cash on Delivery: the retailer collects the full amount directly
-- from the member, so GVCDA never holds that money — the retailer instead OWES
-- GVCDA the commission on it. Same for membership purchases: the member pays
-- GVCDA directly via bank/UPI transfer (no payment gateway account exists yet).
-- Both flows funnel through this one table: an amount owed, a reference code that
-- rides along in the UPI transaction note so it's traceable on a bank statement,
-- an optional UTR the payer self-reports, and an Admin verifying it by hand
-- against the actual bank statement before anything is marked paid.
CREATE TABLE IF NOT EXISTS payment_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('membership','commission_settlement')),
  user_id INTEGER NOT NULL REFERENCES users(user_id),        -- who owes the money (member, or the retailer's account)
  plan_id INTEGER REFERENCES membership_plans(plan_id),       -- membership requests only
  retailer_id INTEGER REFERENCES retailers(retailer_id),      -- commission_settlement requests only
  amount REAL NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  utr TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','verified','rejected')),
  rejection_reason TEXT,
  verified_by INTEGER REFERENCES users(user_id),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer_id INTEGER NOT NULL REFERENCES retailers(retailer_id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  image_filename TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES users(user_id),
  retailer_id INTEGER NOT NULL REFERENCES retailers(retailer_id),
  status TEXT NOT NULL DEFAULT 'placed' CHECK(status IN ('placed','accepted','rejected','fulfilled','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK(payment_method IN ('cod')),
  order_total REAL NOT NULL,
  commission_pct REAL NOT NULL,
  commission_amt REAL NOT NULL,     -- what the retailer owes GVCDA (COD: retailer collects order_total in cash)
  payout_amt REAL NOT NULL,         -- what the retailer keeps: order_total - commission_amt
  commission_settled INTEGER NOT NULL DEFAULT 0,
  settlement_request_id INTEGER REFERENCES payment_requests(request_id),
  placed_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id INTEGER PRIMARY KEY AUTOINCREMENT,
  posted_by INTEGER REFERENCES users(user_id),
  title TEXT NOT NULL,
  job_type TEXT,
  description TEXT,
  village_id INTEGER REFERENCES villages(village_id),
  pay TEXT,
  is_open INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_applications (
  application_id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(job_id),
  member_id INTEGER NOT NULL REFERENCES users(user_id),
  status TEXT NOT NULL DEFAULT 'applied',
  UNIQUE(job_id, member_id)
);

CREATE TABLE IF NOT EXISTS complaints (
  complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
  raised_by INTEGER NOT NULL REFERENCES users(user_id),
  against_retailer_id INTEGER REFERENCES retailers(retailer_id),
  category TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','resolved','closed')),
  resolution_notes TEXT,
  resolved_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS field_visits (
  visit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES users(user_id),
  village_id INTEGER REFERENCES villages(village_id),
  purpose TEXT NOT NULL CHECK(purpose IN ('enrolment','retailer','follow_up','complaint')),
  notes TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS broadcasts (
  broadcast_id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  target_scope TEXT NOT NULL DEFAULT 'all' CHECK(target_scope IN ('all','district','mandal')),
  target_district_id INTEGER REFERENCES districts(district_id),
  target_mandal_id INTEGER REFERENCES mandals(mandal_id),
  sent_by INTEGER REFERENCES users(user_id),
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('draft','sent')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---------- SEED (idempotent) ----------
function seed() {
  const districtCount = db.prepare("SELECT COUNT(*) c FROM districts").get().c;
  if (districtCount > 0) { console.log("Already seeded."); return; }

  const insertDistrict = db.prepare("INSERT INTO districts (name) VALUES (?)");
  const insertMandal = db.prepare("INSERT INTO mandals (district_id, name) VALUES (?, ?)");
  const insertVillage = db.prepare("INSERT INTO villages (mandal_id, name, type) VALUES (?, ?, ?)");

  const LOCATIONS = {
    Hyderabad: { Amberpet: ["Amberpet Town"], Secunderabad: ["Marredpally", "Bowenpally"] },
    Rangareddy: { Shamshabad: ["Shamshabad", "Adibatla"], Ibrahimpatnam: ["Ibrahimpatnam", "Yacharam"] },
    Warangal: { Hanamkonda: ["Hanamkonda", "Kazipet"], Narsampet: ["Narsampet", "Duggondi"] },
    Nizamabad: { Bodhan: ["Bodhan", "Rajampet"], Armoor: ["Armoor", "Bibipet"] },
  };
  const villageIds = {}; // "Village Name" -> id (demo dataset has unique names)
  const mandalIds = {};  // "Mandal Name" -> id
  const districtIds = {}; // "District Name" -> id

  for (const [district, mandals] of Object.entries(LOCATIONS)) {
    const dId = insertDistrict.run(district).lastInsertRowid;
    districtIds[district] = dId;
    for (const [mandal, villages] of Object.entries(mandals)) {
      const mId = insertMandal.run(dId, mandal).lastInsertRowid;
      mandalIds[mandal] = mId;
      for (const v of villages) {
        const vId = insertVillage.run(mId, v, "village").lastInsertRowid;
        villageIds[v] = vId;
      }
    }
  }

  const insertPlan = db.prepare("INSERT INTO membership_plans (name, price, benefits) VALUES (?, ?, ?)");
  insertPlan.run("Basic", 499, JSON.stringify(["₹5L Insurance", "40% Discounts", "Digital Card"]));
  insertPlan.run("Standard", 1500, JSON.stringify(["Groceries ₹560", "₹5L Insurance", "40% Discounts", "Lab Tests"]));
  insertPlan.run("Premium", 2500, JSON.stringify(["Groceries ₹1,250", "₹5L Insurance", "40% Discounts", "Health Check-up"]));

  const insertCat = db.prepare("INSERT INTO retailer_categories (name) VALUES (?)");
  const cats = ["Education", "Grocery", "Business", "Health", "Electronics", "Agriculture", "Services", "Employment"];
  const catIds = {};
  cats.forEach((c) => { catIds[c] = insertCat.run(c).lastInsertRowid; });

  // Demo users
  const insertUser = db.prepare(
    "INSERT INTO users (phone, full_name, role, village_id, designation, territory_district_id, territory_mandal_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const addRole = db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)");

  const adminId = insertUser.run("9000000001", "Admin HQ", "admin", null, null, null, null).lastInsertRowid;
  addRole.run(adminId, "admin");

  const empId = insertUser.run("9000000002", "Suresh Reddy", "employee", villageIds["Amberpet Town"], "mandal_sub_manager", districtIds["Hyderabad"], mandalIds["Amberpet"]).lastInsertRowid;
  addRole.run(empId, "employee");

  const memberId = insertUser.run("9000000003", "Ramesh Kumar", "member", villageIds["Amberpet Town"], null, null, null).lastInsertRowid;
  addRole.run(memberId, "member");

  const retailerUserId = insertUser.run("9000000004", "Lakshmi Devi", "retailer", villageIds["Amberpet Town"], null, null, null).lastInsertRowid;
  addRole.run(retailerUserId, "retailer");

  // Demo membership for Ramesh
  db.prepare(
    "INSERT INTO memberships (user_id, plan_id, card_number, start_date, end_date, amount_paid, sold_by_employee_id) VALUES (?, 2, 'GVC-100234', date('now'), date('now','+365 days'), 1500, ?)"
  ).run(memberId, empId);

  // Demo approved retailer with products
  const retailerId = db.prepare(
    "INSERT INTO retailers (user_id, business_name, category_id, village_id, phone, address, hours, description, onboarded_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'self', 'approved')"
  ).run(retailerUserId, "Sri Lakshmi Grocery", catIds["Grocery"], villageIds["Amberpet Town"], "9000000004", "Main Road, Amberpet Town", "8:00 AM - 9:00 PM daily", "Your neighbourhood grocery store — fresh staples at member discount prices.").lastInsertRowid;

  const insertProduct = db.prepare("INSERT INTO products (retailer_id, name, price) VALUES (?, ?, ?)");
  insertProduct.run(retailerId, "Rice 5kg", 310);
  insertProduct.run(retailerId, "Toor Dal 1kg", 140);
  insertProduct.run(retailerId, "Cooking Oil 1L", 165);

  db.prepare(
    "INSERT INTO promotions (retailer_id, title, discount_pct, start_date, end_date, scope) VALUES (?, ?, ?, date('now'), date('now','+14 days'), 'all_products')"
  ).run(retailerId, "Festival Grocery Sale", 10);

  // Demo: a past commission settlement Lakshmi already paid GVCDA (COD model —
  // she collected cash from members directly, then settled the commission owed).
  db.prepare(
    `INSERT INTO payment_requests (type, user_id, retailer_id, amount, reference_code, utr, status, verified_by, verified_at, created_at)
     VALUES ('commission_settlement', ?, ?, 210, 'GVCDA-SET-DEMO01', 'UTR2608231400', 'verified', ?, date('now','-6 days'), date('now','-7 days'))`
  ).run(retailerUserId, retailerId, adminId);

  // A second retailer still pending approval (submitted by the employee)
  const retailer2UserPhone = "9000000005";
  const retailer2UserId = insertUser.run(retailer2UserPhone, "Venkat Rao", "retailer", villageIds["Amberpet Town"], null, null, null).lastInsertRowid;
  addRole.run(retailer2UserId, "retailer");
  db.prepare(
    "INSERT INTO retailers (user_id, business_name, category_id, village_id, phone, onboarded_by, onboarding_employee_id, status) VALUES (?, 'Venkat Electricals', ?, ?, ?, 'employee', ?, 'pending')"
  ).run(retailer2UserId, catIds["Services"], villageIds["Amberpet Town"], retailer2UserPhone, empId);

  // Demo dual-role account: Member who is also an approved Retailer — exercises the Role Switcher
  const dualUserId = insertUser.run("9000000006", "Padma Naidu", "member", villageIds["Marredpally"], null, null, null).lastInsertRowid;
  addRole.run(dualUserId, "member");
  addRole.run(dualUserId, "retailer");
  db.prepare(
    "INSERT INTO memberships (user_id, plan_id, card_number, start_date, end_date, amount_paid) VALUES (?, 1, 'GVC-100777', date('now'), date('now','+365 days'), 499)"
  ).run(dualUserId);
  const dualRetailerId = db.prepare(
    "INSERT INTO retailers (user_id, business_name, category_id, village_id, phone, address, onboarded_by, status) VALUES (?, 'Padma Tailoring & Services', ?, ?, ?, ?, 'self', 'approved')"
  ).run(dualUserId, catIds["Services"], villageIds["Marredpally"], "9000000006", "Near Bus Stop, Marredpally").lastInsertRowid;
  insertProduct.run(dualRetailerId, "Blouse Stitching", 250);
  insertProduct.run(dualRetailerId, "Alterations", 80);

  // Demo jobs
  db.prepare("INSERT INTO jobs (posted_by, title, job_type, description, village_id, pay) VALUES (?, ?, ?, ?, ?, ?)")
    .run(empId, "Daily Wage — Construction Helper", "Daily Wage", "General labour on a residential building site. Tools provided.", villageIds["Amberpet Town"], "₹600/day");
  db.prepare("INSERT INTO jobs (posted_by, title, job_type, description, village_id, pay) VALUES (?, ?, ?, ?, ?, ?)")
    .run(empId, "Retail Sales Associate", "Company Job", "Grocery store floor staff, customer service and billing.", villageIds["Marredpally"], "₹14,000/mo");

  // Demo field visit + complaint so those screens aren't empty on first look
  db.prepare("INSERT INTO field_visits (employee_id, village_id, purpose, notes) VALUES (?, ?, 'enrolment', ?)")
    .run(empId, villageIds["Amberpet Town"], "Enrolled Ramesh Kumar, Standard plan.");
  db.prepare("INSERT INTO complaints (raised_by, category, description) VALUES (?, 'Order Issue', ?)")
    .run(memberId, "Order was delayed by two days past the promised date.");

  console.log("Seed complete.");
  console.log("Demo phone numbers:");
  console.log("  Admin:    9000000001");
  console.log("  Employee: 9000000002 (Mandal Sub Manager, Amberpet)");
  console.log("  Member:   9000000003 (Ramesh Kumar, Standard plan)");
  console.log("  Retailer: 9000000004 (Sri Lakshmi Grocery, approved)");
  console.log("  Retailer: 9000000005 (Venkat Electricals, pending approval)");
  console.log("  Member+Retailer: 9000000006 (Padma Naidu / Padma Tailoring — try the role switcher)");
  console.log("OTP for all demo logins: 123456");
}

if (require.main === module && process.argv.includes("--seed")) {
  seed();
}

module.exports = { db, seed };
