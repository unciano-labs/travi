-- supabase_migration_008.sql

-- Add price_per_person to tour_schedules to allow date-specific pricing overrides
ALTER TABLE tour_schedules ADD COLUMN IF NOT EXISTS price_per_person numeric(10, 2);
