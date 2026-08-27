# Google Play Store Listing — GVCDA App

Copy-paste ready content for Play Console → Store presence → Main store listing.

## App name
GVCDA — Village & City Development

*(Play Console limit: 30 characters. "GVCDA — Village & City Development" is 35 —
use just **"GVCDA App"** or **"GVCDA"** if the full name doesn't fit; Play Console
will reject it at submission time otherwise, so check the live character counter.)*

## Short description (max 80 characters)
```
Membership, retailer discounts, jobs & village services — all in one app
```
(74 characters)

## Full description (max 4000 characters)

```
GVCDA brings memberships, local retailer discounts, jobs, and community services
to one app — built for Members, Employees, and Retailers across Telangana's
villages and towns.

WHY GVCDA?

GVCDA is a community platform connecting members with local retailers, job
opportunities, and support services — organized by District, Mandal, and Village,
so everything you see is relevant to where you actually live.

FOR MEMBERS
• Get your digital membership card instantly after signing up
• Browse local retailers and shops near your village, by category — grocery,
  electronics, health, education, and more
• Order from local retailers with Cash on Delivery — no online payment needed
• Track your orders from placed to delivered
• Browse and apply to local job listings
• Raise complaints and get them resolved by your local team
• Enjoy member discounts and benefits at partner retailers

FOR RETAILERS
• Register your business and get approved to list your shop
• Add your products and manage your catalogue
• Receive and fulfill orders from members near you
• Track your earnings and settle commission with GVCDA directly
• Run promotions and discounts for members
• Upload photos of your storefront and products

FOR EMPLOYEES (Field Staff)
• Enrol new members and onboard retailers in the field
• Track your monthly targets and incentives
• Log field visits with location
• View your enrolled members and retailers in one place

SAFE, TRANSPARENT PAYMENTS
Membership purchases and retailer commission settlements go through a simple,
transparent bank/UPI transfer — scan a QR code, pay through any UPI app you
already use, and your payment is verified against GVCDA's bank records. No
new payment app or wallet required, and GVCDA never asks for your card
details or UPI PIN.

YOUR PRIVACY MATTERS
GVCDA only asks for what it needs to serve you — your phone number, a
password you choose, and your village so we can show you what's relevant
nearby. Location (GPS) is only used by field staff to log visits — Members
and Retailers are never asked for GPS location. Read our full Privacy Policy
in the app or at the link on this listing.

Join GVCDA today and connect with your community — memberships, retailers,
jobs, and support, all in one place.
```
(character count: ~1,850 — well under the 4,000 limit)

## Category
**Business** (alternative: "Lifestyle" if Business doesn't fit your preference —
Business is the better match given membership/commerce/job-listing features)

## Tags / keywords (for ASO, not a Play Console field but useful when writing
the description — already woven into the text above)
membership, village, community, retailer, discounts, jobs, Telangana, local
business, digital card

## Content rating questionnaire — expected answers
- Violence: None
- Sexual content: None
- Profanity: None
- Controlled substances: None
- Gambling: None
- User-generated content: Yes (retailer product listings/photos, complaint text)
  — moderated by Admin approval queue before retailers go live
- Personal info shared with other users: Retailer business info is public by
  design (name, location, products); member personal info is not shared
  publicly
- Expected rating: **Everyone** or **Everyone 10+** depending on Google's final
  questionnaire flow — no mature content anywhere in the app

## Data safety section — what to declare
Based on what the app's code actually collects (see PRIVACY_POLICY.md):
- **Personal info**: Name, phone number — collected, required for account
  functionality, not shared with third parties, encrypted in transit
- **Location**: Approximate/precise location — collected only from Employee
  accounts for field-visit logging, not shared with third parties
- **Photos**: Collected from Retailer accounts (storefront/product images),
  used for app functionality, not shared with third parties
- **Financial info**: Payment reference codes (UTR) — collected for payment
  verification only; **no card numbers, UPI PINs, or bank credentials are
  ever collected**
- Data is encrypted in transit (HTTPS/TLS)
- Users can request account deletion (mention this in the data safety form's
  "data deletion" question — contact info@gvcdaservicehub.com)

## Privacy Policy URL
```
https://santhoshgr3.github.io/APP/
```

## Assets checklist
- [x] App icon (512×512) — `mobile/assets/icon.png`
- [x] Adaptive icon (Android) — `mobile/assets/android-icon-*.png`
- [ ] Feature graphic (1024×500) — see `mobile/assets/feature-graphic.png`
      (generated separately, review before uploading)
- [ ] Phone screenshots (min 2, ideally 4-8, 16:9 or taller) — capture from
      a real device/emulator running the built app once `eas build` is done;
      the web app's phone-frame preview can serve as a placeholder reference
      but Play Store screenshots should be the actual mobile app
