# API.md — Travi SaaS
# Functional Requirements & API Specification

> Stack: Next.js API Routes (Node.js) + Supabase
> See also: [AGENTS.md](../AGENTS.md) | [DATABASE.md](./DATABASE.md)

---

## Table of Contents
1. [Functional Requirements](#1-functional-requirements)
2. [API Conventions](#2-api-conventions)
3. [API Endpoints](#3-api-endpoints)
4. [Acceptance Criteria](#4-acceptance-criteria)

---

## 1. Functional Requirements

### Authentication
| ID | Requirement | Priority |
|---|---|---|
| AUTH-001 | Register with name, email, password, role | Must-have |
| AUTH-002 | Login with email and password | Must-have |
| AUTH-003 | Google OAuth login | Must-have |
| AUTH-004 | Roles: traveler, organizer, transporter, admin | Must-have |
| AUTH-005 | Role-based access control on all pages | Must-have |
| AUTH-006 | Update profile information | Must-have |
| AUTH-007 | Reset forgotten password | Nice-to-have |

### Organizer
| ID | Requirement | Priority |
|---|---|---|
| ORG-001 | Create organizer profile after registration | Must-have |
| ORG-002 | Profile type: individual or company | Must-have |
| ORG-003 | company_name required if type = company | Must-have |
| ORG-004 | Profile fields: display_name, phone, description | Must-have |
| ORG-005 | Admin approval required before publishing tours | Must-have |
| ORG-006 | Optional: enable "Provides transportation" flag | Must-have |

### Transporter
| ID | Requirement | Priority |
|---|---|---|
| TRP-001 | Create transporter profile after registration | Must-have |
| TRP-002 | Profile type: individual or company | Must-have |
| TRP-003 | company_name required if type = company | Must-have |
| TRP-004 | Profile fields: display_name, phone, description, service_areas | Must-have |
| TRP-005 | Admin approval required before listing vehicles | Must-have |
| TRP-006 | Display average_rating and review_count on profile | Must-have |

### Tours
| ID | Requirement | Priority |
|---|---|---|
| TOUR-001 | Approved organizer can create a tour | Must-have |
| TOUR-002 | Required: title, location, description, price, days, capacity | Must-have |
| TOUR-003 | Include accommodation details | Must-have |
| TOUR-004 | Include travel time information | Must-have |
| TOUR-005 | Day-wise itinerary | Must-have |
| TOUR-006 | Save as draft or publish | Must-have |
| TOUR-007 | Only published tours visible to travelers | Must-have |
| TOUR-009 | Transport type: none / self_provided / external_transporter | Must-have |
| TOUR-011 | Prevent booking when capacity is full | Must-have |
| TOUR-012 | Prevent booking when start date is past | Must-have |

### Bookings
| ID | Requirement | Priority |
|---|---|---|
| BOOK-001 | Logged-in traveler can book a published tour | Must-have |
| BOOK-002 | Select number of seats | Must-have |
| BOOK-003 | Total amount = price × seats | Must-have |
| BOOK-004 | Validate capacity before booking | Must-have |
| BOOK-005 | Status = pending before payment | Must-have |
| BOOK-006 | Status = confirmed after successful payment | Must-have |
| BOOK-007 | booked_count increments on confirmed booking | Must-have |
| BOOK-008 | Traveler can view booking history | Must-have |

### Vehicles
| ID | Requirement | Priority |
|---|---|---|
| VEH-001 | Approved transporter can add vehicles | Must-have |
| VEH-002 | Required: name, type, seat_capacity, status | Must-have |
| VEH-003 | Optional: photos, description, plate_number, rate_per_day | Must-have |
| VEH-004 | Transporter can edit and deactivate vehicles | Must-have |
| VEH-005 | Vehicle availability management (date ranges) | Must-have |
| VEH-006 | Inactive vehicles cannot be requested | Must-have |

### Vehicle Availability
| ID | Requirement | Priority |
|---|---|---|
| AVAIL-001 | Transporter sets available date ranges per vehicle | Must-have |
| AVAIL-002 | System detects date range conflicts | Must-have |
| AVAIL-003 | Accepted transport booking blocks availability | Must-have |
| AVAIL-004 | Organizer can filter transporters by available dates | Must-have |

### Transport Requests
| ID | Requirement | Priority |
|---|---|---|
| TREQ-001 | Organizer can send transport request to a transporter | Must-have |
| TREQ-002 | Request includes: tour, vehicle, dates, seats, pickup/dropoff | Must-have |
| TREQ-003 | Request starts as pending | Must-have |
| TREQ-004 | Transporter can accept or decline | Must-have |
| TREQ-005 | Accepting blocks vehicle availability | Must-have |
| TREQ-006 | Tour transport_status updates on accept/decline | Must-have |

### Reviews
| ID | Requirement | Priority |
|---|---|---|
| REV-001 | Review only allowed after completed transport booking | Must-have |
| REV-002 | Rating 1–5 + optional comment | Must-have |
| REV-003 | Transporter average_rating auto-updates | Must-have |
| REV-004 | Admin can hide/moderate reviews | Must-have |

### Admin
| ID | Requirement | Priority |
|---|---|---|
| ADM-001 | Approve or reject organizers | Must-have |
| ADM-002 | Approve or reject transporters | Must-have |
| ADM-003 | Monitor all tours, bookings, transport requests | Must-have |
| ADM-004 | Moderate reviews | Must-have |
| ADM-005 | Audit log for all admin actions | Must-have |

---

## 2. API Conventions

### Base URL
```
/api/v1/
```

### Response Shape (always use this)
```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: string, code?: string }
```

### Status Codes
| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthenticated |
| 403 | Unauthorized (wrong role) |
| 404 | Not found |
| 409 | Conflict (e.g. capacity full, vehicle not available) |
| 500 | Internal server error |

### Authentication
All protected routes require a valid Supabase session cookie.
Always verify with `supabase.auth.getUser()` — never trust headers directly.

### Route Template
```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const schema = z.object({ /* ... */ })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message }, { status: 400 }
    )

    const { data, error } = await supabase.from('table').insert(parsed.data).select().single()
    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error('[API]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## 3. API Endpoints

> **Not implemented at launch (decision D6).** The web app uses Server Actions, not these routes. The early Bearer-token routes (`/api/bookings`, `/api/tours`, `/api/organizers`, `/api/profile`) were removed before launch and will come back as a versioned mobile API post-launch. The only live route handlers are `/api/webhooks/paymongo`, `/api/cron/*` and `/api/admin/export/[kind]`. This table is the original spec.

### Auth
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/signup` | Register new user | No |
| POST | `/api/auth/login` | Email/password login | No |
| POST | `/api/auth/logout` | Logout | Yes |
| GET | `/api/auth/callback` | OAuth callback handler | No |

### Profiles
| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/profile` | Get own profile | Yes |
| PATCH | `/api/profile` | Update own profile | Yes |

### Organizers
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/organizers` | Create organizer profile | Yes (traveler/organizer) |
| GET | `/api/organizers/:id` | Get public organizer profile | No |
| PATCH | `/api/organizers/:id` | Update own organizer profile | Yes (organizer) |

### Tours
| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/tours` | List published tours (with filters) | No |
| POST | `/api/tours` | Create tour | Yes (organizer, approved) |
| GET | `/api/tours/:id` | Get tour details | No |
| PATCH | `/api/tours/:id` | Update tour | Yes (organizer, own) |
| DELETE | `/api/tours/:id` | Archive tour | Yes (organizer, own) |
| GET | `/api/tours/:id/bookings` | List tour bookings | Yes (organizer, own) |

### Tour Itineraries
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/tours/:id/itinerary` | Add itinerary item | Yes (organizer, own) |
| PATCH | `/api/itinerary/:id` | Update item | Yes (organizer, own) |
| DELETE | `/api/itinerary/:id` | Remove item | Yes (organizer, own) |

### Bookings
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/bookings` | Create booking (pending payment) | Yes (traveler) |
| GET | `/api/bookings` | List own bookings | Yes (traveler) |
| GET | `/api/bookings/:id` | Get booking details | Yes |
| POST | `/api/bookings/:id/confirm` | Confirm after payment | Yes (system/webhook) |

### Transporters
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/transporters` | Create transporter profile | Yes |
| GET | `/api/transporters` | List approved transporters (with filters) | No |
| GET | `/api/transporters/:id` | Get transporter profile | No |
| PATCH | `/api/transporters/:id` | Update own profile | Yes (transporter) |

### Vehicles
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/vehicles` | Add vehicle | Yes (transporter, approved) |
| GET | `/api/vehicles` | List own vehicles | Yes (transporter) |
| PATCH | `/api/vehicles/:id` | Update vehicle | Yes (transporter, own) |
| DELETE | `/api/vehicles/:id` | Deactivate vehicle | Yes (transporter, own) |
| GET | `/api/vehicles/:id/availability` | Get vehicle availability | No |
| POST | `/api/vehicles/:id/availability` | Set availability range | Yes (transporter, own) |

### Transport Requests
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/transport-requests` | Send transport request | Yes (organizer, approved) |
| GET | `/api/transport-requests` | List own requests | Yes (organizer or transporter) |
| GET | `/api/transport-requests/:id` | Get request details | Yes |
| POST | `/api/transport-requests/:id/accept` | Accept request | Yes (transporter, own) |
| POST | `/api/transport-requests/:id/decline` | Decline request | Yes (transporter, own) |

### Reviews
| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/api/reviews` | Submit review | Yes (traveler or organizer) |
| GET | `/api/transporters/:id/reviews` | Get transporter reviews | No |

### Admin
| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/organizers` | List organizer applications | Yes (admin) |
| POST | `/api/admin/organizers/:id/approve` | Approve organizer | Yes (admin) |
| POST | `/api/admin/organizers/:id/reject` | Reject organizer | Yes (admin) |
| GET | `/api/admin/transporters` | List transporter applications | Yes (admin) |
| POST | `/api/admin/transporters/:id/approve` | Approve transporter | Yes (admin) |
| POST | `/api/admin/transporters/:id/reject` | Reject transporter | Yes (admin) |
| GET | `/api/admin/reviews` | List all reviews | Yes (admin) |
| POST | `/api/admin/reviews/:id/hide` | Hide review | Yes (admin) |

---

## 4. Acceptance Criteria

### Authentication
```
Given a new user registers with valid details
Then account is created and they can login

Given a user with role traveler tries to access organizer dashboard
Then access is denied (403)
```

### Tour Booking
```
Given a published tour with available capacity
When traveler books and pays successfully
Then booking.status = confirmed and tour.booked_count increments

Given a tour is full
When traveler tries to book
Then 409 Conflict is returned
```

### Transport Request
```
Given organizer sends request for available vehicle
Then transport_booking.status = pending

Given transporter accepts request
Then vehicle_availability is blocked and tour.transport_status = confirmed

Given transporter declines
Then organizer can send another request
```

### Vehicle Availability
```
Given vehicle booked 10 Jan–15 Jan
When organizer requests 14 Jan–16 Jan
Then system returns 409 (conflict)

Given vehicle booked 10 Jan–15 Jan
When organizer requests 16 Jan–18 Jan
Then vehicle is available
```

### Reviews
```
Given transport booking is completed
When review is submitted
Then review saved and transporter.average_rating recalculates

Given user tries to review without completed booking
Then review is rejected (403)
```

---

*See [AGENTS.md](../AGENTS.md) for dev phases | [DATABASE.md](./DATABASE.md) for schema**
