# Travi Operations Runbook

> Owner: platform engineering. Audience: whoever is on call. Keep this file next to the code and update it in the same PR as the change it describes.
> Related: [AGENTS.md](../AGENTS.md) (§5 security, §4.4 money), [docs/MVP_LAUNCH_READINESS.md](MVP_LAUNCH_READINESS.md) (roadmap and per-phase "To apply" lists).

**Golden rules**

- Production data changes (SQL, `supabase db push`, `scripts/*` with `CONFIRM_DB_WRITE`) need a second person to approve, and are written down in the incident or change log.
- Never paste secrets, OTP codes, passwords, tokens or customer PII into chat, tickets or Sentry comments.
- Money is moved only by the database functions in `20261023120000_money_integrity.sql` and later migrations. Never `UPDATE user_wallets` or `wallet_transactions` by hand. Corrections are new `manual_adjustment` ledger rows, written via a reviewed SQL function call.

---

## 1. Environments

| Environment | Vercel | Supabase project | Notes |
|---|---|---|---|
| Local | `npm run dev` | staging project (never production) | `.env.local`; `APP_ENV=development` |
| Preview | every PR branch | staging project | `VERCEL_ENV=preview` |
| Staging | `staging` branch / preview alias | staging project | Migrations land here first |
| Production | `main` | production project (PITR on) | `APP_ENV=production` (or Vercel's `VERCEL_ENV=production`) |

`APP_ENV=production` makes `lib/env.ts` refuse to start without every production secret, and turns admin MFA on by default.

---

## 2. Deploy flow (staging → production)

1. **PR green:** `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, `npm run build`, `npm run test:rls`, `npm run test:e2e` (CI runs all but e2e and `test:qa` automatically). `npm run test:qa` against staging.
2. **Merge to the staging branch.** Vercel deploys the preview/staging build.
3. **Apply new migrations to staging** (section 3) before or together with the code that needs them.
4. **Smoke-test staging:** `/api/health` returns `{"status":"ok"}`; sign up, book, pay in PayMongo **test** mode (GCash/Maya), webhook received (Vercel logs), admin sign-in with MFA, approve a partner, request + reject a payout. Check the browser console for CSP violations on `/`, `/tours`, a tour page, `/dashboard/organizer/tours/new` (map) and `/admin`.
5. **Promote to production:** merge to `main`. Apply production migrations **first** when the release depends on them (all `2026102*` migrations do). Watch Sentry and `/api/health` for 30 minutes.
6. **Rollback:** Vercel → Deployments → previous production deployment → "Instant Rollback". Migrations are not rolled back automatically; every migration is additive/idempotent, so old code keeps working. If a migration itself is wrong, write a new forward migration; restore from PITR only for data loss (section 7).

---

## 3. Applying database migrations

Migrations live in `supabase/migrations/` and are applied **in filename order**. They are written idempotently (`IF NOT EXISTS`, `CREATE OR REPLACE`).

1. **Audit live policies first (read-only).** In the Supabase SQL editor of the target project, run `supabase/tests/rls/live-policy-audit.sql`. It lists policies that exist in the DB but not in the migrations. Drop any unexpected policy (with a reviewed migration or, for an emergency, by hand + a follow-up migration).
2. **Dry-run locally:** `npm run test:rls` replays the full chain in PGlite.
3. **Apply to staging:** `npx supabase link --project-ref <staging-ref>` then `npx supabase db push`. Read every `NOTICE` (corrected `booked_count` rows, ledger duplicates, schedules over capacity, skipped unique indexes) and record them in the change log.
4. **Post-migration steps** (per the phase "To apply" lists in `docs/MVP_LAUNCH_READINESS.md`):
   - Money integrity (Phase 2): run the escrow backfill dry run, then apply it:
     ```bash
     npx tsx scripts/backfill-escrow-deposits.ts                                   # dry run, read-only
     CONFIRM_DB_WRITE=<project-ref> npx tsx scripts/backfill-escrow-deposits.ts --apply
     ```
     Then `select * from wallet_ledger_drift();` must return no rows that are not explained by legacy history (record any that are).
   - Catalog (Phase 3): verify the `public_*` view embeds through PostgREST, then delete `lib/data/tours-fallback.ts`.
   - Auth (Phase 3): Supabase Auth → URL configuration (site URL + `/auth/callback` redirect), "Confirm email" ON, Resend domain verified.
   - Legal (Phase 4, `20261026090000_legal_consent_privacy_support.sql`): **apply before deploying the Phase 4 code.** Checkout and partner onboarding refuse to continue when `legal_acceptances` is missing. No data steps. Before go-live, fill `lib/legal/company.ts` (business identity, DPO, support contacts, retention, effective dates) and set `LEGAL_REVIEW_COMPLETE = true` only after counsel signs off. Make the support and DPO mailboxes real.
   - OTP (Phase 5.7, `20261026100000_otp_challenges.sql`): no data steps. Old `otp_pending_*`/`otp_verified_*` cookies are ignored; users with a code in flight just request a new one.
   - Admin MFA (Phase 5.6): Supabase Auth → Multi-Factor → TOTP **enabled** (default). Every admin enrols on next sign-in.
5. **Regenerate types:** `npx supabase gen types typescript --project-id <ref> > types/supabase.ts`, commit.
6. **Repeat 1–5 on production** after the staging smoke test passes, with a second person approving the `db push`.

---

## 4. Environment variable checklist

Set these in Vercel (Production and Preview scopes separately; Preview points at staging). The source of truth is `lib/env.ts` + `.env.example`.

| Variable | Production | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | Production project |
| `SUPABASE_SERVICE_ROLE_KEY` | required, secret | Never `NEXT_PUBLIC_` |
| `APP_ENV` | `production` | Turns on strict env checks |
| `WEBSITE_ID`, `ADMIN_EMAIL` | required | |
| `NEXT_PUBLIC_SITE_URL` | `https://travi.ph` | Also enables `upgrade-insecure-requests` in the CSP |
| `OTP_SECRET` | required, secret, ≥32 chars | HMAC key for OTP hashes. Rotating it invalidates codes in flight only |
| `CRON_SECRET` | required, secret, ≥32 chars | Vercel cron sends it as Bearer |
| `PAYMONGO_SECRET_KEY` | `sk_live_…` | |
| `PAYMONGO_WEBHOOK_SECRET` | required, secret | From the PayMongo webhook registration |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | required | Rate limiting |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | required | Verified domain sender |
| `ADMIN_MFA_REQUIRED` | unset (= on) | `false` only as break-glass (section 6.3) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | recommended | Same DSN for both is fine |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | recommended (build-time) | Source-map upload; token is a secret |
| `LOG_LEVEL` | optional | `info` default in production |
| `NEXT_PUBLIC_SERVICE_ROLE_KEY` | **must not exist** | |

After changing a variable, redeploy (Vercel does not apply env changes to running deployments).

---

## 5. Creating the first admin (bootstrap)

Admins can never be created through the app (`assign_self_role` refuses `admin`). Bootstrap with SQL in the Supabase SQL editor of the target project:

1. The person signs up normally at `/signup` (any role) and confirms their email.
2. Run, replacing the email:
   ```sql
   -- Grants the admin role for this deployment's website (WEBSITE_ID).
   INSERT INTO public.user_roles (user_profile_id, website_role_id)
   SELECT up.id, wr.id
   FROM public.user_profiles up
   JOIN public.website_roles wr ON wr.role = 'admin' AND wr.website_id = '<WEBSITE_ID>'
   WHERE lower(up.email) = lower('<admin@example.com>')
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur WHERE ur.user_profile_id = up.id AND ur.website_role_id = wr.id
     );
   ```
3. They sign in at `/admin/login`, are sent to `/admin/mfa/enroll`, scan the QR code and verify a code. From then on every admin sign-in asks for a TOTP code.
4. Further admins: the first admin adds the role from `/admin/users` (audited). Set `ADMIN_EMAIL` to the super-admin's address.

---

## 6. Security operations

### 6.1 Rotating secrets

| Secret | How | Impact |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` / JWT signing keys | Supabase → Settings → API → rotate; update Vercel; redeploy | Rotating the JWT secret signs everyone out |
| `OTP_SECRET` | New random 48+ char value in Vercel; redeploy | Codes sent in the last 10 minutes stop working |
| `CRON_SECRET` | New value in Vercel; redeploy (Vercel cron reads it automatically) | None |
| `PAYMONGO_SECRET_KEY` | PayMongo dashboard → API keys; update Vercel; redeploy | None if done in one deploy |
| `PAYMONGO_WEBHOOK_SECRET` | Re-create the webhook in PayMongo, update Vercel, redeploy, then disable the old webhook | Events during the switch are retried by PayMongo |
| `RESEND_API_KEY`, Upstash token, `SENTRY_AUTH_TOKEN` | Provider dashboard → new key → Vercel → redeploy → revoke the old one | None |

Rotate immediately on any suspected leak (section 8) and at least yearly.

### 6.2 Resetting an admin's second factor (lost phone)

Verify the person's identity out of band (video call with a known colleague). Then, in the SQL editor:

```sql
-- Removes all MFA factors for one admin; they re-enrol on next sign-in.
DELETE FROM auth.mfa_factors
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = lower('<admin@example.com>'));
```

Record it in the change log. Ask the admin to sign out everywhere and sign in again.

### 6.3 Admin MFA break-glass

If Supabase MFA itself is broken and the console is needed urgently: set `ADMIN_MFA_REQUIRED=false` in Vercel production, redeploy, do the minimum work, set it back (or delete it) and redeploy. Two people must agree; log the window. Prefer 6.2 for a single locked-out admin.

### 6.4 Suspending a compromised account

`/admin/users` → Suspend (Supabase ban; existing access tokens live up to one hour). For an admin account: remove the admin role with SQL (`DELETE FROM user_roles … website_roles.role = 'admin'`), delete its MFA factors (6.2), and rotate any secret the account could see.

---

## 7. Backups and point-in-time restore (PITR)

- Production has PITR enabled (Supabase → Database → Backups). Staging uses daily backups.
- **Restore drill (quarterly):** restore production PITR to a **new** project at a chosen timestamp, point a preview deployment at it, check `/api/health`, row counts of `bookings`, `wallet_transactions`, `booking_payments`, and `select * from wallet_ledger_drift();`.
- **Real restore:** Supabase PITR restores in place and replaces all data after the chosen time.
  1. Declare an incident (section 8), put the site in maintenance (Vercel → redirect to a status page, or roll back to a deployment that shows maintenance).
  2. Export PayMongo payments and refunds for the window that will be lost (dashboard CSV) **before** restoring.
  3. Restore to the last good timestamp.
  4. Replay lost money events: for each PayMongo payment after the restore point, the webhook retry or the success page re-applies it (`confirm_booking_payment` is idempotent). Re-send failed webhooks from the PayMongo dashboard.
  5. Run the daily reconciliation (section 10) and record the result before reopening.

---

## 8. Incident response

**Severity:** SEV1 = money wrong, data exposed, site down. SEV2 = a core journey broken (signup, booking, payment, payouts). SEV3 = degraded, workaround exists.

1. **Detect:** Sentry alert, uptime alert, PayMongo/Vercel email, user report.
2. **Declare:** open an incident note (time, reporter, severity, incident lead). SEV1/SEV2: page the second engineer.
3. **Stabilise:** Vercel instant rollback; disable the failing feature; for money issues stop the escrow cron (Vercel → Settings → Cron Jobs → disable) and pause payouts (do not mark any paid).
4. **Investigate:** Sentry (scrubbed events, no PII), Vercel function logs (pino JSON), Supabase logs, `admin_audit_logs`.
5. **Fix forward** with a reviewed PR + migration if needed.
6. **Close:** confirm with reconciliation (section 10), write a blameless post-mortem within 5 working days, add tests and update this runbook.

### 8.1 Personal-data breach (RA 10173, NPC Circular 16-03)

Applies when personal data (names, emails, phones, IDs/KYC documents, payout account numbers) may have been accessed by an unauthorised party.

1. **Contain** immediately: revoke access, rotate secrets (6.1), suspend accounts (6.4), make leaked storage objects private.
2. **Inform the Data Protection Officer** at once. Start a breach log: what, whose data, how many, when discovered, containment steps.
3. **Assess within 24 hours** whether the breach involves sensitive personal information or information that could enable identity fraud (government IDs, TIN, financial account numbers count) and is likely to give rise to a real risk of serious harm.
4. **Notify the National Privacy Commission within 72 hours of knowledge** of the breach when step 3 says so (NPC breach notification portal). Do not wait for the full investigation; send what is known and supplement later.
5. **Notify affected data subjects within the same 72 hours**, by email from a verified sender, with: nature of the breach, data involved, measures taken, what they should do (e.g. change password, watch for phishing), and the DPO contact.
6. Notify processors/partners involved (Supabase, Vercel, Resend, PayMongo, Upstash, Sentry) as needed, and PayMongo for any payment data.
7. Keep the breach log and evidence; the NPC may request a full report. Annual breach summary goes to the NPC per the Circular.

---

## 9. Manual payout procedure

Payout requests are created by partners (`request_payout()`); the balance is already debited and a `withdrawal_pending` ledger row exists.

1. `/admin/payouts` → open the request. Check the partner is approved (KYC) and the destination (masked) matches their verified documents.
2. If `payout_dual_approval_threshold` applies, a first admin **approves**; a **different** admin pays.
3. Send the money **outside Travi** (bank transfer / GCash / Maya business account) to exactly the snapshotted destination. Never to a destination given by phone or chat.
4. Back in `/admin/payouts`: **Mark paid** with the bank/e-wallet reference number. This calls `mark_payout_paid()` (once only, audited, partner emailed).
5. If the transfer fails or the request is suspicious: **Reject** with a reason. `reject_payout()` returns the funds to the partner's available balance (audited, partner emailed).
6. Never mark paid before the transfer has actually left the account.

---

## 10. Daily reconciliation checks (business days, 10:00 Manila)

Run in the production SQL editor (read-only queries) or from `/admin/finance`:

```sql
-- 1. Ledger matches balances (must be empty). The escrow cron also alerts on drift.
select * from public.wallet_ledger_drift();

