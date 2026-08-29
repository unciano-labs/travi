# Production-Ready MVP Architecture Reference Guide

> **Purpose**: This document is a reusable, AI-consumable architecture standard for building a scalable, secure, production-grade MVP. It is derived from a real-world multi-tenant SaaS codebase (Ruvio, Next.js/Supabase, 148 tables, RBAC, multi-integration), stripped down and **re-engineered** for teams that want to start lean but never have to do a painful rewrite later.
>
> **How to use this doc**: Treat each section as a spec. Where a decision is marked `[DEFAULT]`, use it unless the project has a stated reason not to. Where a decision is marked `[SCALE TRIGGER: ...]`, only add that complexity once the trigger condition is actually met — premature complexity is itself a production risk.

---

## 1. Guiding Principles

1. **Boring technology wins.** Pick tools with large communities, long track records, and predictable failure modes. Novelty is a cost, not a feature, for an MVP.
2. **Security and data integrity are not "phase 2."** Auth, authorization, input validation, and tenant isolation must exist from commit #1 — retrofitting them into a live database with real user data is how breaches happen.
3. **Design for multi-tenancy even if you launch single-tenant.** Adding an `organization_id` column later means touching every table, every query, and every RLS policy under time pressure. Add it now; it costs nothing when there's 1 tenant.
4. **Optimize for deletion, not reuse.** Prefer code that is easy to delete/replace over code that is maximally abstracted/reusable. Avoid the temptation to build the "capability matrix" or "generic rules engine" before you have 3+ real use cases that need it.
5. **Every layer should assume the layer above it is compromised.** Client-side checks are UX, not security. Server-side checks (with the database as the final authority via RLS) are security.
6. **Make the fast path and the safe path the same path.** If doing things securely (org-scoped queries, validated input, audited mutations) is also the path of least resistance for a developer, the codebase stays secure as it grows.

---

## 2. Tech Stack

### 2.1 Core Framework — `[DEFAULT]`

| Layer | Technology | Version (as of 2026) | Rationale |
|---|---|---|---|
| Runtime | Node.js | LTS (22.x or newer) | Pin to `engines` in `package.json`; matches Vercel/most PaaS runtimes |
| Framework | Next.js (App Router) | 15.x | Server Components, Server Actions, Route Handlers, built-in caching primitives |
| UI Library | React | 19.x | Concurrent features, `useActionState`/`useOptimistic` reduce custom state code |
| Language | TypeScript | 5.x, `strict: true` | Non-negotiable for a codebase an AI or a growing team will maintain |
| Styling | Tailwind CSS | 4.x | Utility-first, small footprint, easy to theme via design tokens |
| Validation | Zod | latest | Single source of truth for both runtime validation and inferred TS types |

**Improvement over the reference app**: enforce `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true` in `tsconfig.json` from day one — the reference codebase's scale (148 tables, 40+ domain modules) makes these settings expensive to turn on retroactively. Turning them on early costs a few extra null-checks; turning them on late requires touching every file.

### 2.2 Database & Backend — `[DEFAULT]`

| Layer | Technology | Notes |
|---|---|---|
| Database | PostgreSQL (via Supabase, Neon, or RDS) | Relational integrity + Row-Level Security (RLS) beats "add integrity checks in app code later" |
| DB Client | `@supabase/supabase-js` (or `postgres.js` / Drizzle if self-hosting Postgres) | Pick one query layer; do not mix raw SQL and an ORM in the same domain |
| ORM / Query Builder | Drizzle ORM (recommended) or Prisma | Type-safe queries, migration generation, works outside Supabase if you ever migrate off it |
| SSR Auth | `@supabase/ssr` (or custom JWT + `iron-session`) | Cookie-based session, httpOnly, `SameSite=Lax` minimum |
| Migrations | Supabase CLI or Drizzle Kit | **Never** hand-edit production schema; migrations are the only path to prod DB changes |

**Why Postgres over "just use SQLite/Mongo for MVP speed"**: relational + RLS gives you tenant isolation and referential integrity for free. Document databases push that integrity into application code, which is exactly the kind of thing that gets forgotten under deadline pressure and becomes a security bug later.

