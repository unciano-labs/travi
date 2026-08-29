-- Add CHECK constraint to ensure capacity is not exceeded
ALTER TABLE tour_schedules
DROP CONSTRAINT IF EXISTS check_capacity_not_exceeded;

ALTER TABLE tour_schedules
ADD CONSTRAINT check_capacity_not_exceeded 
CHECK (booked_count <= capacity);

-- Create a function to automatically manage booked_count on tour_schedules
CREATE OR REPLACE FUNCTION update_tour_schedule_booked_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Only count pending, confirmed, completed
        IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
            UPDATE tour_schedules
            SET booked_count = booked_count + NEW.seats
            WHERE id = NEW.tour_schedule_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If seats or status changed
        IF (NEW.seats != OLD.seats OR NEW.status != OLD.status) THEN
            -- Revert old seats if it was active
            IF OLD.status IN ('pending', 'confirmed', 'completed') THEN
                UPDATE tour_schedules
                SET booked_count = booked_count - OLD.seats
                WHERE id = OLD.tour_schedule_id;
            END IF;
            
            -- Add new seats if it is active
            IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
                UPDATE tour_schedules
                SET booked_count = booked_count + NEW.seats
                WHERE id = NEW.tour_schedule_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('pending', 'confirmed', 'completed') THEN
            UPDATE tour_schedules
            SET booked_count = booked_count - OLD.seats
            WHERE id = OLD.tour_schedule_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_tour_schedule_booked_count ON bookings;

-- Create trigger on bookings
CREATE TRIGGER trigger_update_tour_schedule_booked_count
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_tour_schedule_booked_count();
