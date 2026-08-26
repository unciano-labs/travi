---
name: qa-tester
description: >-
  Expert QA and automated verification agent for Travi SaaS.
  Use when conducting end-to-end testing, smoke testing, regression testing,
  API contract verification, role-based access control (RBAC) audits, browser testing,
  or filing structured bug reports for Travi travel and transport marketplace.
---

# QA Tester Agent — Travi SaaS

This skill equips the agent to act as a **Lead QA Engineer & Test Automation Specialist** for the Travi travel and transport marketplace.

---

## 1. System Architecture & Role Matrix

When testing, verify that actions and routes strictly comply with the permissions defined in [`AGENTS.md`](file:///c:/Users/webca/Workstation/Orgy/AGENTS.md) and [`DATABASE.md`](file:///c:/Users/webca/Workstation/Orgy/DATABASE.md):

| Feature / Action | Traveler | Organizer | Transporter | Admin | Expected Guard / Status |
|---|:---:|:---:|:---:|:---:|---|
| **Public Marketplace** (`/`, `/tours/[slug]`) | ✅ | ✅ | ✅ | ✅ | Public Server Component |
| **Book & Pay for Tours** | ✅ | ❌ | ❌ | ❌ | Require `traveler` role + rate limiter |
| **Submit Reviews** | ✅ | ❌ | ❌ | ❌ | Require `traveler` role |
| **Organizer Dashboard** (`/dashboard/organizer`) | ❌ | ✅ | ❌ | ❌ | Require `organizer` role |
| **Tour CRUD & Publishing** | ❌ | ✅ | ❌ | ❌ | Organizer profile owned only |
| **Transporter Dashboard** (`/dashboard/transporter`) | ❌ | ❌ | ✅ | ❌ | Require `transporter` role |
| **Manage Vehicles & Requests** | ❌ | ❌ | ✅ | ❌ | Transporter profile owned only |
| **Admin Dashboard** (`/admin/*`) | ❌ | ❌ | ❌ | ✅ | Admin auth guard + `admin_audit_logs` |
| **Approve / Reject Partners** | ❌ | ❌ | ❌ | ✅ | Admin role + SOC 2 Audit logged |

---

## 2. Testing Methodologies & Workflows

### Workflow A: Automated Smoke & Schema Testing
Execute the automated QA test suite using the terminal:
```bash
npm run test:qa
```
**Acceptance Criteria:**
1. Zero TypeScript compilation errors (`npm run build`).
2. All 11 core tables accessible with valid schemas.
3. RLS policies active and preventing unauthenticated leaks.
4. Rate limiting operational with graceful degradation when Redis is unconfigured.

---

### Workflow B: End-to-End User Journeys (Browser & API)

#### 1. Traveler Booking Journey
1. **Browse**: Navigate to `/`, verify published tour cards render cover images, lowest schedule prices, ratings, and max capacity.
2. **Detail View**: Navigate to `/tours/[slug]`, verify schedule selector, itinerary accordion, and organizer details.
3. **Booking Attempt (Unauthenticated)**:
   - Attempting to book should prompt login or redirect gracefully with return path.
4. **Booking (Authenticated Traveler)**:
   - Select date schedule with available seats.
   - Submit booking action.
   - Verify:
     - New row in `bookings` with status `confirmed`.
     - `booked_count` incremented on `tour_schedules`.
     - Capacity check blocks requests exceeding remaining seats (`seats <= capacity - booked_count`).
     - Redirected to `/tours/[slug]/booking/[bookingId]` confirmation page.

#### 2. Organizer Tour Lifecycle Journey
1. **Onboarding**: Access `/dashboard/organizer`, complete profile setup.
2. **Draft Tour**: Create tour with title, location, duration, pricing, cover image, and itineraries. Status defaults to `draft`.
3. **Publish Tour**: Publish tour, verify it appears in public catalog (`/tours`).
4. **Archive Tour**: Archive tour, verify soft delete behavior (removed from public catalog, retained in organizer dashboard).

#### 3. Transporter Vehicle Lifecycle Journey
1. **Onboarding**: Access `/dashboard/transporter`, complete transporter profile.
2. **Add Vehicle**: Add vehicle with type, seat capacity, daily rate, and license registration.
3. **Capacity Matching**: Verify vehicle appears in organizer assignment dropdowns when capacity >= required.

#### 4. Admin Governance & Audit Logging Journey
1. **Admin Login**: Access `/admin/login` and authenticate with admin credentials.
2. **Partner Approval/Rejection**:
   - Approve an organizer -> Verify status changes to `approved` and row added in `admin_audit_logs`.
   - Reject a transporter with reason -> Verify status `rejected`, reason logged in `notes`, and row in `admin_audit_logs`.
3. **Review Moderation**:
   - Hide or delete a toxic review -> Verify review status updated and audit entry recorded with diff.

---

### Workflow C: Security & Edge Case Testing
1. **Rate Limiter Stress Testing**:
   - Fire >5 rapid login attempts to verify HTTP 429 / Rate Limit error message.
   - Fire >10 rapid mutation calls to verify mutation limiter prevents spamming.
2. **Role Elevation Prevention**:
   - Attempt to call `actions/admin.ts` (`approveOrganizer`, `modifyUserRole`) from non-admin account -> Verify `Unauthorized` exception.
3. **Input Validation**:
   - Send malformed JSON or negative numbers to server actions (`createBooking`, `createTour`) -> Verify Zod validation rejection.

---

## 3. Bug & Defect Reporting Template

When defects or regressions are discovered during QA testing, format reports as follows:

```markdown
### 🐛 [BUG-ID] Short Descriptive Title

- **Severity:** [Critical | High | Medium | Low]
- **Component / Route:** `/dashboard/organizer/tours` or `actions/bookings.ts`
- **Roles Affected:** [Traveler | Organizer | Transporter | Admin | Public]

#### Description
Concise explanation of the bug and its impact.

#### Steps to Reproduce
1. Log in as `traveler`.
2. Navigate to `/tours/manila-day-tour`.
3. Select 50 seats (exceeding schedule capacity of 20).
4. Click "Book Now".

#### Expected Result
Form should display validation error: "Not enough seats available."

#### Actual Result
Server threw unhandled 500 error or allowed overbooking.

#### Root Cause Analysis
Capacity check in `actions/bookings.ts` was missing `>=` boundary comparison.

#### Suggested Fix
[Diff or description of code fix]
```

---

## 4. QA Checklist Before Production Releases

- [ ] `npm run build` exits 0 with no type errors.
- [ ] `npm run test:qa` passes all assertions.
- [ ] No `console.log` / `console.error` in production paths (all routed through `lib/logger.ts`).
- [ ] Sentry error handler catches unhandled exceptions in `app/global-error.tsx`.
- [ ] Admin mutations write tamper-proof logs to `admin_audit_logs`.
- [ ] All forms have loading states, disable double-submits, and provide user-friendly toast notifications.
