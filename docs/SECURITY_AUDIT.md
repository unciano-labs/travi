# Security Audit Report — Travi SaaS

## ✅ Resolved Vulnerabilities

### 1. Exposed Service Role Key (Fixed)
**Location**: `actions/bookings.ts`
**Resolution**: Removed the `NEXT_PUBLIC_` prefix, changing it to `SUPABASE_SERVICE_ROLE_KEY` to ensure the key remains securely on the server and is not bundled into the client-side JavaScript.

### 2. TOCTOU Race Condition in Bookings (Fixed)
**Location**: `actions/bookings.ts`, `supabase/migrations/`
**Resolution**: Created a PostgreSQL RPC function (`book_tour_seats`) using row-level locking (`FOR UPDATE`) to atomically verify available capacity and increment the `booked_count`. This eliminates the risk of overbooking tours due to simultaneous requests.

### 3. Missing Role Validation in Admin Login (Fixed)
**Location**: `actions/auth.ts`
**Resolution**: Updated `loginAsAdmin` to explicitly query the `user_roles` table after a successful password authentication, preventing standard users from accessing the admin dashboard.

### 4. Missing Ownership Validation in Tour Actions (Fixed)
**Location**: `actions/tours.ts`
**Resolution**: Added backend validation to fetch the currently authenticated user's `organizer_id` and append it to the update query (`.eq('organizer_id', ...)`. This provides defense-in-depth authorization ensuring users can only modify tours they explicitly own.

---

## ❌ False Positives

### 1. Broken Route Protection / Middleware Bypass
**Location**: `proxy.ts`
**Clarification**: The initial audit flagged `proxy.ts` as a bypassed middleware file (expecting `middleware.ts`). However, Next.js 16.3.2 deprecated `middleware.ts` in favor of `proxy.ts`. Therefore, the route protection is functioning correctly by design for this specific Next.js version. 

---

## 🚀 Recommended Future Enhancements (To-Do)

### 1. Strict Input Validation (Zod)
- **Issue**: Server actions (like `createTour` or `signupUser`) currently extract strings from `FormData` and cast them without strict length, type, or format validation.
- **Action**: Implement a validation library like `Zod` to define strict schemas for all API routes and server actions.

### 2. Rate Limiting
- **Issue**: Authentication endpoints (`loginUser`, `loginAsAdmin`, `signupUser`) are susceptible to brute-force or credential stuffing attacks.
- **Action**: Implement rate limiting (e.g., via `@upstash/ratelimit` or a custom Redis implementation) to throttle excessive requests from a single IP.

### 3. Content Security Policy (CSP) Headers
- **Issue**: The application currently lacks strict CSP headers, which are a critical defense layer against Cross-Site Scripting (XSS).
- **Action**: Configure strict CSP headers in `next.config.ts` or `proxy.ts` to restrict script execution and resource loading to trusted domains (especially important with the new Stripe integration).
