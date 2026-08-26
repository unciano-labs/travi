# Payment & Monetization Integration

This document outlines the architecture, flow, and business logic for how payments are processed, how the platform earns revenue, and how organizers cash out.

> **Stack:** Stripe Connect (Destination Charges) + Next.js App Router API Routes

---

## 1. Business Model (Monetization)
The platform uses a **commission-based model**:
- **Platform Fee (Commission)**: The platform takes a `10%` cut of the total booking amount automatically at checkout.
- **Organizer Revenue**: The organizer receives the remaining `90%` of the booking amount.

*Example*: If a traveler books a tour for **$100**:
- Platform receives **$10.00** (Platform Fee).
- Organizer receives **$90.00** (minus standard Stripe processing fees).

---

## 2. Architecture: Stripe Connect
The platform utilizes **Stripe Connect Express** for multi-party payments. 

### Why Stripe Connect?
- **Automated Payouts**: The platform does not need to manually transfer funds or manage a complex internal ledger.
- **Compliance**: Stripe handles KYC (Know Your Customer) and tax reporting (e.g., 1099s) for organizers.
- **Destination Charges**: Users pay the platform, and the funds are automatically split instantly.

---

## 3. The End-to-End Flow

### Step A: Organizer Onboarding
1. An Organizer navigates to their **Profile Settings** (`/dashboard/organizer/profile`).
2. They click **"Connect with Stripe"**.
3. The server calls `createStripeConnectedAccount()` (in `actions/stripe.ts`), creating an Express account and returning an onboarding URL.
4. The Organizer is redirected to Stripe to fill in their identity and bank details.
5. Upon returning, `checkStripeOnboardingStatus()` verifies if they are fully onboarded and sets `stripe_onboarding_complete = true` in the database.

### Step B: Traveler Checkout
1. A Traveler clicks "Book" on a tour.
2. The system calculates the `total_amount`, atomically verifies capacity via an RPC, and creates a `pending` booking in the database.
3. The server calls `createCheckoutSession()` (in `actions/stripe.ts`).
4. **The Split**: The session is created using `payment_intent_data`:
   - `application_fee_amount`: `10%` of the total.
   - `transfer_data.destination`: The Organizer's `stripe_account_id`.
5. The Traveler completes the payment on Stripe's hosted checkout page.

### Step C: Webhook Confirmation
1. Stripe fires a `checkout.session.completed` event to the platform's webhook (`/api/webhooks/stripe/route.ts`).
2. The webhook secure validates the signature.
3. The webhook updates the booking `status` to `confirmed` and saves the `stripe_payment_intent_id`.

### Step D: Cashout
- **Fully Automated**: Organizers do not need to click a "Cashout" button on the platform.
- Stripe automatically sweeps the funds from the Organizer's connected Stripe account to their linked bank account on a rolling basis (usually 2 business days).

---

## 4. Database Schema Changes

**`organizer_profiles` Table:**
| Column | Type | Description |
|---|---|---|
| `stripe_account_id` | `text` | The unique connected account ID (e.g., `acct_12345`) |
| `stripe_onboarding_complete` | `boolean` | True if the organizer can receive payouts |

**`bookings` Table:**
| Column | Type | Description |
|---|---|---|
| `platform_fee` | `decimal` | The 10% commission amount |
| `organizer_revenue` | `decimal` | The 90% organizer net amount |
| `stripe_payment_intent_id` | `text` | Reference to the Stripe transaction |
