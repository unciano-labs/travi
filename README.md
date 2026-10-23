# Travi

A Philippine tour and transport marketplace. Travelers book seats on dated tours and pay with GCash or Maya (PayMongo). Organizers publish tours and earn through escrow. Transporters list vehicles and accept transport requests. Admins approve partners, moderate content, resolve disputes and pay out.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Supabase (Postgres, Auth, Storage, RLS) and PayMongo.

> **Working on the code?** Read [AGENTS.md](AGENTS.md) first. It is the operating manual: architecture, coding rules, domain rules, security, and the QA gate every change must pass.

## Getting started

Requirements: Node 24 and npm.

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

There is no local Supabase stack. The app runs against a Supabase project, so `.env.local` needs at least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Every variable is documented in [.env.example](.env.example) and validated at startup by [lib/env.ts](lib/env.ts).

Without `PAYMONGO_SECRET_KEY`, payments run in mock mode (local development only). Without `RESEND_API_KEY`, emails are logged instead of sent. Without the Upstash variables, rate limiting is off.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build and type-check |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run test:unit` | Unit tests (vitest) |
| `npm run test:rls` | Database tests: replays every migration in an in-process Postgres (PGlite) and checks RLS, triggers and money functions. No database needed |
| `npm run test:qa` | Read-only smoke checks against the Supabase project in `.env.local` |
| `npm run test:e2e` | Playwright end-to-end tests |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, type-check, unit tests, database tests and the build on every pull request and on pushes to `main`.

## Project layout

| Path | Contents |
|---|---|
| `app/` | Routes (App Router): landing, catalog, tour pages, booking and payment, dashboards, admin console, legal pages, webhook and cron handlers |
| `actions/` | Server Actions, one file per domain |
| `components/` | UI, grouped by area; `components/ui/` is the shared kit |
| `lib/` | Supabase clients, services, schemas, data readers, email, payments, helpers |
| `supabase/migrations/` | Database schema (append-only) |
| `supabase/tests/rls/` | Database test harness |
| `docs/` | Specs, launch readiness plan and roadmap |

## Database changes

Schema changes are new files in `supabase/migrations/`. Applying them to the shared Supabase project (`npx supabase db push`) needs a human's approval. See AGENTS.md §3.6.

## Deployment

Hosted on Vercel. Cron schedules are in [vercel.json](vercel.json). The launch checklist and the steps that need a human (migrations, PayMongo go-live, email domain, legal review) are in [docs/MVP_LAUNCH_READINESS.md](docs/MVP_LAUNCH_READINESS.md).
