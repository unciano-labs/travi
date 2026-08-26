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
- [x] Transporter vehicle management & fleet operations (TRANSPORTER.md)
- [ ] Traveler booking flow

## 8. Specialized Agent Roster

| Agent / Alias | Role & Specialty | When to Invoke | Skill Location |
|---|---|---|---|
| **Planning Agent** (`@brainstorming`) | Feature architecture, interactive clarifying interview, technical spec mapping against `API.md` & `DATABASE.md`. | Before building any new feature or major workflow. | [`.agents/skills/brainstorming/SKILL.md`](file:///.agents/skills/brainstorming/SKILL.md) |
| **Next.js TypeScript Expert** (`@optimized-nextjs-typescript`) | Main fullstack builder. Next.js 14+ App Router, RSC, Tailwind CSS v4, and strict Server Action mutation patterns. | When implementing components, routes, database mutations, and styling. | [`.agents/skills/optimized-nextjs-typescript/SKILL.md`](file:///.agents/skills/optimized-nextjs-typescript/SKILL.md) |
| **Linting & Code Review** (`@lint-and-validate`) | Static analysis, code reviewer, WCAG 2.1 AA accessibility auditor, and edge-case detector. | Continuous lane during development and before finalizing pull requests. | [`.agents/skills/lint-and-validate/SKILL.md`](file:///.agents/skills/lint-and-validate/SKILL.md) |
| **System Debugger** (`@systematic-debugging`) | Hydration mismatch fixer, SSR/CSR desync resolver, Supabase cookie auth troubleshooter, and Turbopack compiler error analyst. | When encountering runtime errors, hydration mismatches, or build breaks. | [`.agents/skills/systematic-debugging/SKILL.md`](file:///.agents/skills/systematic-debugging/SKILL.md) |
| **QA Tester Agent** (`@qa-tester`) | Test automation engineer, smoke testing, RBAC security verification, and defect reporting. | Mandatory invocation after any code changes are made (`npm run test:qa`). | [`.agents/skills/qa-tester/SKILL.md`](file:///.agents/skills/qa-tester/SKILL.md) |
| **Playwright Agent** (`@playwright-agent`) | Cross-browser End-to-End automation, user journey simulation, and visual regression tester. | When creating or executing browser E2E test suites (`npm run test:e2e`). | [`.agents/skills/playwright-agent/SKILL.md`](file:///.agents/skills/playwright-agent/SKILL.md) |
| **Technical SEO Agent** (`@technical-seo`) | Dynamic metadata, JSON-LD structured data, sitemaps, robots.ts, and Core Web Vitals optimization. | When building public routes, adding metadata, or auditing organic search ranking signals. | [`.agents/skills/technical-seo/SKILL.md`](file:///.agents/skills/technical-seo/SKILL.md) |
| **UI/UX Designer Agent** (`@ui-ux-designer`) | UI consistency, layout system design, Tailwind CSS v4 styling, component micro-interactions, and accessibility aesthetics. | When creating new interfaces, improving user experience, or auditing visual consistency across pages. | [`.agents/skills/ui-ux-designer/SKILL.md`](file:///.agents/skills/ui-ux-designer/SKILL.md) |

---

## 9. Agent Rules

### ALWAYS Do
- Default to Server Components; justify every `"use client"`
- Add empty state for every list view
- Use Tailwind v4 styling (no tailwind.config.ts)
- **Invoke QA Tester Agent**: After any code changes are made, ALWAYS run QA verification (`npm run test:qa` and `npm run build`) using the [`qa-tester`](file:///.agents/skills/qa-tester/SKILL.md) skill protocols before concluding your turn or declaring tasks complete. Ensure 100% test pass rate and zero regressions.

