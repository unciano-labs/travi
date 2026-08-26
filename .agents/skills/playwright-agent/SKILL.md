---
name: playwright-agent
description: >-
  Playwright End-to-End & Browser Automation Specialist (@playwright-agent).
  Use to create, execute, maintain, and debug cross-browser automated E2E tests,
  visual regression checks, and user journey workflows for Travi SaaS.
---

# Playwright Agent (`@playwright-agent`) — Travi SaaS

The **Playwright Agent** specializes in authoring, running, and maintaining high-fidelity End-to-End (E2E) browser tests for the Travi travel and transport marketplace using `@playwright/test`.

---

## 1. Test Suite Commands & Execution

| Command | Purpose |
|---|---|
| `npm run test:e2e` | Run all E2E specs in headless mode against `localhost:3000`. |
| `npx playwright test e2e/smoke.spec.ts` | Run a specific test spec. |
| `npm run test:e2e:ui` | Open the interactive Playwright UI mode for live debugging. |
| `npx playwright show-report` | View the generated HTML test report with trace recordings. |
| `npx playwright show-trace test-results/.../trace.zip` | Step through recorded DOM snapshots, network requests, and console logs. |

---

## 2. Testing Best Practices & Locator Strategy

### A. Resilient User-Facing Locators
Always prioritize locators that reflect real user interaction over brittle CSS or XPath selectors:
```typescript
// ✅ RECOMMENDED: Accessible, role-based locators
page.getByRole('button', { name: /book now/i });
page.getByRole('heading', { level: 1, name: /discover/i });
page.getByLabel(/number of seats/i);
page.getByPlaceholder(/search destinations/i);

// ⚠️ FALLBACK: Test IDs or dedicated data attributes
page.getByTestId('tour-booking-card');
```

### B. Route Protection & Auth Guard Verification
Validate that unauthenticated requests to protected zones immediately redirect to the appropriate login portal:
```typescript
test('Redirects unauthenticated admin to /admin/login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});
```

### C. Multi-Role Testing with Authenticated State
To test authenticated traveler, organizer, or admin workflows without repetitive login forms, use Playwright storage state fixtures:
```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill('admin@travi.com');
  await page.getByLabel(/password/i).fill('AdminPassword123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/admin');
  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});
```

---

## 3. Playwright Troubleshooting & Failure Triage

When a test fails:
1. **Inspect Failure Artifacts**: Check `test-results/` for screenshots, failure videos, and trace archives (`trace.zip`).
2. **Check Server State**: Ensure the Next.js dev server is running on `http://localhost:3000` (handled automatically via `webServer` in [`playwright.config.ts`](file:///c:/Users/webca/Workstation/Orgy/playwright.config.ts)).
3. **Verify Asynchronous Timing**: Avoid arbitrary `page.waitForTimeout()`; use auto-waiting assertions:
   ```typescript
   // ✅ Auto-waits up to timeout for element to be visible and stable
   await expect(page.getByText('Booking Confirmed')).toBeVisible({ timeout: 5000 });
   ```
