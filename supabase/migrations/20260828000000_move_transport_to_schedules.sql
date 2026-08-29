-- Move transport configuration from tours to tour_schedules

-- 1. Add transport_type and transport_status to tour_schedules
ALTER TABLE tour_schedules
ADD COLUMN transport_type text DEFAULT 'none' CHECK (transport_type IN ('none', 'self_provided', 'external_transporter')),
ADD COLUMN transport_status text DEFAULT 'not_required' CHECK (transport_status IN ('not_required', 'self_provided', 'pending', 'confirmed', 'unresolved'));

-- 2. Backfill existing data from tours to tour_schedules
UPDATE tour_schedules
SET 
  transport_type = t.transport_type,
  transport_status = t.transport_status
FROM tours t
WHERE tour_schedules.tour_id = t.id;

-- 3. Make transport_type and transport_status NOT NULL on tour_schedules
ALTER TABLE tour_schedules
ALTER COLUMN transport_type SET NOT NULL,
ALTER COLUMN transport_status SET NOT NULL;

-- 4. Drop transport_type and transport_status from tours
ALTER TABLE tours
DROP COLUMN transport_type,
DROP COLUMN transport_status;
