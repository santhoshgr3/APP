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

## 3. The database — Supabase Postgres

The backend runs on Postgres, not SQLite — `backend/db.js` connects via
`DATABASE_URL` and every route queries through `pg`. This means the backend
itself is fully stateless (no local disk needed at all), so it can run on
Render's **free** tier.

1. In your [Supabase](https://supabase.com) project → **Settings → Database →
   Connection string**, copy the **URI** (Session pooler works fine).
2. Set `DATABASE_URL` to that string wherever the backend runs (see §4 below
   for Render specifically).
3. Schema creation is automatic — `db.js` runs `CREATE TABLE IF NOT EXISTS`
   for everything on every boot, so there's no separate migration step.
4. Seed demo data once: `npm run seed` (safe to re-run — it's a no-op once
   `districts` has rows).

Backups and point-in-time recovery are Supabase's job at that point — no
Litestream/cron setup needed like a self-hosted SQLite file would require.

## 4. Hosting the backend — Render

The backend is a plain Express app (`backend/server.js`). This repo ships a
`render.yaml` blueprint at the repo root pre-wired for it:

1. Push this repo to GitHub (already done — `github.com/santhoshgr3/APP`).
2. In the [Render dashboard](https://dashboard.render.com), **New → Blueprint**,
   pick this repo. Render reads `render.yaml` and creates the `gvcda-backend`
   web service on the **free** tier — no disk needed since the database lives
   in Supabase.
3. Render generates `JWT_SECRET` for you automatically (`generateValue: true`
   in the blueprint). Fill in the rest it left blank in the dashboard's
   Environment tab:
   - `DATABASE_URL` → from §3 above
   - `CORS_ORIGIN` → your Vercel URL, e.g. `https://gvcda.vercel.app`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` → see §4a below
   - `MSG91_*` or `TWILIO_*` → only once you're ready for real SMS (see §2)

No blueprint? You can set this up by hand instead — connect the repo, set
**Root Directory** to `gvcda-app/backend`, build command `npm install`, start
command `npm start`, plus the env vars above.

**Required env vars in production** (`backend/.env`, see `backend/.env.example`
— all pre-filled by `render.yaml` if you used the blueprint):
```
NODE_ENV=production
DATABASE_URL=<your Supabase connection string>
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
CORS_ORIGIN=https://gvcda.vercel.app
```
The backend **will refuse to boot** without `DATABASE_URL` or `JWT_SECRET` in
production, and will refuse to fake OTP/payments without a real provider
configured — this is deliberate, so you can't accidentally ship the demo mode.

### 4a. Photo storage — Supabase Storage

Retailer storefront and product photos go through `backend/lib/uploads.js`,
which has two modes:
- **Local dev (default, zero setup)**: files save to `backend/uploads/` on
  disk and serve back out at `/uploads/<filename>`. This is what you've been
  testing against and it's what stays active if `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` are unset.
- **Production (Supabase Storage)**: set both env vars and every upload goes
  straight to Supabase's own CDN instead — no dependency on Render's disk for
  this, and it scales past one backend instance if you ever need that.

To turn it on:
1. In your [Supabase](https://supabase.com) project → **Storage**, create a
   new bucket named `gvcda-photos` (or pick your own name and set
   `SUPABASE_BUCKET` to match) and mark it **Public** — photos need to load
   directly in `<img>` tags without a signed URL.
2. Project Settings → API → copy the **Project URL** and the **service_role**
   secret key (not the `anon` key — uploads need the elevated one).
3. Set on Render: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`.

That's the entire integration — no other code changes needed, and every route
that touches photos already calls only the functions this one file exports.

## 5. Hosting the web app — Vercel

1. In [Vercel](https://vercel.com), **Add New → Project**, import
   `github.com/santhoshgr3/APP`.
2. Set **Root Directory** to `gvcda-app/frontend` (this is a monorepo — Vercel
   needs to know the actual app lives one level down). Leave the Build/Install/
   Output Command overrides off — Vite's own defaults (`npm install`,
   `npm run build`, `dist`) are correct once Root Directory is set.
3. Add one environment variable: `VITE_API_URL` → your Render backend URL,
   e.g. `https://gvcda-backend.onrender.com`.
4. Deploy. Then go back to Render and set `CORS_ORIGIN` to whatever domain
   Vercel gave you (or your custom domain once you attach one).

## 6. Publishing the mobile app

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

## 7. Before you flip the switch — a short pre-launch pass

- [ ] Swap the seed data's 4-district demo location set for the full Telangana
      LGD (Local Government Directory) dataset from data.gov.in — `backend/db.js`'s
      `seed()` function is where the 4 districts are hardcoded.
- [ ] Set real commission percentages per retailer category (currently a flat 8%
      default on every retailer — `commission_pct` on the `retailers` table).
- [ ] Decide real incentive rates for field employees (currently ₹50/membership,
      ₹150/retailer — `routes/employee.js`, `INCENTIVE_PER_MEMBERSHIP`/`_RETAILER`).
- [ ] Run through the OTP rate limits (`routes/auth.js`) with your expected traffic
      in mind — 5 requests per 15 minutes per phone+IP is a reasonable default but
      tune it if it's too strict for your rollout (e.g. field employees enrolling
      many members from one IP/device in a day).
- [ ] Load-test if you expect a big-bang launch (a district-wide announcement, a
      TV/radio spot) rather than organic growth — Supabase's free tier Postgres
      handles moderate concurrent load fine, but a sudden spike is a different
      question than steady growth; upgrade the Supabase plan if you expect one.

## What I can't do for you

Signing up for MSG91/Twilio, Apple Developer, or Google Play requires your
business's legal identity and payment — none of that can be delegated to an AI
assistant, by design (these are exactly the kind of credential/account-creation
actions this assistant is built to refuse). Payments don't need a new signup —
your existing bank account is already wired in. Everything else — the code, the
config, the deployment steps — is done or ready to go the moment you have those
remaining credentials in hand.
