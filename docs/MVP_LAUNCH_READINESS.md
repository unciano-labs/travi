# Travi MVP launch readiness: gaps, roadmap and status

**Date:** 2026-10-22. **Code reviewed:** branch `feat/dashboard-admin-theme` at commit `fbbbf32`, including all 33 migrations in `supabase/migrations/`.

**How this was produced:** a read-only audit in four parts: security, financials, business logic against the specs in `docs/`, and engineering/operations. Each finding was checked against the code; the file and line references point at that commit.

**Relationship to AGENTS.md:** this file is the full gap register as of 2026-10-22. AGENTS.md §6 lists only a subset, and several of its claims turned out to be wrong (see [Appendix B](#appendix-b-agentsmd-claims-that-are-wrong-today)).

> **Legal and tax items (§4.6) are flagged for review by Philippine counsel.** They describe likely obligations, not legal advice.

---

## Contents
1. [Executive summary](#1-executive-summary)
2. [Severity and effort legend](#2-severity-and-effort-legend)
3. [What's done](#3-whats-done)
4. [Gap analysis](#4-gap-analysis)
   - 4.1 [Financials](#41-financials) · 4.2 [Security](#42-security) · 4.3 [Business logic](#43-business-logic) · 4.4 [Coding standards & engineering](#44-coding-standards--engineering) · 4.5 [Operations](#45-operations) · 4.6 [Legal, tax & compliance](#46-legal-tax--compliance)
5. [Launch roadmap: phases and detailed tasks](#5-launch-roadmap)
6. [Go / no-go launch checklist](#6-go--no-go-launch-checklist)
7. [Post-launch future improvements](#7-post-launch-future-improvements)
8. [Appendix A: key metrics](#appendix-a-key-metrics) · [Appendix B: AGENTS.md corrections](#appendix-b-agentsmd-claims-that-are-wrong-today)

---

## 1. Executive summary

### Verdict: not ready to take real money

The product surface is broad and mostly built. All four role dashboards exist, along with the tour catalog, booking flow, GCash/Maya checkout, wallets and the admin console. The parts underneath that hold money and trust are not ready:

1. **Organizers are never credited for real payments.** A traveler pays, the booking is confirmed, but the escrow credit fails silently (wrong wallet-owner id, error swallowed). No ledger row is written, so 100% of GMV sits in Travi's PayMongo balance with nothing recorded as owed. The escrow-release job is also **not scheduled anywhere**, and it only looks for a ledger type the success page never writes. Result: no partner can ever be paid out.
2. **There are several direct theft and privilege paths through the database.** The Supabase anon key is public, so any signed-in user can call PostgREST directly and skip every Server Action check. Today that lets them:
   - grant themselves the `admin` role;
   - edit their own booking's price or status;
   - insert a payout request with no balance debit;
   - as a transporter, create "accepted" transport bookings that make the cron **drain any organizer's balance**;
   - publish their own reviews.
3. **Payment confirmation can be forged or replayed.**
   - The PayMongo webhook has no signature check and trusts the amount in the payload.
   - `verifyPaymentAndUpdateBooking` is unauthenticated, and it re-confirms bookings that were already canceled or refunded.
   - With `PAYMONGO_SECRET_KEY` unset, every payment and refund "succeeds".
4. **Core journeys have dead ends.**
   - No password reset.
   - Traveler and organizer profile forms don't save.
   - The `/tours` page returns 404 and the hero search does nothing.
   - Travelers never receive a confirmation email, although the UI says they will.
   - Partners are auto-approved with no KYC, and rejecting an organizer does nothing.
   - An organizer can "confirm" an unpaid booking.
5. **Launch prerequisites are missing:**
   - Terms of Service, Privacy Policy and refund policy (footer links point to `#`), and no consent capture at signup.
   - Business identity is not disclosed; there are no partner agreements and no tax or invoicing handling.
   - The marketing copy makes claims that aren't true yet ("vetted", "12,400+ verified reviews", seeded fake reviews).
6. **Engineering safety net is thin.**
   - There are no unit, RLS or money-flow tests, and no CI.
   - Sentry never loads, so production errors are invisible.
   - Dev, QA and production appear to share **one** Supabase project.
   - The installed Next.js 16.3.2 has a critical RCE advisory.

### Top 12 launch blockers

| # | Blocker | Ref |
|---|---|---|
| 1 | RLS lets users self-grant admin, edit bookings and payout requests, and forge transport bookings | SEC-01…05 |
| 2 | Organizer escrow is never credited (wrong wallet id), and the ledger-type split blocks release | FIN-01, FIN-02 |
| 3 | Escrow-release cron is unscheduled, fails open, and is non-atomic | FIN-05, OPS-01 |
| 4 | Webhook is unsigned and unmapped; payment verification is unauthenticated and replayable | FIN-03, FIN-04, SEC-06 |
| 5 | Payout and wallet mutations aren't atomic (double-spend, replay, client-supplied wallet ids) | FIN-06…08 |
| 6 | `test-login` route and admin login with hardcoded, pre-filled credentials | SEC-07 |
| 7 | Next.js critical CVE; secrets optional with insecure fallbacks; one shared Supabase project | ENG-01, SEC-10, OPS-03 |
| 8 | Stored XSS via JSON-LD; OTP code readable from its own cookie | SEC-08, SEC-09 |
| 9 | Booking state machine: no server guards, organizer can confirm unpaid bookings, late payments orphaned, schedule cancel strands paid bookings | BIZ-01…05 |
| 10 | Missing journeys: password reset, profile save, email verification, `/tours`, traveler emails | BIZ-10…14 |
| 11 | Partner approval and KYC not enforced; reject is a no-op | BIZ-06, BIZ-07 |
| 12 | No ToS/Privacy/refund policy, consent, business identity or partner terms; misleading claims; tax and BSP structure unreviewed | LEG-01…08 |

### Estimated effort to an MVP launch

One senior full-stack engineer, plus part-time help from legal/ops and a product owner:

| Phase | Theme | Engineering effort | Can overlap with |
|---|---|---|---|
| 0 | Stop the bleeding (hotfixes) | ~1 week | — |
| 1 | Database security hardening (RLS + RPCs) | ~1.5 weeks | 4 |
| 2 | Payments, ledger and payouts correctness | ~2 weeks | 4 |
| 3 | Business-logic completion | ~2.5 weeks | 4, 5 |
| 4 | Legal, content and trust | ~1 week of eng + external legal | 1–3 |
| 5 | Quality, observability and ops | ~1.5 weeks (tests written alongside 1–3) | 1–3 |
| 6 | Staging UAT, PayMongo go-live, soft launch | ~1 week | — |
| | **Total** | **~9–11 weeks for one engineer; ~5–6 weeks with two** | |

Out of scope for MVP: transport payouts can be deferred, and transport offered as an "organizer arranges directly" coordination feature without payment. That deferral saves about a week (see the [decision log](#decisions-needed-before-phase-2)).

---

## 2. Severity and effort legend

| Severity | Meaning |
|---|---|
| **Blocker (B)** | Must be fixed before real users or real money |
| **High (H)** | Fix before launch unless explicitly risk-accepted |
| **Medium (M)** | Fix before launch if cheap, otherwise in the first month after launch |
| **Low (L)** | Hygiene; schedule post-launch |

| Effort | Meaning |
|---|---|
| **S** | ≤ 1 day |
| **M** | 2–4 days |
| **L** | 1–2 weeks |

ID prefixes: **FIN** financial, **SEC** security, **BIZ** business logic, **ENG** engineering and code standards, **OPS** operations, **LEG** legal and compliance.

---

## 3. What's done

These features are built and work end to end, unless they are cross-referenced to a gap.

### Platform
- **Stack:** Next.js 16 App Router, Supabase (Postgres + Auth + Storage, RLS on every migrated table), Tailwind v4, Vercel.
- **Sessions:** cookie-based via `@supabase/ssr`, refreshed in `middleware.ts`. Role-based route gating covers `/admin/*` and `/dashboard/*` (`lib/supabase/middleware.ts:67-110`).
- **Multi-role accounts:** one account can be traveler, organizer and transporter, with a role switcher in the header.
- **Server Action contract** (§3.2): followed by the newer actions (`actions/tours.ts`, `actions/admin.ts` approvals, `createBooking`): zod validation, `requireSession` + `assertRole`, Upstash rate limit, audit log, cache tags.
- **Overbooking:** made impossible in the DB by trigger `update_tour_schedule_booked_count` plus CHECK `check_capacity_not_exceeded`.
- **Booking references:** generated by a DB trigger (`BK-xxxxxx`). Pending bookings expire after 15 minutes via pg_cron.
- **Public catalog:** cached reads (`lib/data/*`, tag-invalidated). SEO is in place: `generateMetadata`, JSON-LD, sitemap and robots.
- **Dashboard theme:** the Tailwind Admin theme now covers all dashboards. It includes shadcn/Radix primitives, a shared shell, charts on the role home pages, and consistent status badges.
- **Logging and rate limiting:** structured logging with pino, plus Upstash rate limiting. Sentry is configured but not loading (ENG-03).

### Traveler
- Landing catalog of published tours with future open schedules (`lib/data/tours.ts:15-108`).
- Tour detail page with itinerary, schedules, reviews and JSON-LD (`app/tours/[slug]/page.tsx`).
- Seat picker that respects remaining capacity, and server-side pricing (`lib/services/bookings.ts:28-33`).
- GCash/Maya PaymentIntent checkout and a success-page verification (`actions/bookings.ts:203-250`, `lib/paymongo.ts`).
- Bookings list, cancellation with a full PayMongo refund before the start date, and opening a dispute (`TravelerBookingsClient.tsx`, `actions/bookings.ts:252-392`).
- Dashboard with upcoming and past trips, a status donut and a timeline.
- OTP-protected changes of email, phone and password (`AccountSecurityManager.tsx`, `actions/profile.ts`). The OTP itself is weak (SEC-09).

### Organizer
- Onboarding gate (`app/dashboard/organizer/layout.tsx`).
- Tour create and edit: images, map location, themes, format (joiner, private or solo), itinerary builder, accommodation and travel time (`TourForm.tsx`, `lib/services/tours.ts`).
- Schedules with per-schedule pricing, a compare-at price, capacity and a calendar view (`ScheduleForm.tsx`, `SchedulesCalendar.tsx`).
- Vehicle discovery by dates and capacity, favourite vehicles, and transport requests (`actions/vehicles.ts:263-388`, `TransportRequestModal.tsx`).
- Bookings list with search and pagination, and a per-schedule traveler manifest.
- KPI dashboard with a revenue chart and a status breakdown.
- Wallet with ledger view and CSV export. Payout requests require password re-entry; adding a payout method requires an OTP.

### Transporter
- Onboarding; vehicle CRUD with photos, activate/deactivate and soft delete (`actions/vehicles.ts:53-258`).
- Availability blocks with an overlap check, shown on a calendar (`actions/availability.ts`).
- Request inbox: accept or decline, which syncs availability, notifies the organizer and writes an audit row (`actions/transport-requests.ts:93-269`).
- Profile update (`actions/transporter.ts:83-145`) and wallet.

### Admin
- Separate admin login and admin console.
- Approve organizers; approve or reject transporters, with audit log and email (`actions/admin.ts:18-173`).
- Bookings list with dispute resolution (refund or deny).
- Payout queue with mark-paid and reject, each sending an email.
- Hide reviews (audited); notifications feed.
- Dashboard with GMV and booking charts.

---

## 4. Gap analysis

### 4.1 Financials

#### How money moves today

```
Traveler ──createBooking──► booking pending (server-priced ✅, seats held ✅)
        ──processPayment──► PaymentIntent created; bookings.paymongo_session_id OVERWRITTEN each click ⚠
        ──GCash/Maya──────► PayMongo collects 100% of GMV into Travi's merchant balance
        ──/success────────► verifyPaymentAndUpdateBooking (NO auth ⚠)
                             booking → confirmed (from ANY status except confirmed ⚠)
                             ensure_user_wallet(organizer_profiles.id) → FK violation, error swallowed ⚠
                             ⇒ NO escrow credit, NO ledger row ❌
Webhook ────────────────────► no signature ⚠; can't map PaymentIntent payloads to a booking ⇒ no-op ❌
                             (a forged payload with reference_number DOES confirm + credit "payment_hold")
pg_cron (every min) ────────► pending > 15 min → canceled (PaymentIntent NOT cancelled at PayMongo ⚠)
Escrow cron ────────────────► NOT SCHEDULED ❌; public if CRON_SECRET unset ⚠
                             releases only "payment_hold" rows ⇒ success-page bookings never complete ❌
Transport payout ───────────► dead: estimated_price is never set; "Mark complete" skips the cron ❌
Payout request ─────────────► read-modify-write balance (race ⚠); free-text destination ⚠
Admin mark paid / reject ───► manual bank/GCash transfer outside the system; replayable; client walletId ⚠
Cancel / dispute refund ────► full PayMongo refund; tries to reverse an escrow row that never exists ⚠
```

#### Findings

| ID | Sev | Finding | Evidence | Impact | Fix | Eff |
|---|---|---|---|---|---|---|
| FIN-01 | B | **Escrow never credited on real payments**: `organizer_profiles.id` is passed where `user_profiles.id` is expected; the RPC error is discarded | `actions/bookings.ts:160-164`, `:297-300`, `:426-429`; FK `20260830042500_billing_and_wallets.sql:18` | Organizers are never paid. Liabilities of about 90% of GMV are unrecorded | Resolve `organizer_profiles.user_profile_id` and throw on RPC errors. Backfill deposits for every confirmed booking from PayMongo records | S + M backfill |
| FIN-02 | B | **Ledger type split**: the success page writes `escrow_deposit`, the webhook writes `payment_hold`, the cron releases only `payment_hold`, and cancel/dispute reverse only `escrow_deposit` | `actions/bookings.ts:169,305,434`; webhook `route.ts:84`; cron `route.ts:74` | Bookings never complete; phantom escrow builds up | One type (`escrow_deposit`) written by one shared DB function; migrate existing rows | S |
| FIN-03 | B | **Webhook has no HMAC check, trusts the payload amount, and can't map PaymentIntent payloads** | `app/api/webhooks/paymongo/route.ts:10-23,64,81-95`; PI description `actions/bookings.ts:223` | Forged "paid" events confirm bookings and credit escrow. Real payments get no backstop when the user closes the tab | Verify `paymongo-signature` over the raw body and fail closed. Set `metadata.booking_id` on the PaymentIntent. Re-fetch the payment from PayMongo and ignore the payload amount. Always return 200 for unknown refs | M |
| FIN-04 | B | **Payment verification is unauthenticated and replayable**: it re-confirms `canceled`/`refunded` bookings, never compares the amount, and ignores update errors | `actions/bookings.ts:105,129,142-152` | Refund, then revisit `/success`, gives a free tour. A late payment on a full schedule shows "success" with no seat | Move to `lib/`, called from the RSC only. Allow only `pending→confirmed` with a rows-affected check. Assert `amount == round(total×100)` and currency PHP | M |
| FIN-05 | B | **Escrow cron fails open, is non-atomic, N+1, and doesn't check RPC errors** | `app/api/cron/escrow-release/route.ts:9,59-110` | Double credits under concurrent runs; balance and ledger drift on partial failure | Fail closed. One `SECURITY DEFINER` plpgsql function per release (`FOR UPDATE`, ledger + balances in one transaction). UNIQUE index on `wallet_transactions(reference_type, reference_id, type)` | M |
| FIN-06 | B | **`requestPayout` double-spend**: balance read-modify-write; free-text destination; no zod; dead role check (`profile.role` doesn't exist) | `actions/wallet.ts:12-123` (`:17`, `:54-63`, `:91`) | Two parallel requests give two payouts; funds can go to any account | `request_payout(wallet, amount, saved_method_id)` RPC: conditional `UPDATE … WHERE available >= amt RETURNING`, with the ledger and request in the same transaction. `assertRole` plus an approved-partner and KYC gate | M |
| FIN-07 | H | **`markPayoutPaid` is replayable and trusts the client `walletId`** | `actions/admin.ts:289-326` | Duplicate `withdrawal_completed` rows; rejected payouts get marked paid | Atomic RPC (`UPDATE … RETURNING`, abort on 0 rows); derive the wallet from the request; audit log | S |
| FIN-08 | H | **`rejectPayout` race (check-then-act) and client `walletId`** | `actions/admin.ts:363-389` | Double refund to the partner's available balance | Same atomic pattern as FIN-07 | S |
| FIN-09 | B | **Mock mode isn't blocked in production**: missing key means every verify and refund succeeds; no `sk_live_` check | `lib/paymongo.ts:75-78,106-109,214-217,234-238`; `lib/env.ts:13` | Free bookings if production is misconfigured | Make PayMongo keys required in `env.ts` when `NODE_ENV=production`; reject `sk_test_` in production | S |
| FIN-10 | H | **`processPayment` overwrites the PaymentIntent id for any status and any user**; `returnUrl` comes from the client | `actions/bookings.ts:203-236`; `PaymentSelectionClient.tsx:25-28` | Paid PaymentIntent lost, so refunds become impossible; double charges across tabs; open redirect | Owner + `pending` only; reuse a live PaymentIntent; build `returnUrl` on the server; add a `payments` table (one row per PaymentIntent) | M |
| FIN-11 | H | **No reconciliation data**: the `payments` table is unused (default currency USD), refund ids are discarded, there is no settlement matching and no admin exports | `legacy_migration_012.sql:16-25`; `actions/bookings.ts:293,423` | Can't match PayMongo settlements and refunds to the ledger | Record provider id, gross, MDR, net, refund id and refund amount; daily reconciliation job; admin CSV exports | M |
| FIN-12 | H | **No audit trail for money mutations** (payouts, disputes, settings, verify, cron) | compare `actions/admin.ts:35` | Fails basic finance controls | `logMutation` everywhere; append-only trigger on `wallet_transactions` | S |
| FIN-13 | H | **No DB invariants**: no `CHECK (balance >= 0)`, no unique dedupe key, `increment_*` succeed silently on a missing wallet, EXECUTE granted to anon/authenticated | `billing_and_wallets.sql:16-37,128-136` | Negative balances; races | Constraints, unique index, `RAISE` on missing row, `REVOKE EXECUTE` | M |
| FIN-14 | M | **Platform settings broken**: `.eq('id', 1)` on a uuid; no bounds; no audit; the `|| 3` fallback vs the 10% DB default (`??` needed) | `actions/admin.ts:437-461`; `app/admin/settings/page.tsx:16`; `bookings.ts:156,364`; webhook `:62`; cron `:25-26` | Fees can't change; a null row charges 3% instead of 10% | `.limit(1)`; zod (fee 0–50%, hold 0–30 days); `??`; fee history | S |
| FIN-15 | M | **Platform revenue isn't recorded** (`platform_fee` type never written); dashboards show gross as "revenue" | webhook `:81-89`; `app/admin/page.tsx`; `app/dashboard/organizer/page.tsx` | No take-rate or VAT-base reporting; organizers see about 11% more than they'll receive | Platform-fee ledger rows (platform wallet); show organizers the net | S–M |
| FIN-16 | M | **PayMongo MDR (~2–2.5%) is not modelled and is lost on every refund** | `actions/bookings.ts:158-159,293,423` | Platform margin erodes; refunds cost Travi | Decide who absorbs MDR; record the fee per payment; cancellation fee or tiers (BIZ-16) | M |
| FIN-17 | M | **Refunds are non-atomic and always full**: no refund state, no chargeback handling | `actions/bookings.ts:279-327,394-469` | Refund succeeds but the DB write fails, leaving a stuck booking; double-refund race on cancel | Refund state machine (`refund_pending → refunded`) with idempotency; handle refund and dispute webhooks | M |
| FIN-18 | M | **Dispute vs cron race**: a dispute can open on a just-completed booking; refunds don't claw back from the organizer | `actions/bookings.ts:374-381` vs cron `:106` | Platform loses 100% of a refunded booking | Status-guarded updates; clawback from available with a negative-balance policy | S |
| FIN-19 | M | **Price inputs not validated** (negative, NaN, sub-centavo; below PayMongo's ~₱20 minimum; no max seats) | `actions/schedules.ts:17-18`; `lib/schemas/tour.ts:9` | Failed or mismatched charges | zod: price ≥ minimum, 2 decimals, upper bound; seats ≤ remaining | S |
| FIN-20 | M | **Payout account numbers in plaintext**; delete and set-default have no OTP | `actions/wallet.ts:136-253` | Data Privacy Act exposure; silent destination change | Encrypt (Vault/pgsodium) or tokenize; mask in UI; OTP on set-default | M |
| FIN-21 | M | **Payout minimum inconsistent**: UI ₱500 vs server ₱100 (the documented rule) | `WalletClient.tsx:36` vs `actions/wallet.ts:50` | Confusing policy | Store in `platform_settings`; enforce on the server; read it in the UI | S |
| FIN-22 | M | **Sign convention inconsistent** across ledger rows (`withdrawal_pending` +, `refund` −, UI "+₱-X") | `wallet.ts:72`, `admin.ts:319`, `bookings.ts:314`, `WalletClient.tsx:296` | Σ ledger ≠ balance; no automated proof | Signed amounts per bucket; documented convention | S |
| FIN-23 | L | **Fee snapshot taken at confirmation, computed in floats** | `actions/bookings.ts:155-159` | ₱0.01 drift; fee changes mid-booking | Snapshot `fee_percent` on the booking at creation; integer-centavo math | S |
| FIN-24 | L | **Pending-hold seat abuse** (15-minute hold; limit per profile only) | `booking_expiration_cron.sql` | Bots can block popular departures | Max concurrent pending bookings per user; per-IP limit | S |

### 4.2 Security

The biggest exposure is RLS, not app code. The anon key is public, so every RLS policy is effectively a public API.

| ID | Sev | Finding | Evidence | Fix | Eff |
|---|---|---|---|---|---|
| SEC-01 | B | **Self-grant admin**: `user_roles` INSERT allows any `website_role_id`, and `website_roles` is publicly readable | `20260801000001_legacy_migration_01.sql:15,47-49` | Drop the self-INSERT; assign roles only in a definer RPC that allow-lists `traveler/organizer/transporter` | S |
| SEC-02 | B | **Travelers can edit any column of their bookings** (status, `total_amount`, `paymongo_session_id`, `dispute_status`, `tour_schedule_id`, which bypasses the capacity trigger) | `…legacy_migration_012.sql:38-46` | Revoke UPDATE; all transitions through actions/RPCs; INSERT only `pending` with server price | S |
| SEC-03 | B | **Transporter (and organizer) `FOR ALL` on `transport_bookings`**: forge `accepted` rows with any organizer and price, and the cron drains the organizer's wallet | `…legacy_migration_017.sql:50-82`; cron `:118-175` | Transporter SELECT only plus a status RPC; organizer INSERT only `pending` with no price, on an owned schedule and a matching vehicle | M |
| SEC-04 | B | **Users can INSERT `payout_requests`** with no debit | `20260830042500_billing_and_wallets.sql:83-85` | Drop the policy; RPC only (FIN-06) | S |
| SEC-05 | H | **Self-update of status and money-adjacent columns**: organizer `status`, transporter `status/average_rating/review_count`, `user_profiles.email/phone/*_verified_at`; reviews inserted as `published`; notifications inserted for anyone (phishing links) | `…002.sql:27-29`, `…003.sql:21-23`, `…01.sql:31`, `…011.sql:27-32`, `create_notifications.sql:28-30` | Column-level GRANTs; WITH CHECK `status='pending'`; notifications insert via service role only | S |
| SEC-06 | B | **Unauthenticated exported Server Actions**: `verifyPaymentAndUpdateBooking`, `createNotification`, `sendEmailNotification`, `notifySuperAdmin`, `notifyOrganizerOfNewBooking`, `notifyTransporterAccountStatus`, `requireVerifiedOtp`, `consumeVerifiedOtp`. Session-only (any target): `notifyTransporterOfRequest`, `notifyOrganizerOfStatusChange`, `notifyOrganizerAccountStatus` | `actions/bookings.ts:105`; `actions/notifications.ts:10,37,156,211,270,333,392,430`; `actions/otp.ts:158,176` | Move internal helpers to `lib/`; add auth + role + ownership to the rest | M |
| SEC-07 | B | **Hardcoded credentials**: `/api/test-login` is ungated (password in source, stack traces); `/admin/login` pre-fills `admin@travi.ph` / `password` and prints a hint | `app/api/test-login/route.ts:6-53`; `app/admin/login/page.tsx` | Delete the route; remove the pre-fill and hint; rotate those passwords | S |
| SEC-08 | B | **Stored XSS via JSON-LD**: `JSON.stringify` doesn't escape `</script>`; the input is organizer-controlled | `components/seo/TourJsonLd.tsx:42` | `.replace(/</g,'\\u003c')`; add a test | S |
| SEC-09 | H | **OTP is bypassable**: the code sits in a signed but unencrypted JWS cookie; `Math.random`; no attempt limit; not bound to the user; codes logged (SMS mock always logs) | `actions/otp.ts:39,69,82,87-123,158-172`; `lib/sms.ts:16-19` | Server-side hashed OTP (`payout_otps` exists), bound to `user.id`, attempt counter, single use, `crypto.randomInt`; never log codes | M |
| SEC-10 | H | **Secret handling**: `SUPABASE_JWT_SECRET` reused for OTP with caller-spread claims (possible service-role token forgery if it's the project secret); `'fallback-secret-for-dev-only'`; `NEXT_PUBLIC_SERVICE_ROLE_KEY` fallback; every secret `.optional()`; `CRON_SECRET`, `SUPABASE_JWT_SECRET`, `RESEND_*`, `NEXT_PUBLIC_SITE_URL` not in `env.ts` | `actions/otp.ts:10,35,87`; `lib/env.ts:13,20` | Dedicated `OTP_SECRET`; allow-list the claims; required-in-production schema; remove the public fallback | S |
| SEC-11 | H | **Step-up gaps**: phone OTP optional for password change; the new email is never verified but is marked verified; no rate limit on password-check oracles or OTP send/verify | `actions/profile.ts:178,186,211-214,253`; `actions/wallet.ts:26-30` | Require phone OTP when a phone is on file; OTP to the new email; `assertRateLimit(...,'auth')` | S |
| SEC-12 | H | **Admin console has single-factor auth** | `actions/auth.ts:14-69`; middleware | Supabase TOTP MFA; require `aal2` for `/admin` and `assertRole('admin')` | M |
| SEC-13 | M | **PII publicly scrapable with the anon key**: transporter/organizer phone and address, vehicle plate numbers, all availability notes; `getAvailableVehicles` returns transporter phones; organizers read every column of travelers' profiles | `…003.sql:20`, `…002.sql:30`, `…017.sql:21-23,45-47`, `…015.sql:23-25`; `actions/vehicles.ts:285-289` | Public views with safe columns; owner/admin base tables; column-limited organizer view | M |
| SEC-14 | M | **Organizers can hard-DELETE tours and schedules**, and the cascade deletes paid bookings; they can UPDATE `booked_count`/`capacity` | `…002.sql:58-64`, `…010.sql:3-15`, `…012.sql:7`, `…006.sql:20-43` | Split policies (no DELETE); FK `RESTRICT`; column-level UPDATE | S |
| SEC-15 | M | **Missing page-level admin checks** on `app/admin/{bookings,tours}/page.tsx` (service-role reads) | as cited | `requireSession` + `assertRole('admin')` | S |
| SEC-16 | M | **No security headers** (CSP, HSTS, frame-ancestors, nosniff, referrer policy) | `next.config.ts` | `headers()` block with a CSP (nonce/strict-dynamic) | S |
| SEC-17 | M | **Uploads unrestricted** in the public `tour-images` bucket (any signed-in user, any path, any MIME type) | `…004.sql:12-15`; `TourForm.tsx:129-135`; `VehicleModal.tsx:51-56` | Bucket `allowed_mime_types` + `file_size_limit`; path prefix = `auth.uid()`; role check | S |
| SEC-18 | M | **HTML injection in transactional emails** (names and titles not escaped); the mock logs full bodies including OTPs | `actions/admin.ts:345,347,420`; `actions/notifications.ts:44-48,196-382,493`; `actions/wallet.ts:109`; `actions/otp.ts:60` | `escapeHtml()` in `lib/email.ts`; log only the subject | S |
| SEC-19 | M | **Bearer API routes broken**: the client doesn't attach the token (every route 401s today); zod v3 `.errors[0]`; `/api/organizers` writes non-existent columns; raw DB errors returned | `lib/api-auth.ts:19-41`; `app/api/{tours:53,bookings:23,organizers:34-51}` | Fix with `global.headers.Authorization`, `.issues`, correct columns, generic errors; or remove the API until mobile exists | S |
| SEC-20 | L | Function hygiene: `is_organizer_for_traveler` SECURITY DEFINER without `search_path`; default EXECUTE grants | `…015.sql:7-10` | `SET search_path = public, pg_temp`; `REVOKE EXECUTE` | S |
| SEC-21 | L | Unbounded `limit` on public reads; XFF-based rate-limit identity spoofable off Vercel; tables outside migrations (`websites`, `pages`, `templates`) with unknown RLS; `ADMIN_PWD` in `.env.local` | `actions/public.ts:5`; `app/api/tours/route.ts:12-16`; `lib/ratelimit.ts:40-43` | zod cap; trusted IP header; audit live RLS; remove the plaintext admin password | S |

### 4.3 Business logic

#### Booking and payment lifecycle

| ID | Sev | Finding | Evidence | Fix | Eff |
|---|---|---|---|---|---|
| BIZ-01 | B | **No server-side booking guards**: schedule `open`, `start_date > today` (Manila), tour `published`, `deleted_at`, max seats | `lib/services/bookings.ts:13-33` | Add the guards in the service; mirror them in the RLS INSERT check | S |
| BIZ-02 | B | **Organizer can "Confirm" an unpaid booking**, cancel a paid one with no refund, or complete it early (no transition guard) | `actions/bookings.ts:55-103`; `OrganizerBookingsClient.tsx:326-345` | Remove confirm; allow only `pending→canceled`; route paid cancellations through the refund service | S |
| BIZ-03 | B | **Late payments are orphaned**: 15-minute expiry plus an unmapped webhook means paid but canceled, with no refund path; pay page and `processPayment` don't check status | `20260830035500:8-12`; `pay/page.tsx:26-38`; `bookings.ts:211-217` | Cancel the PaymentIntent on expiry; on a late paid event re-confirm if seats remain, else auto-refund; block pay on non-pending | M |
| BIZ-04 | B | **Schedule cancel or delete strands paid bookings** (no refunds, notifications or block) | `actions/schedules.ts:168-190`; `archiveTourService` | Block while paid bookings exist, or cascade cancel + refund + notify; optional organizer penalty | M |
| BIZ-05 | B* | **Private-format pricing mismatch**: one booking consumes full capacity but is charged per seat chosen | trigger `20260830030000:31-33` vs `services/bookings.ts:33` | Flat private price, or force seats = capacity (\*Blocker only if private tours are listed) | S |
| BIZ-16 | H | **Cancellation policy** is hard-coded as a full refund up to start (UTC compare); it contradicts the marketing copy "free cancellation up to 24h"; MDR lost | `bookings.ts:283-294`; `HeroSection.tsx:86` | Define a tiered policy per tour; show it at checkout; Manila timezone | M |
| BIZ-17 | H | **Disputes**: no reason or evidence; no admin or organizer notification on open; traveler not told the outcome | `bookings.ts:340-469` | Reason + attachments; notifications; SLA tracking | M |
| BIZ-18 | M | **Pending bookings can't resume payment**; booking detail, receipt and meeting point missing | `bookings.ts:226`; traveler bookings | "Pay now" that reuses the live PaymentIntent; booking detail page | S–M |
| BIZ-19 | M | **Capacity edits**: lowering below `booked_count` raises a raw DB error; capacity edits after a private booking corrupt `booked_count` | `schedules.ts:91-99`; trigger `:44-46` | Validate `capacity >= booked_count`; store consumed seats per booking | S |

#### Partners, approval and trust

| ID | Sev | Finding | Evidence | Fix | Eff |
|---|---|---|---|---|---|
| BIZ-06 | B | **Partners auto-approved; no KYC**; tour publish and vehicle create aren't gated on approval; rejected transporters stay discoverable | `actions/organizer.ts:44`; `actions/transporter.ts:49`; `actions/tours.ts:124-142`; `actions/vehicles.ts:53,275-293` | Insert `pending`; gate publish, vehicle create, requests and payouts on `approved` (+ KYC); filter discovery | M |
| BIZ-07 | B | **`rejectOrganizer` is a silent no-op** (RLS client, no admin policy) and sends no notification | `actions/admin.ts:59-91` | Admin client + rows-affected check + notify | S |
| BIZ-08 | H | **Company name not enforced** for company-type partners | `OrganizerOnboardingForm.tsx:52`; `actions/organizer.ts:27-45`; `actions/transporter.ts:31` | zod conditional refine | S |
| BIZ-09 | H | **Publish rules**: no itinerary or future-schedule requirement; `status` is a free string | `services/tours.ts:117-136`; `lib/schemas/tour.ts:13` | `z.enum`; publish checklist | S |

#### Accounts, discovery and communications

| ID | Sev | Finding | Evidence | Fix | Eff |
|---|---|---|---|---|---|
| BIZ-10 | B | **No password reset** | `app/login/page.tsx` | Forgot/reset pages with `resetPasswordForEmail`; rate limit | S |
| BIZ-11 | B | **Profile forms don't save** (traveler, organizer; admin "Admin Profile" password form is a no-op) | `TravelerProfileForm.tsx:23-28`; `OrganizerProfileForm.tsx:34-39`; `updateProfileName` unused (`actions/profile.ts:10`) | Wire to `updateProfileName`; build `updateOrganizerProfile`; remove the admin stub | S |
| BIZ-12 | B | **Email verification undefined**: with Supabase "confirm email" on, signup can't create the profile (RLS) and `/login` doesn't show the message; with it off, unverified users book and pay | `actions/auth.ts:195-234` | Create the profile in an `auth.users` trigger; decide the confirm setting; gate booking, publish and payout on verified | M |
| BIZ-13 | B | **Discovery broken**: no `/tours` page (dashboard links 404); hero search does nothing; footer links point to `#`; catalog has no filters and paginates in memory | `dashboard/traveler/page.tsx:111,219`; `HeroSection.tsx:39-47`; `Footer.tsx:26-39`; `lib/data/tours.ts:15-95` | `/tours` with query-param filters (location, dates, price, duration) pushed into SQL with `.range()` | M |
| BIZ-14 | B | **Travelers never receive emails** (confirmation, cancellation, refund, reminder, dispute outcome), although the UI says they will; no traveler in-app notifications | `success/page.tsx:27`; `booking/[bookingId]/page.tsx:61`; `actions/notifications.ts` | Transactional templates via one `lib/email.ts` sender; in-app notifications | M |
| BIZ-15 | H | **Signup**: no role or partner path (partners sign up as travelers then add a role); "Become an Organizer" CTAs dead; no return-to after login; password minimum 6 | `SignupForm.tsx:32-83`; `PartnersSection.tsx:16,19`; `TourBookingCard.tsx:54`; `pay/page.tsx:17` | Partner signup path; honour `?next=`; minimum 8 | S |
| BIZ-20 | H | **Reviews**: travelers can't write reviews; no eligibility (completed booking) or uniqueness; no publish queue (new reviews would stay `pending`); no rating recalculation; transporter reviews query joins a non-existent relation (always empty) and shows "5.0" with no ratings | `…011.sql:27-32`; `ReviewsClient.tsx:49-50`; `actions/transporter.ts:175-178`; `transporter/reviews/page.tsx:33` | Review action tied to a completed booking, unique per booking; admin publish/reject; rating trigger; fix the join; "No ratings yet" | M |
| BIZ-21 | B | **Seeded fake "published" reviews in migrations** | `…011.sql:59-78` | Hide or delete via migration | S |

#### Transport (decide MVP scope first: see the decision log)

| ID | Sev | Finding | Evidence | Fix | Eff |
|---|---|---|---|---|---|
| BIZ-22 | B† | **No price or quote on transport requests**: `estimated_price` is never set, so transporters are never paid | `actions/transport-requests.ts:313-391`; cron `:136` | Transporter quote on accept, organizer approval; or defer payouts | M |
| BIZ-23 | B† | **No conflict check** on send or accept (accept only warns if the block insert fails), so vehicles can be double-booked | `transport-requests.ts:115-147`; `schedules.ts:41-53` | Overlap check plus insert in one transaction; 409 | S |
| BIZ-24 | H† | **Lifecycle gaps**: transporter can "complete" any time (skipping the payout cron); organizer can't cancel a request or see a list of requests; schedule edits reset `transport_status` and don't sync dates; `sendTransportRequest` doesn't notify the transporter or validate ownership | `transport-requests.ts:274-285,328-384`; `schedules.ts:89,98` | Transport service with guarded transitions; cron-only completion; notifications; ownership checks | M |

† Blocker only if the external-transporter marketplace launches with payouts at MVP.

### 4.4 Coding standards & engineering

| ID | Sev | Finding | Evidence | Fix | Eff |
|---|---|---|---|---|---|
| ENG-01 | B | **Next.js 16.3.2 critical advisories** (RCE in image optimizer and `next/og`, SSRF, cache poisoning); fixed in 16.3.8 | `npm audit` | Bump `next` + `eslint-config-next` to ≥16.3.8 (don't use `npm audit fix --force`) | S |
| ENG-02 | H | **No tests for money, RLS or actions; no CI**. 0 unit tests; 20 Playwright tests, all logged-out; `test:qa` mostly checks that tables exist, and its audit probe **hard-deletes `admin_audit_logs` rows** in the live DB | `scripts/qa-smoke-test.ts`; no `.github/` | See the test plan in Phase 5 | L |
| ENG-03 | H | **Sentry never loads**: no `instrumentation.ts` / `instrumentation-client.ts`; `sentry.client.config.ts` doesn't work under Turbopack; no `onRequestError`; no source maps | `sentry.*.config.ts` | Add the instrumentation files and `captureRequestError`; upload source maps; `beforeSend` PII scrubbing | S |
| ENG-04 | M | **Server Action contract not applied** to legacy actions: `schedules.ts` (33 raw `formData.get`, no auth), `organizer.ts`, `transporter.ts`, `vehicles.ts`, `transport-requests.ts`, `availability.ts`, `wallet.ts`, `profile.ts`, `otp.ts`, `notifications.ts` (no zod and/or rate limit; `{error}`-only returns) | per file | Migrate to the §3.2 template while fixing the related BIZ/SEC items | M |
| ENG-05 | M | **Type safety**: `types/supabase.ts` stale and `Database` imported nowhere (all clients untyped); 219 `no-explicit-any`; 87 `catch (e: any)`; columns used in code with no migration (`bookings.paymongo_session_id`, `tours.latitude/longitude`) | ESLint; `types/supabase.ts` | Regenerate; type the clients; `ADD COLUMN IF NOT EXISTS` migration; `catch (e: unknown)` | M |
| ENG-06 | M | **`unstable_rethrow` used nowhere**: getters swallow `redirect`/`notFound`/dynamic bailouts (noisy build errors) | grep | Add it to every render-time catch | S |
| ENG-07 | M | **Migration chain unhealthy**: duplicate `20260831000000`; `websites` never created; `uuid-ossp` missing; no `supabase/config.toml` (no local stack or shadow DB) | `supabase/migrations/` | Baseline with `supabase db dump`; local stack; rename the duplicate (needs approval) | L |
| ENG-08 | M | **Timezone inconsistencies** (UTC vs Asia/Manila) in cron thresholds, catalog cutoffs, cancel cutoff, transport pickup display (8 hours off), availability dates | cron `:28`; `lib/data/tours.ts:64`; `bookings.ts:284`; `TransportRequestsClient.tsx:243-260`; `transport-requests.ts:129-131` | `lib/datetime.ts` with Manila helpers; SQL `AT TIME ZONE 'Asia/Manila'` | M |
| ENG-09 | M | **No shared formatters**: 81 locale-less `toLocale*`, 40 `en-US`, 0 `en-PH`, 69 hand-built `₱` strings (hydration-mismatch risk) | grep | `lib/format.ts` (`formatPHP`, `formatDate`) | S |
| ENG-10 | M | **Performance**: catalog selects every tour with every schedule and review, then filters in JS (hits the 1000-row cap); tour detail uncached and fetched twice; middleware runs a roles query on every request; 0 `.range()` calls; admin lists unbounded | `lib/data/tours.ts:20-113`; `app/tours/[slug]/page.tsx:16,46`; `lib/supabase/middleware.ts:33,41` | SQL-side filters/view; `cache()` + tag cache; role query only on gated paths; server pagination | M |
| ENG-11 | M | **Missing route segments**: no `loading.tsx`/`error.tsx` for `/tours/**` (booking, pay, success) | `app/` | Add them | S |
| ENG-12 | M | **Two email senders**, different from-addresses; links hardcoded to `https://travi.app` (site is `travi.ph`); Resend domain unverified | `actions/notifications.ts:53,201…`; `lib/email.ts:8` | One sender; links from `NEXT_PUBLIC_SITE_URL`; verify SPF/DKIM | S |
| ENG-13 | M | **Phone OTP unusable**: SMS is a console mock | `lib/sms.ts` | PH SMS provider (e.g. Semaphore), or disable phone channels at launch | M |
| ENG-14 | L | **Hygiene**: 52 `console.*`; 19 `process.env` outside `env.ts`; 37 `confirm/alert/prompt`; 8 files > 400 lines; 13 `<img>`; 47 dynamic `await import()` in actions; `getPublicSupabase` copied 3×; `unstable_cache` deprecated in favour of `use cache` | Appendix A | Clean up incrementally under the §3 rules | M |
| ENG-15 | L | **Dependencies**: unused `stripe`, `@stripe/stripe-js`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers` (pulls vulnerable `fast-uri`); 5 unused Radix primitives; `@types/*` in `dependencies`; `moment` via react-big-calendar | `npm ls`; `npm audit` | Remove them; move the types; date-fns localizer | S |
| ENG-16 | L | **Repo junk**: tracked `error.html`, `lint_results.txt`, `output.json`, `script_output.txt`, `test-query.*`, `test-vehicles.ts`, `seed-other-transporter.ts`, `scratch/`, `playwright-report/`, `test-results/`; `.gitignore` gaps; `.env.example` untracked; README is boilerplate; outdated landing e2e spec | repo root | `git rm --cached` + ignore; commit `.env.example`; README; fix the spec | S |
| ENG-17 | L | **SEO gaps**: no `metadataBase`/canonical; no `noindex` on booking/pay pages; sitemap `lastModified` is `new Date()`; LCP hero image hotlinked from `image.qwenlm.ai` as `<img>` | `app/layout.tsx`; `app/sitemap.ts`; `HeroSection.tsx:69-71` | Add them; self-host the hero with `next/image priority` | S |

### 4.5 Operations

| ID | Sev | Finding | Evidence | Fix | Eff |
|---|---|---|---|---|---|
| OPS-01 | B | **Escrow cron not scheduled** (no `vercel.json`, no GitHub Actions, no pg_cron call) | repo | `vercel.json` `crons` with `CRON_SECRET`; `maxDuration`; alert on failure | S |
| OPS-02 | B | **Destructive scripts with no target guard** (e.g. `scripts/update-bookings.js` sets every non-confirmed booking to `confirmed` using `NEXT_PUBLIC_SERVICE_ROLE_KEY`) | `scripts/update-bookings.js:10-14`; `fix-overbooking.mjs`; `fix-booking-statuses.mjs` | Delete, or require `--project-ref` confirmation + dry-run default | S |
| OPS-03 | B | **One Supabase project for dev, QA and production**; image host hardcoded | `next.config.ts`; `.env.local`; `scripts/*` | Separate staging + production projects; env-driven image host; PITR on production | M |
| OPS-04 | H | **No monitoring or runbook**: no `/api/health`, uptime, alerting on webhook/cron failures; no backup/restore or admin-bootstrap procedure | repo | Health endpoint; uptime monitor; Sentry alerts; `docs/RUNBOOK.md` | M |
| OPS-05 | H | **No support channel**: dispute UI says "contact support" with nowhere to go | `Footer.tsx:3`; `TravelerBookingsClient.tsx:57` | Contact page + support inbox; admin case notes | S |
| OPS-06 | H | **Admin can't refund or cancel outside disputes**; no partial refunds; can't unpublish tours; no user management (suspend, roles UI); no transport-request oversight; no audit-log viewer; no finance page or exports | `admin.ts:227` (no UI); `ToursClient.tsx` | Admin booking actions, tour unpublish, `/admin/users`, `/admin/transport`, `/admin/audit`, `/admin/finance` (+CSV) | L |
| OPS-07 | M | **Maker-checker missing on payouts** (one admin approves and marks paid) | `actions/admin.ts:289-361` | Two-person rule above a threshold; audit | S |

### 4.6 Legal, tax & compliance

*All items below need confirmation by Philippine counsel and a tax adviser.*

| ID | Sev | Requirement | Status / evidence | Action | Eff |
|---|---|---|---|---|---|
| LEG-01 | B | **Terms of Service** (traveler), age 18+, platform role/liability | Missing; footer `#` (`Footer.tsx:46`); checkout references "our terms" | Draft + `/terms`; versioned acceptance at signup and checkout | M |
| LEG-02 | B | **Privacy Policy & consent (RA 10173 Data Privacy Act)**: purposes, recipients (organizers see traveler data), processors (Supabase, Resend, Sentry, Upstash, PayMongo, Vercel), retention, rights, DPO | Missing; no consent checkbox (`SignupForm.tsx`) | `/privacy`; consent checkbox with version + timestamp; DPO; NPC registration if thresholds are met; 72-hour breach procedure | M |
| LEG-03 | B | **Refund & cancellation policy** consistent with the code and marketing | Missing; code and copy disagree (BIZ-16) | Publish; show at checkout (PayMongo merchant onboarding typically requires it) | S |
| LEG-04 | B | **Business identity**: DTI/SEC registered name, address, TIN, contact | Missing in footer and terms | Footer + Terms disclosure | S |
| LEG-05 | B | **Partner agreements** (Organizer/Transporter Terms): commission, escrow hold, payout timing, chargebacks, cancellation obligations, liability, insurance | Missing | Click-through with versioning at onboarding | M |
| LEG-06 | B | **Internet Transactions Act (RA 11967)**: merchant verification, merchant identity shown to buyers, complaints/redress | Auto-approve; no KYC; no complaints channel | KYC (BIZ-06); show organizer legal name and contact on tour pages; complaints process (OPS-05) | M |
| LEG-07 | B | **Truthful advertising (Consumer Act RA 7394)**: "400+ tours… vetted local experts", "Best price guaranteed", "free cancellation up to 24 hours", "4.8/5 · 12,400+ verified reviews", seeded fake reviews | `HeroSection.tsx:7-18,85-86,103`; `…011.sql:59-78` | Replace with real data or remove before launch | S |
| LEG-08 | B | **Payments & tax structure**: is holding partner funds in internal wallets a BSP-regulated activity (NPS Act RA 11127, e-money/OPS)? Merchant of record vs agent (VAT base)? BIR invoicing under EOPT (RA 11976); e-marketplace withholding (RR 16-2023); VAT on commission; 2307 certificates | Not addressed | Legal + tax opinion **before Phase 2 design is final**; consider PayMongo-native split/payout features; implement invoice/withholding as advised | M (+ counsel) |
| LEG-09 | H | **Sector licensing**: DOT accreditation (tour operators); LTFRB franchise / DOT tourist-transport accreditation, OR/CR, insurance (transporters) | Not captured (`actions/vehicles.ts:57-63`) | Collect + verify documents; "accredited" badge; required for transport | M |
| LEG-10 | H | **Data subject rights**: access, correction, erasure, portability | No account deletion or export | Self-serve export + deletion request; admin workflow | M |
| LEG-11 | M | **Cookie policy** | Footer `#`; current cookies appear strictly necessary and Vercel Analytics is cookieless | Publish the policy; reassess if marketing pixels are added | S |

---

## 5. Launch roadmap

### Decisions needed before Phase 2

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | **Funds-holding model** (LEG-08) | (a) Internal wallets + manual payouts (today); (b) PayMongo-native split/payouts so Travi never holds partner funds | Get a legal opinion first. If (a), keep escrow small and fast, with KYC. Design Phase 2 RPCs so the model can be switched later |
| D2 | **Transport at MVP** | (a) Full marketplace with quotes and payouts; (b) coordination only (requests/accept, organizer pays transporter off-platform); (c) hide | **(b)**: removes BIZ-22 and the transport payout cron, about −1 week |
| D3 | **Private tours at MVP** | Flat private price vs force seats = capacity vs hide | Flat `private_price` on the schedule |
| D4 | **Cancellation policy and MDR** | Who absorbs PayMongo fees; tiered refunds | Tiered per tour (e.g. 100% ≥7 days, 50% ≥48 hours, 0% after); MDR deducted from the organizer net, or a small traveler service fee |
| D5 | **Phone OTP** | Integrate an SMS provider vs email-only at launch | Email-only at launch; hide phone OTP options |
| D6 | **Mobile API (`/api/*` Bearer)** | Fix now vs remove until mobile exists | Remove/disable; reintroduce post-launch |

---

### Phase 0: Stop the bleeding (≈1 week)

**Goal:** close the trivially exploitable holes and misconfigurations. All of these are small and independent.

| Task | Refs | Details | Eff |
|---|---|---|---|
| 0.1 Upgrade Next.js | ENG-01 | `next` + `eslint-config-next` → ≥16.3.8; full QA gate | S |
| 0.2 Remove hardcoded credentials | SEC-07 | Delete `app/api/test-login`; remove the admin login pre-fill and hint; rotate the `admin@travi.ph` and test-account passwords; remove `ADMIN_PWD` from `.env.local` | S |
| 0.3 Fail-closed secrets | SEC-10, FIN-09, FIN-05 | `lib/env.ts`: add `CRON_SECRET`, `OTP_SECRET`, `PAYMONGO_*`, `RESEND_*`, `NEXT_PUBLIC_SITE_URL`; required when `NODE_ENV=production`; reject `sk_test_` in production; remove the `NEXT_PUBLIC_SERVICE_ROLE_KEY` and OTP fallbacks; cron returns 401 when the secret is missing; update `.env.example` and commit it | S |
| 0.4 JSON-LD XSS | SEC-08 | Escape `<` in `TourJsonLd`; add a unit test | S |
| 0.5 Disable unsafe booking actions in the UI and server | BIZ-02, FIN-10 | Remove organizer "Confirm"; `updateBookingStatus` only `pending→canceled`; `processPayment` owner + `pending` only, server-built `returnUrl` | S |
| 0.6 Lock down exported helpers | SEC-06 | Move notification/OTP helpers to `lib/`; add auth to `verifyPaymentAndUpdateBooking` (owner check) | M |
| 0.7 Admin page checks | SEC-15 | `requireSession` + `assertRole('admin')` on `admin/bookings` and `admin/tours` | S |
| 0.8 Script guards | OPS-02 | Delete or guard destructive `scripts/*`; stop `test:qa` deleting audit rows | S |
| 0.9 Environments | OPS-03 | Create a staging Supabase project and env-driven image host; production gets PITR. From here on, all development runs against staging | M |
| 0.10 Truthful marketing | LEG-07, BIZ-21 | Remove false hero claims, USD prices and fake counts; migration to hide seeded reviews | S |

**Exit criteria:** `npm audit` shows no critical issues; no credentials in source; production refuses to boot without secrets; staging exists; QA gate green.

#### Phase 0 status (2026-10-22, branch `fix/phase-0-hardening`)

| Task | Status | Notes |
|---|---|---|
| 0.1 Next.js upgrade | ✅ Done | `next` + `eslint-config-next` 16.3.8; `npm audit` shows no critical |
| 0.2 Hardcoded credentials | ✅ Code done · ⏳ **Human** | `/api/test-login` deleted; admin login pre-fill and hint removed. **Still to do:** rotate the passwords of `admin@travi.ph` and the old test account; delete `ADMIN_PWD` from `.env.local` |
| 0.3 Fail-closed secrets | ✅ Done | `lib/env.ts`: with `APP_ENV`/`VERCEL_ENV=production`, 12 secrets are required at startup and PayMongo must be `sk_live_`. Dedicated `OTP_SECRET`; `NEXT_PUBLIC_SERVICE_ROLE_KEY` fallback removed; cron fails closed (constant-time compare); OTP codes no longer logged; SMS mock refuses in production |
| 0.4 JSON-LD XSS | ✅ Done | `lib/json-ld.ts` `serializeJsonLd()` (unit test lands with the Phase 5 test runner) |
| 0.5 Unsafe booking actions | ✅ Done | Organizer "Confirm" removed; `updateBookingStatus` is `pending → canceled` only. `processPayment`: owner + `pending` only, zod, rate limit, server-built return URL |
| 0.6 Exported helpers | ✅ Done | Notification senders → `lib/notifications.ts`; OTP helpers → `lib/otp.ts` (typed claims, bound to the user); payment verification → `lib/services/payments.ts` (owner-only, `pending → confirmed` only, late payments flagged instead of re-confirmed). The success page requires the owner's session |
| 0.7 Admin page checks | ✅ Done | `admin/bookings`, `admin/tours` |
| 0.8 Script guards | ✅ Done | `scripts/update-bookings.js` deleted; write-capable scripts require `CONFIRM_DB_WRITE=<project-ref>`; `test:qa` audit probe is now read-only |
| 0.9 Environments | 🟡 Partial · ⏳ **Human** | Image host now follows `NEXT_PUBLIC_SUPABASE_URL`. **Still to do:** create the staging Supabase project, enable PITR on production, set the new env vars in Vercel (`APP_ENV`, `OTP_SECRET`, `CRON_SECRET`, …) |
| 0.10 Truthful marketing | ✅ Code done · ⏳ **Human** | Hero claims, USD prices and invented counts removed; stats show real data only. Migration `20261022120000_hide_seeded_demo_reviews.sql` written; **apply with `supabase db push` after review** |

Also fixed: the outdated landing e2e spec (`e2e/landing-page.spec.ts`). QA gate: lint 0 errors (270 warnings, down from 278), build ✅, `test:qa` 27/27, `test:e2e` 20/20.

---

### Phase 1: Database security hardening (≈1.5 weeks)

**Goal:** RLS becomes a real security boundary, so that every mutation of money or status runs through server code or `SECURITY DEFINER` RPCs. Ship as one reviewed migration set, applied to staging first. `supabase db push` to production requires human approval.

| Task | Refs | Details | Eff |
|---|---|---|---|
| 1.1 Roles | SEC-01 | Drop the self-INSERT on `user_roles`; `assign_self_role(role)` RPC allow-listing non-admin roles; admin grants only via the admin action | S |
| 1.2 Bookings | SEC-02, BIZ-01 | Revoke traveler UPDATE; INSERT check: `status='pending'`, `traveler_id` = self; server price enforced in a BEFORE INSERT trigger (`total_amount` recomputed); schedule open/future/published guard in the trigger | M |
| 1.3 Transport bookings | SEC-03 | Replace the `FOR ALL` policies: organizer INSERT pending/no-price on an owned schedule with a matching vehicle; transporter SELECT + `respond_transport_request()` RPC | M |
| 1.4 Payout requests & wallets | SEC-04, FIN-13 | Drop the INSERT policy; `CHECK (balance >= 0)`; unique `(reference_type, reference_id, type)`; `REVOKE EXECUTE` on balance RPCs from anon/authenticated | S |
| 1.5 Profiles & status columns | SEC-05, SEC-14 | Column-level GRANTs (`user_profiles`: name/avatar only); partner `status`/rating columns service-role only; reviews insert `pending` only; notifications insert service-role only; no DELETE on tours/schedules; FK `RESTRICT` from bookings | M |
| 1.6 PII exposure | SEC-13 | Public views (`public_transporters`, `public_vehicles`, `public_organizers`) with safe columns; restrict base tables; column-limited organizer→traveler view | M |
| 1.7 Storage | SEC-17 | `tour-images`: MIME allow-list, size limit, path prefix `auth.uid()` | S |
| 1.8 Function hygiene | SEC-20 | `SET search_path` on definer functions | S |
| 1.9 RLS test suite | ENG-02 | Per-role JWT tests (anon, traveler, organizer, transporter, admin) asserting each hole above is closed. Runs in CI against staging | M |
| 1.10 Regenerate types | ENG-05 | `supabase gen types`; add the missing columns (`paymongo_session_id`, `latitude`, `longitude`) via `IF NOT EXISTS` | S |

**Exit criteria:** the RLS test suite passes and every hole in §4.2 rows SEC-01…05, 13, 14, 17 has a failing-before/passing-after test.

---

### Phase 2: Payments, ledger and payouts (≈2 weeks)

**Goal:** every peso is traceable. Confirmation is idempotent and verifiable, and payouts are atomic. Depends on D1 and Phase 1.

| Task | Refs | Details | Eff |
|---|---|---|---|
| 2.1 Payments table | FIN-10, FIN-11 | `payments` (booking_id, provider, intent_id, payment_id, status, gross, mdr_fee, net, currency PHP, refund_id, refunded_amount, raw event ids); `processPayment` reuses a live PaymentIntent and records rows | M |
| 2.2 Confirmation service | FIN-01, FIN-02, FIN-04, BIZ-03 | One `confirm_booking_payment(booking_id, payment_id, amount)` definer function: `pending→confirmed` only, amount assert, fee snapshot, `escrow_deposit` ledger + escrow increment for the **correct** wallet, all in one transaction. Used by the success page and the webhook. Late payment on an expired booking: re-confirm if capacity allows, else enqueue an auto-refund | M |
| 2.3 Webhook | FIN-03 | Raw-body HMAC verification (`PAYMONGO_WEBHOOK_SECRET`); `metadata.booking_id`; re-fetch the payment from the API; idempotent on event id; handle `payment.paid`, `payment.failed`, `payment.refunded`; always 2xx after durable work | M |
| 2.4 Escrow release | FIN-05, FIN-18, OPS-01 | `release_booking_escrow(booking_id)` definer function (row lock, idempotent); cron iterates eligible bookings; Manila-date threshold; `vercel.json` schedule; Sentry alert on failure | M |
| 2.5 Payouts | FIN-06…08, FIN-21, FIN-20, OPS-07 | `request_payout(amount, saved_method_id)` RPC (atomic debit + ledger + request); minimum from settings; KYC/approved gate; `mark_payout_paid`/`reject_payout` RPCs keyed by request id (wallet derived), rows-affected checked; maker-checker above a threshold; payout method numbers encrypted and masked | M |
| 2.6 Refunds | FIN-17, BIZ-04, BIZ-16 | Refund service with state machine (`refund_pending → refunded/failed`), PayMongo refund id stored, escrow reversal via RPC, partial amounts by policy; used by traveler cancel, schedule cancel cascade, admin refund and dispute | M |
| 2.7 Platform revenue & MDR | FIN-15, FIN-16 | Platform wallet + `platform_fee` rows; MDR recorded per payment; organizer dashboards show net | S |
| 2.8 Settings | FIN-14 | Fix the singleton query; zod bounds; `??`; audit; fee history table | S |
| 2.9 Audit & invariants | FIN-12, FIN-22 | `logMutation` on all money paths; append-only trigger on `wallet_transactions`; documented sign convention; nightly invariant job (Σ ledger = balances) that alerts on drift | S |
| 2.10 Backfill & reconciliation | FIN-01, FIN-11 | One-off script (staging first, then approved for production): rebuild deposits for confirmed bookings from PayMongo; daily reconciliation job PayMongo ↔ `payments` ↔ ledger; admin finance page + CSV | M |
| 2.11 Money-flow tests | ENG-02 | Integration tests with mocked PayMongo: pay→confirm (success page and webhook, duplicate events), release ×2 idempotent, cancel/refund, dispute blocks release, concurrent payout rejected, mark-paid replay rejected | M |
| 2.12 Transport payouts (only if D2 = a) | BIZ-22 | Quote on accept, organizer approval, payout on cron-completed | M |

**Exit criteria:** money-flow test suite green. A staging run with PayMongo **test** keys covers the full lifecycle (book → pay → webhook → release → payout → reject/refund) with ledger = balances and no orphaned payments.

---

### Phase 3: Business-logic completion (≈2.5 weeks)

**Goal:** every MVP journey works end to end without dead ends.

| Task | Refs | Details | Eff |
|---|---|---|---|
| 3.1 Booking guards & UX | BIZ-01, BIZ-18, BIZ-05, BIZ-19 | Server guards (if not fully covered by 1.2); "Pay now" for pending; booking detail page (meeting point, itinerary, receipt link); private pricing per D3; capacity edit validation | M |
| 3.2 Schedule cancellation cascade | BIZ-04 | Organizer cancel: confirm dialog listing affected bookings, then refund service, then notifications | S |
| 3.3 Partner approval & KYC | BIZ-06, BIZ-07, BIZ-08, LEG-06, LEG-09 | Onboarding creates `pending`; KYC fields + document upload (ID, DTI/SEC, BIR TIN, bank-name match, DOT/LTFRB docs); admin review screen; gate publish, vehicle create, requests and payouts on `approved`; fix reject + notifications; company-name rule | L |
| 3.4 Accounts | BIZ-10, BIZ-11, BIZ-12, BIZ-15 | Forgot/reset password; profile saves; `auth.users` → `user_profiles` trigger; email-confirm decision and verified gating; partner signup path; `?next=` return; password min 8 | M |
| 3.5 Discovery | BIZ-13, ENG-10 | `/tours` catalog with filters (destination, dates, price, duration, format, theme) in SQL; hero search routes to it; footer links; pagination | M |
| 3.6 Communications | BIZ-14, ENG-12 | One email sender; templates: booking confirmed (with receipt), payment failed, cancellation/refund, trip reminder (T-2 days, cron), dispute opened/resolved, partner approved/rejected, payout paid/rejected; traveler in-app notifications | M |
| 3.7 Disputes | BIZ-17 | Reason + evidence upload; notify admin and organizer; traveler outcome email; admin case notes | M |
| 3.8 Reviews | BIZ-20 | Traveler review after a `completed` booking (unique per booking); admin publish/reject queue; rating recalculation trigger; fix transporter reviews query; "No ratings yet" | M |
| 3.9 Publish rules | BIZ-09 | `z.enum` status; publish checklist (itinerary, ≥1 future open schedule, approved organizer) | S |
| 3.10 Transport per D2 | BIZ-23, BIZ-24 | Conflict check in transaction; guarded transitions; organizer request list + cancel; notifications; ownership validation; date sync on schedule edits | M |
| 3.11 Admin tooling | OPS-06 | Admin cancel/refund/partial refund; tour unpublish with reason; `/admin/users` (search, suspend, roles); `/admin/transport`; `/admin/audit` viewer | L |
| 3.12 Legacy action migration | ENG-04 | Bring every touched action to the §3.2 contract (zod, auth, role, ownership, rate limit, return shape) | M |

**Exit criteria:** authenticated e2e journeys pass for each role (see Phase 5), with no stub forms and no `#` links in navigation.

---

### Phase 4: Legal, content and trust (≈1 week of engineering; external legal in parallel from Phase 0)

| Task | Refs | Details | Eff |
|---|---|---|---|
| 4.1 Legal opinions | LEG-08 | Counsel + tax adviser: funds-holding model, merchant of record, VAT, withholding, invoicing. Feeds D1 | (external) |
| 4.2 Policy pages | LEG-01…04, LEG-11 | `/terms`, `/privacy`, `/refund-policy`, `/cookies`, `/about`, `/contact`, `/faq`; footer business identity | M |
| 4.3 Consent capture | LEG-01, LEG-02, LEG-05 | Versioned acceptance records (user, document, version, timestamp) at signup, checkout and partner onboarding | S |
| 4.4 Partner agreements | LEG-05 | Organizer and Transporter Terms (commission, escrow, payouts, chargebacks, cancellations, liability, insurance) | S (eng) |
| 4.5 Data subject rights | LEG-10, LEG-02 | Account data export; deletion request flow (with booking/ledger retention rules); DPO contact; breach procedure doc | M |
| 4.6 Invoicing / tax | LEG-08 | Per counsel: invoice numbering and PDF for platform fees; withholding in payout computation; 2307 generation | M (if required) |
| 4.7 Merchant transparency | LEG-06 | Organizer legal name + contact on tour pages; complaints process linked from bookings | S |

**Exit criteria:** counsel sign-off on policies and the payments structure; all footer and legal links live; acceptance records stored.

---

### Phase 5: Quality, observability and operations (≈1.5 weeks; tests written alongside Phases 1–3)

| Task | Refs | Details | Eff |
|---|---|---|---|
| 5.1 CI pipeline | ENG-02 | GitHub Actions: `npm ci` → lint → `tsc` → build → vitest → RLS/integration tests (staging) → Playwright against preview; required on PRs | S |
| 5.2 Unit tests | ENG-02 | Pricing, fees (incl. 0% and `??`), pesos↔centavos, escrow eligibility, Manila date helpers, zod schemas, webhook signature, OTP hashing, JSON-LD escaping | M |
| 5.3 Authenticated e2e | ENG-02 | Playwright `storageState` per role on seeded staging users: traveler books and pays (test mode); organizer creates tour/schedule/publishes; transporter accepts a request; admin approves a partner and a payout. Fix landing spec | M |
| 5.4 Sentry | ENG-03 | Instrumentation files, `onRequestError`, source maps, PII scrubbing, alerts (webhook, cron, payout errors) | S |
| 5.5 Monitoring & runbook | OPS-04 | `/api/health`; uptime checks on `/`, health and the cron; `docs/RUNBOOK.md` (deploys, migrations, admin bootstrap via SQL, PITR restore, incident and breach response, manual payout procedure, reconciliation) | M |
| 5.6 Security headers & MFA | SEC-16, SEC-12 | CSP/HSTS/frame-ancestors; admin TOTP MFA with `aal2` gate | M |
| 5.7 OTP rework | SEC-09, SEC-11, D5 | Server-side hashed OTP with attempts and expiry, bound to the user; rate limits; email-only at launch | M |
| 5.8 Timezone & formatting | ENG-08, ENG-09 | `lib/datetime.ts`, `lib/format.ts`; replace ad-hoc usages on booking, transport and money surfaces | M |
| 5.9 Performance | ENG-10, ENG-11, ENG-17 | Catalog SQL filters, tour-detail caching, middleware role query scope, `loading`/`error` segments, self-hosted hero image, `metadataBase`, `noindex` on booking pages | M |
| 5.10 Hygiene | ENG-06, ENG-14…16 | `unstable_rethrow`; remove unused deps; repo junk + `.gitignore`; README | S |

**Exit criteria:** CI green and required on PRs; Sentry receiving test errors; uptime alerts firing in a drill; runbook reviewed.

---

### Phase 6: Launch readiness (≈1 week)

| Task | Details |
|---|---|
| 6.1 PayMongo go-live | Live account onboarding (business docs, refund policy URL), `sk_live_` keys in Vercel production env, webhook registered with secret, small real-money test (₱20–100) through the full lifecycle including refund |
| 6.2 Production migration | Apply Phase 1–2 migrations to production (human-approved `supabase db push`), run the backfill (2.10) with reconciliation report signed off |
| 6.3 UAT | Scripted UAT per role on staging with real devices (mobile web, GCash and Maya apps); accessibility spot-check (WCAG AA) |
| 6.4 Seed real supply | Onboard 5–10 KYC'd organizers with real tours and schedules; remove all demo data |
| 6.5 Security review | Re-run this audit's checklist; external pen-test of auth/RLS/payments if budget allows |
| 6.6 Soft launch | Invite-only or single destination; daily reconciliation and invariant checks; on-call rota; rollback plan (Vercel instant rollback + PITR) |
| 6.7 Go/no-go meeting | Walk the checklist in §6 |

---

## 6. Go / no-go launch checklist

**Security**
- [ ] RLS suite green: no self-admin, no booking/payout/transport forgery, no self-publish reviews, PII not public
- [ ] No hardcoded credentials; `test-login` gone; admin MFA on
- [ ] Production secrets required and set; `sk_live_` key; webhook secret; cron secret
- [ ] `npm audit`: no critical/high in runtime dependencies
- [ ] Security headers + CSP deployed; JSON-LD escaped; uploads restricted

**Money**
- [ ] Webhook signature verified; confirmation idempotent and amount-checked
- [ ] Every confirmed booking has exactly one `escrow_deposit` and correct fee
- [ ] Escrow release scheduled, idempotent, alerting; ledger = balances invariant passing nightly
- [ ] Payout request, mark-paid and reject are atomic; maker-checker; payout destinations from saved, OTP-verified methods only
- [ ] Refunds tracked with PayMongo refund ids; late-payment path tested
- [ ] Reconciliation report PayMongo ↔ ledger for the soft-launch period is clean

**Product**
- [ ] Password reset, profile save, email verification, `/tours` catalog working
- [ ] Traveler confirmation/cancellation/refund emails delivered (SPF/DKIM verified)
- [ ] Partners KYC'd and approved before publishing or receiving money
- [ ] Organizer cannot confirm unpaid bookings; schedule cancel refunds travelers
- [ ] Support/contact channel staffed

**Legal**
- [ ] Terms, Privacy, Refund, Cookie, Partner Terms published and accepted with versioning
- [ ] Business identity in footer; marketing claims truthful; demo reviews removed
- [ ] Counsel sign-off on funds-holding model, VAT/withholding/invoicing

**Ops**
- [ ] Separate staging and production; PITR on; runbook reviewed
- [ ] Sentry and uptime alerts routed to on-call
- [ ] CI required on `main`

---

## 7. Post-launch future improvements

### First 90 days (stabilize & grow)
- **Payments**
  - Card payments (PayMongo cards with 3-DS).
  - QR Ph and online banking.
  - Saved payment methods.
  - Instalments for high-value tours.
- **Automated payouts** via PayMongo payouts / InstaPay–PESONet APIs, plus scheduled payout batches and partner statements (monthly PDF).
- **Reviews & trust**
  - Verified-booking badges and photo reviews.
  - Organizer replies.
  - Fraud signals: velocity rules, device fingerprinting, high-risk booking review.
- **Search & discovery**
  - Full-text search (Postgres `tsvector` or Meilisearch).
  - Map view.
  - Destination landing pages for SEO.
  - Wishlists.
  - "Similar tours".
- **Traveler experience**
  - Guest details per seat and a downloadable e-ticket/QR for check-in.
  - Add-to-calendar.
  - Weather and packing info.
  - Waitlist when a schedule is full.
- **Organizer tools**
  - Bulk/recurring schedules.
  - Promo codes and early-bird pricing.
  - Manifest CSV/print.
  - Check-in app mode.
  - Co-host/staff accounts with permissions.
- **Admin & finance**
  - Finance dashboard: GMV, take rate, refunds, MDR, escrow liability.
  - BIR-ready exports.
  - Chargeback workflow.
  - Partner risk scoring.
  - Support ticketing integration (e.g. Help Scout/Zendesk).
- **Comms**
  - SMS (Semaphore) for OTP and trip reminders.
  - WhatsApp/Viber notifications.
  - Messaging between traveler and organizer, kept in-platform with PII masking.
- **Analytics**
  - Product analytics: funnels, cohort retention, PostHog.
  - Marketing attribution with a consent banner.

### 3–12 months (scale)
- **Transport marketplace v2:** quotes and counter-offers, rate cards, live trip status, driver assignment, GPS check-in, transporter payouts via escrow, insurance verification.
- **Multi-tenant / white-label:** the `WEBSITE_ID` model for partner storefronts, custom domains, per-tenant branding (the dashboard theme tokens already support this).
- **Mobile apps:** a fixed, versioned Bearer API (reintroduced from D6), React Native/Expo app for travelers, an organizer check-in app, push notifications.
- **Internationalisation:** Filipino/English UI, multi-currency display for foreign travelers, FX handling.
- **Loyalty:** referral credits, traveler points, organizer tiers with lower commission.
- **Dynamic pricing & yield:** demand-based pricing suggestions, last-minute deals.
- **Platform engineering:**
  - Read replicas or materialised views for the catalog.
  - Background job queue (e.g. Supabase Queues / Inngest) for email, refunds and reconciliation.
  - Feature flags.
  - Typed DB access end-to-end.
  - Migrate `unstable_cache` → `use cache`.
  - Dark mode for dashboards.
- **Compliance maturity:** SOC 2-style controls, periodic access reviews, data retention automation, a DPIA for new features, annual pen-test.

---

## Appendix A: key metrics

| Metric | Value (2026-10-22) |
|---|---|
| TypeScript errors | 0 |
| ESLint | 0 errors, 278 warnings (219 `no-explicit-any`, 48 unused vars, 10 `<img>`, 1 hooks) |
| `catch (e: any)` / `catch (e: unknown)` | 87 / 0 |
| `console.*` calls | 52 in 20 files (20 `console.log`) |
| `process.env` outside `lib/env.ts` | 19 in 10 files |
| `confirm` / `alert` / `prompt` | 37 in 10 files |
| Files > 400 lines | 8 (AccountSecurityManager 527, actions/notifications 506, ScheduleForm 488, admin ToursClient 478, actions/bookings 469, actions/admin 461, TourForm 448, AvailabilityManager 423) |
| Pagination (`.range()`) | 0 calls |
| Tests | 0 unit · 20 e2e (all unauthenticated; 19 pass, 1 outdated spec) · 27 QA smoke checks |
| `npm audit` | 15 (1 critical `next`, 10 high, 4 moderate) |
| Server Actions fully compliant with §3.2 | ~20% (admin approvals, tours, createBooking) |

---

## Appendix B: AGENTS.md claims that are wrong today

These need correcting in AGENTS.md as the related fixes land:

| AGENTS.md section | Claim | Reality |
|---|---|---|
| §4.4 step 2 | The success page writes `escrow_deposit` and increments escrow | It writes nothing: the wallet-id FK error is swallowed (FIN-01) |
| §4.4 step 3 | The webhook handles `payment.paid` | It can't map PaymentIntent payloads to a booking, so it is a no-op for real payments (FIN-03) |
| §4.4 | Users have SELECT-only RLS on money tables | `payout_requests` allows user INSERT (SEC-04) |
| §4.4 | Transport payout works via the cron | Dead: `estimated_price` is never set (BIZ-22) |
| §4.3 | Cancellation does an escrow reversal | It reverses a row that never exists (FIN-01/02) |
| §4.5 | Only the owning transporter can act, only on pending | Only in the action layer; RLS allows any insert or update (SEC-03) |
| §4.6 / §5.1 | OTP protects sensitive changes | Code is readable from the cookie; phone OTP optional (SEC-09, SEC-11) |
| §1.2 / §3.3 | `captureException` forwards to Sentry | Sentry never loads (ENG-03) |
| §1.2 | Cron schedules are configured outside the repo | No schedule exists anywhere (OPS-01) |
| §1.3 | `test:qa` checks roles, overbooking, audit | Mostly table-exists checks, and its audit probe deletes audit rows (ENG-02) |
| §5.5 | All runtime env vars are in `lib/env.ts` | Several secrets are missing and all are optional (SEC-10) |
| §6 #10 | The success page ignores late payments | It re-confirms canceled and refunded bookings (FIN-04) |
| §4.8 | Admin console and profiles "Implemented" | Admin tours are read-only, settings save is broken, profile saves are stubs |
