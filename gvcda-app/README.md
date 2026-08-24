# GVCDA App — Full-Stack Build (Web + Mobile)

A real, working build of the GVCDA multi-role app: **Member, Employee, and Retailer
share one login** (role resolved after phone+password login); **Admin** is a
separate web dashboard. This isn't a mockup — it's a live Express + Postgres
(Supabase) backend, a React web client, and a React Native (Expo) mobile app,
all talking to the same real REST API.

```
gvcda-app/
  backend/    Express API + Postgres (Supabase) — shared by both clients
  frontend/   React + Vite web app (Member/Employee/Retailer phone-frame + full Admin dashboard)
  mobile/     Expo React Native app (Member/Employee/Retailer) — see mobile/README.md
```

Start here: run the backend once, then either client (or both) against it.

**Going to production?** Read [GO_LIVE.md](GO_LIVE.md) — the honest, complete
checklist of what turns this from a demo into a real deployment: hosting and
app store submission. Payments are already fully real (see below) — no gateway
account needed, and auth needs no third-party provider either since it's
phone+password, not SMS OTP.

## What's actually implemented

- **Auth**: phone + password, rate-limited (10 login attempts/15min per phone+IP, 10 new accounts/hour per IP), passwords hashed with bcrypt, self-signup creates a Member account. Accounts can hold more than one role (e.g. Member + Retailer) — a **Role Switcher** re-issues the token with the new active role instead of a second login.
- **Location hierarchy**: District → Mandal → Village, seeded with a sample of real Telangana districts, served live via API (not hardcoded in either client)
- **Payments — real, no gateway needed**: membership purchases and retailer commission settlements are direct bank/UPI transfer — a QR code + UPI deep link built from GVCDA's actual account (`lib/bankDetails.js`, `lib/payments.js`), the payer reports their UTR, and an Admin verifies it against the bank statement in the web dashboard's Payment Verification queue (`lib/paymentRequests.js`) before anything activates. Retailer orders are Cash on Delivery — the retailer collects payment directly and owes GVCDA the commission, settled the same way.
- **Member**: registration, membership purchase (bank-transfer QR flow above), digital card, sector browsing scoped to the member's own village, retailer catalogue browsing, real cart → COD order flow, order tracking, jobs + apply, complaints
- **Employee**: dashboard with live targets, assisted member enrolment, retailer listing, "my book" of enrolled members/retailers, incentive breakdown, GPS field-visit log
- **Retailer**: self-registration → pending-approval gate → approved catalogue/orders/earnings. Order accept/reject/fulfil actually moves data through the database and recalculates commission owed. Business profile, bank/UPI payout details, promotions, and commission settlement are all live. Storefront photos and per-product images upload to Supabase Storage (local disk in dev — `lib/uploads.js`) and show up everywhere a retailer/product does — member browsing, Admin's approval queue, the retailer's own catalogue and profile.
- **Admin**: overview stats, payment verification queue, territory drill-down, retailer approval queue (with rejection reasons), employee performance leaderboard, revenue & commission reports, complaint desk, broadcast/notification tool, user & role management (create employee accounts, deactivate/reactivate)

Commission math, membership card numbers, order totals, incentive payouts — all computed server-side from real database rows, not faked in the UI.

## Project structure

```
gvcda-app/
  backend/          Express API + Postgres (Supabase)
    db.js           Schema + async query helpers (get/all/run) + seed data
    server.js        Entry point — security middleware, error handling, graceful shutdown
    routes/          auth, locations, member, employee, retailer, admin
    middleware/auth.js   JWT verification + role guards
    lib/             bankDetails.js + payments.js (UPI QR/bank transfer), paymentRequests.js (verification queue), memberships.js
    .env.example     Copy to .env and fill in for production (see ../GO_LIVE.md)
  frontend/         React + Vite app
    src/
      api.js         Thin fetch client for the backend
      App.jsx         Session bootstrap + role routing
      Login.jsx        Phone + password login/register screen
      MemberApp.jsx / EmployeeApp.jsx / RetailerApp.jsx / AdminApp.jsx
      LocationCascade.jsx   Live District/Mandal/Village picker
      ui.jsx          Shared design tokens & components
```

