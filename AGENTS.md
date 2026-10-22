<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Travi

> **Single source of truth and operating manual for every AI agent working in this repo.**
> If anything in `docs/`, `README.md`, or `.agents/skills/*` contradicts this file, **this file wins**. If this file contradicts the code or `supabase/migrations/`, **the code wins**: fix this file.
> **Last updated:** 2026-10-22 (Phase 0 hardening)

---

## ⛔ MANDATORY AGENT WORKFLOW — DEFINITION OF DONE

**No task is complete until `AGENTS.md` has been reviewed and, where needed, updated.**

**Before you report any task as finished, you MUST:**

1. **Run the QA gate and get it fully green:**
   - `npm run lint`: zero errors.
   - `npm run build`: zero errors. It also runs the TypeScript type-check.
   - `npm run test:qa`: 100% pass. This hits the live Supabase project, so it needs `.env.local`.
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
| Framework | Next.js (App Router, Turbopack) | **16.3.8** | Not Next 14. Read `node_modules/next/dist/docs/` before using framework APIs |
| UI runtime | React / React DOM | **19.2.8** | |
| Language | TypeScript | 5.9.3 | `strict: true`; path alias `@/*` → `./*` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) + `@tailwindcss/typography` + `tw-animate-css` | 4.3.3 / 1.4.0 | CSS-first config in `app/globals.css`; **no `tailwind.config.*`**. `tw-animate-css` powers the `data-[state]` animations of the UI primitives |
| UI primitives | shadcn-style components on Radix UI (`@radix-ui/react-{slot,dialog,dropdown-menu,tabs,avatar,label,progress,switch,checkbox,separator,tooltip,select,visually-hidden}`) + `class-variance-authority` 0.7.1 + `clsx` / `tailwind-merge` via `cn()` | | Ported from `reference/tailwind-admin-reactjs-free` into `components/ui/`. This is the project's only UI kit |
| Charts | apexcharts 8.4.1 + react-apexcharts 2.1.1 | | Only through `components/ui/charts/*` (browser-only, `next/dynamic` `ssr: false`) |
| Icons | lucide-react | 1.33.0 | The only icon set |
| Database / Auth / Storage | Supabase (Postgres 14.5 PostgREST) via `@supabase/ssr` 0.12.4 and `@supabase/supabase-js` 2.112.3 | | Cookie sessions; RLS on every table |
| Validation | zod | **4.4.3** | v4: use `error.issues`, not `error.errors` |
| Payments | PayMongo REST (hand-written client in `lib/paymongo.ts`) | | `stripe` / `@stripe/stripe-js` are installed but **unused** |
| Email | Resend | 6.25.0 | Logs to the console when `RESEND_API_KEY` is unset |
| SMS | `lib/sms.ts` | | **Console mock only** |
| OTP tokens | jose (HS256 JWT in httpOnly cookies) | 6.2.10 | |
| Rate limiting | `@upstash/ratelimit` + `@upstash/redis` | 2.0.8 | Turns itself off when Upstash env vars are missing |
| Logging / monitoring | pino 10.3.1 (+ pino-pretty in dev), `@sentry/nextjs` 10.71.0, `@vercel/analytics` | | |
| Dates / calendars | date-fns 4.4.0, react-big-calendar, react-day-picker 10 | | |
| Maps | leaflet 1.9.4 + react-leaflet 5.0.0 | | Always loaded through `next/dynamic` with `ssr: false` |
| Markdown | react-markdown | | |
| State management | **None.** RSC props plus local `useState` | | `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers` are installed but **never imported** |
| E2E tests | Playwright (`@playwright/test`) | 1.62.1 | Chromium only |
| Smoke / QA tests | `scripts/qa-smoke-test.ts` run with `tsx` | | Runs against the live DB |
| Lint | ESLint 9 (flat config) + `eslint-config-next` 16.3.8 | 9.39.5 | No Prettier, no EditorConfig |
| Hosting | Vercel | | No `vercel.json`, so cron schedules are configured outside the repo |
| Local toolchain | Node v24.15.0, npm 11.12.1 (the lockfile is npm) | | `package.json` has no `engines` field |