### 2.3 Payments & Billing — `[SCALE TRIGGER: first paying customer]`

| Layer | Technology | Notes |
|---|---|---|
| Billing | Stripe | Industry standard; use **Stripe Checkout + Customer Portal** first, not custom billing UI |
| Webhooks | Stripe CLI locally, signature-verified Route Handler in prod | Never trust a webhook body without verifying `Stripe-Signature` |
| Entitlements | A single `subscriptions` table + a `hasFeature(orgId, feature)` helper | Skip the multi-tier plan-gating system until you have >1 real pricing tier |

### 2.4 AI / ML Integration — `[SCALE TRIGGER: feature requires it]`

| Layer | Technology | Notes |
|---|---|---|
| LLM Provider | Anthropic / OpenAI / Google, behind a single internal `lib/ai/client.ts` abstraction | Never call a provider SDK directly from route/component code — swapping providers or adding fallback should be a one-file change |
| Structured output | Zod schema + provider's structured-output/tool-use mode | Never regex-parse LLM text output |
| Cost control | Token/usage logging per org from day one | AI cost overruns are one of the most common "surprise bill" MVP failures |

### 2.5 Key Libraries — `[DEFAULT]`

| Purpose | Library | Notes |
|---|---|---|
| Data fetching (client) | `swr` or `@tanstack/react-query` | Pick **one**, per-component fetching — see Section 5 on why *not* to build a monolithic global data provider |
| Forms | `react-hook-form` + `zod` (via `@hookform/resolvers`) | Client validation mirrors server validation schema |
| Tables | `@tanstack/react-table` | Headless, scales to virtualization when needed |
| Dates | `date-fns` + `luxon` (pick one; both is redundant) | **Always store timestamps in UTC**; format in the client's timezone only |
| Toasts / notifications | `sonner` | Lightweight, accessible |
| Logging | `pino` (server) | Structured JSON logs, easy to ship to any log aggregator |
| Error monitoring | Sentry (`@sentry/nextjs`) | Wire up from commit #1, not after the first production incident |
| Rate limiting | `@upstash/ratelimit` + Upstash Redis (or `express-rate-limit` equivalent) | See Section 6.6 |
| Background jobs / queues | `Inngest`, `Trigger.dev`, or Supabase Edge Functions + `pg-boss` | See Section 5.4 — do not rely on Vercel Cron alone for anything business-critical |
| CSV/Excel | `papaparse` (CSV), `exceljs` (Excel export) | Stream large exports; never load an entire export into memory |
| PDF | `pdf-lib` or `@react-pdf/renderer` | For generated PDFs; use a dedicated OCR/parsing service for scanned input |

### 2.6 UI Component Libraries — `[DEFAULT]`

- **shadcn/ui** (built on Radix primitives) instead of raw Radix + Headless UI + two icon sets. It gives you owned, editable component source instead of an opaque dependency, which matters once you need non-trivial customization.
- One icon set only (`lucide-react`). Two icon libraries is dead weight and inconsistent iconography.

### 2.7 Dev Tooling — `[DEFAULT]`

| Tool | Purpose |
|---|---|
| ESLint (flat config) + `eslint-plugin-security` | Lint + basic security-antipattern detection |
| Prettier | Formatting; run in CI, not just locally |
| Vitest (preferred over Jest for new projects) | Faster, native ESM, Jest-compatible API |
| Playwright (preferred over Cypress for new projects) | Faster, better parallelization, first-class Next.js support |
| `@testing-library/react` | Component testing |
| `@next/bundle-analyzer` | Run in CI on every PR that touches client bundles above a size budget |

---

## 3. Project Structure

