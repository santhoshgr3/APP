# Go-Live Checklist

Everything in this app is now built so that **dropping in real credentials is the
only thing standing between "demo" and "live."** No code changes needed for any
item below — just environment variables and account setup. This doc is the honest,
complete list of what that takes: what I (Claude) can do in this session versus
what only you can do (business KYC, paid accounts, phone-verified signups).

## 1. Payments — direct bank/UPI transfer (no payment gateway)

There's no Razorpay/Cashfree account, so this is genuinely live already, not
waiting on any third party:

- **Retailer orders are Cash on Delivery.** The retailer collects the full
  amount directly from the member — GVCDA never touches that money, so no
  gateway is needed for orders at all. The retailer instead owes GVCDA the
  commission on it (see below).
- **Membership purchases and commission settlements** both go through
  `backend/lib/payments.js`: it builds a UPI deep link + QR code from the real
  GVCDA account in `backend/lib/bankDetails.js` (account ...1138, YES Bank).
  The payer scans it, pays with any UPI app, and reports the UTR
  (`backend/lib/paymentRequests.js`). An Admin verifies that UTR against the
  actual bank statement in the web dashboard's **Payment Verification** tab
  before the membership activates or the settlement is marked paid.

**What you need to do:** nothing to go live — the real account is already wired
in. The only reason this stays partly manual is that verification is by a human
looking at the bank statement, not an API. Two ways to reduce that manual work
later, if volume grows enough to justify it:

1. **Bank statement API / SMS parsing**: some Indian banks (including YES Bank)
   offer an account-statement API for business accounts — wiring that up would
   let `routes/admin.js`'s payment-request queue auto-match incoming credits by
   amount + reference code, cutting manual verification to just the ones that
   don't match cleanly. That's a real integration project, not a quick add.
2. **A payment gateway account eventually** (Razorpay/Cashfree) — once you have
   one, the checkout screens (`MemberApp.jsx`'s `BuyPlan`, `RetailerApp.jsx`'s
   `EarningsTab`) can be pointed at a hosted checkout instead of a QR code,
   removing the manual verification step entirely. Not needed to operate today.

**Retailer commission settlement** works the same way, in reverse: the retailer
already holds the cash (COD), so they pay GVCDA the commission owed via the
same QR/bank-transfer flow from their Earnings screen's "Settle Now" button.
`orders.commission_settled` and the `payment_requests` table (type
`commission_settlement`) track what's been paid.

## 2. SMS OTP

**What the code already does:** `backend/lib/sms.js` has working MSG91 and Twilio
integrations, real HTTP calls with correct auth. Falls back to logging the OTP
(never sends real SMS) when neither is configured.

**What you need to do — pick one:**

