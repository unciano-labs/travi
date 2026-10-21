# Implementation Plan: Final Phases (Admin Data & Traveler Flow)

This document outlines the structured execution plan to complete Phase 7 (Admin DB Integration) and Phase 8 (Traveler Booking Flow). 

## User Review Required
> [!IMPORTANT]
> Please review this plan. Once approved, I will begin executing the steps sequentially and tracking them in a living `task.md` document.

## Open Questions
> [!NOTE]
> 1. Do we need an actual payment integration (like Stripe) right now for the Traveler booking flow, or should the "Book Now" button immediately set the booking status to `pending`/`confirmed` for this MVP phase?
> 2. For the Admin dashboard actions, should we build Server Actions to handle approval/rejections, or keep them client-side using Supabase client? (I recommend Server Actions for security).

---

## Proposed Changes

### 1. Admin Dashboard Data Integration (Phase 7)
Replace the hardcoded mock data arrays across the `/app/admin/*` routes with real Supabase queries.

#### [MODIFY] `app/admin/organizers/page.tsx`
- **Changes**: 
  - Fetch `organizer_profiles` joining `user_profiles(email)`.
  - Implement Server Actions in `actions/admin.ts` to `approve` or `reject` organizer applications.

#### [MODIFY] `app/admin/transporters/page.tsx`
- **Changes**: 
  - Fetch `transporter_profiles` joining `user_profiles(email)`.
  - Wire up the Approve/Reject buttons to Server Actions.

#### [MODIFY] `app/admin/tours/page.tsx`
- **Changes**: 
  - Fetch `tours` joining `organizer_profiles(company_name, display_name)`.

#### [MODIFY] `app/admin/bookings/page.tsx`
- **Changes**: 
  - Fetch `bookings` joining `tour_schedules`, `tours`, and `user_profiles` to show a global overview of all platform bookings.

#### [MODIFY] `app/admin/reviews/page.tsx`
- **Changes**: 
  - Fetch `reviews` and wire up a moderation action (e.g., `hide` or `delete` review).

---

### 2. Traveler Booking Flow (Phase 8 MVP)
Build the public-facing UI and logic for Travelers to browse and book tours.

#### [NEW] `app/tours/page.tsx`
- **Changes**: 
  - Create the main Tour Discovery page.
  - Implement a grid displaying all active tours.
  - Include basic filtering (e.g., location or keyword search).

#### [NEW] `app/tours/[slug]/page.tsx`
- **Changes**: 
  - Create the public Tour Details page.
  - Display the tour's image gallery, description, itineraries, and policies.
  - Show a list/calendar of `open` schedules available for booking.
  - Add a "Select & Book" button that leads to the booking checkout form.

#### [NEW] `app/tours/[slug]/booking/[scheduleId]/page.tsx`
- **Changes**: 
  - Create the Booking/Checkout page.
  - Form to input the number of seats (up to the remaining capacity).
  - Calculate total price.
  - Submit the booking via the existing `POST /api/bookings` route or a new Server Action.

#### [MODIFY] `app/dashboard/traveler/bookings/page.tsx`
- **Changes**: 
  - Ensure travelers can view their own confirmed and past trips.

---

## Verification Plan

### Automated Tests
- Run `npm run lint` and `npm run build` after completing the Admin integration to ensure TypeScript types match the Supabase responses.
- After implementing the booking flow, use `@qa-tester` to simulate a traveler booking a tour and verify the DB triggers work flawlessly.

### Manual Verification
- Log in as the `Admin` to approve an organizer and a transporter.
- Navigate to the public `/tours` page, click a tour, and successfully complete a booking as a traveler.
- Verify the booked seats reflect correctly on the Organizer's dashboard.