```
my-mvp/
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── layout.tsx                  # Root layout (fonts, providers, error boundary)
│   │   ├── globals.css
│   │   ├── (marketing)/                # Public pages (route group, no auth)
│   │   ├── auth/                       # Sign-in, sign-up, callback, password-reset
│   │   ├── onboarding/                 # First-run flow (create org, invite team)
│   │   ├── invite/[token]/             # Org invite acceptance
│   │   ├── [orgSlug]/                  # Multi-tenant scoped routes (see 3.1)
│   │   │   ├── layout.tsx              # Auth + org-membership guard
│   │   │   ├── page.tsx                # Role-based landing redirect
│   │   │   ├── actions.ts              # Server Actions (mutations) — see 6.3
│   │   │   ├── queries.ts              # Read queries (RSC-only, no client import)
│   │   │   └── <feature>/              # One folder per domain feature
│   │   ├── api/                        # Route Handlers — webhooks, crons, external callbacks ONLY
│   │   │   ├── webhooks/<provider>/    # Signature-verified inbound webhooks
│   │   │   ├── cron/                   # Secret-authenticated scheduled jobs
│   │   │   └── auth/callback/          # OAuth callback
│   │   └── admin/                      # Internal/superadmin dashboard, IP-allowlisted if possible
│   ├── core/                           # Framework-level, app-agnostic concerns
│   │   ├── supabase/ (or db/)          # DB client factories per execution context (see 3.2)
│   │   ├── session.ts                  # Session types + `requireSession()`
│   │   ├── logger.ts                   # Pino instance, request-scoped child loggers
│   │   ├── errors.ts                   # Typed application error classes + HTTP mapping
│   │   ├── rate-limit.ts               # Shared rate limiter instance
│   │   └── env.ts                      # Zod-validated, typed `process.env` wrapper (see 6.7)
│   ├── lib/                            # Business domain modules — one folder per bounded context
│   │   ├── organizations/              # Org CRUD, membership, roles
│   │   ├── billing/                    # Stripe integration + entitlements
│   │   ├── <domain>/
│   │   │   ├── schema.ts               # Zod schemas (request + DB row shapes)
│   │   │   ├── queries.ts              # Reads
│   │   │   ├── mutations.ts            # Writes (called from actions.ts)
│   │   │   ├── service.ts              # Pure business logic, framework-agnostic, unit-testable
│   │   │   └── __tests__/
│   ├── components/                     # Shared, dumb UI components
│   ├── hooks/                          # Shared React hooks
│   └── types/                          # Shared TS types (DB types generated here)
├── supabase/ (or drizzle/)
│   ├── migrations/                     # SQL migrations — the only path to schema change
│   └── seed.sql                        # Dev seed data (never run against prod)
├── scripts/                            # One-off / operational scripts, reviewed like code
├── e2e/                                 # Playwright specs
├── .env.example                        # Every required env var, documented, no real values
├── next.config.js
├── drizzle.config.ts (or supabase config)
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### 3.1 Multi-Tenant Routing (`[DEFAULT]` — add even for a single-tenant launch)

- Every authenticated route lives under `/[orgSlug]/...`. Even a "single company" MVP should model an `organizations` table with one row — it costs nothing now and avoids a full data-model migration the first time you get a second customer.
- A single layout-level guard (`requireRouteAccess(orgSlug, capability)`) checks membership + role before rendering anything below it. Denial → `notFound()` (404), never a silent redirect that leaks the existence of a resource.
- Middleware (`src/middleware.ts`) handles only cross-cutting, cheap checks: session refresh, CSRF token issuance, and blocking obviously-invalid routes. Anything requiring a DB round trip (role/capability checks) belongs in the layout, not middleware, to keep the edge fast.

### 3.2 Database Client Factories (`[DEFAULT]`)

Keep the reference app's strongest pattern: **one client factory per execution context**, so nobody accidentally uses a browser client on the server or a cookie-bound client in a webhook handler.

| Context | Client | Subject to RLS? |
|---|---|---|
| Server Components | Cookie-based | Yes |
| Server Actions | Cookie-based | Yes |
| Route Handlers (webhooks/cron) | Service-role | No (self-authenticates via signature/secret instead) |
| Middleware | Cookie read/write only | Yes |
| Client Components | Browser client (anon key) | Yes |
| Admin-only escalation | Explicit `{ admin: true }` variant, used *only* after an app-level role check has already passed | No |

**Rule**: the service-role/admin client must never be reachable from a code path that starts with unauthenticated user input without an explicit, auditable auth check immediately before it. Grep for `admin: true` in code review.

---

## 4. Authentication & Authorization

### 4.1 Authentication — `[DEFAULT]`

- Provider: Supabase Auth, Auth.js (NextAuth v5), or Clerk/WorkOS if you want auth fully outsourced. Cookie-based sessions, `httpOnly`, `Secure`, `SameSite=Lax`.
- JWT/session expiry: 1 hour access token with silent refresh, **not** long-lived tokens stored client-side.
- Password minimum: 8 characters is an *old* floor — combine with breached-password checking (Supabase and Auth.js both support HaveIBeenPwned-style checks) rather than raising the character minimum alone, which mostly annoys users without stopping credential-stuffing.
- Require email verification before granting write access, even in an MVP — unverified-email spam/abuse is a top-3 source of early production incidents.
- MFA (TOTP) should be a supported option before you have paying customers, even if off by default.

### 4.2 Authorization (RBAC) — simplified from the reference app

Start with **3 roles**, not 6:

```
Owner  — full access, billing, can delete org
Admin  — full access except billing/org-deletion
Member — standard read/write on their own scope
```

Add `Viewer` only when a real customer asks for read-only seats. Skip the reference app's ~100-capability granular matrix until you have evidence multiple customers need different permission shapes — until then, `if (role === 'owner' || role === 'admin')` in the server action is correct, auditable, and fast to write.

**Two independent gates (keep this pattern — it's the reference app's best idea):**
1. **Role gate** → forbidden = `notFound()`. Never reveal a resource exists to someone without access to it.
2. **Plan/entitlement gate** → not on the required plan = an upgrade prompt (not a 404) — the user is allowed to know the feature exists, they just need to pay for it.

### 4.3 Row-Level Security — `[DEFAULT, not optional]`

Even in an MVP, RLS is cheap insurance against the single most common SaaS bug class: a missing `.eq('organization_id', ...)` in one query out of thousands.

```sql
-- Canonical policy pattern: evaluate both subqueries ONCE per query (InitPlan optimization)
create policy "org_isolation_select" on public.<table>
for select using (
  (select auth.jwt() ->> 'role') = 'service_role'
  or organization_id in (select org_id from public.user_organizations where user_id = auth.uid())
);
```

- Enable RLS on **every** table the moment it's created — not "before launch." A table with RLS disabled and real data in staging is a real risk if staging data ever resembles production data.
- Write policies by hand for an MVP (<15 tables); only build a policy-generator script once you're regenerating policies across dozens of tables repeatedly.
- Keep an `EMERGENCY_disable_rls.sql` break-glass script in the repo, but require two-person sign-off (PR review) to ever run it against production.
- Service-role key bypasses RLS — treat it like a root credential: never send it to the client, never log it, rotate it if it ever appears in a client bundle or log line.

### 4.4 CSRF & Session Hygiene — `[DEFAULT]`

- Server Actions get Next.js's built-in CSRF protection (Origin header check) — verify it's actually enabled for your Next.js version, don't assume.
- Any traditional POST route handler (webhooks excluded) needs an explicit CSRF token (`edge-csrf` or equivalent).
- Rotate the session on privilege change (e.g., role upgrade, password change) — don't let an old token retain old privileges.

---

## 5. Data Architecture, Caching & Efficiency

This section directly addresses **better data handling and efficiency** — expanded well beyond the reference app.

### 5.1 Don't build a monolithic "EverythingProvider"

The reference app's single global data loader (fetch-everything-at-mount, cache in IndexedDB) is a **known anti-pattern to avoid replicating**, even though it worked at that scale. Problems it causes:
- Couples every feature's load time to every other feature's payload size.
- Makes it hard to reason about staleness (you're either invalidating too little or too much).
- Client-side caching of sensitive data (IndexedDB, localStorage) is not encrypted at rest — anything in it is readable by any XSS payload or by anyone with local device access.

**Recommended replacement — `[DEFAULT]`**:
- Fetch data **per-page/per-feature**, server-side, in the Server Component that needs it (Next.js `fetch`/DB call caching + `revalidateTag`/`revalidatePath` handles most of what a client cache was doing).
- For client-side reactivity (e.g., live-updating tables), use `swr`/React Query scoped to that feature, with query keys like `["org", orgId, "invoices", filters]` — not one giant blob.
- Only reach for a client-side persistent cache (IndexedDB) for genuinely offline-first features, and encrypt anything sensitive before storing it, or store only non-sensitive derived/display data.

### 5.2 Caching layers — simplified, each with an explicit TTL and invalidation trigger

| Layer | Use for | TTL / Invalidation |
|---|---|---|
| Next.js Data Cache (`fetch` cache / `unstable_cache`) | Server-rendered read-heavy pages | Tag-based (`revalidateTag`) invalidated by the mutation that changed the data — not time alone |
| Redis (Upstash) | Cross-request shared cache (rate limits, computed aggregates, session lookups) | Explicit TTL per key; version the key (`v2:org:123:summary`) so a shape change doesn't require flushing everything |
| React Query / SWR | Client-side, per-feature | `staleTime` tuned per data volatility; invalidate on mutation success via `queryClient.invalidateQueries` |
| CDN / Edge cache | Static assets, public marketing pages | Standard `Cache-Control` headers |

**Rule**: every cache key must have (a) an explicit version prefix and (b) a documented invalidation trigger. An un-invalidatable cache is a bug generator.

### 5.3 Database efficiency

- **Indexing**: index every foreign key used in a `WHERE`/`JOIN`, every column used in RLS policies (`organization_id` above all), and composite indexes for common filter+sort combos. Run `EXPLAIN ANALYZE` on any query touching a table you expect to exceed 10k rows.
- **Pagination**: cursor-based (`WHERE id > $lastId ORDER BY id LIMIT N`) for anything that can grow unbounded; avoid `OFFSET` pagination past a few thousand rows (it degrades linearly).
- **N+1 prevention**: use a single joined query or `IN (...)` batch fetch instead of looping queries per row. If using an ORM, enable query logging in dev and grep for repeated identical queries in a single request.
- **Connection pooling**: use PgBouncer (Supabase provides this via the pooler connection string) for any serverless/edge deployment — direct Postgres connections exhaust fast under serverless concurrency.
- **Large payload hygiene**: never `SELECT *` on tables with blob/JSON columns (OCR text, AI embeddings, large JSON) in a list view; select only display columns, fetch heavy columns lazily on detail view — this was literally the reference app's biggest realized optimization (6.5 MB saved).
- **Soft deletes vs hard deletes**: default to a `deleted_at` column + a `WHERE deleted_at IS NULL` filter (enforced via a view or RLS, not per-query discipline) for user-facing data, so accidental/malicious deletes are recoverable. Hard-delete only for genuinely ephemeral data or on an explicit, logged admin action with a retention/legal basis.

### 5.4 Background jobs & scheduled tasks

- Do not rely on Vercel Cron (or equivalent platform cron) alone for anything where a missed/duplicate run has business impact (billing, notifications, sync jobs). Platform cron has no built-in retry, dedup, or observability.
- Use a real job queue — **Inngest** or **Trigger.dev** (both have generous free tiers and work well with serverless) or self-hosted `pg-boss` on top of your existing Postgres. Benefits: automatic retries with backoff, idempotency keys, step-level observability, and the ability to fan out/parallelize.
- Every job handler must be **idempotent** — assume it may run twice for the same input (at-least-once delivery is the norm for queues). Use a unique constraint or a processed-events table to dedupe.
- Long-running jobs (>60s) must not live inside a request-response Route Handler on serverless — hand off to the queue immediately and return 202.

### 5.5 Consistency & single source of truth

- Keep the reference app's best idea: **one facade module per cross-cutting calculation** (e.g., `lib/billing/calculations.ts`) — never reimplement the same financial/business math inline in two places. Add a unit test per calculation edge case before adding a UI for it.
- All timestamps stored in UTC (`timestamptz` in Postgres); format to the user's timezone only at render time, and anchor date-range logic (`startOf('month')`, etc.) to UTC to keep server/CI/local-dev results identical.
- Use database transactions for any multi-table mutation that must succeed or fail atomically (e.g., "create invoice + decrement inventory"). Don't rely on "mostly works" sequential writes from application code.

---

## 6. Security Hardening Checklist

Beyond auth/RLS (Section 4), production-readiness requires:

### 6.1 Input validation
- Validate **every** external input (Server Action args, Route Handler bodies, query params, webhook payloads) with Zod at the boundary — never trust `req.json()` shape.
- Validate file uploads: check MIME type by content sniffing (not just extension), enforce size limits, and scan/route through a dedicated storage bucket with restricted execution permissions — never write user uploads into a path that could be served as executable code.

### 6.2 Secrets management
- All secrets in environment variables, validated at boot via a Zod-parsed `env.ts` (fail fast on missing/malformed secrets rather than failing on first use in production).
- Never commit `.env*` files with real values; commit only `.env.example`.
- Rotate any secret that has ever appeared in a client bundle, log, or error report, treating the exposure as a live incident, not a cleanup task.
- Separate secrets per environment (dev/staging/prod) with **no shared credentials** between them — a compromised staging key should never grant production access.

### 6.3 Server Action / API mutation pattern — `[DEFAULT, keep from reference app]`

```
1. requireSession(client)                          — authenticate
2. assertOrgMembership(client, userId, orgId)       — tenant check
3. assertOrgRole(role, ['owner','admin'])           — authorization
4. schema.parse(input)                              — validation (Zod)
5. .eq('organization_id', orgId)                     — scoped DB write
6. log the mutation (who/what/when) for audit        — see 6.5
```
Every mutation should be traceable back through these five steps in code review; skipping any one of them is the review comment to raise.

### 6.4 Webhooks & unauthenticated endpoints
- Verify signatures (HMAC-SHA256, timing-safe compare) on every inbound webhook (Stripe, third-party integrations) — never process an unverified payload.
- Rate-limit and IP-consider (where the provider publishes IP ranges) webhook endpoints even though they're signature-verified — defense in depth against replay/DoS.
- Cron endpoints require a bearer secret (`Authorization: Bearer ${CRON_SECRET}`) — treat a leaked cron secret as a production incident.

### 6.5 Auditing & observability
- Maintain an `audit_log` table for sensitive mutations (role changes, billing changes, deletions, data exports) — capture actor, org, action, before/after diff, timestamp. This is both a security control and often a compliance requirement (SOC 2, GDPR data-access logs) once you have business customers.
- Sentry (or equivalent) wired up from the start, with **PII scrubbing** configured before you ever ship — don't let user emails/names flow unredacted into a third-party error tracker by default.
- Structured logs (Pino) with a request ID threaded through every log line in a request, so a single user report can be traced through the whole call stack.

### 6.6 Rate limiting & abuse prevention
- Rate-limit: auth endpoints (login/signup/password-reset) per-IP and per-account; AI/LLM endpoints per-org (cost control); public API endpoints per API key.
- Use a sliding-window limiter (`@upstash/ratelimit`) backed by Redis, not in-memory counters — in-memory limiters reset on every serverless cold start and don't work across multiple instances.
- CAPTCHA (or equivalent, e.g., Cloudflare Turnstile) on public unauthenticated forms (signup, contact) once you see any bot traffic — don't wait for abuse to become a fire before adding it.

### 6.7 Dependency & supply-chain hygiene
- `npm audit` / Dependabot (or Renovate) in CI, with a policy to actually review and merge security patches, not just generate the PRs.
- Pin lockfiles (`package-lock.json`/`pnpm-lock.yaml`) committed and enforced in CI (`npm ci`, not `npm install`).
- Avoid installing packages with very low download counts / no recent maintenance for anything touching auth, crypto, or payment flows — prefer the well-known option even if slightly heavier.

### 6.8 Data privacy & compliance groundwork
- Design the schema so a "delete my account/data" request is a bounded, testable operation (know every table that references `user_id`) — this is far cheaper to guarantee at 10 tables than to retrofit at 150.
- Encrypt sensitive third-party credentials (OAuth tokens, API keys stored on behalf of users) at the application layer before writing to the DB (e.g., AES-256-GCM with a key from a secrets manager), not just relying on "the disk is encrypted."
- Document what personal data you store and why — even a one-page internal doc — before you need it for a customer security questionnaire or a legal request.

---

## 7. API Design

### 7.1 Server Actions (primary mutation path) — `[DEFAULT]`
Use Next.js Server Actions for internal app mutations, following the pattern in 6.3. This removes an entire REST/GraphQL API layer for internal use, reducing surface area and duplicate validation logic.

### 7.2 Route Handlers — for external-facing needs only
| Category | When to use |
|---|---|
| Webhooks | Inbound events from Stripe/third parties |
| Public API | Only if you're offering a documented external API to customers — version it (`/api/v1/...`) from day one |
| OAuth callbacks | Integration connect flows |
| Cron triggers | Scheduled job entry points (which immediately hand off to the queue, see 5.4) |

### 7.3 If/when you need a public API
- Version explicitly (`/api/v1/`), never break a shipped version silently.
- API keys, not session cookies, for external consumers; scope keys per-org with the same RLS/authorization checks as internal mutations.
- OpenAPI/JSON schema documentation generated from the same Zod schemas used for validation — one source of truth, not hand-maintained docs that drift.

---

## 8. Testing & QA

| Layer | Tool | Notes |
|---|---|---|
| Unit tests | Vitest | Test `lib/<domain>/service.ts` pure functions — especially any financial/business math, with edge cases (zero, negative, boundary dates) |
| Component tests | `@testing-library/react` + Vitest | Test behavior, not implementation details |
| E2E tests | Playwright | Cover: signup → onboarding → core happy path → billing flow; run in CI against a real (ephemeral) test database |
| DB tests | `pgTAP` or Supabase's `supabase test db` | Test RLS policies directly — assert a user in Org A cannot read Org B's rows, not just that the app "seems to" filter correctly |
| Load/perf testing | k6 or Artillery | Run before any launch with expected real traffic; identify the first bottleneck (usually DB connections or a missing index) before users find it |

**CI pipeline (`[DEFAULT]`)**:
```bash
typecheck → lint → unit tests → RLS/DB tests → build → E2E (against preview deploy)
```
Block merges on all of the above. A red CI pipeline that people routinely override is worse than no CI pipeline — it trains the team to ignore it.

---

## 9. Deployment & Environments

### 9.1 Platform — `[DEFAULT]`
- Vercel (or Netlify/Fly.io) for the Next.js app; co-locate the deployment region with your database region (e.g., both in `us-east-1` or both in `eu-central-1`) — cross-region DB round trips are a top, easily-avoided latency cost.
- Separate environments: **Development** (local, Docker Postgres or local Supabase), **Preview** (per-PR ephemeral, seeded test data), **Production** (real data, stricter access controls).
- Never point a preview/staging deployment at the production database.

### 9.2 Environment configuration
- One `.env.<environment>` pattern, all validated through the typed `env.ts` (Section 6.2) so a missing var fails the build, not a random runtime request.
- Feature flags (even a simple `feature_flags` table or a service like PostHog/LaunchDarkly) for anything you want to roll out gradually or kill-switch quickly — cheaper than a redeploy when something's wrong in production.

### 9.3 Function/route resource tuning
- Set explicit timeout/memory per route only where the default is insufficient (file processing, AI calls, exports) — don't blanket-increase every route's resources, which increases cost and can mask a route that should actually be moved to the background queue.

### 9.4 CI/CD
- GitHub Actions (or equivalent) running the full pipeline from Section 8 on every PR; auto-deploy `main` → production only after CI is green.
- Database migrations run as a separate, explicit CI/CD step (not auto-applied on every deploy without review) — a schema migration is a higher-risk operation than a code deploy and deserves its own gate.

---

## 10. Monitoring, Alerting & Incident Readiness

- **Error tracking**: Sentry, with alert rules for new error types and error-rate spikes.
- **Uptime/health checks**: a `/api/health` route checking DB connectivity, checked by an external uptime monitor (e.g., Better Stack, UptimeRobot) — know about downtime before your users tell you.
- **Metrics**: track at minimum — request latency (p50/p95/p99), error rate, DB connection pool utilization, job queue depth/failure rate, and per-org resource usage if you bill on usage.
- **On-call/alerting**: even a solo founder should have Slack/email/SMS alerts wired for: production error-rate spike, failed payment webhook, job queue backing up, DB approaching connection limit.
- **Runbook**: a short doc (even a `RUNBOOK.md`) covering "how do I roll back a bad deploy," "how do I re-run a failed migration," "how do I revoke a leaked key" — write it before you need it under pressure.

---

## 11. What to Simplify vs. Carry Over (Decision Table)

| Reference App Pattern | MVP Recommendation | Add Full Version When |
|---|---|---|
| ~100-capability RBAC matrix | 3-role check (`owner`/`admin`/`member`) | You have customers explicitly requesting custom permission sets |
| Monolithic `EverythingProvider` client cache | Per-feature server fetch + scoped SWR/React Query | You have a proven, specific offline-first requirement |
| RLS policy auto-generator script | Hand-written RLS policies (still **enabled from day one**) | You're regenerating policies across 20+ tables routinely |
| Full i18n (`i18next`) | Single language; `next-intl` only if a second language is contractually required | You have committed, paying customers in a second locale |
| 6 third-party integration pipelines (Beds24, Revolut, etc.) | Skip entirely | A specific integration is a named product requirement |
| Vercel Cron for everything | Real job queue (Inngest/Trigger.dev) for anything business-critical; platform cron only for cheap, idempotent, non-critical polling | Never fully replace — queue-based is the production-grade default even for MVPs handling money |
| Three-tier Stripe subscription billing | Stripe Checkout + single product/plan, or Payment Links | You have more than one real pricing tier with different feature access |
| Custom capability-gated navigation | Simple `role`-based nav item visibility | Same trigger as RBAC above |
| `localForage`/IndexedDB caching | `swr`/React Query in-memory cache; add IndexedDB only for specific offline needs, encrypted if sensitive | Confirmed offline-first requirement |
| Contentlayer/MDX content system | Plain Markdown + a simple frontmatter parser, or a headless CMS if non-engineers write content | Content volume/editorial workflow justifies it |

---

## 12. Minimum Viable, Production-Ready Starting Point

```
my-mvp/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── auth/{sign-in,sign-up,callback}/
│   │   ├── onboarding/
│   │   ├── [orgSlug]/
│   │   │   ├── layout.tsx              # session + membership + role guard
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts              # requireSession → assertRole → validate → write
│   │   │   ├── queries.ts
│   │   │   └── settings/ billing/ (feature folders as needed)
│   │   └── api/
│   │       ├── webhooks/stripe/route.ts
│   │       └── cron/<job>/route.ts     # hands off to queue immediately
│   ├── core/
│   │   ├── db/{server,middleware,browser,admin}.ts
│   │   ├── session.ts
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   ├── rate-limit.ts
│   │   └── env.ts
│   ├── lib/
│   │   ├── organizations/{schema,queries,mutations,service}.ts
│   │   ├── billing/{schema,queries,mutations,service}.ts
│   │   └── <feature>/...
│   ├── components/
│   └── middleware.ts
├── supabase/migrations/  (or drizzle/)
├── e2e/
├── .env.example
└── RUNBOOK.md
```

This starting point keeps every proven, load-bearing pattern from the reference app — tenant-scoped routing, per-context DB clients, RLS from day one, the `requireSession → assertRole → validate → write` mutation pattern, UTC-anchored dates, a single source of truth for business math — while deliberately deferring the patterns that only pay for themselves at much larger scale (granular capability matrices, monolithic client caches, multi-integration pipelines, full i18n, and multi-tier billing).

**Build in this order**: auth + org model + RLS → core domain CRUD with the mutation pattern → billing (Checkout only) → observability (Sentry + health check) → background jobs (only once you have a real async need) → public API (only if a customer needs it).
