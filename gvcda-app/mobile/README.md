# GVCDA Mobile App (Expo / React Native)

The real mobile client for Member, Employee and Retailer — one app, role resolved
after OTP login, exactly per the PRD's architecture. Admin stays a web dashboard
(see `../frontend`). Talks to the same backend as the web app (`../backend`).

## Running it

You need the backend running first (`cd ../backend && npm start`).

```bash
cd mobile
npm install
npx expo start
```

- Press `w` to open it in a browser (fastest way to check it works).
- Scan the QR code with the **Expo Go** app on your phone to run it on a real device.
- Press `a` / `i` for an Android/iOS emulator if you have one set up.

## Pointing it at your backend

The app defaults to `http://192.168.1.20:4000` (this dev machine's LAN IP at build
time). That only works for a physical phone on the same Wi-Fi network as this
computer, or for Expo web (which runs in the browser on this machine and can reach
localhost/LAN IPs fine).

If it's wrong for your setup:
1. Open the Login screen.
2. Tap the "Server: ..." line to expand it.
3. Type the correct address — e.g. `http://<your-computer's-LAN-IP>:4000`.

It's saved on-device (AsyncStorage), so you only need to set it once. Find your
computer's LAN IP with `ipconfig` (Windows) and make sure your phone is on the same
Wi-Fi network — `localhost` from a phone means the phone itself, not this computer.

## Demo accounts

Same seed data as the web app — OTP is always `123456`:

| Phone | Role |
|---|---|
| 9000000001 | Admin (use the web dashboard instead — mobile is Member/Employee/Retailer only) |
| 9000000002 | Employee — Mandal Sub Manager, Amberpet |
| 9000000003 | Member — Ramesh Kumar, Standard plan active |
| 9000000004 | Retailer — Sri Lakshmi Grocery, approved |
| 9000000005 | Retailer — Venkat Electricals, pending approval |
| 9000000006 | Member + Retailer — try the role switcher (Profile tab) |
| any other 10-digit number | New Member self-signup path |

## What's implemented

Every screen from the Screen Specification doc for Member, Employee and Retailer:

- **Shared**: Splash, Login/OTP, Registration + location picker, Plan selection,
  Payment (real bank/UPI-transfer QR flow, see below), Role Switcher (Profile
  tab, dual-role accounts only)
- **Member**: Home (sectors + nearby retailers + digital card), Sector detail,
  Retailer profile + ordering, Cart/checkout (Cash on Delivery), Order tracking
  (status stepper), Jobs list + detail + apply, Complaints, Digital card with a
  real scannable QR code
- **Employee**: Dashboard (targets vs achieved), Enrol member, List retailer,
  My Book (members/retailers), Incentives & earnings, Field visit log (GPS check-in
  with manual-village fallback if permission is denied)
- **Retailer**: Business registration, Pending-approval screen (polls status),
  Home dashboard, Orders inbox (accept/reject/fulfil), Order detail with COD
  commission breakdown, Catalogue manager with per-product photo upload,
  Earnings + commission settlement (same QR flow as membership payment),
  Business profile + storefront photo gallery + promotions + bank/UPI details

### Payments — bank/UPI transfer, no gateway

There's no Razorpay/Cashfree account, so membership purchases and commission
settlements both work the same way: the backend (`lib/payments.js`) builds a UPI
deep link + QR code from GVCDA's real receiving account, the screen shows it via
`components/BankTransferQR.js`, the payer scans it and pays with any UPI app,
then reports their UTR. An Admin verifies that against the bank statement in the
**web** dashboard's Payment Verification tab (this app doesn't have an Admin
role) before the membership activates or settlement is marked paid. Retailer
orders are Cash on Delivery — no payment step in the app at all, the retailer
just collects cash and later settles commission the same QR way.

## Project structure

```
mobile/
  App.js                    Providers (Auth, Cart) + navigation root
  src/
    api.js                  Fetch client — mirrors frontend/src/api.js, plus a
                             configurable server URL for Expo Go on a phone
    theme.js                Same color tokens as the web app
    context/                AuthContext (session/role-switch), CartContext
    components/             Shared UI kit (Screen, Card, Btn, Chip, ...),
                             LocationCascade, RoleSwitcherCard
    navigation/              RootNavigator (flat stack) + one Tab navigator
                             per role (MemberTabs/EmployeeTabs/RetailerTabs)
    screens/                 One file per Screen-Spec screen, grouped by role
```

## Known limits (same as the web app's backend)

- OTP is fixed at `123456` (dev mode) — configure `MSG91_*`/`TWILIO_*` env vars on the backend for real SMS delivery in production.
- Payment verification is manual — an Admin checks each UTR against the bank statement by hand (no gateway/webhook to auto-confirm).