### 1.3 Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies. Use npm only; `package-lock.json` is the lockfile |
| `npm run dev` | Dev server on `http://localhost:3000` (`allowedDevOrigins: ['127.0.0.1']`) |
| `npm run build` | Production build and TypeScript type-check. **Must pass before you finish** |
| `npm run start` | Serve the production build |
| `npm run lint` | `eslint` (flat config `eslint.config.mjs`) |
| `npm run test:qa` | `npx tsx scripts/qa-smoke-test.ts`: env, table, role, overbooking, audit, and soft-delete checks against the **live** DB. **Must pass before you finish** |
| `npm run test:e2e` | `playwright test`. Starts `npm run dev` itself (`reuseExistingServer: true`) |
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
Mobile/external ──► app/api/**/route.ts (Bearer JWT via lib/api-auth.ts) ──► lib/services/*.ts
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
│   ├── login/, signup/      # Auth pages (login is a client page)
│   ├── tours/[slug]/                      # Public tour detail (generateMetadata + JSON-LD)
│   │   └── booking/[bookingId]/{,pay,success}/   # Booking review → payment method → payment verification
│   ├── dashboard/           # Authenticated multi-role area
│   │   ├── layout.tsx       # 'use client' shell (sidebar from pathname). NO auth logic
│   │   ├── page.tsx         # Dispatcher: redirects to the user's primary role
│   │   ├── traveler/        # bookings, profile
│   │   ├── organizer/       # layout.tsx (server: onboarding gate), tours (new, [id]/edit, [id]/schedules/[scheduleId]), bookings, wallet, profile
│   │   └── transporter/     # layout.tsx (server: onboarding gate), vehicles, availability, requests, reviews, wallet, profile
│   ├── admin/               # Admin console: organizers, transporters, tours, bookings, reviews, payouts, notifications, settings, login
│   ├── api/                 # Route handlers: bookings, tours, organizers, profile (Bearer auth), cron/escrow-release, webhooks/paymongo
│   ├── robots.ts, sitemap.ts, not-found.tsx, global-error.tsx
├── actions/                 # ALL Server Actions. One kebab-case file per domain noun; each starts with 'use server'
│                            # admin, auth, availability, bookings, notifications, organizer, otp, profile, public,
│                            # reviews, schedules, tours, transport-requests, transporter, vehicles, wallet
├── components/
│   ├── admin/               # Admin *Client.tsx tables, AdminNotificationBell, AdminProfileMenu, PlatformSettingsForm, BookingMobileCard
│   ├── auth/                # SignupForm
│   ├── dashboard/           # Role dashboards: forms, modals, managers, calendars, LocationPicker, RoleSwitcher, NotificationBell
│   ├── landing/             # Marketing sections, TourListClient, TourBookingCard, PaymentSelectionClient, hero.css, useScrollReveal
│   ├── seo/                 # TourJsonLd
│   ├── shell/               # AppShell (sidebar + sticky header + mobile Sheet) and AppSidebar. Used by app/dashboard/layout.tsx and app/admin/layout.tsx
│   ├── traveler/            # TravelerBookingsClient
│   ├── ui/                  # shadcn primitives (lowercase: button, card, badge, table, input, textarea, label, select, dialog, sheet, tabs,
│   │                        #   dropdown-menu, avatar, alert, progress, switch, checkbox, separator, skeleton, tooltip),
│   │                        # template widgets (PascalCase: CardBox, PageHeader, WelcomeBanner, StatCard, StatusBadge, Timeline, EmptyState),
│   │                        # charts/ (Chart, BarChart, DonutChart), and ConfirmModal, GenericMobileCard, LazyMobileCard, PageLoader
│   └── wallet/              # PayoutMethodsManager
├── lib/
│   ├── supabase/            # server.ts (cookie client), browser.ts, middleware.ts (updateSession + RBAC), admin.ts (service role)
│   ├── auth-helpers.ts      # requireSession(), assertRole()   ← Server Actions / RSC
│   ├── api-auth.ts          # verifyApiAuth(), assertApiRole() ← app/api Bearer routes
│   ├── schemas/             # zod: admin, auth, booking, tour
│   ├── services/            # bookings.ts, tours.ts, payments.ts (verifyBookingPayment): write logic shared by actions, pages and API routes
│   ├── data/                # tours.ts, reviews.ts, stats.ts: cached public reads (unstable_cache, tags)
│   ├── env.ts               # zod-validated env. Import `env`, not process.env
│   ├── logger.ts            # pino `logger` + captureException() (pino + Sentry)
│   ├── audit.ts             # logMutation() / logAdminAudit() → admin_audit_logs
│   ├── ratelimit.ts         # assertRateLimit(id, 'auth' | 'mutation'), getClientIp()
│   ├── paymongo.ts          # PayMongo REST client (intents, methods, checkout, refunds). Mocks when the key is missing
│   ├── email.ts, sms.ts     # Resend sender; SMS console mock (dev only; fails in production)
│   ├── notifications.ts     # Internal notification senders (in-app + email). Not Server Actions
│   ├── otp.ts               # OTP issue/verify/require/consume helpers. Not Server Actions
│   ├── json-ld.ts           # serializeJsonLd(): escapes </script> etc. for JSON-LD
│   ├── utils.ts             # cn(): clsx + tailwind-merge
├── types/supabase.ts        # Generated DB types. ⚠ STALE (see §4.7). Regenerate; never hand-edit
├── supabase/migrations/     # YYYYMMDDHHMMSS_snake_case.sql. Append-only
├── e2e/                     # Playwright specs (unauthenticated flows only)
├── scripts/                 # Seed, fix, and QA scripts (ESLint-ignored). qa-smoke-test.ts is the QA gate (read-only).
│                            # Scripts that write call scripts/lib/write-guard.cjs: run with CONFIRM_DB_WRITE=<project-ref>
├── docs/                    # Reference specs (see Quick Links)
├── reference/               # HTML mockups + mvp-architecture.md
├── public/                  # Static assets. public/dashboard/ holds the template's banner and sidebar illustrations
├── .agents/                 # Agent skills (§7) and rules
├── sentry.{client,server,edge}.config.ts, next.config.ts (withSentryConfig), playwright.config.ts, eslint.config.mjs, postcss.config.mjs
└── (junk, tracked by mistake) error.html, lint_results.txt, output.json, script_output.txt, test-query.{js,ts},
    test-vehicles.ts, seed-other-transporter.ts, scratch/, playwright-report/, test-results/
    → Do NOT add more root-level scratch files. Put one-off scripts in scripts/ or your scratchpad.
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
    await assertRole(user.id, 'organizer');                     // 3. Authorize (role); admin passes every check
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
- **Cache tags in use:** `tours`, `organizers`, `transporters`, `reviews`, `platform-stats`.
  - Use `updateTag()` (Next 16, Server-Action-only, read-your-writes) for those tags, plus `revalidatePath()` for the affected dashboard and admin pages.

### 3.3 Error handling & logging

- Report errors with `captureException(error, { action: 'name', ...ids })` from `@/lib/logger`. It logs through pino and forwards to Sentry.
- Use `logger.info / warn / debug` for structured logs.
- **Do not add new `console.log`.** It exists in `lib/email.ts`, `lib/sms.ts`, and `actions/otp.ts` as dev mocks.
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
  - **Public catalog data:** `lib/data/*` (`unstable_cache`, `revalidate: 3600`, tags). New public reads go here and must filter `status = 'published'` and `deleted_at IS NULL` themselves.
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
  - Keep `/admin/`, `/dashboard/`, `/api/` disallowed in `app/robots.ts`.
- **Size and reuse:** keep files under ~400 lines; split large client components into sub-components. Extract shared logic into `lib/` or `components/ui/`. Put business logic in services and actions, not in components.

### 3.6 Database & migrations

- **Every schema change is a new migration** in `supabase/migrations/` with a **unique**, current `YYYYMMDDHHMMSS` prefix.
- **Never edit an applied migration.** Never reuse a timestamp; `20260831000000` is already duplicated (§6).
- Use `IF NOT EXISTS` / `IF EXISTS` and `DO $$ … $$` guards. The migration chain does **not** replay on a fresh DB (§4.7), so migrations must be safe against the live schema.
- **Enable RLS on every new table, with explicit policies.**
  - Owner check: `… IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())`.
  - Admin check: the `EXISTS (… user_roles … website_roles … role = 'admin')` pattern.
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
| `organizer_profiles.status` / `transporter_profiles.status` | `pending`, `approved`, `rejected` | CHECK. Onboarding currently inserts `approved` (auto-approve) |
| `organizer_type` / `transporter_type` | `individual`, `company` | CHECK |
| `transport_bookings.status` | `pending`, `accepted`, `declined`, `canceled`, `completed` | CHECK |
| `vehicles.status` / `vehicle_type` | `active`, `inactive`, `archived` / `car`, `van`, `bus`, `minibus`, `suv` | CHECK |
| `vehicle_availability.status` | `available`, `booked`, `blocked` | CHECK |
| `reviews.status` | `pending`, `published`, `hidden` | enum |
| `payout_requests.status` | `pending`, `processing` (unused), `paid`, `rejected` | enum |
| `wallet_transactions.type` | `payment_hold`, `escrow_deposit`, `escrow_release`, `withdrawal_pending`, `withdrawal_completed`, `withdrawal_rejected`, `refund`, `platform_fee`, `manual_adjustment`, `penalty` | enum |
| `wallet_transactions.balance_affected` | `available`, `escrow` | CHECK |

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

- **Seat accounting lives in the DB:**
  - Trigger `update_tour_schedule_booked_count` counts bookings in `pending | confirmed | completed`.
  - A **`private`-format** booking consumes the schedule's **whole capacity**.
  - CHECK `check_capacity_not_exceeded (booked_count <= capacity)` makes overbooking impossible.
  - The service pre-checks `capacity - booked_count` for a friendly error, but **the DB constraint is the real guard. Never remove or bypass it.**
- **Booking refs** come from the `generate_booking_ref` BEFORE INSERT trigger: `BK-` + 6 uppercase hex characters, unique. Do not generate them in app code.
- **Pricing:**
  - `total_amount = (schedule.price_per_person ?? tour.price_per_person) × seats`. Amounts are pesos (`numeric`).
  - The traveler pays **no added fee**.
  - `original_price` on a schedule is a display-only "compare-at" price.
- **The pending expiry (15 minutes) frees seats.** Do not remove the cron job.
  - A payment that arrives after expiry is currently orphaned (§6). Any change to expiry or payment must handle late payments.
- **Traveler cancellation:**
  - Allowed only from `pending` or `confirmed`, and only before the schedule's `start_date`.
  - Confirmed bookings get a **full** PayMongo refund, an escrow reversal, and a `refund` ledger row.
- **Disputes:**
  - Only the owning traveler can open one.
  - Only on a `confirmed` booking with `dispute_status = 'none'`.
  - Only within `escrow_holding_days` after `end_date`.
  - An open dispute blocks escrow release.
- **Organizer `updateBookingStatus`:** checks ownership via `tour_schedules!inner(tours!inner(organizer_id))` and allows **only `pending → canceled`** (decline). Organizers cannot confirm bookings; only a verified payment confirms one. Canceling a paid booking must go through the refund flow.

### 4.4 Payments, fees, escrow & wallets

- **PayMongo flow:**
  1. `/tours/[slug]/booking/[bookingId]/pay` → `PaymentSelectionClient` → `processPayment(bookingId, 'gcash' | 'paymaya')`.
     - Only the owning traveler, only for a `pending` booking. The return URL is built on the server (`NEXT_PUBLIC_SITE_URL`, else the request host).
     - It creates a PaymentIntent (**centavos**: `Math.round(total_amount * 100)`).
     - It stores `pi_…` in `bookings.paymongo_session_id`, then attaches a PaymentMethod and redirects.
     - Card is disabled in the UI.
  2. The redirect returns to `/success`. The RSC requires the signed-in owner, then calls `verifyBookingPayment(bookingId, profileId)` (`lib/services/payments.ts`, not a Server Action). It verifies the intent `succeeded` (or the checkout session `paid`), then:
     - booking `pending → confirmed` only (status-guarded update). A paid booking that is no longer `pending` is **not** re-confirmed; it is reported to Sentry for manual follow-up.
     - organizer fee taken
     - an `escrow_deposit` ledger row, deduplicated by `reference_id` + type ⚠ silently skipped today: wrong wallet id (§6 #7)
     - `increment_escrow_balance`
     - notify the organizer
  3. `POST /api/webhooks/paymongo` handles `payment.paid` / `checkout_session.payment.paid`. It writes a **`payment_hold`** ledger row (see §6: type mismatch, and no signature check).
- **Currency conversion:** DB amounts are pesos; PayMongo amounts are centavos. Convert only at the `lib/paymongo.ts` boundary (`×100` out, `/100` in).
- **Fees** come from the single `platform_settings` row:
  - `organizer_fee_percent` (DB default **10.00**) is deducted from the organizer's escrow credit: `net = total × (1 − fee%)`. The fee is recorded in `fee_amount`.
  - `transporter_fee_percent` (default 3.00) is deducted from transporter payouts. It is **0 when organizer and transporter are the same user**.
  - `escrow_holding_days` (default 3).
  - Code fallbacks use `|| 3`. A stored `0` therefore becomes 3. Use `??` in new code.
- **Escrow release** (`GET /api/cron/escrow-release`, Bearer `CRON_SECRET`):
  - **Tour bookings:** releases `confirmed` bookings whose `end_date <= today − escrow_holding_days` and whose dispute status is `none | resolved_denied`. Moves escrow → available via RPCs, writes an `escrow_release` row (deduplicated), and sets the booking → `completed`.
  - **Transport bookings:** for `accepted` transport bookings, debits the organizer's available balance by `estimated_price`, credits the transporter `price − fee` (`manual_adjustment`, `reference_type 'transport_booking'`), and sets them → `completed`.
  - The cron must stay **idempotent**: it always checks for an existing ledger row before writing.
- **Wallets:**
  - One `user_wallets` row per `user_profiles.id`, created with `ensure_user_wallet`. Currency is PHP.
  - Two balances: `escrow_balance` and `available_balance`.
  - **Every balance change must have a matching `wallet_transactions` row.**
  - Users have **SELECT-only** RLS on wallets and the ledger. All money movement goes through the service-role client.
- **Payouts** (`requestPayout`):
  - Organizers and transporters only. Minimum **₱100**, at most `available_balance`. Requires password re-entry.
  - Debits available, writes `withdrawal_pending`, and creates a `payout_requests` row (`pending`).
  - Admin `markPayoutPaid` → `paid` + `withdrawal_completed`.
  - `rejectPayout` → `rejected`, refunds available, + `withdrawal_rejected`.
- **Saved payout methods** live in `user_wallets.saved_payout_methods` (jsonb): `{ id, type: 'bank'|'gcash'|'maya', isDefault, details: { accountName, accountNumber, bankName? } }`.
  - Adding one requires a verified OTP (`add_payout_method`).
  - The first method saved becomes the default.
- **Mock mode:** with `PAYMONGO_SECRET_KEY` unset, `lib/paymongo.ts` **returns success for every verification and refund**. That is acceptable only for local dev; production must have the key.

### 4.5 Tours, schedules, transport, vehicles, reviews

- **Tours** (`actions/tours.ts` → `lib/services/tours.ts`, `tourSchema`):
  - Organizer only; writes are scoped by `organizer_id`.
  - Slug is `slugify(title)-<last 6 digits of Date.now()>`, set on create and **never changed** (URLs are stable).
  - Itinerary arrives as a JSON string `[{ day_number, title, description }]`. Update replaces all rows. `(tour_id, day_number)` is unique.
  - Publish sets `status: 'published'`, `deleted_at: null`. Archive sets `status: 'archived'`, `deleted_at: now()`.
- **Public catalog** (`lib/data/tours.ts`): only `published`, not-deleted tours with at least one `open`, not-deleted schedule starting today or later.
- **Schedules** (`actions/schedules.ts`):
  - Created `open`. Delete is soft: `deleted_at` + `status: 'cancelled'`.
  - `transport_status` is derived from `transport_type`:
    - `none` → `not_required`
    - `self_provided` → `self_provided`
    - `external_transporter` → `unresolved`, or `pending` once a `transport_bookings` request is created.
  - ⚠ There is no app-layer auth here (it relies on RLS). Add `requireSession` + `assertRole` when you touch this file.
- **Transport requests:**
  - Only the owning transporter can act, and only on `pending`.
  - **Accept** → `accepted`. Inserts `vehicle_availability {status: 'booked', transport_booking_id}`, sets schedule `transport_status: 'confirmed'`, notifies the organizer, and writes an audit row.
  - **Decline** → `declined`, and sets schedule `transport_status: 'unresolved'`.
- **Vehicles:**
  - Default `active`; toggle between `active` and `inactive`; delete is soft.
  - `getAvailableVehicles` excludes vehicles with **any** overlapping `vehicle_availability` row.
- **Availability:**
  - `blockVehicleDates` rejects `start > end` and any overlap.
  - `removeAvailabilityBlock` refuses `booked` rows (a booked row must be released through the transport booking).
- **Reviews:**
  - A review must target a `tour_id` or a `transporter_id` (`reviews_target_check`). Rating is 1–5. Default status is `pending`.
  - **Only `published` reviews are public.**
  - Admin moderation: `hideReview` (used by the UI) and `moderateReview` (`hide | publish | delete` → soft delete).
  - There is no review-creation action yet. When you build it, enforce "traveler with a `completed` booking on that tour", one review per booking.

### 4.6 Accounts, roles, onboarding, notifications, OTP

- **Signup:**
  - Supabase Auth `signUp` → insert `user_profiles` → insert `user_roles` for the chosen role (`traveler | organizer | transporter`; requires `WEBSITE_ID`).
  - Password min 6 at signup; min 8 when changing it.
- **Role switching:**
  - `addAccountType(role)` adds a role row.
  - `RoleSwitcher` links to `/dashboard/<role>`.
  - The **primary role** is `traveler` if the user has it, else the first role.
- **Onboarding:** the `organizer/` and `transporter/` dashboard **server layouts** render the onboarding form until a `*_profiles` row exists. Profiles are currently auto-`approved`; the admin approve/reject flows still exist.
- **Notifications:**
  - Rows are inserted with the service-role client and keyed by **auth user id**.
  - Only `notifications` is in the `supabase_realtime` publication; the bells subscribe through the browser client.
  - `notifySuperAdmin` targets the user whose email is `ADMIN_EMAIL`.
  - Email goes through Resend (`lib/email.ts`).
- **OTP** (`actions/otp.ts`):
  - Stateless HS256 JWT cookies:
    - `otp_pending_<action>`: 10 minutes, holds the 6-digit code.
    - `otp_verified_<action>`: 15 minutes.
  - Actions: `add_payout_method`, `change_email`, `change_phone`, `change_password_email`, `change_password_phone`, `verify_email`.
  - Phone numbers must match PH format `^(\+63|0)9\d{9}$` and be unique.
  - The `payout_otps` table is unused.

### 4.7 Schema drift and doc drift (read before touching the DB)

- **`types/supabase.ts` is stale** (generated around 2026-08-30).
  - Missing: `payout_otps`; `user_profiles.phone`, `email_verified_at`, `phone_verified_at`; `user_wallets.saved_payout_methods`; `wallet_transactions.fee_amount`; `bookings.dispute_status`; the new `platform_settings` columns; enum values `escrow_deposit` and `penalty`; `increment_available_balance`.
  - Still lists the dropped `release_tour_escrow`.
  - **Regenerate before relying on it.**
- **Columns used by the code but missing from the migrations** (they exist only in the live DB): `bookings.paymongo_session_id`, `tours.latitude`, `tours.longitude`. Add them with `ADD COLUMN IF NOT EXISTS` in the next migration that touches those tables.
- **The migrations cannot rebuild a fresh DB:**
  - `websites` (and `pages`, `templates`, …) are never created.
  - Legacy migration 017 references tables created later.
  - `uuid_generate_v4()` requires `uuid-ossp`.
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
| Traveler booking → PayMongo (GCash/Maya) → confirmation, cancel, dispute | Implemented; ⚠ ledger defects in §6 |
| Wallets, escrow cron, payouts, saved payout methods | Implemented; ⚠ defects in §6 |
| Review submission by travelers | **Not implemented** |
| Real SMS provider; PayMongo webhook signature verification | **Not implemented** |

---

## 5. Security & Data Privacy

### 5.1 Authentication

- **Supabase Auth**, email + password.
- **Sessions are cookie-based** through `@supabase/ssr`. `middleware.ts` → `lib/supabase/middleware.ts` `updateSession()` refreshes the session on every non-static request.
- **Server-side identity:** always `supabase.auth.getUser()` (verifies the JWT with Supabase). Never trust `getSession()` on the server.
- **Server Actions and RSC:** `requireSession()` returns `{ user, profile, supabase }` and throws `'Unauthorized'`.
- **`app/api/*` (mobile/external clients):** `verifyApiAuth(request)` requires `Authorization: Bearer <supabase access token>`.
  - ⚠ The client it returns does not attach the token, so queries run as anon. Fix it with `global: { headers: { Authorization } }` before building on it.
- **Re-authentication for sensitive operations** (payout request, password change) uses `signInWithPassword`. **OTP** is required for adding payout methods and for changing email, phone, or password.

### 5.2 Authorization (RBAC): four layers, all required

| Layer | Mechanism | Notes |
|---|---|---|
| 1. Middleware | `/admin/*` requires `admin` (else → `/admin/login`). `/dashboard/*` requires a user with a role; admins → `/admin`; a role mismatch → the primary role's dashboard. `/login` bounces signed-in users | Roles come from `user_roles ⋈ website_roles` filtered by `WEBSITE_ID`. **`/api/*` is NOT gated by middleware** |
| 2. Page / layout | Admin pages: `requireSession()` + `assertRole(user.id, 'admin')` | ⚠ `admin/bookings`, `admin/tours`, `admin/transporters` skip this. Add it when you touch them |
| 3. Server Action / route | `assertRole(user.id, role)` (**admin passes every role check**) or `assertApiRole()` (no admin bypass), **plus an ownership check on the row** | Ownership is enforced with `.eq('organizer_id', …)`, `.eq('transporter_id', …)`, or `!inner` joins |
| 4. Postgres RLS | Owner policies via the `user_profiles.user_id = auth.uid()` subquery; inline admin `EXISTS` checks; `is_organizer_for_traveler()` (the only SECURITY DEFINER helper) | RLS is the last line of defense, **not** the only one |

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
- **Uploads:** bucket `tour-images`. Restrict to image MIME types and sizes on the client and in storage policy.

### 5.5 Secrets & environment variables

- **All runtime env vars are declared and validated in `lib/env.ts` (zod).** New code imports `env` from `@/lib/env`, not `process.env`.
  - When you add a variable, add it to the `envSchema` **and** to `.env.example` (name, comment, and a placeholder value only) in the same change.
  - Some legacy modules still read `process.env` directly: `lib/email.ts`, `lib/data/*`, `actions/otp.ts`, the cron route, `app/robots.ts`, `app/sitemap.ts`.
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
| `OTP_SECRET` | **server secret** | **yes (prod)** | ≥32 chars. Signs OTP cookies. Must NOT be the Supabase JWT secret. Unset in dev ⇒ random key per server run |
| `CRON_SECRET` | **server secret** | **yes (prod)** | ≥32 chars. Bearer for `/api/cron/escrow-release`. Unset ⇒ the endpoint **refuses every request** |
| `PAYMONGO_SECRET_KEY` | **server secret** | **yes (prod)** | PayMongo API. Unset ⇒ **all payment verifications and refunds are mocked as successful** |
| `PAYMONGO_WEBHOOK_SECRET` | **server secret** | yes (prod) | For webhook signature verification (declared, not yet used) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | **server secret** | yes (prod) | Rate limiting. Unset ⇒ rate limiting is **disabled** |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | **server secret** / server | prod | Email. Unset ⇒ console mock |
| `NEXT_PUBLIC_SITE_URL` | public | prod | Absolute URLs (checkout return, sitemap, robots). Fallbacks: `http://localhost:3000`, `https://travi.ph` |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | public / server | optional | Sentry is off when unset |
| `LOG_LEVEL` | server | optional | pino level (`info` in prod, `debug` in dev) |
| `PLAYWRIGHT_TEST_BASE_URL`, `CI` | test | optional | Playwright target and CI mode |
| `NEXT_PUBLIC_SERVICE_ROLE_KEY` | ⛔ | **never set** | Read only by some legacy `scripts/*`. It would expose the service key to the browser |
| `CONFIRM_DB_WRITE` | scripts | per run | Must equal the Supabase project ref for any write-capable `scripts/*` to run |

### 5.6 Rate limiting, CORS, webhooks, cron, data protection

- **Rate limiting** (`lib/ratelimit.ts`, Upstash sliding window):
  - `auth`: 5 requests / 10 s per IP (`getClientIp()`).
  - `mutation`: 10 requests / 10 s per `profile.id`.
  - **Required on:** every login, signup, and OTP send/verify action; every mutating action; every public `app/api` POST. Many legacy actions lack it; add it when you touch them.
- **CORS:** none is configured, so route handlers are same-origin by default. Do not add `Access-Control-Allow-Origin: *`. If mobile clients need CORS, allow-list explicit origins in the route handler.
- **Webhooks:** must verify the PayMongo `paymongo-signature` HMAC with `PAYMONGO_WEBHOOK_SECRET` over the **raw body** before parsing, must be idempotent (dedupe on the ledger row), and must return 2xx only after the work is durable.
- **Cron:** must require `Authorization: Bearer ${CRON_SECRET}`, fail closed when the secret is unset, and stay idempotent.
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

2. **Privilege escalation via RLS.** The `user_roles` INSERT policy (`20260801000001_legacy_migration_01.sql`) lets a user insert **any** `website_role_id` for themselves, including `admin`. The same class of hole exists for organizers updating their own `organizer_profiles.status`, travelers updating their own `bookings.status`, and any authenticated user inserting `notifications` for anyone.
3. **The PayMongo webhook has no signature verification** (`app/api/webhooks/paymongo/route.ts`), and `PAYMONGO_WEBHOOK_SECRET` is unused.
6. **Ledger type split.**
   - The success page writes `escrow_deposit`; the webhook writes `payment_hold`.
   - The cron releases only `payment_hold`; cancel and dispute reverse only `escrow_deposit`.
   - Result: bookings confirmed via the success page are never released or completed.
7. **Wrong wallet owner ID.** `verifyBookingPayment` (`lib/services/payments.ts`), `cancelBookingAsTraveler`, and `resolveDispute` (`actions/bookings.ts`) pass `organizer_profiles.id` to `ensure_user_wallet`, which expects a `user_profiles.id`.
8. **Non-atomic money operations.**
   - `requestPayout` read-modify-writes `available_balance` (double-spend race).
   - `markPayoutPaid` doesn't check rows affected (replayable).
   - `markPayoutPaid` and `rejectPayout` trust a client-supplied `walletId`.
   - Ledger writes and balance RPCs are not in one transaction.
   - The transport payout can drive an organizer's balance negative.
9. **OTP weaknesses** (`lib/otp.ts`): the code sits in a signed but unencrypted cookie (readable by anyone holding the session), `Math.random` codes, and no attempt limit. Tokens are now bound to the user and carry only fixed claims.

### High

10. **Late payments need manual handling.** A payment for a booking that already expired to `canceled` is ignored by the webhook; the success page reports it to Sentry instead of re-confirming. There is no automatic refund yet.
11. **`updatePlatformSettings` can't save.** It filters `.eq('id', 1)`, but `platform_settings.id` is a uuid, so fee settings never save. It also has no validation and no audit log.
12. **`verifyApiAuth` doesn't attach the bearer token** to the returned client, so API-route queries run as anon.
13. **`POST /api/organizers` writes non-existent columns** (`type`, `phone_number`, `provides_transportation`).
14. **API routes read `ZodError.errors[0]`.** That is zod v3; v4 uses `.issues`, so this throws.
16. **Missing app-layer auth or validation** in `actions/schedules.ts`, `actions/organizer.ts`, `actions/transporter.ts`.
    - Partner profiles auto-approve.
    - The `createTour` action doesn't check organizer approval (the API route does).
17b. **Payout minimum mismatch.** `components/dashboard/WalletClient.tsx` hardcodes `MIN_WITHDRAWAL = 500`; the rule (§4.4) is ₱100. Its escrow card says "Released 24h after completion" instead of `escrow_holding_days`.
17e. **The organizer tour edit page lists soft-deleted schedules.** Its `tour_schedules` query (`app/dashboard/organizer/tours/[id]/edit/page.tsx`) has no `.is('deleted_at', null)` (§3.4).
17d. **The admin settings page reads `platform_settings` with `.eq('id', 1)`** (uuid id), so the form always shows fallback values (`|| 3`). Read-side twin of #11.

### Medium / hygiene

17. **Duplicate migration timestamp `20260831000000`** (`add_saved_payout_methods` + `wallet_v2_architecture`). Renaming either file needs human approval, because it affects remote migration history.
18. **`types/supabase.ts` is stale**, and there are columns with no migration (see §4.7).
19. **`|| 3` fee and holding-day fallbacks** turn a stored 0 into 3.
20. **Two email senders.** `lib/email.ts` and `sendEmailNotification` use a hardcoded `notifications@travi.app`; email links are hardcoded to `https://travi.app`.
21. **Unused dependencies:** `stripe`, `@stripe/stripe-js`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`. Also unused: the `payout_otps` table and `lib/paymongo.ts` `createCheckoutSession`.
22. **Tracked junk files at the repo root**, listed in §2.2. `.gitignore` is missing `playwright-report/`, `test-results/`, `scratch/`, `*.log`.
23. **`README.md` is create-next-app boilerplate.**
23a. **Stub forms that persist nothing:** `OrganizerProfileForm` and `TravelerProfileForm` save via a TODO + `setTimeout`; the admin settings "Admin Profile" password form's action is a no-op.
23b. **Stale client state after mutations:** admin `BookingsClient` doesn't update `bookings` after `resolveDispute` (`setBookings` unused); `ReviewsClient.handleHide` uses a stale closure (`setReviews(reviews.map(...))`). Several status labels use `.replace('_', ' ')`, which only replaces the first underscore.
23c. **Admin dashboard charts** (`app/admin/page.tsx`) aggregate a 6-month `bookings` select in JS; past PostgREST's row cap (default 1000) they undercount. Move to a SQL aggregate/RPC when volume grows.
24. **Getter actions catch Next's dynamic-rendering bailout.** `getTransporterVehicles`, `getTransporterAvailability`, `getTransporterRequests`, and `getTransporterReviews` catch it and `captureException` it. `npm run build` prints 5 `"level":"error"` "Dynamic server usage" logs, but it still exits 0. The fix is `unstable_rethrow` (§3.3).

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
