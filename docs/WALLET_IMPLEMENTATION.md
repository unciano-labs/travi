# Wallet and Payout System Architecture

This document outlines the step-by-step implementation plan for the Organizer and Transporter wallet system, detailing how funds flow between `escrow_balance` and `available_balance`.

---

## 🛑 Business Logic Decisions (Resolved)

1. **Platform Fees**: Dynamic and configurable via the Admin dashboard. There are separate fee percentages for the Organizer and the Transporter.
2. **Escrow Release Timing**: Configurable via the Admin dashboard (e.g., number of days to hold funds after tour completion before releasing them).
3. **Transporter Split**: The system will automatically split the revenue when a tour is booked. The Transporter's cut (minus the Transporter platform fee) goes directly into the Transporter's escrow. If the organizer provides their own transport, no transporter platform fee is applied.

---

## 🚀 Step-by-Step Implementation Phases

### Phase 1: Database Schema & RLS Setup
**Goal:** Establish the foundational data structures and secure them via Supabase RLS.

1. **Create Migration File**: `supabase/migrations/xxx_add_wallet_tables.sql`
2. **`platform_settings` Table**:
   - Fields: `id` (int, strictly 1), `organizer_fee_percent` (default 3.0), `transporter_fee_percent` (default 3.0), `escrow_holding_days` (default 3).
3. **`user_wallets` Table**:
   - Fields: `id`, `user_profile_id`, `available_balance` (default 0.00), `escrow_balance` (default 0.00), `created_at`, `updated_at`.
4. **`wallet_transactions` Table (Ledger)**:
   - Fields: `id`, `wallet_id`, `amount`, `fee_amount` (track the platform fee taken), `type` (`escrow_deposit`, `escrow_release`, `withdrawal`, `refund`, `penalty`), `balance_affected` (`available`, `escrow`), `reference_type` (`booking`, `payout`, `transport_booking`, `dispute`), `reference_id`, `description`, `created_at`.
5. **`payout_requests` Table**:
   - Fields: `id`, `wallet_id`, `amount`, `status` (`pending`, `processing`, `completed`, `failed`, `rejected`), `payout_method` (JSON), `created_at`, `updated_at`.
6. **Booking Updates (For Disputes)**:
   - Add `dispute_status` to `bookings` table: `none` (default), `open`, `resolved_refunded`, `resolved_denied`.

### Phase 2: Booking Payments (Escrow Deposits & Split)
**Goal:** Automatically split and deposit funds into Escrow when a traveler successfully pays for a tour.

1. **Update `actions/bookings.ts`**:
   - When a booking is `confirmed`, fetch `platform_settings`.
   - **If External Transporter:** Split revenue, deduct respective platform fees, deposit into Organizer's `escrow_balance` and Transporter's `escrow_balance`.
   - **If Organizer Provides Transport:** Organizer gets full revenue minus Organizer platform fee. Deposit into Organizer's `escrow_balance`.
   - Insert corresponding `wallet_transactions` (`type: escrow_deposit`).

### Phase 3: Tour Completion & The Holding Period (Escrow Releases)
**Goal:** Transfer funds from Escrow to Available Balance after the holding period passes.

1. **Escrow Release Logic (`actions/escrow.ts`)**:
   - Create a cron job (or scheduled function) that runs daily.
   - Find all `confirmed` bookings where the `tour_schedule.endDate` + `platform_settings.escrow_holding_days` has passed.
   - **CRITICAL**: Skip any booking where `dispute_status = 'open'`. These funds remain frozen in Escrow until the dispute is resolved.
   - For cleared bookings: Move the exact amount originally deposited from `escrow_balance` to `available_balance` for the respective Wallets (Organizer and/or Transporter).
   - Insert ledger entries for `escrow_release`.

### Phase 4: Cancellations, Refunds & Disputes (Edge Cases)
**Goal:** Safely reverse Escrow balances if a tour is canceled or a dispute is won by the traveler.

1. **Traveler / Organizer Cancellation (Before Tour)**:
   - If a booking is canceled and qualifies for a refund, deduct the exact deposited amount from the Organizer's (and Transporter's) `escrow_balance`.
   - Process refund via Payment Gateway (e.g., Stripe).
   - Insert `wallet_transactions` (`type: refund`, `balance_affected: escrow`).
2. **Dispute Resolution (During Holding Period)**:
   - **Time Limit Enforcement**: Travelers CANNOT initiate a dispute or request a refund if the holding period has already passed (i.e., funds have already moved to `available_balance`). The system strictly blocks refunds post-holding period.
   - If a traveler opens a dispute within the valid window, Admin updates `booking.dispute_status = 'open'`. This prevents the cron job in Phase 3 from releasing the funds.
   - **Admin Resolves in Favor of Traveler**: Admin clicks "Refund". Deduct from `escrow_balance`, process Stripe refund, update status to `resolved_refunded`.
   - **Admin Resolves in Favor of Organizer**: Admin updates status to `resolved_denied`. The cron job will automatically pick it up and release the funds to `available_balance` on the next run.
3. **Transporter No-Show**:
   - If the Transporter flakes but the tour still happens, Admin can reverse only the Transporter's `escrow_balance` deposit and re-route those funds to the Organizer (if they paid out of pocket) or refund the traveler.

### Phase 5: Payout Requests (Wallet Dashboard & Cashout)
**Goal:** Allow Organizers and Transporters to cash out their earnings from their Available Balance to their real-world bank accounts or e-wallets.

1. **Payout Methods Configuration**:
   - Users can save their preferred payout method details in their dashboard (e.g., Bank Transfer, GCash, PayPal). This is saved as a JSON object `payout_method` in the request.
2. **Refine `actions/wallet.ts`**:
   - Validate that `requested_amount <= available_balance` and meets minimum withdrawal limits.
   - Deduct `requested_amount` directly from `available_balance`.
   - Insert into `payout_requests` with `status = 'pending'`, embedding the chosen `payout_method` details.
3. **Frontend UI Integration**:
   - Dashboard shows `Available Balance`, `Escrow Balance`, `Frozen Balance (Disputes)`, and `Transaction History`.
   - "Withdraw Funds" button opens a modal to select the payout method and enter the amount.

### Phase 6: Admin Platform Settings & Payout Processing
1. **Admin Dashboard (Settings)**: Manage `platform_settings`.
2. **Admin Dashboard (Disputes & Cashouts)**: 
   - View all `payout_requests` where `status = 'pending'`.
   - **Cashout Fulfillment**: Admin processes the transfer to the user's Bank/GCash (either manually or via a payout API like Xendit/Stripe Connect). 
   - Once the money is sent, Admin clicks "Mark as Completed" to finalize the request, or "Reject" to return the funds to the user's `available_balance`.

### Phase 7: QA & Testing
1. **Automated Testing**: Ensure accurate fee splits, escrows, and prevent negative balances during refunds.
2. **Manual Simulation**: Book a tour -> Open a dispute -> Verify funds are frozen -> Resolve dispute -> Verify funds release/refund.