## Running it locally

You'll need Node.js 18+ and a Postgres database — the free tier of
[Supabase](https://supabase.com) works well and is what this app is built
against (Project → Settings → Database → Connection string).

**1. Backend**
```bash
cd backend
npm install
echo "DATABASE_URL=<your Supabase connection string>" > .env
npm run seed          # creates schema + seeds demo data (only needs to run once)
npm start              # runs on http://localhost:4000
```

**2. Frontend** (in a second terminal)
```bash
cd frontend
npm install
npm run dev           # runs on http://localhost:5173, proxies /api to the backend
```

Open `http://localhost:5173`. Log in with one of the seeded demo numbers below — password is always `gvcda123`.

| Phone | Role | Notes |
|---|---|---|
| 9000000001 | Admin | |
| 9000000002 | Employee | Mandal Sub Manager, Amberpet |
| 9000000003 | Member | Ramesh Kumar, Standard plan already active |
| 9000000004 | Retailer | Sri Lakshmi Grocery, already approved |
| 9000000005 | Retailer | Venkat Electricals, still pending — log in as Admin in another tab to approve it |
| 9000000006 | Member + Retailer | Try the Role Switcher (profile menu) — Padma Naidu / Padma Tailoring |
| any other 10-digit number | New Member | self-signup path |

Open two browser tabs (e.g. Member in one, Admin in the other) to see cross-role actions land live — place an order as the Member, accept it as the Retailer, approve a pending retailer as Admin and watch it show up for Members immediately.

**Mobile app**: see `mobile/README.md` — same backend, same demo accounts, run with `npx expo start` and open in Expo Go on your phone or press `w` for a browser preview.

## Extending this

The `Screen Specifications` document (delivered earlier) lists every screen this app should eventually have, organized by role — use it as your build checklist. Each backend route file maps cleanly to one section of that document:

- `routes/member.js` → Member app screens
- `routes/employee.js` → Employee app screens
- `routes/retailer.js` → Retailer app screens
- `routes/admin.js` → Admin screens

To add a screen: add the endpoint to the matching route file, add the query to `frontend/src/api.js`, and add a component to the matching `*App.jsx` file following the existing pattern (a component that calls `useEffect` + the API function, shows a `LoadingScreen` while waiting, and renders a `Screen` with `Card`s).

## Production hardening already in place

- **Security**: `helmet` security headers, `express-rate-limit` (global + a stricter limiter on login/register), CORS locked to `CORS_ORIGIN` in production, request logging (`morgan`), centralized JSON error handler (no stack traces leak to clients), graceful shutdown on `SIGTERM`.
- **Auth**: `JWT_SECRET` is required from the environment in production (the server refuses to boot without it) — see `middleware/auth.js`. Passwords are hashed with bcrypt (`routes/auth.js`), never stored or logged in plain text.
- **Payments**: real from the start — direct bank/UPI transfer against GVCDA's actual account, no gateway or mock mode involved (`lib/payments.js`, `lib/bankDetails.js`).

## What's left before a real launch

See [GO_LIVE.md](GO_LIVE.md) for the full checklist (accounts, hosting, app store submission). The short version of what's genuinely still missing from the code itself:

- **Full LGD dataset**: only 4 districts are seeded for the demo. Swap in the complete Telangana District/Mandal/Village dataset from data.gov.in's Local Government Directory (`backend/db.js`'s `seed()`).
- **Payment verification is manual**: an Admin cross-checks each UTR against the bank statement by hand (no gateway/webhook to auto-confirm) — fine at current scale, see GO_LIVE.md §1 for what'd reduce that as volume grows.