-- 2. Payments received but not applied (refund or close each one in /admin/finance).
select id, booking_id, amount_centavos, review_reason, created_at
from public.booking_payments
where status = 'needs_review' and resolved_at is null
order by created_at;

-- 3. Confirmed bookings without an escrow deposit (must be empty after the backfill).
select * from public.bookings_missing_deposit();

-- 4. Refunds stuck in flight for more than an hour, or failed (retry from the admin console).
select id, booking_id, amount, status, error, created_at from public.booking_refunds
where (status = 'pending' and created_at < now() - interval '1 hour') or status = 'failed';

-- 5. Payout requests waiting more than 2 business days.
select id, amount, status, created_at from public.payout_requests
where status in ('pending', 'processing') and created_at < now() - interval '2 days';
```

Also compare the PayMongo dashboard's settled payments for yesterday with `booking_payments` (count and sum). Record the result (OK / issues + ticket) in the finance log.

---

## 11. Monitoring

### 11.1 Uptime checks (e.g. Better Stack / UptimeRobot, 1-minute interval, 2 regions)

| Target | Expect | Alert after |
|---|---|---|
| `https://travi.ph/` | 200 | 2 failures |
| `https://travi.ph/api/health` | 200 and body contains `"status":"ok"` (503 = database unreachable) | 2 failures |
| `https://travi.ph/tours` | 200 | 3 failures |
| Cron `/api/cron/escrow-release` (daily 18:00 UTC) and `/api/cron/trip-reminders` (daily 01:00 UTC) | Vercel → Settings → Cron Jobs / function logs show a 200 each day | Check daily; missing run = SEV2 |

