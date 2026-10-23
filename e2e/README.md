# End-to-end tests (Playwright)

```bash
npm run test:e2e                                    # starts `next dev` on PORT (default 3000), or reuses one
PORT=3100 npm run test:e2e                          # use another port
PLAYWRIGHT_TEST_BASE_URL=https://preview.example npm run test:e2e   # test a running deployment; starts nothing
```

| Project | Specs | Needs |
|---|---|---|
| `chromium` | `e2e/*.spec.ts` (signed-out flows) | An app wired to a Supabase project with published tours |
| `auth-setup` | `e2e/authenticated/auth.setup.ts` | Signs each role in once and saves cookies to `e2e/fixtures/.auth/<role>.json` (git-ignored) |
| `authenticated` | `e2e/authenticated/*.spec.ts` | `auth-setup`, plus the role credentials below |

Every authenticated test **skips itself** when its role's credentials are missing, so a plain local
`npm run test:e2e` stays green.

## Authenticated suite: STAGING only

These tests sign in as real accounts and, with `E2E_ALLOW_WRITES=1`, create data (a pending booking,
a draft tour). Run them only against an app whose `NEXT_PUBLIC_SUPABASE_URL` points at the **staging**
Supabase project. They refuse to run when `PLAYWRIGHT_TEST_BASE_URL` is the production site, but the
browser cannot see which database a local server uses: never run them with `.env.local` pointing at
production.

| Variable | Purpose |
|---|---|
| `E2E_TRAVELER_EMAIL` / `E2E_TRAVELER_PASSWORD` | Traveler account |
| `E2E_ORGANIZER_EMAIL` / `E2E_ORGANIZER_PASSWORD` | Organizer account |
| `E2E_TRANSPORTER_EMAIL` / `E2E_TRANSPORTER_PASSWORD` | Transporter account |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | Admin account (signs in at `/admin/login`) |
| `E2E_ALLOW_WRITES` | `1` enables the tests that create a booking and a draft tour |
| `E2E_TOUR_SLUG` | Optional: the tour the traveler books (default: the first tour on `/tours`) |

Never commit these values. Locally, export them in your shell (not in `.env.local`, which the app reads).

### Staging seed users

Create these once in the staging project (Supabase Auth, email confirmed), each with a
`user_profiles` row and the listed `user_roles` (scoped to staging's `WEBSITE_ID`):

| Account | Roles | Also needs |
|---|---|---|
| Traveler | `traveler` | Nothing else. Its pending bookings expire after 15 minutes |
| Organizer | `organizer` only (no `traveler`) | An **approved** `organizer_profiles` row (so the onboarding gate is passed) |
| Transporter | `transporter` only (no `traveler`) | An **approved** `transporter_profiles` row; vehicles optional |
| Admin | `admin` | Nothing else |

The traveler booking test also needs at least one **published** tour on staging with an **open**
schedule that starts in the future and has free seats (or set `E2E_TOUR_SLUG` to such a tour). Draft
tours created by the organizer test are titled `E2E draft <timestamp>` and can be deleted at any time.

The organizer draft test fills the province and city pickers, which load from the public PSGC API
(`psgc.gitlab.io`); it fails if that API is unreachable.

## CI

`.github/workflows/ci.yml` runs the e2e job only when the repository secrets `E2E_SUPABASE_URL` and
`E2E_SUPABASE_ANON_KEY` (staging) exist; otherwise it skips with a notice. It builds the app against
staging, serves it with `next start`, and uploads the Playwright report when a test fails.
