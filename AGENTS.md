<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Travi SaaS
# Travel Tour & Transportation Marketplace

> **Stack:** Next.js 14 (App Router) · React 18 · Tailwind CSS v4 · Node.js API Routes · Supabase · Vercel
> **Last updated:** 2026-08-24

---

## Quick Links

| Document | Contents |
|---|---|
| **AGENTS.md** ← you are here | Product summary, roles, MVP scope, dev phases, agent rules |
| [DATABASE.md](./DATABASE.md) | DB schema, table definitions, status enums, business rules, RLS, migrations |
| [API.md](./API.md) | Functional requirements, API endpoints, acceptance criteria |

---

## 1. Product Summary

Travi is a travel marketplace where:
- **Travelers** browse and book tour packages
- **Organizers** create and manage tours (individuals or companies)
- **Transporters** offer vehicles and manage availability (individuals or companies)
- **Admins** approve organizers/transporters and moderate the platform

---

## 2. Roles & Permissions

| Action | Traveler | Organizer | Transporter | Admin |
|---|:---:|:---:|:---:|:---:|
| Register / Login | ✅ | ✅ | ✅ | ✅ |
| Browse & view tours | ✅ | ✅ | ✅ | ✅ |
| Book & pay for tours | ✅ | ❌ | ❌ | ❌ |
| Submit reviews | ✅ | ❌ | ❌ | ❌ |
| Create / edit own tours | ❌ | ✅ | ❌ | ❌ |
| View tour bookings | ❌ | Own only | ❌ | ✅ |
| List / manage vehicles | ❌ | Optional | ✅ | ❌ |
| Receive transport requests | ❌ | ❌ | ✅ | ❌ |
| Accept / decline requests | ❌ | ❌ | ✅ | ❌ |
| Approve organizers/transporters | ❌ | ❌ | ❌ | ✅ |
| Moderate reviews | ❌ | ❌ | ❌ | ✅ |

---

## 7. Development Phases

### Phase 1 — Project Scaffold
- [x] `npm run dev` starts on `localhost:3000`
- [x] `npm run build` — zero TypeScript errors
- [x] `npm run lint` — zero errors

### Phase 5 — Core UI System & Landing Page
- [x] Build landing page UI with Tailwind v4
- [x] Build modular components in `components/landing/`

### Phase 6 — Admin Dashboard Shell & Authentication (Mock Data)
- [x] Protected layout with sidebar + topbar
- [x] Middleware intercepts `/admin`
- [x] Admin Dashboard Overview with metrics
- [x] Organizers, Transporters, Tours, Bookings, Reviews pages (mock tables)

### Phase 7 — Supabase Database Integration
- [x] Connect Supabase
- [x] Implement robust auth (`@supabase/ssr`) with multi-role system
- [ ] Replace mock admin tables with real DB data

### Phase 8 — User/Organizer Features (MVP)
- [x] Single-account role switching (Traveler, Organizer, Transporter)
- [x] Organizer & Transporter seamless onboarding
- [ ] Organizer tour CRUD
- [ ] Transporter vehicle management
- [ ] Traveler booking flow

---

## 9. Agent Rules

### ALWAYS Do
- Default to Server Components; justify every `"use client"`
- Add empty state for every list view
- Use Tailwind v4 styling (no tailwind.config.ts)
