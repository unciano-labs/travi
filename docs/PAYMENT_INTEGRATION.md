# Payment & Monetization Integration

This document outlines the architecture, flow, and business logic for how payments are processed, how the platform earns revenue, and how organizers and transporters cash out.

> **Stack:** PayMongo Checkout + Internal Digital Wallet System + Next.js App Router API Routes

---

## 1. Business Model (Monetization)
The platform uses a **commission-based model**:
- **Platform Fee (Commission)**: The platform takes a `10%` cut of the total booking amount. This is fully configurable in the `platform_settings` table.
- **Partner Revenue**: The remaining `90%` of the booking amount is credited to the Organizer (or split between Organizer and Transporter if an external transporter is used).

*Example*: If a traveler books a tour for **₱5,000**:
- Platform receives **₱500.00** (Platform Fee).
- Organizer receives **₱4,500.00** into their Wallet (minus any transporter splits).

---

## 2. Architecture: PayMongo + Digital Wallets
Because strict KYC (Know Your Customer) requirements for automated split-routing gateways (like Stripe Connect) can hinder rapid MVP onboarding in the Philippines, the platform utilizes an internal **Escrow & Wallet System** powered by **PayMongo** for initial payments.

### Key Components:
- **Traveler Payment**: Processed securely via PayMongo (GCash, Maya, QR Ph, Credit/Debit).
- **Internal Ledger**: Custom database tables (`user_wallets`, `wallet_transactions`) guarantee strict accounting and zero financial discrepancies.
- **Escrow System**: Funds are locked in an `escrow_balance` until the tour is completed, protecting travelers from organizer cancellations or no-shows.
- **Manual Payouts**: Partners withdraw funds from their `available_balance`, and the Platform Admin executes the manual bank transfer (InstaPay/PESONet).

---

## 3. The End-to-End Flow

### Step A: Traveler Checkout
1. A Traveler clicks "Book This Tour" on a tour schedule.
2. The server verifies capacity, atomically creates a `pending` booking in the database, and calls `createCheckoutSession()` (via PayMongo API).
3. The Traveler is redirected to the secure PayMongo Checkout URL.
4. The Traveler completes the payment.
5. *If payment is not completed within 15 minutes, a `pg_cron` background job automatically cancels the `pending` booking and releases the reserved seats.*

### Step B: Webhook Confirmation & Escrow
1. PayMongo fires a `payment.paid` event to the platform's webhook (`/api/webhooks/paymongo/route.ts`).
2. The webhook validates the event, updates the booking `status` to `confirmed`.
3. The system calculates the 10% platform fee and credits the remaining 90% to the Organizer's `escrow_balance`.
4. A `payment_hold` transaction is logged in `wallet_transactions`.

### Step C: Tour Completion (Escrow Release)
1. When a tour schedule is marked as `completed`, the system triggers the `release_tour_escrow()` database function.
2. This function iterates through all confirmed bookings for that schedule, deducts the funds from `escrow_balance`, and adds them to `available_balance`.
3. An `escrow_release` transaction is logged.

### Step D: Cashout (Withdrawal)
1. The Organizer navigates to their **Wallet Dashboard** (`/dashboard/organizer/wallet`).
2. They click **Request Payout**, select their withdrawal method (e.g., GCash, BDO), and specify the amount.
3. The amount is immediately deducted from their `available_balance` and a `payout_requests` row is created (status: `pending`).
4. The Admin navigates to the **Admin Payouts Dashboard** (`/admin/payouts`), views the request, and manually transfers the funds via their banking app.
5. The Admin clicks **Mark as Paid**, updating the request status to `paid`.

---

## 4. Database Schema Changes

**`platform_settings` Table:**
Stores global financial settings (e.g., `platform_fee_percent`).

**`user_wallets` Table:**
| Column | Type | Description |
|---|---|---|
| `available_balance` | `decimal` | Funds cleared and ready for withdrawal. |
| `escrow_balance` | `decimal` | Funds held for upcoming tours. |

**`wallet_transactions` Table:**
The immutable ledger.
| Column | Type | Description |
|---|---|---|
| `amount` | `decimal` | Transaction amount. |
| `type` | `enum` | e.g., `payment_hold`, `escrow_release`, `withdrawal_pending`. |
| `balance_affected` | `enum` | `available` or `escrow`. |

**`payout_requests` Table:**
| Column | Type | Description |
|---|---|---|
| `amount` | `decimal` | Amount requested. |
| `status` | `enum` | `pending`, `processing`, `paid`, `rejected`. |
| `payout_method` | `jsonb` | Bank details or GCash number. |
