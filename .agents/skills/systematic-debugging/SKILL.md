---
name: systematic-debugging
description: >-
  System Debugger & Hydration Specialist for Travi SaaS (@systematic-debugging).
  Use when diagnosing React hydration mismatches, Next.js App Router rendering errors,
  Supabase cookie/session desync, Turbopack build errors, or unexpected runtime exceptions.
---

# System Debugger Agent (`@systematic-debugging`) — Travi SaaS

The **System Debugger Agent** is a specialist in identifying root causes of complex runtime bugs, hydration mismatches, state synchronization issues, and Next.js App Router anomalies.

---

## 1. Primary Diagnostic Capabilities

### A. React Hydration Mismatch Resolution
- **Symptoms**: `Hydration failed because the initial UI does not match what was rendered on the server`, `Text content does not match server-rendered HTML`.
- **Common Root Causes in Travi**:
  1. **Date & Time Formatting**: Rendering `new Date().toLocaleDateString()` directly on the client without fixed timezone/formatting or ISO strings.
  2. **Browser-Only APIs**: Accessing `window`, `localStorage`, or `navigator` during the initial render pass instead of inside `useEffect()`.
  3. **Third-Party Extensions**: Browser extensions injecting DOM nodes into `<body>` or inputs (e.g. password managers).
  4. **Dynamic IDs & Randomness**: Calling `Math.random()` or dynamic UUID generators during render instead of React 19's `useId()`.
- **Fix Protocol**:
  - Isolate non-deterministic values to `useEffect()` or suppress with `suppressHydrationWarning` if strictly necessary.
  - Standardize date formatting with `date-fns` using explicit UTC or static server formatting.

### B. Supabase Auth & Session Desynchronization
- **Symptoms**: User logged in on client but Server Actions return `Unauthorized`, redirect loops between `/login` and `/dashboard/*`, stale role permissions.
- **Diagnostic Steps**:
  1. Check `lib/supabase/middleware.ts` cookie propagation: Verify `getAll()` and `setAll()` correctly mutate request/response cookie headers.
  2. Check role resolution: Ensure `user_roles` query joins `website_roles` matching `WEBSITE_ID`.
  3. Ensure server actions use `createClient()` from `lib/supabase/server.ts` to access live cookie context.

### C. Server Component vs Client Component Data Boundary Errors
- **Symptoms**: `Functions cannot be passed directly to Client Components unless you explicitly expose a Server Action`, `Event handlers cannot be passed to Client Component props`.
- **Fix Protocol**:
  - Ensure Server Components fetch pure serializable JSON data.
  - Pass server actions as form actions or bound functions, never raw database query callbacks.

### D. Next.js / Turbopack Build & Compilation Failures
- **Diagnostic Steps**:
  1. Inspect error stack trace and pinpoint the exact file and column.
  2. Check for duplicate keys in object literals, invalid imports, or circular dependencies.
  3. Verify type contracts with `npm run build`.

---

## 2. Structured Debugging Workflow

When tackling any bug:
1. **Reproduce**: Capture exact steps, URL route, user role, and browser environment.
2. **Isolate**: Inspect logs in `lib/logger.ts`, Sentry event captures, or terminal output.
3. **Trace Root Cause**: Differentiate between Data/DB error, Auth/Cookie issue, or Rendering/Hydration mismatch.
4. **Formulate Minimal Fix**: Apply localized, clean fix preserving system stability.
5. **Verify**: Run `npm run test:qa` and `npm run build` to confirm zero regressions.
