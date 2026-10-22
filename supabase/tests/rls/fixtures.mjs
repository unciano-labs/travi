// Shared fixtures for the database test suites (RLS + money). All rows are inserted as the
// superuser, so they bypass RLS and triggers that only apply to end users.
export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const W = id(1);
export const R = { admin: id(2), traveler: id(3), organizer: id(4), transporter: id(5) };
export const U = { T: id(10), O: id(11), O2: id(12), X: id(13), N: id(14) };            // auth.users
export const P = { T: id(20), O: id(21), O2: id(22), X: id(23) };                        // user_profiles
export const OP = { O: id(31), O2: id(32) };                                            // organizer_profiles
export const TP = { X: id(41) };                                                        // transporter_profiles
export const TOUR = { t1: id(51), t2: id(52), draft: id(53) };
export const S = { s1: id(61), past: id(62), closed: id(63), draft: id(64), o2: id(65) };
export const V1 = id(71);
export const WALLET = { O2: id(81), X: id(82) };
export const TB1 = id(91);
export const B1 = id(101);
export const N1 = id(111);

// Insert auth.users rows WITHOUT the signup trigger (20261024090000) creating profiles, so tests can
// create profiles with fixed ids themselves (and keep some users profile-less on purpose).
export function seedAuthUsers(rows) {
  const toggle = (action) => `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created' AND tgrelid = 'auth.users'::regclass) THEN
    ALTER TABLE auth.users ${action} TRIGGER on_auth_user_created;
  END IF;
END $$;`;
  const values = rows.map(([uid, email]) => `('${uid}', '${email}')`).join(', ');
  return `${toggle('DISABLE')}\nINSERT INTO auth.users (id, email) VALUES ${values};\n${toggle('ENABLE')}`;
}

export const SEED = `
INSERT INTO websites (id, name) VALUES ('${W}', 'travi');
INSERT INTO website_roles (id, website_id, role) VALUES
  ('${R.admin}', '${W}', 'admin'), ('${R.traveler}', '${W}', 'traveler'),
  ('${R.organizer}', '${W}', 'organizer'), ('${R.transporter}', '${W}', 'transporter');
${seedAuthUsers([
  [U.T, 't@example.com'], [U.O, 'o@example.com'], [U.O2, 'o2@example.com'],
  [U.X, 'x@example.com'], [U.N, 'new@example.com'],
])}
INSERT INTO user_profiles (id, user_id, email, full_name) VALUES
  ('${P.T}', '${U.T}', 't@example.com', 'Tina Traveler'), ('${P.O}', '${U.O}', 'o@example.com', 'Oscar Org'),
  ('${P.O2}', '${U.O2}', 'o2@example.com', 'Olive Org'), ('${P.X}', '${U.X}', 'x@example.com', 'Xavier Van');
INSERT INTO user_roles (user_profile_id, website_role_id) VALUES
  ('${P.T}', '${R.traveler}'), ('${P.O}', '${R.organizer}'), ('${P.O2}', '${R.organizer}'), ('${P.X}', '${R.transporter}');
INSERT INTO organizer_profiles (id, user_profile_id, organizer_type, display_name, phone, status) VALUES
  ('${OP.O}', '${P.O}', 'individual', 'Oscar Tours', '09170000001', 'approved'),
  ('${OP.O2}', '${P.O2}', 'individual', 'Olive Tours', '09170000002', 'approved');
INSERT INTO transporter_profiles (id, user_profile_id, transporter_type, display_name, phone, status) VALUES
  ('${TP.X}', '${P.X}', 'individual', 'Xavier Vans', '09180000001', 'approved');
INSERT INTO tours (id, organizer_id, title, slug, description, location, price_per_person, duration_days, status) VALUES
  ('${TOUR.t1}', '${OP.O}', 'Palawan', 'palawan', 'd', 'Palawan', 1000, 3, 'published'),
  ('${TOUR.t2}', '${OP.O2}', 'Cebu', 'cebu', 'd', 'Cebu', 2000, 1, 'published'),
  ('${TOUR.draft}', '${OP.O}', 'Draft', 'draft', 'd', 'Bohol', 500, 1, 'draft');
INSERT INTO tour_schedules (id, tour_id, start_date, end_date, capacity, status) VALUES
  ('${S.s1}', '${TOUR.t1}', current_date + 30, current_date + 32, 10, 'open'),
  ('${S.past}', '${TOUR.t2}', current_date - 10, current_date - 8, 10, 'open'),
  ('${S.closed}', '${TOUR.t1}', current_date + 40, current_date + 41, 10, 'cancelled'),
  ('${S.draft}', '${TOUR.draft}', current_date + 30, current_date + 31, 5, 'open'),
  ('${S.o2}', '${TOUR.t2}', current_date + 20, current_date + 21, 8, 'open');
INSERT INTO vehicles (id, transporter_id, name, vehicle_type, seat_capacity, plate_number, status) VALUES
  ('${V1}', '${TP.X}', 'Hiace', 'van', 12, 'ABC1234', 'active');
INSERT INTO user_wallets (id, user_profile_id, available_balance) VALUES
  ('${WALLET.O2}', '${P.O2}', 50000), ('${WALLET.X}', '${P.X}', 0);
-- Every balance has a matching ledger row (sign convention: amount = signed effect on the bucket).
INSERT INTO wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description)
  VALUES ('${WALLET.O2}', 50000, 'manual_adjustment', 'available', 'seed', '${WALLET.O2}', 'Opening balance');
INSERT INTO transport_bookings (id, tour_schedule_id, organizer_id, transporter_id, vehicle_id,
  pickup_location, dropoff_location, pickup_datetime, seats_required, status) VALUES
  ('${TB1}', '${S.s1}', '${OP.O}', '${TP.X}', '${V1}', 'Airport', 'Hotel', now() + interval '30 days', 10, 'pending');
INSERT INTO bookings (id, tour_schedule_id, traveler_id, seats, total_amount, status) VALUES
  ('${B1}', '${S.s1}', '${P.T}', 2, 2000, 'pending');
INSERT INTO notifications (id, user_id, type, title, message) VALUES ('${N1}', '${U.T}', 'info', 'Hello', 'Welcome');
`;


export const as = (key, role = 'authenticated') => ({ role, uid: U[key] });
export const service = { role: 'service_role' };
export const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];
