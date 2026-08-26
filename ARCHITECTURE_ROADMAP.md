# MVP Architecture Roadmap — Travi SaaS

This document serves as the technical roadmap for bringing the Travi SaaS platform up to the standards defined in the `mvp-architecture.md` reference guide. It outlines the specific tasks required to implement best-in-class security, validation, and data architecture patterns.

---

## 🟢 Priority 1: Core Foundation & Security

These tasks address runtime stability, input validation, and preventing unauthorized mutations.

### ~~1. Zod-Validated Environment Variables~~ (Completed)
**Why:** Currently, missing environment variables (like a Stripe Key or Supabase URL) cause unpredictable runtime errors deep within the application.
**Task:** 
- [x] Create `lib/env.ts`.
- [x] Define a `zod` schema for `process.env`.
- [x] Export a validated `env` object to be used across the app.

### ~~2. Standardize Database Client Factories~~ (Completed)
**Why:** Instantiating the admin/service-role client inline using `process.env` (as currently done in `actions/bookings.ts`) increases the risk of exposing the service key.
**Task:**
- [x] Create `lib/supabase/server.ts`, `browser.ts`, and `admin.ts`.
- [x] Ensure the `admin` client requires an explicit `{ admin: true }` flag to prevent accidental usage.
- [x] Refactor all existing Server Actions to use these new factories.

### ~~3. Implement Strict Server Action Pattern~~ (Completed)
**Why:** Current Server Actions perform manual string casting and ad-hoc auth checks, lacking a consistent structure.
**Task:**
- [x] Create standard auth assertion helpers (`requireSession`, `assertRole`).
- [x] Install/configure `zod` for input validation.
- [x] Refactor all mutations in `actions/tours.ts`, `actions/bookings.ts`, and `actions/auth.ts` to follow the 5-step pattern:
  1. Authenticate (`requireSession`)
  2. Authorize (`assertRole`)
  3. Validate (`schema.parse`)
  4. Scope DB Write (`eq('organizer_id', ...)`)
  5. Return Typed Result

---

## 🟡 Priority 2: Observability & Abuse Prevention

These tasks prepare the application for real-world traffic and business compliance.

### ~~4. Rate Limiting for Authentication & Mutations~~ (Completed)
**Why:** Public endpoints (login, signup) are vulnerable to credential stuffing, and un-throttled actions can exhaust database connections.
**Task:**
- [x] Integrate `@upstash/ratelimit` and Redis.
- [x] Apply strict rate limits to `loginAsAdmin`, standard login, and signup routes based on IP.
- [x] Apply secondary rate limits per user/account for mutations (e.g., creating tours).

### ~~5. Centralized Audit Logging~~ (Completed)
**Why:** SOC 2 compliance and operational security require a tamper-proof trail of who did what. The `admin_audit_logs` table exists but is unused.
**Task:**
- [x] Create a `logMutation(actor, action, entity, diff)` utility function.
- [x] Inject this function into critical admin operations (e.g., approving an organizer, deleting a review, modifying a user's role).

### ~~6. Centralized Error Handling & Logging~~ (Completed)
**Why:** We need to know when production errors occur before users report them.
**Task:**
- [x] Integrate **Sentry** (`@sentry/nextjs`) for unhandled exception tracking with `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts` wrapper, and `app/global-error.tsx`.
- [x] Set up **Pino** (`pino` / `pino-pretty`) for structured JSON logging on the server to replace raw `console.log()` statements via `lib/logger.ts`.

---

## 🔵 Priority 3: Data Efficiency & Performance

These tasks optimize the app for scale and prevent degraded performance as the database grows.

### ~~7. Enforce Soft Deletes~~ (Completed)
**Why:** Hard-deleting user data (like vehicles or profiles) destroys historical context and breaks related foreign keys.
**Task:**
- [x] Add `deleted_at` timestamps or standard `status: 'archived'` enums to all primary tables (`user_profiles`, `organizer_profiles`, `transporter_profiles`, `tours`, `tour_schedules`, `tour_itineraries`, `bookings`, `reviews`, `vehicles`).
- [x] Applied migration `20260826164500_enforce_soft_deletes.sql` with B-tree indexes for `deleted_at`.
- [x] Update RLS policies and application Server Actions/read queries to filter out archived data by default.

### ~~8. Optimize Component Data Fetching (De-monolith)~~ (Completed)
**Why:** Fetching massive blobs of data globally slows down initial page loads.
**Task:**
- [x] Established cached Data Access Layer (`lib/data/tours.ts`, `lib/data/stats.ts`, `lib/data/reviews.ts`) using Next.js `unstable_cache` with background revalidation.
- [x] Implemented React `<Suspense>` streaming boundaries with pulse skeleton loaders (`TourCardSkeleton.tsx`) on the landing page catalog.
- [x] Upgraded Server Actions (`actions/tours.ts`, `actions/schedules.ts`, `actions/admin.ts`, `actions/bookings.ts`) to use surgical `revalidateTag()` invalidation for high-traffic entities.

