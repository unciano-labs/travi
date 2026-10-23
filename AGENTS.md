<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Travi

> **Single source of truth and operating manual for every AI agent working in this repo.**
> If anything in `docs/`, `README.md`, or `.agents/skills/*` contradicts this file, **this file wins**. If this file contradicts the code or `supabase/migrations/`, **the code wins**: fix this file.
> **Last updated:** 2026-10-24 (Phases 4–5 complete; Phase 6 is human launch work, see docs/RUNBOOK.md)

---

## ⛔ MANDATORY AGENT WORKFLOW — DEFINITION OF DONE

**No task is complete until `AGENTS.md` has been reviewed and, where needed, updated.**

**Before you report any task as finished, you MUST:**

1. **Run the QA gate and get it fully green:**
   - `npm run lint`: zero errors.
   - `npm run build`: zero errors. It also runs the TypeScript type-check.
   - `npm run test:unit`: 100% pass (vitest, no network).
   - `npm run test:qa`: 100% pass. This hits the live Supabase project, so it needs `.env.local`.
   - `npm run test:rls`: 100% pass, if you touched `supabase/migrations/`, RLS, triggers, or any table the app writes with the user's own client. Runs locally (PGlite), no DB needed.
   - `npm run test:e2e` as well, if you touched routing, middleware, auth guards, SEO, or the landing or tour pages.
   - Follow the [`qa-tester`](.agents/skills/qa-tester/SKILL.md) skill protocol.
2. **Review this file against your diff.** Answer each question below. **If any answer is "yes", update the matching section of `AGENTS.md` in the same change:**
   - **Dependencies:** did you add, remove, or upgrade a dependency? → §1.2
   - **Commands:** did you add or change an npm script, CLI, or tool? → §1.3
   - **Structure:** did you add, move, or rename a folder or top-level file, or change a naming convention? → §2
   - **Conventions:** did you introduce a new coding pattern, or retire an old one? → §3
   - **Domain:** did you change a status value, state transition, price/fee/escrow calculation, validation rule, or business rule? Did you add or change a table, column, enum, trigger, RLS policy, or migration? → §4
   - **Security:** did you change auth, authorization, RLS, rate limiting, the webhook/cron/API surface, or environment variables? → §5, plus `.env.example`
   - **Known defects:** did you fix one (remove it), or find a new one (add it)? → §6
3. **State in your final report** whether `AGENTS.md` was updated, and which sections changed. If no update was needed, say so explicitly ("AGENTS.md reviewed — no changes required").

---

## Quick Links

| Document | Purpose | Reliability |
|---|---|---|
| **AGENTS.md** ← you are here | Operating manual: stack, architecture, rules, domain logic, security | Authoritative |
| [`supabase/migrations/`](supabase/migrations/) | The real database schema | **Ground truth for the DB** |
| [docs/DATABASE.md](docs/DATABASE.md) | Original schema and business-rule spec | ⚠️ Stale; see §4.7 for where it is wrong |
| [docs/API.md](docs/API.md) | Functional requirements and acceptance criteria | Spec / intent, not current behavior |
| [docs/MVP_LAUNCH_READINESS.md](docs/MVP_LAUNCH_READINESS.md) | 2026-10-22 audit: full gap register (FIN/SEC/BIZ/ENG/OPS/LEG IDs), launch roadmap, go/no-go checklist, post-launch backlog | **Current launch plan.** Supersedes §6 where they differ |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Deploys, migration order, env checklist, admin bootstrap, MFA reset, PITR, incidents, RA 10173 breach procedure, manual payouts, reconciliation, monitoring | **Operational source of truth** |
| [docs/TODO.md](docs/TODO.md), [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md) | Backlog and roadmap | Planning |
| [docs/ORGANIZER.md](docs/ORGANIZER.md), [docs/TRANSPORTER.md](docs/TRANSPORTER.md), [docs/TRAVELER.md](docs/TRAVELER.md) | Per-role feature specs | Spec |
| [docs/PAYMENT_INTEGRATION.md](docs/PAYMENT_INTEGRATION.md), [docs/WALLET_IMPLEMENTATION.md](docs/WALLET_IMPLEMENTATION.md) | Payment and wallet design notes | Spec; see §4 for actual behavior |
| [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) | Earlier security audit | Historical; see §5 and §6 for the current state |
| [`reference/`](reference/) | HTML mockups and `mvp-architecture.md`. The dashboard theme source `tailwind-admin-reactjs-free/` (see §3.5) is kept locally and is **not committed** | Design reference only. `reference/` is excluded from `tsconfig.json` and ESLint; never import from it |

---

## 1. Project Overview & Tech Stack

### 1.1 Purpose

Travi is a **Philippine travel-tour and transportation marketplace**. Currency is PHP and payments go through PayMongo (GCash and Maya).

| Role | What they do |
|---|---|
| **Traveler** | Browses published tours, books seats on a dated schedule, pays, cancels, and opens disputes |
| **Organizer** | An individual or company. Creates tours, schedules, and itineraries; arranges transport; earns into a wallet through escrow |
| **Transporter** | An individual or company. Lists vehicles, blocks availability, accepts or declines transport requests, and earns into a wallet |
| **Admin** | Approves or rejects partners, moderates reviews, manages roles, resolves disputes, processes payouts, and sets platform fees |

A single account can hold several roles (traveler + organizer + transporter) and switch between dashboards. `admin` is separate: admins are sent to `/admin` and blocked from `/dashboard`.

### 1.2 Tech stack (installed versions)

| Concern | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router, Turbopack) | **16.4.3** | Not Next 14. Read `node_modules/next/dist/docs/` before using framework APIs |
| UI runtime | React / React DOM | **19.2.8** | |
| Language | TypeScript | 5.9.3 | `strict: true`; path alias `@/*` → `./*` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) + `@tailwindcss/typography` + `tw-animate-css` | 4.3.3 / 1.4.0 | CSS-first config in `app/globals.css`; **no `tailwind.config.*`**. `tw-animate-css` powers the `data-[state]` animations of the UI primitives |
| UI primitives | shadcn-style components on Radix UI (`@radix-ui/react-{slot,dialog,dropdown-menu,tabs,avatar,label,progress,switch,checkbox,separator,tooltip,select,visually-hidden}`) + `class-variance-authority` 0.7.1 + `clsx` / `tailwind-merge` via `cn()` | | Ported from `reference/tailwind-admin-reactjs-free` into `components/ui/`. This is the project's only UI kit |
| Charts | apexcharts 8.4.1 + react-apexcharts 2.1.1 | | Only through `components/ui/charts/*` (browser-only, `next/dynamic` `ssr: false`) |
| Icons | lucide-react | 1.33.0 | The only icon set |
| Database / Auth / Storage | Supabase (Postgres 14.5 PostgREST) via `@supabase/ssr` 0.12.4 and `@supabase/supabase-js` 2.112.3 | | Cookie sessions; RLS on every table |
| Validation | zod | **4.6.7** | v4: use `error.issues`, not `error.errors` |
| Payments | PayMongo REST (hand-written client in `lib/paymongo.ts`) | | No Stripe |
| Email | Resend | 6.25.0 | Logs to the console when `RESEND_API_KEY` is unset |
| SMS | `lib/sms.ts` | | **Console mock only** |
| OTP | Server-side hashed codes in `otp_challenges` (`lib/otp.ts`) | | jose 6.2.10 is still used by `lib/password-recovery.ts` and `lib/admin-mfa.ts` |
| Admin MFA | Supabase Auth TOTP (`aal2`) | | `lib/admin-mfa.ts`, `/admin/mfa/{enroll,verify}` |
| Rate limiting | `@upstash/ratelimit` + `@upstash/redis` | 2.0.8 | Turns itself off when Upstash env vars are missing |
| Logging / monitoring | pino 10.3.1 (+ pino-pretty in dev), `@sentry/nextjs` 10.76.2, `@vercel/analytics` | | Sentry loads via `instrumentation.ts` / `instrumentation-client.ts`; every event is scrubbed by `lib/sentry-scrub.ts`. Health check: `GET /api/health` | |
| Dates / calendars | date-fns 4.4.0, react-big-calendar, react-day-picker 10 | | |
| Maps | leaflet 1.9.4 + react-leaflet 5.0.0 | | Always loaded through `next/dynamic` with `ssr: false` |
| Markdown | react-markdown | | |
| State management | **None.** RSC props plus local `useState` | | |
| Unit tests | vitest (dev) | 4.1.11 | `tests/unit/*.test.ts`, `vitest.config.mts` (`@/` alias, runs with `TZ=America/New_York` to catch time-zone leaks) |
| E2E tests | Playwright (`@playwright/test`) | 1.62.1 | Chromium only. Projects: `chromium` (signed out), `auth-setup` + `authenticated` (staging only, see `e2e/README.md`) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | | Lint, tsc, unit, RLS, build on every PR and on pushes to `main`; e2e job only when the `E2E_SUPABASE_*` repo secrets exist |
| RLS tests | `node:test` + PGlite (`@electric-sql/pglite`, dev) | 0.3.16 | In-process Postgres; replays every migration with Supabase stubs (`supabase/tests/rls/`) |
| Smoke / QA tests | `scripts/qa-smoke-test.ts` run with `tsx` | | Runs against the live DB |
| Lint | ESLint 9 (flat config) + `eslint-config-next` 16.4.3 | 9.39.5 | No Prettier, no EditorConfig |
| Hosting | Vercel | | `vercel.json` defines the cron schedules (`/api/cron/escrow-release` 18:00 UTC, `/api/cron/trip-reminders` 01:00 UTC) |
| Local toolchain | Node v24.15.0, npm 11.12.1 (the lockfile is npm) | | `package.json` has no `engines` field |

