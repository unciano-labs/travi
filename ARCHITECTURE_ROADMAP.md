# MVP Architecture Roadmap — Travi SaaS

This document serves as the technical roadmap for bringing the Travi SaaS platform up to the standards defined in the `mvp-architecture.md` reference guide. It outlines the specific tasks required to implement best-in-class security, validation, and data architecture patterns.

---

## 🟢 Priority 1: Core Foundation & Security

These tasks address runtime stability, input validation, and preventing unauthorized mutations.

### 1. Zod-Validated Environment Variables
**Why:** Currently, missing environment variables (like a Stripe Key or Supabase URL) cause unpredictable runtime errors deep within the application.
**Task:** 
- Create `src/core/env.ts`.
- Define a `zod` schema for `process.env`.
- Export a validated `env` object to be used across the app.

### 2. Standardize Database Client Factories
**Why:** Instantiating the admin/service-role client inline using `process.env` (as currently done in `actions/bookings.ts`) increases the risk of exposing the service key.
**Task:**
- Create `src/core/supabase/server.ts`, `browser.ts`, and `admin.ts`.
- Ensure the `admin` client requires an explicit `{ admin: true }` flag to prevent accidental usage.
- Refactor all existing Server Actions to use these new factories.

### 3. Implement Strict Server Action Pattern
**Why:** Current Server Actions perform manual string casting and ad-hoc auth checks, lacking a consistent structure.
**Task:**
- Create standard auth assertion helpers: `requireSession()` and `assertRole()`.
- Install and configure `zod` for input validation.
- Refactor all mutations in `actions/tours.ts`, `actions/bookings.ts`, and `actions/auth.ts` to follow the 5-step pattern:
  1. Authenticate (`requireSession`)
  2. Authorize (`assertRole`)
  3. Validate (`schema.parse`)
  4. Scope DB Write (`eq('organizer_id', ...)`)
  5. Return Typed Result

---

## 🟡 Priority 2: Observability & Abuse Prevention

These tasks prepare the application for real-world traffic and business compliance.

### 4. Rate Limiting for Authentication & Mutations
**Why:** Public endpoints (login, signup) are vulnerable to credential stuffing, and un-throttled actions can exhaust database connections.
**Task:**
- Integrate `@upstash/ratelimit` and Redis.
- Apply strict rate limits to `loginAsAdmin`, standard login, and signup routes based on IP.
- Apply secondary rate limits per user/account for mutations (e.g., creating tours).

### 5. Centralized Audit Logging
**Why:** SOC 2 compliance and operational security require a tamper-proof trail of who did what. The `admin_audit_logs` table exists but is unused.
**Task:**
- Create a `logMutation(actor, action, entity, diff)` utility function.
- Inject this function into critical admin operations (e.g., approving an organizer, deleting a review, modifying a user's role).

### 6. Centralized Error Handling & Logging
**Why:** We need to know when production errors occur before users report them.
**Task:**
- Integrate **Sentry** (`@sentry/nextjs`) for unhandled exception tracking.
- Set up **Pino** for structured JSON logging on the server to replace raw `console.log()` statements, passing a request ID through the call stack.

---

## 🔵 Priority 3: Data Efficiency & Performance

These tasks optimize the app for scale and prevent degraded performance as the database grows.

### 7. Enforce Soft Deletes
**Why:** Hard-deleting user data (like vehicles or profiles) destroys historical context and breaks related foreign keys.
**Task:**
- Add `deleted_at` timestamps or standard `status: 'archived'` enums to all primary tables (currently only implemented partially on Tours).
- Update RLS policies and application read queries to filter out archived data by default.

### 8. Optimize Component Data Fetching (De-monolith)
**Why:** Fetching massive blobs of data globally slows down initial page loads.
**Task:**
- Migrate data fetching to the component level using Next.js Server Components.
- Implement cursor-based pagination for unbounded lists (e.g., browsing all tours, viewing all transporter reviews).
- Use specific `revalidateTag()` invalidation instead of generic `revalidatePath()` to cache and purge data efficiently.
