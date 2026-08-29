# DATABASE.md — Travi SaaS
# Database Schema, Status Definitions & Business Rules

> Stack: Supabase (PostgreSQL) + Row Level Security
> See also: [AGENTS.md](./AGENTS.md) | [API.md](./API.md)

---

## Table of Contents
1. [Schema Overview](#1-schema-overview)
2. [Table Definitions](#2-table-definitions)
3. [Status Definitions](#3-status-definitions)
4. [Business Rules](#4-business-rules)
5. [RLS Policies](#5-rls-policies)
6. [Migration Guide](#6-migration-guide)

---

## 1. Schema Overview

```
users (auth.users via Supabase)
  profiles (1:1)
  organizer_profiles (1:1, optional)
  transporter_profiles (1:1, optional)

tours (many per organizer)
  tour_itineraries (many per tour)
  bookings (many per tour)
    payments (1:1 per booking)

vehicles (many per transporter)
  vehicle_availability (many per vehicle)

organizer_favorite_vehicles (links organizer + vehicle)

transport_bookings (links tour + vehicle + transporter)
reviews (linked to transporter + optional vehicle/tour)
admin_audit_logs
```

---

## 2. Table Definitions

### 1. `websites`
Stores multi-tenant domains/subdomains.
| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary Key, Default `gen_random_uuid()` |
| `name` | `text` | Not Null |
| `subdomain` | `text` | Not Null, Unique |
| `created_at` | `timestamptz` | Not Null, Default `now()` |

### 2. `website_roles`
Defines the roles available for a specific website.
| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary Key, Default `gen_random_uuid()` |
| `website_id`| `uuid` | Not Null, Foreign Key to `websites(id)` ON DELETE CASCADE |
| `role` | `text` | Not Null |
| `created_at` | `timestamptz` | Not Null, Default `now()` |
> **Constraint:** `UNIQUE(website_id, role)` prevents duplicate roles on the same website.

---

### 3. `user_profiles`
Global profile for an authenticated user.
| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK, Default `gen_random_uuid()` |
| user_id | UUID | Yes | FK → auth.users(id) ON DELETE CASCADE |
| email | text | Yes | |
| full_name | text | No | |
| avatar_url | text | No | |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

---

### 4. `user_roles`
Links a user's profile to a specific role on a website.
| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary Key, Default `gen_random_uuid()` |
| `user_profile_id`| `uuid` | Not Null, Foreign Key to `user_profiles(id)` ON DELETE CASCADE |
| `website_role_id`| `uuid` | Not Null, Foreign Key to `website_roles(id)` ON DELETE CASCADE |
| `created_at` | `timestamptz` | Not Null, Default `now()` |
> **Constraint:** `UNIQUE(user_profile_id, website_role_id)` prevents a profile from being assigned the same role twice.

---

### 4.1 organizer_profiles

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| user_profile_id | UUID | Yes | FK → user_profiles(id) ON DELETE CASCADE |
| organizer_type | enum | Yes | individual, company |
| company_name | text | Conditional | Required if type=company |
| display_name | text | Yes | |
| phone | text | Yes | |
| description | text | No | |
| address | text | No | |
| status | enum | Yes | pending, approved, rejected |
| provides_transport | boolean | Yes | Default false |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

---

### 2.3 transporter_profiles

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| user_profile_id | UUID | Yes | FK → user_profiles(id) ON DELETE CASCADE |
| transporter_type | enum | Yes | individual, company |
| company_name | text | Conditional | Required if type=company |
| display_name | text | Yes | |
| phone | text | Yes | |
| description | text | No | |
| service_areas | text[] | Yes | Array of cities/regions |
| status | enum | Yes | pending, approved, rejected |
| average_rating | decimal | Yes | Default 0.0 |
| review_count | integer | Yes | Default 0 |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

---

### 2.4 tours

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| organizer_id | UUID | Yes | FK → organizer_profiles |
| title | text | Yes | |
| slug | text | Yes | URL-friendly unique identifier |
| description | text | Yes | |
| location | text | Yes | Detailed address or meetup point |
| city | text | Yes | |
| province | text | Yes | |
| price_per_person | decimal | Yes | Must be > 0 |
| duration_days | integer | Yes | |
| accommodation_details | text | No | |
| travel_time_info | text | No | |
| status | enum | Yes | draft, published, archived |
| format | enum | Yes | joiner, private, solo |
| themes | text[] | Yes | Array of theme tags (e.g., island_hopping) |
| cover_image_url | text | No | First image uploaded |
| image_urls | text[] | No | Array of all uploaded images |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

---

### 2.5 tour_schedules

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| `tour_id` | uuid | Yes | Foreign key to `tours` |
| `start_date` | date | Yes | Start date of the schedule |
| `end_date` | date | Yes | End date of the schedule |
| `capacity` | integer | Yes | Total available seats for this specific schedule |
| `price_per_person`| numeric(10,2)| No | Custom price for this schedule |
| `original_price`  | numeric(10,2)| No | Optional "compare-at" price |
| `transport_type` | enum | Yes | none, self_provided, external_transporter |
| `transport_status` | enum | Yes | not_required, self_provided, pending, confirmed, unresolved |
| `status` | enum | Yes | Schedule status: `open`, `full`, `cancelled`, `completed` |
| `created_at` | timestamptz | Yes | |
| `updated_at` | timestamptz | Yes | |

---

### 2.6 tour_itineraries

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| tour_id | UUID | Yes | FK → tours |
| day_number | integer | Yes | 1-based |
| title | text | Yes | |
| description | text | Yes | |
| created_at | timestamptz | Yes | |

---

### 2.7 bookings

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| booking_ref | varchar | Yes | Auto-generated unique alphanumeric ID (e.g. BK-X9A2B4) |
| tour_schedule_id | UUID | Yes | FK → tour_schedules |
| traveler_id | UUID | Yes | FK → user_profiles |
| seats | integer | Yes | Min 1 |
| total_amount | decimal | Yes | price × seats |
| status | enum | Yes | pending, confirmed, canceled, refunded, completed |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

---

### 2.7 payments

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| booking_id | UUID | Yes | FK → bookings |
| amount | decimal | Yes | |
| currency | text | Yes | Default 'USD' |
| status | enum | Yes | pending, succeeded, failed, refunded |
| provider | text | Yes | stripe, razorpay, etc. |
| provider_payment_id | text | No | Gateway transaction ID |
| created_at | timestamptz | Yes | |

---

### 2.8 vehicles

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| transporter_id | UUID | Yes | FK → transporter_profiles |
| name | text | Yes | |
| vehicle_type | enum | Yes | car, van, bus, minibus, suv |
| seat_capacity | integer | Yes | |
| plate_number | text | No | |
| description | text | No | |
| rate_per_day | decimal | No | |
| `photos` | `text[]` | Optional, array of image URLs |
| `status` | `text` | Default `'active'`, Check: `IN ('active', 'inactive')` |
| `deleted_at` | `timestamp` | Optional (Soft Delete) |
| `created_at` | `timestamp` | Default `now()` |
| `updated_at` | `timestamp` | Default `now()` |

### 11. `organizer_favorite_vehicles`
Stores which vehicles an organizer has favorited for quick access.
| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary Key, Default `gen_random_uuid()` |
| `organizer_id` | `uuid` | Not Null, References `organizer_profiles(id)` |
| `vehicle_id` | `uuid` | Not Null, References `vehicles(id)` |
| `created_at` | `timestamp` | Default `now()` |

*Note: Unique constraint on `(organizer_id, vehicle_id)` to prevent duplicates.*

### 12. `vehicle_availability`

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| vehicle_id | UUID | Yes | FK → vehicles |
| start_date | date | Yes | |
| end_date | date | Yes | |
| status | enum | Yes | available, booked, blocked |
| transport_booking_id | UUID | No | FK → transport_bookings if booked |
| notes | text | No | |
| created_at | timestamptz | Yes | |

---

### 2.10 transport_bookings

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| tour_schedule_id | UUID | Yes | FK → tour_schedules |
| organizer_id | UUID | Yes | FK → organizer_profiles |
| transporter_id | UUID | Yes | FK → transporter_profiles |
| vehicle_id | UUID | Yes | FK → vehicles |
| pickup_location | text | Yes | |
| dropoff_location | text | Yes | |
| pickup_datetime | timestamptz | Yes | |
| return_datetime | timestamptz | No | |
| seats_required | integer | Yes | |
| estimated_price | decimal | No | |
| status | enum | Yes | pending, accepted, declined, canceled, completed |
| created_at | timestamptz | Yes | |
| updated_at | timestamptz | Yes | |

---

### 2.11 reviews

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| reviewer_profile_id | UUID | Yes | FK → user_profiles |
| transporter_id | UUID | Yes | FK → transporter_profiles |
| vehicle_id | UUID | No | FK → vehicles |
| transport_booking_id | UUID | No | FK → transport_bookings |
| tour_id | UUID | No | FK → tours |
| rating | integer | Yes | 1–5 |
| comment | text | No | |
| status | enum | Yes | pending, published, hidden |
| created_at | timestamptz | Yes | |

---

### 2.12 admin_audit_logs

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID | Yes | PK |
| admin_profile_id | UUID | Yes | FK → user_profiles |
| entity_type | text | Yes | organizer, transporter, tour, booking, review |
| entity_id | UUID | Yes | |
| action | text | Yes | approve, reject, hide, update |
| notes | text | No | |
| created_at | timestamptz | Yes | |

---

## 3. Status Definitions

### Organizer Status
| Status | Meaning |
|---|---|
| pending | Submitted, awaiting admin approval |
| approved | Can create and publish tours |
| rejected | Cannot operate on platform |

### Transporter Status
| Status | Meaning |
|---|---|
| pending | Submitted, awaiting admin approval |
| approved | Can list vehicles, receive requests |
| rejected | Cannot operate on platform |

### Tour Status
| Status | Meaning |
|---|---|
| draft | Being created, not visible to travelers |
| published | Visible and bookable |
| archived | Inactive, retained for history |

### Tour Transport Status
| Status | Meaning |
|---|---|
| not_required | No transport needed |
| self_provided | Organizer handles transport |
| pending | Waiting for transporter to accept |
| confirmed | Transport confirmed |
| unresolved | Request declined or canceled |

### Booking Status
| Status | Meaning |
|---|---|
| pending | Created, payment not confirmed |
| confirmed | Payment successful |
| canceled | Booking canceled |
| refunded | Payment refunded |
| completed | Trip completed |

### Transport Booking Status
| Status | Meaning |
|---|---|
| pending | Waiting for transporter response |
| accepted | Transporter accepted |
| declined | Transporter declined |
| canceled | Request canceled |
| completed | Service completed |

### Vehicle Availability Status
| Status | Meaning |
|---|---|
| available | Can be requested |
| booked | Reserved for a confirmed booking |
| blocked | Manually blocked by transporter |

---

## 4. Business Rules

### Account Rules
| ID | Rule |
|---|---|
| BR-ACC-001 | User must select a role during signup |
| BR-ACC-002 | Organizer profile can be individual or company |
| BR-ACC-003 | Transporter profile can be individual or company |
| BR-ACC-004 | Company accounts must provide company_name |

### Organizer Rules
| ID | Rule |
|---|---|
| BR-ORG-001 | Cannot publish tours until approved |
| BR-ORG-002 | Can only edit their own tours |
| BR-ORG-003 | Can only view bookings for their own tours |
| BR-ORG-004 | Soft delete (archive) tours and schedules by setting `deleted_at = now()` instead of hard deleting to preserve historical bookings and payments. |

### Soft Delete & Data Retention Rules
| ID | Rule |
|---|---|
| BR-DEL-001 | All primary tables (`user_profiles`, `organizer_profiles`, `transporter_profiles`, `tours`, `tour_schedules`, `tour_itineraries`, `bookings`, `reviews`, `vehicles`, `vehicle_availability`, `transport_bookings`) use soft deletion with a `deleted_at timestamptz DEFAULT NULL` column. |
| BR-DEL-002 | Default public and authenticated user read queries must filter rows where `deleted_at IS NULL`. |
| BR-DEL-003 | Soft deletion is performed via `UPDATE ... SET deleted_at = NOW()` and does not cascade-purge foreign keys. |

### Transporter Rules
| ID | Rule |
|---|---|
| BR-TRP-001 | Cannot list vehicles until approved |
| BR-TRP-002 | Can only manage their own vehicles and availability |
| BR-TRP-005 | average_rating recalculates when a new published review is added |

### Tour Rules
| ID | Rule |
|---|---|
| BR-TOUR-001 | Must have all required fields + ≥1 itinerary item before publishing |
| BR-TOUR-003 | Start date must be in the future at time of publishing |
| BR-TOUR-004 | capacity > 0 |
| BR-TOUR-005 | price_per_person > 0 |

### Booking Rules
| ID | Rule |
|---|---|
| BR-BOOK-003 | seats ≤ (capacity − booked_count) |
| BR-BOOK-004 | total_amount = price_per_person × seats |
| BR-BOOK-005 | Status becomes `confirmed` only after successful payment |
| BR-BOOK-006 | Confirmed booking increments tour.booked_count |

### Transport Rules
| ID | Rule |
|---|---|
| BR-TRANS-002 | vehicle.seat_capacity ≥ seats_required |
| BR-TRANS-003 | Vehicle must be active |
| BR-TRANS-004 | Vehicle must be available for requested date range |
| BR-TRANS-006 | Accepted request → creates vehicle_availability row (status=booked) |
| BR-TRANS-007 | Declined request does not block availability |

### Availability Overlap Rule
A vehicle is unavailable if any confirmed booking or blocked row overlaps the requested period:
```
conflict = existing.start_date <= requested.end_date
        AND existing.end_date >= requested.start_date
```

---

## 5. RLS Policies

### profiles
```sql
-- Users can read their own profile
create policy "own profile select" on profiles for select using (auth.uid() = id);
-- Users can update their own profile
create policy "own profile update" on profiles for update using (auth.uid() = id);
```

### organizer_profiles
```sql
create policy "organizer select own" on organizer_profiles for select using (auth.uid() = user_id);
create policy "organizer insert own" on organizer_profiles for insert with check (auth.uid() = user_id);
create policy "organizer update own" on organizer_profiles for update using (auth.uid() = user_id);
-- Public read for approved organizers
create policy "public read approved" on organizer_profiles for select using (status = 'approved');
```

### tours
```sql
-- Travelers/public: read published tours only
create policy "public read published tours" on tours for select using (status = 'published');
-- Organizer: full CRUD on own tours
create policy "organizer manage own tours" on tours for all using (
  auth.uid() = (select user_id from organizer_profiles where id = organizer_id)
);
```

### bookings
```sql
-- Traveler sees own bookings
create policy "traveler own bookings" on bookings for select using (auth.uid() = traveler_id);
-- Organizer sees bookings for their tours
create policy "organizer tour bookings" on bookings for select using (
  auth.uid() = (select op.user_id from organizer_profiles op
                join tours t on t.organizer_id = op.id
                where t.id = tour_id)
);
```

---

## 6. Migration Guide

```bash
# Initialize Supabase locally
supabase init
supabase start

# Apply all migrations
supabase db reset

# Push to remote project
supabase db push

# REQUIRED after every schema change — regenerate types
supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.types.ts
```

### Migration File Naming Convention
```
supabase/migrations/
  001_initial_schema.sql
  002_add_vehicle_photos.sql
  003_add_tour_cover_image.sql
```

> **Rule:** Never edit existing migration files. Always create a new numbered migration file for schema changes.

---

*See [AGENTS.md](./AGENTS.md) for dev phases | [API.md](./API.md) for API spec*
