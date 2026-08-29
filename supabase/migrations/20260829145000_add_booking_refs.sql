-- Add booking_ref column
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booking_ref varchar(10);

-- Create function to generate random alphanumeric string
CREATE OR REPLACE FUNCTION generate_booking_ref()
RETURNS TRIGGER AS $$
DECLARE
  new_ref varchar(10);
  is_unique boolean := false;
BEGIN
  IF NEW.booking_ref IS NULL THEN
    WHILE NOT is_unique LOOP
      -- Generate 'BK-' + 6 random uppercase alphanumeric characters
      new_ref := 'BK-' || upper(substr(md5(random()::text), 1, 6));
      
      -- Check if it exists
      PERFORM 1 FROM bookings WHERE booking_ref = new_ref;
      IF NOT FOUND THEN
        is_unique := true;
      END IF;
    END LOOP;
    NEW.booking_ref := new_ref;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on insert
DROP TRIGGER IF EXISTS trigger_generate_booking_ref ON bookings;
CREATE TRIGGER trigger_generate_booking_ref
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION generate_booking_ref();

-- Backfill existing bookings with random refs using an inline DO block
DO $$
DECLARE
  r RECORD;
  new_ref varchar(10);
  is_unique boolean;
BEGIN
  FOR r IN SELECT id FROM bookings WHERE booking_ref IS NULL LOOP
    is_unique := false;
    WHILE NOT is_unique LOOP
      new_ref := 'BK-' || upper(substr(md5(random()::text), 1, 6));
      PERFORM 1 FROM bookings WHERE booking_ref = new_ref;
      IF NOT FOUND THEN
        is_unique := true;
      END IF;
    END LOOP;
    UPDATE bookings SET booking_ref = new_ref WHERE id = r.id;
  END LOOP;
END;
$$;

-- Enforce NOT NULL and UNIQUE constraint
ALTER TABLE bookings 
ALTER COLUMN booking_ref SET NOT NULL,
ADD CONSTRAINT bookings_booking_ref_key UNIQUE (booking_ref);
