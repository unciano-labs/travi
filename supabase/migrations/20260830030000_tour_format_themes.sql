CREATE TYPE tour_format_enum AS ENUM ('joiner', 'private', 'solo');

ALTER TABLE tours 
ADD COLUMN format tour_format_enum NOT NULL DEFAULT 'joiner',
ADD COLUMN themes text[] NOT NULL DEFAULT '{}';

-- Update the overbooking trigger to handle private tours
CREATE OR REPLACE FUNCTION update_tour_schedule_booked_count()
RETURNS TRIGGER AS $$
DECLARE
    v_format tour_format_enum;
    v_capacity integer;
    seats_to_modify integer;
BEGIN
    -- Determine the tour format and schedule capacity
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT t.format, ts.capacity INTO v_format, v_capacity
        FROM tour_schedules ts
        JOIN tours t ON t.id = ts.tour_id
        WHERE ts.id = NEW.tour_schedule_id;
    ELSE
        SELECT t.format, ts.capacity INTO v_format, v_capacity
        FROM tour_schedules ts
        JOIN tours t ON t.id = ts.tour_id
        WHERE ts.id = OLD.tour_schedule_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
            seats_to_modify := NEW.seats;
            IF v_format = 'private' THEN
                seats_to_modify := v_capacity; -- Private tour consumes all capacity
            END IF;

            UPDATE tour_schedules
            SET booked_count = booked_count + seats_to_modify
            WHERE id = NEW.tour_schedule_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.seats != OLD.seats OR NEW.status != OLD.status) THEN
            -- Revert old seats
            IF OLD.status IN ('pending', 'confirmed', 'completed') THEN
                seats_to_modify := OLD.seats;
                IF v_format = 'private' THEN
                    seats_to_modify := v_capacity;
                END IF;
                
                UPDATE tour_schedules
                SET booked_count = booked_count - seats_to_modify
                WHERE id = OLD.tour_schedule_id;
            END IF;
            
            -- Add new seats
            IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
                seats_to_modify := NEW.seats;
                IF v_format = 'private' THEN
                    seats_to_modify := v_capacity;
                END IF;

                UPDATE tour_schedules
                SET booked_count = booked_count + seats_to_modify
                WHERE id = NEW.tour_schedule_id;
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('pending', 'confirmed', 'completed') THEN
            seats_to_modify := OLD.seats;
            IF v_format = 'private' THEN
                seats_to_modify := v_capacity;
            END IF;

            UPDATE tour_schedules
            SET booked_count = booked_count - seats_to_modify
            WHERE id = OLD.tour_schedule_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
