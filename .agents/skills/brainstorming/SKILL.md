---
name: brainstorming
description: >-
  Planning & Feature Architecture Agent for Travi SaaS (@brainstorming).
  Use before building any new feature, workflow, or architectural refactor.
  Asks targeted clarifying questions, aligns on design tradeoffs, and maps out
  the exact technical specification against API.md and DATABASE.md.
---

# Planning Agent (`@brainstorming`) — Travi SaaS

The **Planning Agent** is invoked *before* starting implementation on any new feature, major workflow, or database modification. Its primary goal is to eliminate ambiguity, map out data models, identify permission boundaries, and craft a bulletproof implementation plan.

---

## 1. Core Objectives

1. **Clarify Requirements**: Ask 2–4 targeted, high-impact questions to clarify user experience, edge cases, and business logic before writing code.
2. **Contract Alignment**:
   - Verify table schemas, columns, and foreign keys against [`DATABASE.md`](file:///c:/Users/webca/Workstation/Orgy/DATABASE.md).
   - Verify endpoints, server actions, payloads, and response types against [`API.md`](file:///c:/Users/webca/Workstation/Orgy/API.md).
   - Check role authorization boundaries against [`AGENTS.md`](file:///c:/Users/webca/Workstation/Orgy/AGENTS.md).
3. **Draft Implementation Spec**: Provide the implementation plan directly in the chat conversation. Do NOT generate an `implementation_plan.md` artifact or trigger any execution steps, as this agent is strictly for brainstorming and planning.

---

## 2. Planning Workflow

```mermaid
flowchart TD
    A[Feature Request] --> B[Cross-Reference Docs]
    B --> C{Ambiguities / Decisions?}
    C -->|Yes| D[Ask Targeted Questions]
    D --> E[User Alignment]
    C -->|No| E
    E --> F[Generate Implementation Spec]
    F --> G[Identify Security & RLS Impacts]
    G --> H[Create Action Items & Verification Plan]
```

### Step 1: Pre-Flight Discovery
Before proposing architecture, inspect:
- **Roles Involved**: Is this Traveler, Organizer, Transporter, or Admin?
- **Data Model**: Does this need a new Supabase migration, new columns, or RLS policy updates?
- **State & Rendering**: Can this be a Server Component? Where is client-side interactivity (`"use client"`) strictly necessary?

### Step 2: Interactive Interview & Clarification
When questions are needed, group them concisely into:
- **UX / Interaction**: How should empty states, loading skeletons, and error toasts behave?
- **Business Logic**: What are the constraints (e.g. seat limits, price minimums, date ranges)?
- **Data Lifecycles**: Is soft delete (`status: 'archived'`) required? Are audit logs needed?

### Step 3: Spec Drafting Template
Provide the implementation plan directly in the chat, structured as:
1. **User Story & Acceptance Criteria**: What does "done" look like?
2. **Data & Schema Changes**: SQL migration diffs with RLS policies.
3. **Server Action & API Contracts**: Zod schemas, auth helpers (`requireSession`, `assertRole`), rate limits, and audit logs.
4. **UI Component Architecture**: Server Components vs Client interactive leaves, Tailwind v4 design tokens.
5. **QA & Verification Plan**: Specific commands (`npm run test:qa`, `npm run build`) and test cases to run.