**MSG91** (India, cheapest for Indian numbers, but has a mandatory regulatory step):
1. Sign up at [msg91.com](https://msg91.com).
2. **DLT registration** (required by Indian telecom law for any transactional/OTP
   SMS): register as a Principal Entity on your telecom operator's DLT platform
   (or MSG91 can do this for you), then register your OTP message template and
   get a Template ID. This step alone can take 3–7 days and needs a GST number.
3. Set in `backend/.env`: `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID`.

**Twilio** (simpler signup, more expensive per SMS, works internationally):
1. Sign up at [twilio.com](https://twilio.com), buy a phone number.
2. Set in `backend/.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.

Either way, OTPs become real random 6-digit codes the moment a provider is
configured (see `generateOtp()` in `routes/auth.js`) — the fixed `123456` is only
ever used when nothing is configured.

## 3. Hosting the backend

The backend is a plain Express app (`backend/server.js`) — deploy it anywhere that
runs Node 18+:

- **Simplest**: [Render](https://render.com) or [Railway](https://railway.app) —
  connect the repo, set the root to `gvcda-app/backend`, build command
  `npm install`, start command `npm start`, add the `.env` vars in their dashboard.
  Both give you a persistent disk you can point `DB_PATH` at (see below).
- **More control**: a small VPS (DigitalOcean/AWS Lightsail), run with
  [PM2](https://pm2.keymetrics.io/) (`pm2 start server.js --name gvcda-backend`)
  behind Nginx as a reverse proxy for TLS.

**Database**: SQLite (current setup) is genuinely fine in production at this
app's expected scale — it's not a toy choice — as long as the `.db` file lives on
**persistent** disk (not container ephemeral storage) and you back it up. Use
[Litestream](https://litestream.io/) to continuously stream backups to S3/GCS for
free, or just cron a daily copy somewhere safe. Only move to PostgreSQL if you
outgrow single-writer throughput (unlikely until you're at real regional scale) —
the schema in `backend/db.js` translates to Postgres almost column-for-column if
that day comes.

**Required env vars in production** (`backend/.env`, see `backend/.env.example`):
```
NODE_ENV=production
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
CORS_ORIGIN=https://app.gvcdaservicehub.com
```
The backend **will refuse to boot** without `JWT_SECRET` in production, and will
refuse to fake OTP/payments in production if you haven't configured a real
provider — this is deliberate, so you can't accidentally ship the demo mode.

## 4. Hosting the web app

`frontend/` is a static Vite build:
```bash
cd frontend
echo "VITE_API_URL=https://api.gvcdaservicehub.com" > .env.production
npm run build        # outputs frontend/dist
```
Deploy `dist/` to [Vercel](https://vercel.com), [Netlify](https://netlify.com), or
any static host / CDN. Point your domain at it, and make sure `CORS_ORIGIN` on the
backend includes that domain.

## 5. Publishing the mobile app

The mobile app is Expo-managed — build and submit through
[EAS](https://docs.expo.dev/eas/), no Mac required even for iOS:

```bash
cd mobile
npx eas login
npx eas build:configure          # links this project to an Expo account
npx eas build --platform all --profile production
npx eas submit --platform all --profile production
```

`eas.json` (already set up) bakes `EXPO_PUBLIC_API_URL` into the build per
profile — update the URLs in it to your real domains first.

**Accounts you need** (these are the parts only you can do — they require your
legal identity/business and payment):
- **Apple Developer Program** — $99/year, apple.com/developer, needs a legal
  entity or individual identity verified by Apple (can take a few days).
- **Google Play Console** — $25 one-time, play.google.com/console.
- Both stores require a **Privacy Policy URL** (mandatory given this app collects
  location and payment data) and **app store listing assets** — screenshots, a
  feature graphic, and a short/long description. None of that exists yet; it's
  content work, not code, but it blocks submission.
- Confirm you actually own/control the identifiers I picked as placeholders in
  `mobile/app.json`: `com.gvcdaservicehub.app` for both iOS bundle ID and Android
  package name. These are **permanent once published** — change them now if you'd
  rather use something else.

## 6. Before you flip the switch — a short pre-launch pass

- [ ] Swap the seed data's 4-district demo location set for the full Telangana
      LGD (Local Government Directory) dataset from data.gov.in — `backend/db.js`'s
      `seed()` function is where the 4 districts are hardcoded.
- [ ] Set real commission percentages per retailer category (currently a flat 8%
      default on every retailer — `commission_pct` on the `retailers` table).
- [ ] Decide real incentive rates for field employees (currently ₹50/membership,
      ₹150/retailer — `routes/employee.js`, `INCENTIVE_PER_MEMBERSHIP`/`_RETAILER`).
- [ ] Retailer/product photo upload isn't wired yet (no file storage integration) —
      add S3/GCS + multipart upload handling if you need it before launch, or ship
      without photos for v1 and add it after.
- [ ] Run through the OTP rate limits (`routes/auth.js`) with your expected traffic
      in mind — 5 requests per 15 minutes per phone+IP is a reasonable default but
      tune it if it's too strict for your rollout (e.g. field employees enrolling
      many members from one IP/device in a day).
- [ ] Load-test if you expect a big-bang launch (a district-wide announcement, a
      TV/radio spot) rather than organic growth — SQLite + a single small server
      handles moderate concurrent load fine, but a sudden spike is a different
      question than steady growth.

## What I can't do for you

Signing up for MSG91/Twilio, Apple Developer, or Google Play requires your
business's legal identity and payment — none of that can be delegated to an AI
assistant, by design (these are exactly the kind of credential/account-creation
actions this assistant is built to refuse). Payments don't need a new signup —
your existing bank account is already wired in. Everything else — the code, the
config, the deployment steps — is done or ready to go the moment you have those
remaining credentials in hand.
