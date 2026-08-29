-- Add city and province to tours table
ALTER TABLE tours
ADD COLUMN city text,
ADD COLUMN province text;

-- We could populate these fields from the existing location if needed, 
-- but since location is free text, we'll just leave existing rows as null 
-- and let the application handle them gracefully.
