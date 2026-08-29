-- Add image_urls array to tours table
ALTER TABLE tours ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}'::text[];