### 1.3 Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies. Use npm only; `package-lock.json` is the lockfile |
| `npm run dev` | Dev server on `http://localhost:3000` (`allowedDevOrigins: ['127.0.0.1']`) |
| `npm run build` | Production build and TypeScript type-check. **Must pass before you finish** |
| `npm run start` | Serve the production build |
| `npm run lint` | `eslint` (flat config `eslint.config.mjs`) |
| `npm run test:qa` | `npx tsx scripts/qa-smoke-test.ts`: env, table, role, overbooking, audit, and soft-delete checks against the **live** DB (read-only). **Must pass before you finish** |
| `npm run test:rls` | `node --test supabase/tests/rls/*.test.mjs`: replays all migrations in PGlite and runs every RLS attack/legit-flow case as each role. `RLS_BASELINE=1` runs it without the newest hardening migration |
| `npm run test:unit` | `vitest run`: pure unit tests in `tests/unit/` (helpers, schemas, email, webhook signature, booking rules). **Must pass before you finish** |
| `npm run test:e2e` | `playwright test`. Starts `next dev` on `PORT` (default 3000) and reuses a server already running there; with `PLAYWRIGHT_TEST_BASE_URL` set it starts nothing and tests that URL. If your own dev server holds port 3000, use `PORT=3110` or `next start -p 3110` + `PLAYWRIGHT_TEST_BASE_URL`. Authenticated specs skip without `E2E_*` credentials |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npx tsc --noEmit` | Standalone type-check (there is no npm script for it) |
| `npx supabase db push` | Apply new migrations to the linked project. **Requires human approval; it changes the shared remote DB** |
| `npx supabase gen types typescript --project-id <ref> > types/supabase.ts` | Regenerate DB types. `<ref>` is the subdomain of the Supabase host in `next.config.ts` `images.remotePatterns` |

There is no `supabase/config.toml`, so there is no local Supabase stack. Everything runs against the remote project.

---

## 2. Architecture & Directory Structure

### 2.1 Architectural pattern

This is a **layered Next.js App Router monolith, organised by layer rather than by feature**:

```
Browser ──► middleware.ts (session refresh + role-based route gating)
        ──► app/**/page.tsx   (async Server Component: fetches data)
              └─► components/**/XClient.tsx  ('use client': interactive UI, local state)
                     └─► actions/*.ts  ('use server': auth → validate → rate-limit → mutate → revalidate)
                            └─► lib/services/*.ts  (reusable write logic, takes a SupabaseClient)
                            └─► lib/supabase/{server,admin}.ts ──► Supabase (RLS) / service role
PayMongo / Vercel cron / admin CSV ──► app/api/**/route.ts (HMAC / CRON_SECRET / admin session) ──► lib/services/*.ts
Public cached reads ──► lib/data/*.ts (unstable_cache + anon client, tag-invalidated)
```

### 2.2 Directory map

```
travi/
├── middleware.ts            # Calls updateSession(). The ONLY global auth gate. Keep the name (see §3.7)
├── app/                     # App Router. No route groups
│   ├── layout.tsx           # Root: fonts (Plus Jakarta Sans, Playfair Display), metadata, <Analytics/>
│   ├── globals.css          # Tailwind v4 entry: @import "tailwindcss", @plugin typography, @theme tokens
│   ├── page.tsx             # Landing page
│   ├── login/, signup/      # Auth pages (signup has a role picker, ?role= preselects; both honour ?next=)
│   ├── auth/                # callback/ (PKCE code + token_hash exchange → safe next), forgot-password/, reset-password/
│   ├── tours/page.tsx       # Public catalog: filters/sort/pagination via search_public_tours RPC (+ loading/error)
│   ├── tours/[slug]/                      # Public tour detail (generateMetadata + JSON-LD; cache() + tagged unstable_cache)
│   │   └── booking/[bookingId]/{,pay,success}/   # Booking review → payment method → payment verification (noindex layout, loading/error)
│   ├── dashboard/           # Authenticated multi-role area
│   │   ├── layout.tsx       # 'use client' shell (sidebar from pathname). NO auth logic
│   │   ├── page.tsx         # Dispatcher: redirects to the user's primary role
│   │   ├── traveler/        # bookings (+ [id] detail: receipt, pay now, cancel, dispute), profile
│   │   ├── organizer/       # layout.tsx (server: onboarding gate + status banner), tours (new, [id]/edit, [id]/schedules/[scheduleId]), bookings, transport, wallet, profile
│   │   └── transporter/     # layout.tsx (server: onboarding gate), vehicles, availability, requests, reviews, wallet, profile
│   ├── admin/               # Admin console: organizers, transporters (KYC review), tours, bookings, reviews, payouts, finance, users, transport, audit, requests (data requests + support inbox), notifications, settings, login
│   ├── api/                 # Route handlers: cron/{escrow-release,trip-reminders}, webhooks/paymongo, admin/export/[kind] (CSV), health (public, uncached). No Bearer/mobile API (D6)
│   ├── terms/, privacy/, refund-policy/, cookies/, partner-terms/   # Policy pages (LegalPage; draft banner until LEGAL_REVIEW_COMPLETE)
│   ├── about/, faq/, contact/   # Trust pages; /contact posts to actions/support.ts
│   ├── robots.ts, sitemap.ts, not-found.tsx, global-error.tsx
├── actions/                 # ALL Server Actions. One kebab-case file per domain noun; each starts with 'use server'
│                            # admin, admin-mfa, auth, availability, bookings, notifications, organizer, otp, partner-documents, partner-review,
│                            # privacy, profile, reviews, schedules, support, tours, transport-requests, transporter, vehicles, wallet
├── components/
│   ├── admin/               # Admin *Client.tsx tables (incl. Users/Finance/PaymentsReview/Transport/Audit/Requests), PartnerReviewPanel, InputDialog, AdminPager, TourModerationActions, AdminCancelBookingDialog, AdminNotificationBell, AdminProfileMenu, PlatformSettingsForm
│   ├── auth/                # SignupForm, LoginForm, ForgotPasswordForm, ResetPasswordForm, AuthCard
│   ├── dashboard/           # Role dashboards: forms, modals, managers, calendars, Partner{KycFields,DocumentUpload,DocumentsManager,StatusBanner}, TourPublishChecklist, CancelSchedule*, OrganizerTransportClient, RoleSwitcher, NotificationBell
│   ├── legal/               # LegalPage, ContactForm, PartnerTermsCheckbox, YourDataSection (profile "Your data" card)
│   ├── landing/             # Marketing sections, TourCard/TourGrid (server), CatalogFilters, TourBookingCard, PaymentSelectionClient, PublicRouteError, hero.css
│   ├── seo/                 # TourJsonLd
│   ├── shell/               # AppShell (sidebar + sticky header + mobile Sheet) and AppSidebar. Used by app/dashboard/layout.tsx and app/admin/layout.tsx
│   ├── traveler/            # TravelerBookingsClient, ReviewDialog
│   ├── ui/                  # shadcn primitives (lowercase: button, card, badge, table, input, textarea, label, select, dialog, sheet, tabs,
│   │                        #   dropdown-menu, avatar, alert, progress, switch, checkbox, separator, skeleton, tooltip),
│   │                        # template widgets (PascalCase: CardBox, PageHeader, WelcomeBanner, StatCard, StatusBadge, Timeline, EmptyState),
│   │                        # charts/ (Chart, BarChart, DonutChart), and ConfirmModal, GenericMobileCard, LazyMobileCard, PageLoader
│   └── wallet/              # PayoutMethodsManager
├── lib/
│   ├── supabase/            # server.ts (cookie client), browser.ts, middleware.ts (updateSession + RBAC), admin.ts (service role)
│   ├── auth-helpers.ts      # requireSession(), assertRole() (admin ⇒ aal2), assertAdminRoleForMfa() (MFA steps only), assertEmailVerified()
│   ├── admin-mfa.ts, admin-mfa-page.ts   # Admin TOTP state, paths, aal claim check
│   ├── sentry-scrub.ts      # PII scrubbing for every Sentry event (dependency-free; used by all Sentry configs)
│   ├── schemas/             # zod: admin, admin-tools, auth, booking, catalog (lenient query parsing), legal, partner, review, schedule, tour, transport
│   ├── legal/               # company.ts (business facts, LEGAL_REVIEW_COMPLETE, document versions, retention: placeholders until filled),
│   │                        # settings.ts (getPolicySettings, tag platform-settings), consent.ts (recordAcceptance; server-only), privacy.ts (data export)
│   ├── services/            # bookings, tours (+ publish readiness), payments (applyPaidPayment, verifyBookingPayment), refunds (refundBooking),
│   │                        # schedules (cancelScheduleWithBookings), partner-documents, traveler-contacts (SEC-13)
│   ├── transport.ts, partners.ts, csv.ts, finance-format.ts   # transport helpers/ownership, partner helpers, CSV (formula-safe), money/mask formatters
│   ├── data/merchant.ts     # Public organizer details for the tour page (LEG-06)
│   ├── data/                # tours.ts (catalog search + detail), reviews.ts, stats.ts: cached public reads. tours-fallback.ts is TEMPORARY until 20261024100000 is applied
│   ├── env.ts               # zod-validated env. Import `env`, not process.env
│   ├── logger.ts            # pino `logger` + captureException() (pino + Sentry)
│   ├── audit.ts             # logMutation() / logAdminAudit() → admin_audit_logs
│   ├── ratelimit.ts         # assertRateLimit(id, 'auth' | 'mutation'), getClientIp()
│   ├── paymongo.ts          # PayMongo REST client (intents, methods, checkout, refunds). Mocks when the key is missing
│   ├── email.ts, sms.ts     # The ONLY email sender (sendEmail) + escapeHtml/siteUrl/maskEmail; SMS console mock (dev only; fails in production)
│   ├── notifications.ts     # Internal notification senders (in-app + email via templates). Not Server Actions
│   ├── email-templates.ts   # Pure email templates { subject, html, text }; the layout escapes every value
│   ├── accounts.ts          # ensureAccountProvisioned(): profile/role fallback when the signup trigger did not run
│   ├── password-recovery.ts # Signed httpOnly recovery-marker cookie (travi_pw_recovery) for /auth/reset-password
│   ├── safe-next.ts         # safeNextPath(): only same-site relative return-to paths
│   ├── features.ts          # Feature flags (PHONE_OTP_ENABLED = false, decision D5)
│   ├── otp.ts               # OTP send/verify/redeem/require/consume (hashed codes in otp_challenges). Not Server Actions
│   ├── json-ld.ts           # serializeJsonLd(): escapes </script> etc. for JSON-LD
│   ├── datetime.ts          # manilaToday(): business dates are Asia/Manila
│   ├── utils.ts             # cn(): clsx + tailwind-merge
├── types/supabase.ts        # Generated DB types. ⚠ STALE (see §4.7). Regenerate; never hand-edit
├── supabase/migrations/     # YYYYMMDDHHMMSS_snake_case.sql. Append-only
├── supabase/tests/rls/      # DB harness (harness.mjs, fixtures.mjs), RLS + money tests (*.test.mjs), live-policy-audit.sql
├── vercel.json              # Cron schedule
├── e2e/                     # Playwright specs: signed-out flows (e2e/*.spec.ts) + e2e/authenticated/ (staging only; e2e/README.md)
├── tests/unit/              # vitest unit tests
├── .github/workflows/ci.yml # CI pipeline
├── scripts/                 # Seed, fix, and QA scripts (ESLint-ignored). qa-smoke-test.ts is the QA gate (read-only).
│                            # Scripts that write call scripts/lib/write-guard.cjs: run with CONFIRM_DB_WRITE=<project-ref>
├── docs/                    # Reference specs (see Quick Links); docs/RUNBOOK.md is the operations runbook
├── reference/               # HTML mockups + mvp-architecture.md
├── public/                  # Static assets. public/dashboard/ holds the template's banner and sidebar illustrations
├── .agents/                 # Agent skills (§7) and rules
├── instrumentation.ts, instrumentation-client.ts, sentry.{server,edge}.config.ts   # Sentry wiring (onRequestError; browser init + zod jitless for the CSP)
├── next.config.ts           # withSentryConfig + security headers / CSP (headers()), poweredByHeader off
├── playwright.config.ts, vitest.config.mts, eslint.config.mjs, postcss.config.mjs
└── Do NOT add root-level scratch files (the old ones are untracked and git-ignored). Put one-off scripts in scripts/ or your scratchpad.
```

### 2.3 Naming & export conventions

| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx`, grouped by area folder | `components/dashboard/VehicleModal.tsx` |
| shadcn UI primitives | **lowercase kebab-case** `.tsx` in `components/ui/`, named exports (shadcn convention). Don't rename them | `components/ui/dropdown-menu.tsx` |
| Interactive half of an RSC page | `<Thing>Client.tsx`, receives `initial<Thing>` props | `BookingsClient initialBookings={…}` |
| Hooks | `useX.ts`, kept next to the consumer (there is no `hooks/` dir) | `components/landing/useScrollReveal.ts` |
| Server Action files | kebab-case domain noun in `actions/` | `actions/transport-requests.ts` |
| Server Action functions | camelCase verb-first | `approveOrganizer`, `blockVehicleDates` |
| Services | `<verb><Entity>Service` in `lib/services/<entity>.ts` | `createBookingService` |
| zod schemas | camelCase `<thing>Schema` in `lib/schemas/<domain>.ts` | `createBookingSchema`, `tourSchema` |
| Cached readers | `getCached<Thing>` in `lib/data/` | `getCachedPublicTours` |
| Migrations | `YYYYMMDDHHMMSS_snake_case_description.sql`, **unique timestamp** | `20260831072900_add_phone_verified_at_to_user_profiles.sql` |
| DB identifiers | snake_case; TS/zod fields camelCase, mapped explicitly in the service | `pricePerPerson` → `price_per_person` |
| Exports | Components: **default export** (named for a few: `NotificationBell`, `RoleSwitcher`, `WalletClient`, …; match the file). Actions, lib, services: **named exports** | |
| Directives | `'use client'` / `'use server'` on **line 1**. `'use server'` appears only in `actions/*` | |
| Imports | Always the `@/` alias for cross-folder imports; relative only within the same folder | `import { env } from '@/lib/env'` |

---

## 3. Coding Rules & Standards

### 3.1 Formatting, typing, linting

- **ESLint** (`eslint.config.mjs`) extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
  - Local overrides: `@typescript-eslint/no-explicit-any` → **warn**, `@next/next/no-img-element` → **warn**, `react/no-unescaped-entities` → off.
  - Ignored paths: `scripts/**`, `playwright-report/**`, `test-results/**`, `test-query.js`.
  - **The bar is zero errors.** Do not add new warnings.
- **TypeScript is `strict`.**
  - New code must not introduce `any`. The existing `any` (role-join mapping, `catch (error: any)`) is legacy.
  - Prefer `catch (error: unknown)` and narrow it.
  - Use `z.infer<typeof schema>` for validated input types.
  - Use `Database` types from `@/types/supabase` when they are accurate, and regenerate them when you change the schema.
- **No formatter is configured.** Match the file you are editing: 2-space indent and single quotes; semicolons dominate in `actions/` and `lib/`.
- Do not disable lint rules inline unless you also add a comment explaining why.

### 3.2 Server Action contract

**Every mutating Server Action MUST follow this order.** `actions/admin.ts` `approveOrganizer` is the reference:

```ts
'use server';
export async function doThing(input: unknown) {
  try {
    const data = thingSchema.parse(input);                     // 1. Validate with zod (lib/schemas/*)
    const { user, profile, supabase } = await requireSession(); // 2. Authenticate
    await assertRole(user.id, 'organizer');                     // 3. Authorize (role); admin passes every check (and must be aal2)
    await assertRateLimit(profile.id, 'mutation');              // 4. Rate-limit ('auth' + getClientIp() for login/signup)
    // 5. Ownership check: scope every write with .eq('<owner>_id', ownProfileId) or a !inner join
    // 6. Mutate with the RLS client; use createAdminClient({ admin: true }) only per §5.3
    // 7. Admin and money mutations: await logMutation({...})
    updateTag('tours'); revalidatePath('/dashboard/organizer/tours'); // 8. Invalidate caches
    return { success: true as const };
  } catch (error: unknown) {
    captureException(error, { action: 'doThing' });              // 9. Log via lib/logger
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to do thing' };
  }
}
```

- **Return shape.** Return `{ success: true, ...data } | { success: false, error: string }`. Never throw to the client.
  - Legacy actions in `auth.ts`, `organizer.ts`, `transporter.ts`, `schedules.ts` return only `{ error }`. Do not copy that.
- **`redirect()` goes outside `try/catch`.** It throws `NEXT_REDIRECT`. Use the `let success = false` flag pattern from `actions/tours.ts`.
- **Every exported function in a `'use server'` file is a publicly callable endpoint.** Every export needs its own auth check.
  - Internal helpers (notification senders, OTP helpers, payment verification) belong in `lib/`, not as exports of `actions/*`: `lib/notifications.ts`, `lib/otp.ts`, `lib/services/payments.ts`.
- **Cache tags in use:** `tours`, `organizers`, `transporters`, `reviews`, `platform-stats`, `platform-settings` (fee/escrow figures quoted on the policy pages).
  - Use `updateTag()` (Next 16, Server-Action-only, read-your-writes) for those tags, plus `revalidatePath()` for the affected dashboard and admin pages.

### 3.3 Error handling & logging

- Report errors with `captureException(error, { action: 'name', ...ids })` from `@/lib/logger`. It logs through pino and forwards to Sentry.
- Use `logger.info / warn / debug` for structured logs.
- Every Sentry event, breadcrumb and transaction passes through `lib/sentry-scrub.ts` (drops cookies, headers, bodies, query strings; filters emails, phones, long digit runs, JWTs, sensitive keys). Keep PII out of error messages anyway. Expected user errors (wrong OTP, `OtpError`) are not reported.
- **Do not add new `console.log`.** The SMS dev mock in `lib/sms.ts` is the only one (it refuses to run in production); the email dev mock logs only the masked recipient and subject via pino.
- **Emails:** build them with `lib/email-templates.ts` and send with `sendEmail` from `lib/email.ts`. No inline HTML in actions, no other Resend client, links from `siteUrl()`.
- **Never log secrets, OTP codes, passwords, tokens, or full payment payloads.**
- Map Supabase errors to user-safe messages where they leak internals.
  - Example: the service maps the `check_capacity_not_exceeded` violation to `'Not enough seats available.'`.
- **API routes** return `NextResponse.json({ success: false, error }, { status })`:
  - `ZodError` → 400; read `error.issues[0]` (zod v4).
  - Unauthenticated → 401; forbidden → 403.
  - Not found → 404; capacity conflict → 409.
- **Route-level errors.** Only `app/global-error.tsx` exists, and it reports to Sentry. Add a segment `error.tsx` when you build a new top-level area.
- **Don't swallow Next.js control-flow errors.** In any `try/catch` that can run during render (RSC data getters, including the `get*` functions in `actions/*`), call `unstable_rethrow(error)` from `next/navigation` **first** in the `catch`. Otherwise `redirect()`, `notFound()`, and dynamic-rendering bailouts (`cookies()`) get logged as errors and sent to Sentry. This is defect §6 #24.

### 3.4 Data fetching & state

- **Server Components are the default.** Pages are `async` RSCs that fetch on the server:
  - **Authenticated pages:** `createClient()` from `@/lib/supabase/server` (RLS applies).
  - **Admin pages:** `requireSession()` + `assertRole(user.id, 'admin')` **in the page**, *then* `createAdminClient({ admin: true })`. Never rely on middleware alone.
  - **Public catalog data:** `lib/data/*` (`unstable_cache` + tags). Catalog search goes through the `search_public_tours` RPC (`getCachedTourSearch` / `getCatalogPage` / `getCachedPublicTours`, 300 s); tour detail is `cache()` + `unstable_cache` (60 s, because the pending-booking expiry cannot invalidate a tag); sitemap 1 h. New public reads must filter `status = 'published'` and `deleted_at IS NULL` themselves.
  - **Shared write logic:** `lib/services/*` (takes a `SupabaseClient`), so actions and `app/api` routes share one implementation.
- **Client components** (`'use client'` only when you need state, effects, browser APIs, or event handlers; say why in the PR):
  - Receive server data as `initialX` props and hold it in `useState`.
  - Mutate by calling Server Actions from `@/actions/*`, then update local state optimistically or call `router.refresh()`.
  - Forms are `<form action={handler}>` with `FormData`.
  - Pending state is a local `useState` flag (`loading`, `actionLoading`). Prefer `useTransition` / `useActionState` for new code.
- **The browser Supabase client** (`@/lib/supabase/browser`) is for **realtime notification subscriptions and Storage uploads only** (bucket `tour-images`). Never use it for domain writes.
- **No global state library.** Do not add react-query, Redux, Zustand, or context stores without a recorded decision in this file.
- **Soft deletes are app-enforced.** RLS does **not** hide `deleted_at` rows (except public vehicles). Every query on a soft-deletable table must add `.is('deleted_at', null)`.

### 3.5 Component & UI design rules

- **Styling.** Use Tailwind v4 utilities only. Tokens live in `app/globals.css` `@theme inline` and `:root`. There are two themes:
  - **Dashboards and admin (`/dashboard/*`, `/admin/*`): the Tailwind Admin template theme**, ported from `reference/tailwind-admin-reactjs-free`.
    - Colors: `primary #5d87ff`, `secondary #49beff`, `success #13deb9`, `warning #f6b51e`, `error #ef4444`, `info #8754ec`, `dark #1c2536`; tints `bg-light{primary,secondary,success,warning,error,info}`; darker text `text-{primary,success,warning,error,info}emphasis`.
    - Neutrals: `text-foreground` (headings), `text-bodytext`, `text-muted-foreground`, `border-border`, `bg-muted`.
    - Font: DM Sans (`font-dashboard`, `--font-dashboard` from `next/font` in `app/layout.tsx`). Utilities: `card-title`, `bg-hover`, `shadow-dashboard`.
    - The shell root and every portal surface (Dialog, Sheet, DropdownMenu, Select) carry the `.tw-admin` class, which scopes the base styles (font, heading color, default border color). Pages outside the shell that use this theme (e.g. `/admin/login`) must add `tw-admin` to their root.
    - Primary CTA: `<Button>` (default variant). Active sidebar item: `bg-primary text-white`. Hover: `bg-lightprimary text-primary`.
    - Do **not** use `slate-*`, `coral`, `brand*`, or raw Tailwind palette colors (`emerald-*`, `amber-*`, `red-*`, …) in dashboard code.
  - **Landing, catalog, tour detail, booking/payment pages:** the Travi brand theme. `brand #0EA5E9`, `brand-dark #0284C7`, `brand-navy #0C1A2E`, `brand-deep #061020`, `coral #F97316`, `coral-dark #EA580C`; `font-sans` (Plus Jakarta Sans), `font-display` (Playfair Display); `shadow-card`, `shadow-lift`. Primary CTA `bg-coral hover:bg-coral/90`. `components/landing/hero.css` is landing-only.
  - The template's radius and shadow scale is **not** imported globally (it would change the landing page). Tailwind's defaults apply everywhere.
  - **No dark mode.** The template ships one; we did not port it. Do not add `dark:` variants piecemeal.
  - Do not add new arbitrary hex values; add a token instead.
- **CSP:** `next.config.ts` sends a static allow-list CSP. A new third-party host (images, scripts, API, map tiles, video, form target) must be added there, or the browser blocks it. Check the console for CSP violations.
  - `animate-in` / `fade-in` / `zoom-in-95` etc. now work (`tw-animate-css`).
- **Dashboard building blocks** (use these instead of hand-rolled markup):
  - Layout: `components/shell/AppShell` + `AppSidebar` (nav sections with headings, promo card, profile dropdown in the header). Add nav items in the `ROLE_NAV` / `sections` arrays of the two layouts.
  - Page top: `PageHeader` (title, description, breadcrumbs, actions). Role homes: `WelcomeBanner` + a `StatCard` grid + `charts/BarChart` / `charts/DonutChart` + `Timeline` / `Table`, in the template's `grid grid-cols-12 gap-6` layout.
  - Panels: `CardBox`. Tables: `components/ui/table`. Statuses: `StatusBadge` (single status → color map). Empty lists: `EmptyState`.
  - Forms: `Input`, `Textarea`, `Label`, and **`NativeSelect`** (from `components/ui/input`) for every select inside a `FormData` form. The Radix `Select` is only for client-state filters.
  - Overlays: `Dialog` / `Sheet` / `DropdownMenu` / `Tooltip`; `ConfirmModal` keeps its old props API and is now a Radix `Dialog`.
- **Conditional classes:** use `cn()` from `@/lib/utils` (clsx + tailwind-merge). Template literals in older code are fine; don't add other ad-hoc helpers.
- **Every list view needs an empty state.** Use centered `text-slate-500` copy, e.g. "No vehicles found."
- **Every async route segment needs a loading state.** Use `loading.tsx` with `components/ui/PageLoader`, or a skeleton / `Suspense` (see `TourCardSkeleton`).
- **Confirmations:** use `components/ui/ConfirmModal` for destructive actions. Do not add new `window.confirm` / `prompt` / `alert` calls; existing ones are legacy.
- **Mobile tables:** render `components/ui/LazyMobileCard` (wraps `GenericMobileCard` via `next/dynamic`, `ssr: false`) below `md`.
- **Leaflet and other browser-only libraries** must use `dynamic(() => import(...), { ssr: false })` (see `TourForm.tsx` → `LocationPicker`).
- **Accessibility, WCAG 2.1 AA, for new UI:**
  - Labelled inputs, plus `aria-label` on icon-only buttons.
  - `role="dialog"` + `aria-modal` on modals.
  - Visible `focus-visible:` rings.
  - Use `next/image` instead of `<img>` for remote images; the host must be listed in `next.config.ts` `images.remotePatterns`.
- **SEO for public routes:**
  - `generateMetadata` (await `params`, which is a Promise in Next 16).
  - JSON-LD via `components/seo/*`.
  - Add the route to `app/sitemap.ts`.
  - Keep `/admin/`, `/dashboard/`, `/api/` and `/tours/*/booking/` disallowed in `app/robots.ts`; booking pages are also `noindex` via `app/tours/[slug]/booking/layout.tsx`. Filtered catalog URLs are `noindex, follow` with canonical `/tours`. `metadataBase` comes from `NEXT_PUBLIC_SITE_URL`.
- **Auth redirects:** every return-to redirect goes through `safeNextPath()`. `/login` and `/auth/*` render only fixed, code-chosen messages (never free text from the query string).
- **Size and reuse:** keep files under ~400 lines; split large client components into sub-components. Extract shared logic into `lib/` or `components/ui/`. Put business logic in services and actions, not in components.

### 3.6 Database & migrations

- **Every schema change is a new migration** in `supabase/migrations/` with a **unique**, current `YYYYMMDDHHMMSS` prefix.
- **Never edit an applied migration.** Never reuse a timestamp; `20260831000000` is already duplicated (§6).
- Use `IF NOT EXISTS` / `IF EXISTS` and `DO $$ … $$` guards. The migration chain does **not** replay on a fresh DB (§4.7), so migrations must be safe against the live schema.
- **Enable RLS on every new table, with explicit policies.**
  - Owner check: prefer the definer helpers `public.current_user_profile_id()`, `current_organizer_profile_id()`, `current_transporter_profile_id()` (older policies inline `… IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())`).
  - Admin check: the `EXISTS (… user_roles … website_roles … role = 'admin')` pattern.
  - **Never give end users INSERT/UPDATE on status, price, balance, rating, verification or ownership columns.** Protect them with `guard_readonly_columns('col', …)` (BEFORE UPDATE) and a `*_before_insert` trigger that sets server values when `public.is_end_user_request()` (see `20261023090000_rls_hardening.sql`). Service-role writes are unaffected.
  - Roles are never inserted by users: use the `assign_self_role(role, website_id)` RPC (refuses `admin`).
  - Trigger functions that must write tables the caller cannot (seat counts, booking refs) are `SECURITY DEFINER SET search_path = public, pg_temp`.
  - **Every policy/trigger change needs a case in `supabase/tests/rls/rls.test.mjs`** (attack + legitimate flow), and `npm run test:rls` must pass.
  - Before applying RLS migrations to a real project, run `supabase/tests/rls/live-policy-audit.sql` there (read-only) to catch policies created outside migrations.
- **After a schema change, regenerate `types/supabase.ts`,** then update §4 of this file.
- **Text statuses are CHECK constraints, not enums.** Add values via a migration that drops and recreates the CHECK.

### 3.7 Anti-patterns: NEVER do these in this repo

1. **Never** use `createAdminClient` in a client component or browser code, or without `{ admin: true }`. Never use it where an RLS client would work (§5.3).
2. **Never** read or define a `NEXT_PUBLIC_`-prefixed secret. Never set `NEXT_PUBLIC_SERVICE_ROLE_KEY` (removed from `lib/env.ts`; some legacy `scripts/*` still read it).
3. **Never** export an unauthenticated function from an `actions/*` file.
4. **Never** trust client-supplied IDs for ownership: wallet IDs, organizer IDs, prices, amounts, statuses. Re-derive them on the server from the session.
5. **Never** compute a booking price on the client, or pass `total_amount` from the client. Price is `schedule.price_per_person ?? tour.price_per_person` × seats, on the server.
6. **Never** update wallet balances with read-modify-write. Use the `increment_*_balance` RPCs and write a `wallet_transactions` row for every balance change.
7. **Never** "fix" the spelling of `canceled` (bookings, transport_bookings) or `cancelled` (tour_schedules) without a migration. They are different on purpose in the DB.
8. **Never** hard-delete soft-deletable rows. Set `deleted_at`, and filter it out in queries.
9. **Never** hand-edit `types/supabase.ts` or an applied migration.
10. **Never** rename `middleware.ts` → `proxy.ts`. Next 16 deprecates `middleware` in favor of `proxy`, but the rename broke session-cookie refresh and was reverted (commit `fed4510`). Only migrate with a verified session-refresh test.
11. **Never** add libraries for what the stack already covers (another icon set, CSS-in-JS, a second UI kit or chart library, a state manager, a second HTTP client). The Radix/shadcn primitives in `components/ui/` are the UI kit; the template's Iconify/Tabler icons, Swiper, SimpleBar and `tailwind-sidebar` were deliberately **not** ported (lucide only).
12. **Never** create `tailwind.config.*`. Tailwind v4 is configured in CSS.
13. **Never** commit `.env*` files (other than `.env.example`), credentials, test passwords, or scratch output.
14. **Never** run `supabase db push`, destructive SQL, or seed/fix scripts against the remote DB without explicit human approval.
15. **Never** skip the QA gate, or report done without the AGENTS.md review (see the top of this file).

---

## 4. Core Business Logic & Domain Rules

### 4.1 Domain model

```
auth.users ─1:1─ user_profiles ─<─ user_roles ─>─ website_roles(role, website_id)   roles: admin | traveler | organizer | transporter
                    │
                    ├─1:1─ organizer_profiles ─<─ tours ─<─ tour_schedules ─<─ bookings ─>─ user_profiles (traveler_id)
                    │                               ├─<─ tour_itineraries            └─<─ payments (unused by code)
                    │                               └─<─ reviews (tour_id)
                    ├─1:1─ transporter_profiles ─<─ vehicles ─<─ vehicle_availability
                    │            └─<─ reviews (transporter_id)
                    │   tour_schedules ─<─ transport_bookings ─>─ transporter_profiles, vehicles, organizer_profiles
                    │   organizer_profiles ─<─ organizer_favorite_vehicles ─>─ vehicles
                    ├─1:1─ user_wallets ─<─ wallet_transactions (polymorphic reference_type/reference_id)
                    │            └─<─ payout_requests
                    └─ admin_audit_logs (admin_profile_id)
notifications.user_id → auth.users.id   (NOT user_profiles.id; payout_otps is the same)
platform_settings: single row (uuid id). organizer_fee_percent, transporter_fee_percent, escrow_holding_days
```

- **ID rules:**
  - Almost every domain FK points to **`user_profiles.id`**. Only `notifications` and `payout_otps` use the auth user id.
  - `ensure_user_wallet(profile_id)` expects a **`user_profiles.id`**, never an `organizer_profiles.id`. Resolve `organizer_profiles.user_profile_id` first.
- **Multi-tenancy:** roles are scoped by `website_roles.website_id = env.WEBSITE_ID`.
  - With `WEBSITE_ID` unset, role queries drop the filter.
  - Signup role assignment and `addAccountType` silently do nothing.
- **Storage:** public bucket `tour-images` (authenticated upload; owner update and delete).

### 4.2 Status values (exact, from the migrations)

| Column | Values | Type |
|---|---|---|
| `bookings.status` | `pending`, `confirmed`, `canceled`, `refunded`, `completed` | enum `booking_status` (one L) |
| `bookings.dispute_status` | `none`, `open`, `resolved_refunded`, `resolved_denied` | enum |
| `tour_schedules.status` | `open`, `full`, `cancelled` | enum (**two Ls**). `full` is never set automatically |
| `tour_schedules.transport_type` | `none`, `self_provided`, `external_transporter` | CHECK |
| `tour_schedules.transport_status` | `not_required`, `self_provided`, `pending`, `confirmed`, `unresolved` | CHECK |
| `tours.status` | `draft`, `published`, `archived` | CHECK |
| `tours.format` | `joiner`, `private`, `solo` | enum |
| `organizer_profiles.status` / `transporter_profiles.status` | `pending`, `approved`, `rejected` | CHECK. New partners start `pending` (DB-forced); admins approve via `actions/partner-review.ts` |
| `partner_documents.status` | `submitted`, `verified`, `rejected` | CHECK |
| `booking_payments.status` / `.resolution` | `applied`, `needs_review` / `refunded`, `no_refund` | CHECK. Open review item = `needs_review` with `resolved_at IS NULL` |
| `organizer_type` / `transporter_type` | `individual`, `company` | CHECK |
| `transport_bookings.status` | `pending`, `accepted`, `declined`, `canceled`, `completed` | CHECK |
| `vehicles.status` / `vehicle_type` | `active`, `inactive`, `archived` / `car`, `van`, `bus`, `minibus`, `suv` | CHECK |
| `vehicle_availability.status` | `available`, `booked`, `blocked` | CHECK |
| `reviews.status` | `pending`, `published`, `hidden` | enum |
| `payout_requests.status` | `pending`, `processing` (approved by one admin, awaiting a second when the dual-approval threshold applies), `paid`, `rejected` | enum |
| `wallet_transactions.type` | `payment_hold`, `escrow_deposit`, `escrow_release`, `withdrawal_pending`, `withdrawal_completed`, `withdrawal_rejected`, `refund`, `platform_fee`, `manual_adjustment`, `penalty` | enum |
| `wallet_transactions.balance_affected` | `available`, `escrow` | CHECK |
| `legal_acceptances.document` | `terms`, `privacy`, `partner_terms`, `checkout_terms` | CHECK. Append-only event log |
| `data_requests.request_type` / `.status` | `deletion`, `access`, `correction` / `open`, `in_progress`, `completed`, `rejected` | CHECK. One active request per type per user |
| `support_messages.topic` / `.status` | `booking`, `payment_refund`, `complaint_organizer`, `complaint_transporter`, `partner`, `privacy`, `other` / `open`, `in_progress`, `resolved`, `closed` | CHECK |

### 4.3 Booking lifecycle (invariants that must not break)

```
           createBooking (traveler, server-priced)
                    │
                 pending ──(15 min, pg_cron expire_pending_bookings)──► canceled
                    │  payment verified (success page) / webhook
                    ▼
               confirmed ──(traveler cancel, before start_date: full refund)──► canceled
                    │  └─(openDispute within escrow_holding_days of end_date)─► dispute_status=open
                    │                       └─ admin resolveDispute: refund → status=refunded, resolved_refunded
                    │                                                deny   → resolved_denied
                    ▼ (cron: end_date + escrow_holding_days, dispute none/resolved_denied)
               completed  (escrow → available for the organizer)
```

- **Booking inserts are validated and priced by the DB** for end users (`bookings_before_insert` → `booking_quote()`): the schedule must be `open`, not deleted, starting after today (Asia/Manila), on a `published` tour; `total_amount`, `status = 'pending'`, `dispute_status = 'none'` are set by the server. Travelers have **no UPDATE** on bookings; every status change goes through server code (service role).
- **Seat accounting lives in the DB:**
  - `booked_count` = sum of `bookings.seats_consumed` (server-owned) over `pending | confirmed | completed`, maintained by `update_tour_schedule_booked_count` (SECURITY DEFINER). End users cannot change `booked_count`.
  - **Private tours (D3):** a booking takes the whole group: seats = capacity, price = per-person price × capacity; a second booking on the date is refused (`booking_seats()`, `booking_quote()`).
  - A **`private`-format** booking consumes the schedule's **whole capacity**.
  - CHECK `check_capacity_not_exceeded (booked_count <= capacity)` makes overbooking impossible.
  - The service pre-checks `capacity - booked_count` for a friendly error, but **the DB constraint is the real guard. Never remove or bypass it.**
- **Booking refs** come from the `generate_booking_ref` BEFORE INSERT trigger: `BK-` + 6 uppercase hex characters, unique. Do not generate them in app code.
- **Pricing:**
  - `total_amount = (schedule.price_per_person ?? tour.price_per_person) × seats`. Amounts are pesos (`numeric`).
  - The traveler pays **no added fee**.
  - `original_price` on a schedule is a display-only "compare-at" price.
- **The pending expiry (15 minutes) frees seats.** Do not remove the cron job.
  - **Late payments** (paid after expiry): `confirm_booking_payment()` revives the booking if the trip has not started and seats remain; otherwise the payment is recorded in `booking_payments` as `needs_review` (`late_payment_needs_refund`), Sentry and the super-admin are alerted, and the money must be refunded by hand (no admin UI yet, §6).
- **Traveler cancellation** (`cancelBookingAsTraveler`):
  - Allowed only from `pending` or `confirmed`, and only before the schedule's `start_date` (Manila date, `lib/datetime.ts`).
  - Pending (unpaid): status-guarded update to `canceled`.
  - Confirmed: **full** refund through `refundBooking()` (`lib/services/refunds.ts`), which reverses the escrow and cancels the booking atomically.
- **Disputes:**
  - Opened only through `open_booking_dispute(booking, traveler, reason)` (row-locked): the owning traveler, a `confirmed` booking with `dispute_status = 'none'`, after the trip starts and up to `escrow_holding_days` after `end_date`; reason 20–2000 chars (`bookings.dispute_reason`, `dispute_opened_at`). Opening one notifies the traveler, organizer and super-admin.
  - An open dispute blocks escrow release (release locks the same row and re-checks).
  - Admin resolution: refund → `refundBooking(…, bookingStatus 'refunded')` (sets `resolved_refunded`); deny → `deny_booking_dispute()`. Both are audited.
- **Admin cancel/refund:** `adminCancelBooking({ bookingId, amount?, reason })` cancels pending bookings or refunds confirmed ones in full or in part (`refundBooking`, `admin_refund`), audited.
- **Pay now:** pending bookings can be paid from the booking detail page (`/dashboard/traveler/bookings/[id]`); `processPayment` reuses a live PaymentIntent (`awaiting_payment_method`/`awaiting_next_action`) instead of creating a new one.
- **Organizer `updateBookingStatus`:** checks ownership via `tour_schedules!inner(tours!inner(organizer_id))` and allows **only `pending → canceled`** (decline). Organizers cannot confirm bookings; only a verified payment confirms one. Canceling a paid booking must go through the refund flow.

### 4.4 Payments, fees, escrow & wallets

**Every money movement is a database function** (`supabase/migrations/20261023120000_money_integrity.sql`): it locks the rows it touches, writes the ledger and the balances in one transaction, and is idempotent. App code talks to PayMongo and calls these functions with the service role; it **never** updates `user_wallets` balances or `wallet_transactions` directly. They are tested in `supabase/tests/rls/money.test.mjs`.

| Function | Called by | Does |
|---|---|---|
| `confirm_booking_payment(booking, intent, payment, amount_centavos, fee_centavos, source)` | `applyPaidPayment()` (success page + webhook) | Payments for a cancelled/deleted schedule become `booking_closed_needs_refund`. Records the payment in `booking_payments` (unique per PayMongo payment), checks the amount, `pending → confirmed` (or revives a late payment), credits organizer escrow with an `escrow_deposit` row. Returns `confirmed`, `already_applied`, or a needs-review outcome (`amount_mismatch`, `duplicate_payment`, `late_payment_needs_refund`, `booking_closed_needs_refund`) |
| `release_booking_escrow(booking)` + `bookings_due_for_escrow_release()` | escrow cron | Escrow → available (two `escrow_release` rows), booking → `completed` |
| `begin_booking_refund` → `complete_booking_refund` / `fail_booking_refund` | `refundBooking()` | One active refund per booking (`booking_refunds`), proportional escrow reversal, booking → `canceled`/`refunded` |
| `open_booking_dispute(booking, traveler, reason)`, `deny_booking_dispute` | dispute actions | Row-locked dispute transitions |
| `request_payout(amount, method_id)` | `requestPayout()` with the **user's** session | Approved partners only; min from settings; destination from the caller's saved methods; atomic debit + `withdrawal_pending` + `payout_requests` |
| `approve_payout` → `mark_payout_paid`, `reject_payout` | admin actions | Only from `pending`/`processing`; wallet derived from the request; ledger + audit log. With `platform_settings.payout_dual_approval_threshold` set (NULL = off), payouts at or above it must be approved first and paid by a **different** admin; an approved payout is always paid by a different admin |
| `begin_payment_review_refund` → `resolve_payment_review` / `fail_payment_review_refund` | `/admin/finance` | Refund or close (with note) a `needs_review` payment; one claim at a time; audited; no ledger change |
| `admin_finance_summary(from, to)`, `admin_booking_stats(months)` | admin pages | GMV, platform fees, MDR, refunds, liabilities, pending payouts, open reviews, drift; monthly booking stats (Manila) |
| `wallet_ledger_drift()`, `bookings_missing_deposit()`, `backfill_booking_deposit()` | cron, `scripts/backfill-escrow-deposits.ts` | Reconciliation |

- **PayMongo flow:**
  1. `/tours/[slug]/booking/[bookingId]/pay` → `PaymentSelectionClient` → `processPayment(bookingId, 'gcash' | 'paymaya')`.
     - Only the owning traveler, only for a `pending` booking. The return URL is built on the server (`NEXT_PUBLIC_SITE_URL`, else the request host).
     - It creates a PaymentIntent (**centavos**: `Math.round(total_amount * 100)`) with `metadata.booking_id`/`booking_ref`, stores `pi_…` in `bookings.paymongo_session_id`, attaches a PaymentMethod and redirects. Card is disabled in the UI.
  2. The redirect returns to `/success`. The RSC requires the signed-in owner, then `verifyBookingPayment()` re-fetches the intent from PayMongo and calls `applyPaidPayment()`.
  3. `POST /api/webhooks/paymongo` (backstop when the traveler never returns): verifies the `paymongo-signature` HMAC over the raw body (fails closed with 503 without `PAYMONGO_WEBHOOK_SECRET`), skips events already in `webhook_events`, re-fetches the payment from PayMongo, finds the booking by intent id (or intent metadata), calls `applyPaidPayment()`, then records the event. Errors return 500 so PayMongo retries.
- **Currency conversion:** DB amounts are pesos; PayMongo amounts are centavos. Convert only at the `lib/paymongo.ts` boundary.
- **Fees** come from the single `platform_settings` row (uuid id: read the latest row, never `.eq('id', 1)`), bounded by the `platform_settings_bounds` CHECK; every change is copied to `platform_settings_history` and the admin audit log:
  - `organizer_fee_percent` (DB default **10.00**, 0–50), **snapshotted on the booking** (`bookings.organizer_fee_percent`) when it is created. The organizer's escrow credit is `total − round(total × fee%, 2)`; the fee is stored in `fee_amount`.
  - `transporter_fee_percent` (default 3.00, 0–50). Unused while transport is coordination-only (no on-platform transport payouts; decision D2).
  - `escrow_holding_days` (default 3, 0–60). `min_payout_amount` (default ₱100).
  - Never use `||` fallbacks for these; a stored 0 is valid.
  - PayMongo's own fee (MDR) is recorded per payment in `booking_payments.fee_centavos`; who absorbs it is still an open decision (D4).
- **Escrow release** (`GET /api/cron/escrow-release`, Bearer `CRON_SECRET`, daily at 18:00 UTC = 02:00 Manila via `vercel.json`):
  - Releases `confirmed` bookings whose `end_date + escrow_holding_days <= manila_today()` and whose dispute status is `none | resolved_denied`.
  - Reports `no_deposit` bookings and any `wallet_ledger_drift()` rows to Sentry.
- **Wallets and the ledger:**
  - One `user_wallets` row per `user_profiles.id` (`ensure_user_wallet`, race-free). Revenue goes to the organizer's **user** profile wallet (`organizer_wallet_for_booking()`). Currency is PHP.
  - **Sign convention:** `wallet_transactions.amount` is the signed effect on the bucket in `balance_affected`, so `sum(amount)` per bucket equals the balance. `withdrawal_completed` is a 0-amount memo (the debit happened at request time).
  - The ledger is **append-only** (trigger); corrections are new `manual_adjustment` rows. Balances can never go negative (CHECK).
  - Users have SELECT-only RLS on wallets and the ledger; `booking_payments`, `booking_refunds`, `webhook_events` are service-role only.
- **Finance console** (`/admin/finance`): KPIs, payments needing review (refund / close with note), CSV exports via `/api/admin/export/[kind]` (`bookings|payments|refunds|payouts|ledger`; admin-only, rate-limited, audited, account numbers masked to the last 4, formula-injection-safe). Organizer dashboard shows **net** earnings from its own ledger.
- **Payouts:** password re-entry (rate-limited) + `request_payout()`; the destination is always one of the caller's saved, OTP-verified methods (snapshotted into `payout_requests.payout_method`). Admins pay outside Travi, then `markPayoutPaid(payoutId, reference)` or `rejectPayout(payoutId, reason)`.
- **Saved payout methods** live in `user_wallets.saved_payout_methods` (jsonb): `{ id, type: 'bank'|'gcash'|'maya', isDefault, details: { accountName, accountNumber, bankName? } }`. Adding one requires a verified OTP (`add_payout_method`). The first method saved becomes the default.
- **Backfill:** bookings confirmed before this migration may have no deposit (old wrong-wallet bug). Run `scripts/backfill-escrow-deposits.ts` (dry run by default) after the migration is applied.
- **Mock mode:** with `PAYMONGO_SECRET_KEY` unset (local dev only), `lib/paymongo.ts` returns successful mock intents, payments and refunds. Production refuses to start without a live key.

### 4.5 Tours, schedules, transport, vehicles, reviews

- **Tours** (`actions/tours.ts` → `lib/services/tours.ts`, `tourSchema`):
  - Organizer only; writes are scoped by `organizer_id`. New tours always start as `draft`; `status` is `z.enum(['draft','published','archived'])`.
  - Slug is `slugify(title)-<last 6 digits of Date.now()>`, set on create and **never changed** (DB-guarded).
  - Itinerary arrives as a JSON string `[{ day_number, title, description }]`. Update replaces all rows. `(tour_id, day_number)` is unique.
  - **Publish rules** (`getTourPublishReadiness`, shown as a live checklist in `TourForm`): approved organizer, ≥ 1 itinerary day, ≥ 1 open schedule starting after today (Manila), price > 0, cover image. The DB (`tours_publish_guard`) also refuses `published` from an unapproved organizer.
  - Archive is refused while upcoming schedules have pending/confirmed bookings ("cancel schedules first").
  - **Admin hold:** `admin_unpublish_tour` / `admin_republish_tour` (admin console, audited, organizer notified). While `tours.admin_hold_at` is set the organizer cannot re-publish or clear the hold (`tours_enforce_admin_hold`).
- **Public catalog** (`search_public_tours`, `lib/data/tours.ts`): only `published`, not-deleted tours of **approved**, non-deleted organizers with an `open`, non-deleted schedule starting today or later (Manila) with at least max(guests, 1) seats left. Price = schedule price ?? tour price. Ratings come from published, non-deleted reviews (`tour_rating_summary` view). User text is matched literally (LIKE wildcards escaped). Tour detail shows an "Operated by" card (legal name, DOT no., contact email; LEG-06) via `lib/data/merchant.ts`.
- **Schedules** (`actions/schedules.ts`, §3.2-compliant, zod in `lib/schemas/schedule.ts`):
  - Created `open`, starting after today (Manila).
  - `updateSchedule` rejects capacity below `booked_count`, any capacity change on a booked private date, and edits to cancelled schedules. A DB trigger blocks date changes while an **accepted** transport booking exists (error 55000, shown as its message).
  - `transport_status` is derived from `transport_type` only when the type changes (`none` → `not_required`, `self_provided` → `self_provided`, `external_transporter` → `unresolved`), and the type cannot change while a vehicle request is pending/accepted. Requests then move it: send → `pending`, accept → `confirmed`, decline/cancel → `unresolved`.
  - The schedule form **does not create transport requests**; vehicles are requested from the schedule page (`TransportManager` → `sendTransportRequest`).
  - **Cancel** (no hard/soft delete for organizers): `getScheduleCancellationPreview` → `cancelSchedule` → `cancelScheduleWithBookings` (`lib/services/schedules.ts`): schedule → `cancelled` first, pending bookings canceled + travelers notified, confirmed bookings fully refunded through `refundBooking`, active transport request canceled + transporter notified. Failures are returned and retryable; audited. End users cannot cancel/soft-delete a schedule with active bookings any other way (`tour_schedules_guard_cancel`). Refused once the trip has started with active bookings.
- **Transport requests** (D2: coordination only, no on-platform transport payments; `actions/transport-requests.ts`, `lib/transport.ts`, DB triggers in `20261023090000` + `20261025110000`):
  - **Send** (organizer only): `sendTransportRequest({...})` derives transporter, seats and dates on the server; checks schedule ownership, not started, transport type, one active request per schedule (app-level), vehicle seat capacity, approved transporter, and that the vehicle is free (`code: 'CONFLICT'`). The DB forces `status = 'pending'`, `estimated_price = NULL`. Pending requests do not hold the vehicle.
  - **Accept** (transporter; plain status update with the user's client): the DB inserts the `booked` availability row in the same statement and fails if the vehicle is taken (`23P01`), inactive or the schedule cancelled.
  - **Decline / organizer cancel** (`cancelTransportRequest`, pending|accepted) / soft delete release the vehicle by soft-deleting its booked row (trigger).
  - **Complete:** accepted only, from the Manila trip end = max(schedule `end_date`, transport return/pickup date).
  - Times are Manila wall-clock (`manilaDateTimeToIso`, `formatManilaDateTime`). Contact details: the transporter sees the organizer's for pending/accepted requests; the organizer sees the transporter's once accepted (service-role read limited to counterparties).
  - Organizer list: `/dashboard/organizer/transport`. Admin oversight: `/admin/transport`.
- **Vehicles:**
  - Default `active`; toggle between `active` and `inactive`; delete is soft. Optional OR/CR upload per vehicle (private `partner-documents` bucket).
  - Discovery: `available_vehicles(start, end, seats)` RPC (organizers/admins; approved transporters only; no live booked/blocked overlap; no phone or plate).
- **Availability:**
  - No overlapping live booked/blocked rows, enforced in the DB (`vehicle_availability_no_overlap`, per-vehicle lock). `booked` rows are trigger-only (end users cannot write them).
  - Removing a block is a soft delete. Queries must filter `deleted_at IS NULL` and `status IN ('booked','blocked')`.
- **Reviews** (`actions/reviews.ts`):
  - Travelers review **tours only** via `createReview({ bookingId, rating, comment })`: their own `completed` booking of that tour, one review per booking (`reviews.booking_id` unique, also across soft deletes), comment ≤ 1000, inserted `pending`. Enforced by RLS + `can_review_booking()`. End users cannot set `transporter_id` (no organizer→transporter review flow yet).
  - **Only `published` reviews are public.** Admin queue (Pending / Published / Hidden): `publishReview`, `hideReview`, `deleteReview` (soft) — admin-only, service role, audited.
  - `transporter_profiles.average_rating/review_count` are maintained by the `reviews_refresh_ratings` trigger (`refresh_transporter_rating`). Tour ratings: `tour_rating_summary` view (anon-readable).

### 4.6 Accounts, roles, onboarding, notifications, OTP

- **Signup:**
  - Supabase Auth `signUp` with `options.data` (`full_name`/`first_name`/`last_name`, `signup_role`, `signup_website_id`) and `emailRedirectTo` `/auth/callback`. The `on_auth_user_created` trigger (`handle_new_auth_user()`) creates `user_profiles` and assigns the role (self-service roles only; the website id must exist in `website_roles`; never admin). `ensureAccountProvisioned()` (`lib/accounts.ts`) is the fallback on signup, login and callback.
  - With "Confirm email" ON there is no session after signup → `/login?message=check_email`. `on_auth_user_email_confirmed` mirrors `auth.users.email_confirmed_at` into `user_profiles.email_verified_at`. **Bookings require a verified email** (`assertEmailVerified(user)` in `lib/auth-helpers.ts`).
  - Password minimum 8 everywhere (`passwordSchema`, max 72).
  - **Password reset:** `/auth/forgot-password` (rate-limited, same message whether or not the account exists) → email → `/auth/callback` (verifies the recovery link, sets the `travi_pw_recovery` marker cookie) → `/auth/reset-password` (requires the marker; signs out other sessions).
  - Login honours `?next=` (safe paths only); middleware sends signed-out `/dashboard/*` to `/login?next=…`.
- **Role switching:**
  - `addAccountType(role)` adds a role via the `assign_self_role` RPC.
  - `RoleSwitcher` links to `/dashboard/<role>`.
  - The **primary role** is `traveler` if the user has it, else the first role.
- **Onboarding & approval (KYC):** the `organizer/` and `transporter/` dashboard server layouts render the onboarding form until a `*_profiles` row exists, then a `PartnerStatusBanner` (pending / info requested / rejected with reason).
  - Onboarding requires a verified email and a government ID upload, plus legal name, TIN, public contact email; companies also need the company name and DTI/SEC no. (BIZ-08); organizers may add a DOT accreditation no., transporters an LTFRB franchise no.
  - **New partners start `pending`** (DB: `*_profiles_before_insert`). Until approved they can prepare drafts and vehicles but cannot publish tours, be discovered/requested, or request payouts.
  - Documents: private bucket `partner-documents` (`<uid>/…`, pdf/jpeg/png/webp, 10 MB) + table `partner_documents` (`doc_type`, `status` `submitted|verified|rejected`); admins open them via 5-minute signed URLs.
  - Admin review: `actions/partner-review.ts` (`approvePartner`, `rejectPartner(reason)`, `requestMoreInfo(note)`, `getPartnerDocumentUrl`): service role, guarded transitions, audited, partner notified. Approval verifies submitted documents.
  - Identity fields lock after approval (fill-blank only); editing them after a rejection puts the partner back to `pending` (`partner_profiles_kyc_rules`). Rejecting an approved partner is how they are deactivated.
- **Legal consent** (`20261026090000`, `lib/legal/consent.ts`): versions come from `LEGAL_DOCUMENTS` in `lib/legal/company.ts`.
  - Signup requires `acceptTerms` (18+, Terms, Privacy). The versions, an HMAC IP hash (key derived from `OTP_SECRET`; never the raw IP) and a short user agent go into `options.data.legal_acceptance`; the `user_profiles_record_signup_acceptances` trigger copies them into `legal_acceptances` (works with the auth trigger or the `ensureAccountProvisioned` fallback; bad values are dropped, signup never fails on them).
  - Checkout: `processPayment(bookingId, method, acceptedTerms)` requires `true` and records `checkout_terms` for the booking **before** calling PayMongo. Partner onboarding records `partner_terms` before the profile insert. Both **fail closed** if the table is missing.
  - Policy pages read fee %, escrow days and payout minimum from `platform_settings` (`getPolicySettings`), so they never drift from the real numbers.
- **Data subject rights (RA 10173):** the "Your data" card on every profile page downloads a JSON export of the caller's own data (`actions/privacy.ts`, service role with session-derived ids, audited) and files correction/deletion requests (`data_requests`). Admins work them at `/admin/requests` (status-guarded, audited, user notified). Deletion is manual: financial and booking records must be kept.
- **Support / complaints:** `/contact` → `submitSupportMessage` (IP rate limit, honeypot) → `support_messages` + email to the support inbox (falls back to `ADMIN_EMAIL`) + super-admin notification. No acknowledgement goes to the typed address (anti-relay).
- **Admin user management** (`/admin/users`): search, role add/remove (`modifyUserRole`; cannot remove your own or the last admin), suspend/unsuspend (`setUserSuspended`, Supabase ban; cannot suspend yourself or another admin; existing sessions last until token expiry).
- **Admin MFA (SEC-12):** `loginAsAdmin` checks the password, then sends the admin to `/admin/mfa/enroll` (no TOTP factor yet) or `/admin/mfa/verify`. Middleware requires an `aal2` session on every `/admin/*` page except login and the MFA pages; `assertRole` requires `aal2` whenever the check passes because of the admin role (verified via `getClaims()`). `ADMIN_MFA_REQUIRED` defaults to on in production and off elsewhere; `false` in production is break-glass only (RUNBOOK §6).
- **Notifications:**
  - Rows are inserted with the service-role client and keyed by **auth user id**.
  - Only `notifications` is in the `supabase_realtime` publication; the bells subscribe through the browser client.
  - `notifySuperAdmin` targets the user whose email is `ADMIN_EMAIL`.
  - Email goes through `sendEmail` (`lib/email.ts`, Resend) with templates from `lib/email-templates.ts`.
  - **Travelers** get in-app + email messages for: booking confirmed (receipt), payment needs review, booking canceled/refunded, dispute opened, dispute resolved, and a trip reminder 1–2 days before departure (`/api/cron/trip-reminders`, daily 09:00 Manila). Send-once bookkeeping: `booking_notifications_sent` (unique booking/kind/dedupe key; service role only); due list: `bookings_due_for_trip_reminder()`.
- **OTP** (`lib/otp.ts`; only the payout-method wrappers `sendPayoutOtp`/`verifyPayoutOtp` are Server Actions in `actions/otp.ts`):
  - Codes come from `crypto.randomInt` and are only emailed. The DB (`otp_challenges`, `20261026100000`, service role only) stores `HMAC-SHA256(OTP_SECRET, challengeId|userId|action|code)` bound to the user, action and target address. 10-minute expiry, 5 attempts, single use, max 5 codes per user and action per hour; a new code replaces the open one (`otp_issue`, `otp_attempt`, `otp_verified`).
  - The browser holds only the opaque challenge id (httpOnly `otp_challenge_<action>`). Send and verify are rate-limited per user (`auth` limiter).
  - Use `redeemOtp()` to verify and use up a code in one step, or `verifyOtp()` then `requireVerifiedOtp()` / `consumeVerifiedOtp()` (atomic; throws if already used). Consume **before** the protected write (e.g. `savePayoutMethod`), so one code authorizes exactly one change.
  - Email change: the code goes to the **new** address, uniqueness is re-checked on confirm, and a notice goes to the old address.
  - Phone OTP is **hidden at launch** (`PHONE_OTP_ENABLED = false` in `lib/features.ts`, decision D5): the UI hides it and the phone actions refuse. Password change uses the email code only.
  - Actions: `add_payout_method`, `change_email`, `change_phone`, `change_password_email`, `change_password_phone`, `verify_email`.
  - Phone numbers must match PH format `^(\+63|0)9\d{9}$` and be unique.
  - The legacy `payout_otps` table is unused and locked down (no end-user policies or grants).

### 4.7 Schema drift and doc drift (read before touching the DB)

- **`types/supabase.ts` is stale** (generated around 2026-08-30).
  - Missing: `payout_otps`; `user_profiles.phone`, `email_verified_at`, `phone_verified_at`; `user_wallets.saved_payout_methods`; `wallet_transactions.fee_amount`; `bookings.dispute_status`; the new `platform_settings` columns; enum values `escrow_deposit` and `penalty`; `increment_available_balance`.
  - Still lists the dropped `release_tour_escrow`.
  - **Regenerate before relying on it.**
- **Columns that existed only in the live DB** (`bookings.paymongo_session_id`, `tours.latitude`, `tours.longitude`) are now added by `20261023090000_rls_hardening.sql` (`ADD COLUMN IF NOT EXISTS`). `types/supabase.ts` still needs regenerating.
- **The migrations cannot rebuild a fresh Supabase DB on their own:**
  - `websites` (and `pages`, `templates`, …) are never created.
  - Legacy migration 017 references tables created later (in the live DB it ran after `20260826164500`).
  - `uuid_generate_v4()` requires `uuid-ossp`; the expiry migration needs `pg_cron`.
  - The RLS harness (`supabase/tests/rls/harness.mjs`) works around all four with stubs and a reordered 017, so the full chain replays there.
- **`docs/DATABASE.md` is wrong in places; the migrations win:**
  - It says `profiles`; the table is `user_profiles`.
  - Its RLS examples are wrong.
  - It says the organizer fee default is 3%; it is 10%.
  - It lists a `completed` schedule status, which does not exist.
  - It describes a `reviews.vehicle_id` column, which does not exist.
  - It says `booked_count` lives on `tours`; it lives on `tour_schedules` and counts pending bookings too.
  - It describes rating auto-recalculation; there is no trigger.
  - Its types path is wrong.
- **`.agents/skills/*` mention Next 14, React 18, toasts, `useForm`, and coral `#FF5A5F`.** Those are wrong for this repo; follow this file (dashboard styling: §3.5).

### 4.8 Feature status (from the code)

| Area | State |
|---|---|
| Landing, catalog, tour detail, SEO (sitemap, robots, JSON-LD) | Implemented |
| Auth (email/password), multi-role switching, onboarding | Implemented |
| Admin console (organizers, transporters, tours, bookings, reviews, payouts, notifications, settings) | Implemented on the real DB (service role) |
| Organizer tour CRUD, schedules, itineraries, transport requests | Implemented |
| Transporter vehicles, availability, requests, reviews view | Implemented |
| Traveler booking → PayMongo (GCash/Maya) → confirmation, cancel, dispute | Implemented with atomic DB functions + signed webhook; ⚠ migration not yet applied (§6 #3) |
| Wallets, escrow cron (scheduled in `vercel.json`), payouts, saved payout methods | Implemented with atomic DB functions; ⚠ see §6 #3, #6, #7 |
| Review submission by travelers + admin moderation queue | Implemented |
| Public `/tours` catalog with filters, hero search, password reset, email verification, traveler emails/reminders | Implemented (Phase 3 Wave A; migrations pending) |
| Partner KYC + approval, publish rules, schedule cancel cascade, disputes with reasons, private tours, transport conflicts, admin finance/users/audit/transport, maker-checker payouts | Implemented (Phase 3 Wave B; migrations pending) |
| Policy pages, consent capture, data export/requests, contact/complaints inbox | Implemented (Phase 4; migration pending; **text is a draft until counsel review**, placeholders in `lib/legal/company.ts`) |
| Mobile/Bearer API | Removed (D6); returns post-launch |
| Real SMS provider; transport payouts; dispute evidence uploads | **Not implemented** |

---

## 5. Security & Data Privacy

### 5.1 Authentication

- **Supabase Auth**, email + password.
- **Sessions are cookie-based** through `@supabase/ssr`. `middleware.ts` → `lib/supabase/middleware.ts` `updateSession()` refreshes the session on every non-static request.
- **Server-side identity:** always `supabase.auth.getUser()` (verifies the JWT with Supabase). Never trust `getSession()` on the server.
- **Server Actions and RSC:** `requireSession()` returns `{ user, profile, supabase }` and throws `'Unauthorized'`.
- **`app/api/*`** has no user-facing Bearer API (removed, decision D6). The remaining handlers authenticate with the PayMongo HMAC, `CRON_SECRET`, or the admin's session (`/api/admin/export`). A future mobile API must forward the token to Supabase (`global: { headers: { Authorization } }`).
- **Auth email links** (confirm signup, password reset) all land on `/auth/callback`.
- **Admin sign-in is password + TOTP** (`aal2`; see §4.6 Admin MFA).
- **Re-authentication for sensitive operations** (payout request, password change) uses `signInWithPassword`. **OTP** is required for adding payout methods and for changing email, phone, or password.

### 5.2 Authorization (RBAC): four layers, all required

| Layer | Mechanism | Notes |
|---|---|---|
| 1. Middleware | `/admin/*` requires `admin` (else → `/admin/login`) and an `aal2` session (else → `/admin/mfa/*`). `/dashboard/*` requires a user with a role; admins → `/admin`; a role mismatch → the primary role's dashboard. `/login` bounces signed-in users | Roles come from `user_roles ⋈ website_roles` filtered by `WEBSITE_ID`. **`/api/*` is NOT gated by middleware** |
| 2. Page / layout | Admin pages: `requireSession()` + `assertRole(user.id, 'admin')` | ⚠ `admin/bookings`, `admin/tours`, `admin/transporters` skip this. Add it when you touch them |
| 3. Server Action / route | `assertRole(user.id, role)` (**admin passes every role check**), **plus an ownership check on the row** | Ownership is enforced with `.eq('organizer_id', …)`, `.eq('transporter_id', …)`, or `!inner` joins |
| 4. Postgres RLS | Partner/vehicle/availability base tables are **owner + admin only** for signed-in users; others go through `public_organizer_profiles` / `public_transporter_profiles` / `public_vehicles` (contact fields only for accepted transport counterparties), `organizer_traveler_contacts()` (name; email only for confirmed bookings) and `available_vehicles()`. Admins have SELECT-only on `payout_requests`. Owner policies (definer helpers `current_*_profile_id()` or the `user_profiles.user_id = auth.uid()` subquery); inline admin `EXISTS` checks; `is_organizer_for_traveler()`. Server-owned columns guarded by triggers; `assign_self_role`/`booking_quote` RPCs. Anonymous users get column-limited SELECT on partner/vehicle tables. Tested by `npm run test:rls` | RLS is the last line of defense, **not** the only one |

Permissions matrix (intended):

| Action | Traveler | Organizer | Transporter | Admin |
|---|:---:|:---:|:---:|:---:|
| Browse / view published tours | ✅ | ✅ | ✅ | ✅ |
| Book, pay, cancel, dispute own bookings | ✅ | ❌ | ❌ | ❌ |
| Create / edit / archive own tours and schedules | ❌ | ✅ | ❌ | ❌ |
| View bookings | Own | Own tours | ❌ | All |
| Manage vehicles and availability; accept/decline requests | ❌ | ❌ | ✅ | ❌ |
| Request payouts | ❌ | ✅ | ✅ | ❌ |
| Approve partners, moderate reviews, resolve disputes, pay payouts, edit fees, modify roles | ❌ | ❌ | ❌ | ✅ |

### 5.3 The service-role (admin) client

`createAdminClient({ admin: true })` bypasses RLS. Use it **only** when all three of these hold:

1. It runs server-side: actions, RSC, route handlers.
2. The caller has already been authenticated **and** authorized in code, including row ownership. Webhooks and cron are the exception; they use their own secret verification.
3. The operation cannot be done under RLS. Valid cases:
   - wallet and ledger writes
   - cross-user notifications
   - admin console reads and writes
   - `auth.admin.*`
   - audit logs
   - booking status changes driven by payment

Record the reason in a one-line comment at the call site.

### 5.4 Input validation & sanitization

- **Validate every external input with zod** in `lib/schemas/*` before it reaches the DB. This covers action args, `FormData`, route bodies, webhook payloads, and search params.
  - Use `z.string().uuid()` for IDs.
  - Use `z.coerce.number()` for form numbers, with explicit `min` / `max`.
  - Use `z.enum([...])` for statuses, mirroring §4.2.
  - Legacy actions that parse `FormData` by hand (`schedules`, `vehicles`, `availability`, `transport-requests`, `organizer`, `transporter`, `wallet`) must be migrated to zod when you touch them.
- **Queries:** use the Supabase query builder only. Never build SQL strings, and never interpolate user input into `.or()` / `.filter()` strings without escaping.
- **Rendering:** React escapes by default. **Never use `dangerouslySetInnerHTML`** except for JSON-LD from `JSON.stringify` of server data. Render markdown with `react-markdown` (no raw HTML plugin).
- **Email HTML templates:** escape user-provided strings such as names, tour titles, and review text.
- **Uploads:** bucket `tour-images` accepts JPEG/PNG/WebP/AVIF up to 10 MB (bucket config), and users may only upload to `<auth.uid()>/<file>` (storage policy). Client code must use that path.

### 5.5 Secrets & environment variables

- **All runtime env vars are declared and validated in `lib/env.ts` (zod).** New code imports `env` from `@/lib/env`, not `process.env`.
  - When you add a variable, add it to the `envSchema` **and** to `.env.example` (name, comment, and a placeholder value only) in the same change.
  - Sentry configs/instrumentation and `app/api/health` read `VERCEL_*` from `process.env` on purpose. Some legacy modules still read `process.env` directly: `lib/email.ts`, `lib/notifications.ts`, `lib/data/*`, `lib/logger.ts`, `actions/bookings.ts`, `app/robots.ts`, `app/sitemap.ts`. (`NODE_ENV` reads are fine.)
  - `.env.example` is committed and must stay in sync with `lib/env.ts`.
- **`.env.local` is the real secrets file.** It is gitignored by `.env*`, and `!.env.example` is the only exception. **Never commit real values, and never print secrets in logs, test output, or chat.**
- **Only `NEXT_PUBLIC_*` values may reach the browser.** Never prefix a secret with `NEXT_PUBLIC_`.
- **Never hardcode keys, passwords, or test credentials in source.**

| Variable | Scope | Required | Purpose / behavior if missing |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | **yes** | Supabase project URL. Startup fails without it |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | **yes** | Anon key. Startup fails without it |
| `SUPABASE_SERVICE_ROLE_KEY` | **server secret** | yes (prod) | Service-role client, wallets, notifications, `test:qa` |
| `WEBSITE_ID` | server | yes | Tenant scope for roles. Unset ⇒ unscoped role checks, and signup gets **no role** |
| `ADMIN_EMAIL` | server | yes | Super-admin notification target. Unset ⇒ admin notifications are dropped |
| `APP_ENV` | server | prod | `production` turns on the strict checks in `lib/env.ts` (falls back to Vercel's `VERCEL_ENV`). In production every secret in this table marked "yes (prod)" is **required at startup**, and `PAYMONGO_SECRET_KEY` must be `sk_live_` |
| `OTP_SECRET` | **server secret** | **yes (prod)** | ≥32 chars. HMAC key for OTP hashes; also the base of the (domain-separated) consent IP-hash key. Must NOT be the Supabase JWT secret. Unset in dev ⇒ random key per server run. Rotating it voids codes in flight and makes old IP hashes non-comparable |
| `ADMIN_MFA_REQUIRED` | server | optional | `true`/`false`. Unset ⇒ on in production, off elsewhere. `false` in production is break-glass only |
| `CRON_SECRET` | **server secret** | **yes (prod)** | ≥32 chars. Bearer for `/api/cron/escrow-release`. Unset ⇒ the endpoint **refuses every request** |
| `PAYMONGO_SECRET_KEY` | **server secret** | **yes (prod)** | PayMongo API. Unset ⇒ **all payment verifications and refunds are mocked as successful** |
| `PAYMONGO_WEBHOOK_SECRET` | **server secret** | **yes (prod)** | Verifies the `paymongo-signature` HMAC. Unset ⇒ the webhook returns 503 (fails closed) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **server secret** | yes (prod) | Rate limiting. Unset ⇒ rate limiting is **disabled** |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | **server secret** / server | prod | Email. Unset ⇒ console mock |
| `NEXT_PUBLIC_SITE_URL` | public | prod | Absolute URLs (checkout return, sitemap, robots). Fallbacks: `http://localhost:3000`, `https://travi.ph` |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | public / server | recommended | Sentry is off when unset |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | build-time (token secret) | optional | Source-map upload (maps deleted from the output afterwards). Read only by `next.config.ts`, so not in `lib/env.ts` |
| `LOG_LEVEL` | server | optional | pino level (`info` in prod, `debug` in dev) |
| `PLAYWRIGHT_TEST_BASE_URL`, `PORT`, `CI` | test | optional | Playwright target (starts no server when set), local port, CI mode |
| `E2E_{TRAVELER,ORGANIZER,TRANSPORTER,ADMIN}_{EMAIL,PASSWORD}`, `E2E_ALLOW_WRITES`, `E2E_TOUR_SLUG` | test (shell / CI secrets) | optional | Authenticated e2e against **staging only**; never in `.env.local`. CI also uses `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_WEBSITE_ID` repo secrets |
| `NEXT_PUBLIC_SERVICE_ROLE_KEY` | ⛔ | **never set** | Read only by some legacy `scripts/*`. It would expose the service key to the browser |
| `CONFIRM_DB_WRITE` | scripts | per run | Must equal the Supabase project ref for any write-capable `scripts/*` to run |

### 5.6 Rate limiting, CORS, webhooks, cron, data protection

- **Rate limiting** (`lib/ratelimit.ts`, Upstash sliding window):
  - `auth`: 5 requests / 10 s per IP (`getClientIp()`).
  - `mutation`: 10 requests / 10 s per `profile.id`.
  - **Required on:** every login, signup, and OTP send/verify action; every mutating action; every public form (the contact form uses `support:<ip>` on the auth limiter). Many legacy actions lack it; add it when you touch them.
- **Security headers** (`next.config.ts`): CSP (static allow-list; `'unsafe-inline'` scripts because nonces would make every page dynamic; `'unsafe-eval'` only in dev), HSTS 2 years + includeSubDomains, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, no `X-Powered-By`.
- **Public endpoints without auth:** `/api/health` (status, DB ok/latency, short SHA, environment; never cached), `/api/webhooks/paymongo` (HMAC).
- **CORS:** none is configured, so route handlers are same-origin by default. Do not add `Access-Control-Allow-Origin: *`. If mobile clients need CORS, allow-list explicit origins in the route handler.
- **Webhooks:** must verify the PayMongo `paymongo-signature` HMAC with `PAYMONGO_WEBHOOK_SECRET` over the **raw body** before parsing (`verifyWebhookSignature`), must re-fetch money data from PayMongo's API instead of trusting the payload, must be idempotent (`webhook_events` + the money functions), and must return 2xx only after the work is durable. `app/api/webhooks/paymongo` follows all four.
- **Cron:** must require `Authorization: Bearer ${CRON_SECRET}` (constant-time compare), fail closed when the secret is unset, and stay idempotent. Both `/api/cron/escrow-release` and `/api/cron/trip-reminders` do.
- **Data protection:**
  - **PII:** names, emails, phones, payout account numbers. Never log it, never expose it through public reads.
  - Organizers may read only travelers who booked their tours (`is_organizer_for_traveler`).
  - Mask account numbers in UI where possible.
  - **Soft delete** (`deleted_at`) by default.
  - **Audit trail:** admin and money mutations go through `logMutation()` → `admin_audit_logs`, never edited or deleted. (Transporter actions also log there today with `UPPER_SNAKE` action names.)
  - **Test endpoints, seed scripts, and debug routes** must never ship ungated. Gate them on `process.env.NODE_ENV !== 'production'` *and* an explicit env flag, or delete them.

---

## 6. Known Defects Register

These are verified against the code on 2026-10-16. **Do not copy these patterns.**

> The 2026-10-22 audit in [docs/MVP_LAUNCH_READINESS.md](docs/MVP_LAUNCH_READINESS.md) found many more defects and shows several claims in §4 to be wrong (its Appendix B lists them). Treat that file as the full register. When you fix an item, update both files.

- **If your task touches an affected file,** fix the defect or flag it in your report.
- **When you fix one,** delete it from this list.
- **When you find a new one,** add it here.

### Critical (security / money)

2. **Phase 1–5 migrations are not applied to the live DB.** `20261023090000` … `20261026100000` (RLS hardening, money integrity, accounts, catalog, communications, reviews, partners/KYC/SEC-13, bookings, transport, admin, legal consent/data requests/support, OTP challenges) are tested locally only. Order and post-steps: docs/RUNBOOK.md §3. **Checkout and partner onboarding fail closed without `20261026090000`: do not deploy this code before it is applied** (`npm run test:rls`). Until they are pushed in order (after `live-policy-audit.sql`), the live project keeps every hole they close, and the new app code depends on them (fallbacks exist only for the catalog). The `public_*` view embeds still need a check against real PostgREST.
3. **Phase 2 money migration not yet applied, and the FIN-01 backlog is not backfilled.** `20261023120000_money_integrity.sql` (atomic confirm/release/refund/payout functions, append-only ledger, webhook dedupe) is tested locally only. Until it is pushed and `scripts/backfill-escrow-deposits.ts --apply` has run, organizers paid through the old success page have no escrow deposit, and historical ledger rows (old `payment_hold`/`withdrawal_pending` signs) will show in `wallet_ledger_drift()`.
7. **Payout destinations are stored in plaintext** (`user_wallets.saved_payout_methods`, `payout_requests.payout_method`; FIN-20). Maker-checker exists but is off until `payout_dual_approval_threshold` is set.

### High

16. **Transport cancel after vehicle deactivation:** the Phase 1 `transport_bookings_before_write` re-checks `transport_request_is_valid` (vehicle active, transporter approved) on organizer edits, so if the transporter deactivates the vehicle after accepting, the organizer cannot cancel. `vehicle_availability.transport_booking_id` has no FK.
17e. **Onboarding document warnings are not displayed:** if a KYC document row fails to insert, the onboarding action returns a `warning` the forms ignore.

### Medium / hygiene

17. **Duplicate migration timestamp `20260831000000`** (`add_saved_payout_methods` + `wallet_v2_architecture`). Renaming either file needs human approval, because it affects remote migration history.
18. **`types/supabase.ts` is stale**, and there are columns with no migration (see §4.7).
19. **No platform ledger:** platform revenue is derived from `wallet_transactions.fee_amount` (`admin_finance_summary`); refunds do not reverse fee revenue in the KPIs.
21. **Unused tables:** `payout_otps` (locked down) and the legacy `payments` table (replaced by `booking_payments`).
21a. **`npm audit`:** one moderate build-time advisory left (`postcss-selector-parser` via `@tailwindcss/typography`; the offered fix is a breaking downgrade). No critical/high in runtime dependencies as of 2026-10-24.
22. **Legal text is a draft:** `lib/legal/company.ts` holds placeholders (registered name, DTI/SEC, TIN, address, DPO, support contacts, retention periods, effective dates), rendered as "(to be provided)". Counsel must review before `LEGAL_REVIEW_COMPLETE = true`. Partner Terms contains clauses not built yet (chargeback deduction, liability cap).
23d. **Admin MFA flow untested end to end:** enrol/verify needs a real admin on staging (no test account was available). CSP is verified signed out only; check organizer (map, uploads) and admin (charts) pages on staging.
23a. **Stub form:** the admin settings "Admin Profile" password form (`app/admin/settings/page.tsx`) persists nothing.
23b. **Files over ~400 lines:** `TourForm.tsx` (465), `actions/transport-requests.ts`, `actions/admin.ts`, `lib/notifications.ts`, `lib/email-templates.ts` (~600) grew during Phases 3–4; split when next touched.
23c. **Unauthenticated `support_messages` inserts through PostgREST** skip the action's IP rate limit (CHECKs bound sizes). If spam appears, insert with the service role and revoke anon INSERT.
24. **Temporary catalog fallback:** `lib/data/tours-fallback.ts` (bounded PostgREST query, no ratings) runs while `search_public_tours` is missing on the live DB; the build logs one `searchPublicTours` error until `20261024100000` is applied. Delete the fallback after the migration.

---

## 7. Specialized Agent Roster

Skills live in [`.agents/skills/`](.agents/skills/). Where a skill contradicts this file (stack versions, colors, libraries), **AGENTS.md wins**.

| Agent / alias | Specialty | Invoke when | Skill |
|---|---|---|---|
| **Planning** (`@brainstorming`) | Clarifying interview; spec mapping against §4 / migrations / `docs/API.md` | Before any new feature or major workflow | [SKILL.md](.agents/skills/brainstorming/SKILL.md) |
| **Next.js TypeScript Expert** (`@optimized-nextjs-typescript`) | App Router, RSC, Server Action contract (§3.2), Tailwind v4 | Implementing routes, components, mutations | [SKILL.md](.agents/skills/optimized-nextjs-typescript/SKILL.md) |
| **Lint & Review** (`@lint-and-validate`) | Static analysis, review, WCAG 2.1 AA, edge cases | During development and before PRs | [SKILL.md](.agents/skills/lint-and-validate/SKILL.md) |
| **System Debugger** (`@systematic-debugging`) | Hydration, SSR/CSR desync, Supabase cookie auth, Turbopack errors | Runtime errors and build breaks | [SKILL.md](.agents/skills/systematic-debugging/SKILL.md) |
| **QA Tester** (`@qa-tester`) | Smoke tests, RBAC verification, defect reports | **After every code change** (Definition of Done) | [SKILL.md](.agents/skills/qa-tester/SKILL.md), [rules](.agents/rules/qa-tester.md) |
| **Playwright** (`@playwright-agent`) | E2E journeys, regression | Creating or running `e2e/*.spec.ts` | [SKILL.md](.agents/skills/playwright-agent/SKILL.md) |
| **Technical SEO** (`@technical-seo`) | Metadata, JSON-LD, sitemap, robots, CWV | Public routes | [SKILL.md](.agents/skills/technical-seo/SKILL.md) |
| **UI/UX Designer** (`@ui-ux-designer`) | Tailwind v4 tokens (§3.5), layout, accessibility | New interfaces, visual audits | [SKILL.md](.agents/skills/ui-ux-designer/SKILL.md) |

---

**⛔ Reminder: a task is not done until the QA gate passes AND `AGENTS.md` has been reviewed and updated. See the [Mandatory Agent Workflow](#-mandatory-agent-workflow--definition-of-done) at the top.**