`/api/health` is public and unauthenticated by design: it returns only `status`, a database `ok` flag with latency, the short commit SHA and the environment. It never returns hostnames, errors or keys, and is `Cache-Control: no-store`.

### 11.2 Sentry

Sentry loads through `instrumentation.ts` (server/edge, plus `onRequestError` for every uncaught RSC/route/action error) and `instrumentation-client.ts` (browser, no session replay). `lib/logger.ts` `captureException` forwards handled errors. Every event passes `lib/sentry-scrub.ts`: no cookies, auth headers, request bodies or query strings; emails, phone numbers, long digit runs, JWTs and sensitive keys are replaced with `[Filtered]`. Source maps upload only when `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` are set at build time.

Create these alert rules (Alerts → Create → Issues, environment `production`, notify email + chat):

| Rule | Condition |
|---|---|
| New issue | A new issue is created → notify |
| Regression | An issue changes state from resolved to unresolved |
| Error spike | More than 20 events in 5 minutes |
| Webhook failures | Event tag/extra `action` equals `paymongo webhook` → any occurrence |
| Escrow cron | `action` starts with `escrow-release` (includes "Wallet ledger drift" and "Confirmed booking has no escrow deposit") → any occurrence, high priority |
| Trip reminders | `action` equals `trip-reminders` → any occurrence |
| Payouts / refunds | `action` matches `markPayoutPaid`, `rejectPayout`, `requestPayout`, `refundBooking*`, `adminCancelBooking` → any occurrence |
| OTP / email delivery | `action` matches `sendOtp:*` or `sendEmail` → more than 5 in 10 minutes (provider outage) |
| Admin MFA | `action` matches `verifyAdminMfa*` or `startAdminMfaEnrollment` → any occurrence |

### 11.3 Security headers

`next.config.ts` sends a CSP, HSTS (2 years, subdomains), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy` on every route. The CSP is static (no nonces, so cached pages keep working) and allow-lists Supabase (https + wss), Sentry ingest, Vercel analytics, Google Fonts, the image hosts, OpenStreetMap tiles, unpkg (Leaflet icons), Clearbit bank logos, the PSGC API and PayMongo form targets. **Adding a third-party host** (script, image, API, iframe) means editing the CSP in `next.config.ts` and re-checking the browser console. Verify with `curl -sI https://travi.ph | grep -i content-security`.
