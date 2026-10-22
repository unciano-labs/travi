-- Read-only. Run in the Supabase SQL editor (staging first, then production) BEFORE and AFTER
-- applying 20261023090000_rls_hardening.sql, and compare with EXPECTED below.
--
-- Why: the live database has drifted from supabase/migrations before (AGENTS.md §4.7). A policy
-- created by hand in the dashboard would not be dropped by the migration and could keep a hole open.
-- Any policy listed here that is NOT in EXPECTED must be reviewed (and usually dropped).

SELECT tablename, policyname, cmd, roles, permissive
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND tablename IN (
    'user_roles', 'user_profiles', 'organizer_profiles', 'transporter_profiles',
    'bookings', 'tours', 'tour_schedules', 'transport_bookings',
    'payout_requests', 'user_wallets', 'wallet_transactions',
    'reviews', 'notifications', 'objects'
  )
ORDER BY tablename, policyname;

-- EXPECTED after the migration (table: policy [command]):
--   bookings: Organizer tour bookings [SELECT]; Traveler insert own bookings [INSERT]; Traveler own bookings [SELECT]
--   notifications: Users can delete own notifications [DELETE]; Users can update own notifications [UPDATE];
--                  Users can view own notifications [SELECT]
--   objects (storage): Public Access to tour-images [SELECT]; Users can delete own tour-images [DELETE];
--                      Users can update own tour-images [UPDATE]; Users upload tour-images to own folder [INSERT]
--   organizer_profiles: organizer insert own [INSERT]; organizer select own [SELECT]; organizer update own [UPDATE];
--                       public read approved [SELECT]
--   payout_requests: Admin manage all payout requests [ALL]; User read own payout requests [SELECT]
--   reviews: Admins can manage all reviews [ALL]; Public read access for published reviews [SELECT];
--            Reviewers insert pending reviews [INSERT]; Users can read own reviews [SELECT]
--   tour_schedules: Organizers can insert own tour_schedules [INSERT]; Organizers can update own tour_schedules [UPDATE];
--                   Public read access for tour_schedules [SELECT]
--   tours: organizer insert own tours [INSERT]; organizer read own tours [SELECT]; organizer update own tours [UPDATE];
--          public read published tours [SELECT]
--   transport_bookings: Organizers create transport requests [INSERT]; Parties read own transport bookings [SELECT];
--                       Parties update own transport bookings [UPDATE]
--   transporter_profiles: Allow public read transporter profiles [SELECT];
--                         Allow users to insert own transporter profile [INSERT];
--                         Allow users to update own transporter profile [UPDATE]
--   user_profiles: Allow users to insert own profile [INSERT]; Allow users to read own profile [SELECT];
--                  Allow users to update own profile [UPDATE];
--                  Organizers can read profiles of travelers who booked their tour [SELECT]  (name truncated to 63 chars)
--   user_roles: Allow users to read their own roles [SELECT]
--   user_wallets: Admin read all wallets [SELECT]; User read own wallet [SELECT]
--   wallet_transactions: Admin read all wallet transactions [SELECT]; User read own wallet transactions [SELECT]

-- Also confirm the guard triggers exist:
SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE ANY (ARRAY['%guard_columns', '%before_insert', '%before_write'])
ORDER BY 1, 2;
