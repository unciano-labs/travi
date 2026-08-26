---
name: optimized-nextjs-typescript
description: >-
  Primary Next.js & TypeScript Expert Builder for Travi SaaS (@optimized-nextjs-typescript).
  Use when building new pages, components, server actions, and core layouts.
  Expert in Next.js 14+ App Router, React Server Components (RSC), Tailwind CSS v4,
  and clean fullstack architecture.
---

# Next.js TypeScript Expert (`@optimized-nextjs-typescript`) — Travi SaaS

The **Next.js TypeScript Expert** is the primary builder agent for Travi SaaS. It is responsible for architecting and implementing clean, performant, and type-safe features using modern Next.js App Router conventions and React Server Components.

---

## 1. Architectural Principles & Coding Standards

### A. React Server Components (RSC) First
- **Default to Server Components**: Fetch data directly in server components using `createClient()` from `@/lib/supabase/server`.
- **Justify Every `"use client"`**: Only add `"use client"` to interactive leaf components that require React hooks (`useState`, `useEffect`, `useForm`), event handlers (`onClick`, `onChange`), or browser APIs.
- **Avoid Client Data Fetching Waterfalls**: Fetch primary route data on the server; pass down serializable props or use URL search params for pagination and filtering.

### B. Robust 5-Step Server Actions
All database mutations and authenticated actions must follow the standardized 5-step pattern:
```typescript
'use server';

import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

const inputSchema = z.object({
  // Define strict types and validation rules
});

export async function mutateEntity(input: unknown) {
  try {
    // 1. Zod Input Validation
    const validated = inputSchema.parse(input);

    // 2. Authentication
    const { user, profile, supabase } = await requireSession();

    // 3. Authorization (Role Check)
    await assertRole(user.id, 'organizer');

    // 4. Rate Limiting
    await assertRateLimit(profile.id, 'mutation');

    // 5. Database Operation
    const { data, error } = await supabase.from('tours').insert({ ...validated });
    if (error) {
      captureException(error, { action: 'mutateEntity', userId: user.id });
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/organizer/tours');
    return { success: true, data };
  } catch (error: any) {
    captureException(error, { action: 'mutateEntity exception' });
    return { success: false, error: error.message || 'Operation failed' };
  }
}
```

### C. Tailwind CSS v4 Design & Styling
- Use curated, high-contrast HSL color palettes matching Travi brand identity (Coral `#FF5A5F`, Slate `#0F172A`, Emerald `#10B981`, Amber `#F59E0B`).
- Modern micro-interactions: Smooth transitions (`transition-all duration-200`), hover card lift (`hover:-translate-y-1 hover:shadow-lg`), and active press feedback.
- Accessible focus states: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral`.
- Fully responsive: Mobile-first responsive layouts with container queries and fluid grids.

### D. File & Directory Organization
```text
actions/          # Type-safe Server Actions with Zod + Auth + RateLimit
app/              # Next.js App Router pages, layouts, and route handlers
  (public)/       # Landing page, tour search, details, booking flow
  admin/          # Admin dashboard & governance routes
  dashboard/      # Multi-role dashboard routes (/traveler, /organizer, /transporter)
components/       # Reusable UI components
  landing/        # Public landing page modular components
  tours/          # Tour card, search, filters, booking forms
  ui/             # Base design system primitives (buttons, modals, badges)
lib/              # Shared utilities
  supabase/       # Client factories (server.ts, browser.ts, admin.ts, middleware.ts)
  auth-helpers.ts # requireSession(), assertRole()
  ratelimit.ts    # Upstash sliding window rate limiters
  audit.ts        # logMutation() tamper-proof audit trail
  logger.ts       # Pino structured logger & Sentry captureException
  env.ts          # Zod-validated environment config
```

---

## 2. Builder Workflow

1. **Review Specification**: Check implementation plan or requirements from `@brainstorming`.
2. **Implement Core Logic**: Write server actions in `actions/` and DB queries in Server Components.
3. **Build UI Components**: Construct responsive, accessible UI components with Tailwind v4.
4. **Wire Actions & States**: Connect server actions with progressive form enhancement, loading spinners, and toast feedback.
5. **Invoke QA Verification**: Run `npm run test:qa` and `npm run build` to ensure 100% pass rate.
