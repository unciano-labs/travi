-- 1. Add map coordinates to tours
-- ALTER TABLE public.tours ADD COLUMN latitude DECIMAL(10, 8);
-- ALTER TABLE public.tours ADD COLUMN longitude DECIMAL(11, 8);
-- 2. Create tour-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('tour-images', 'tour-images', true) ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
-- Allow public read access to all files in tour-images
CREATE POLICY "Public Access to tour-images" ON storage.objects FOR SELECT USING (bucket_id = 'tour-images');

-- Allow authenticated users (organizers) to upload files
CREATE POLICY "Authenticated users can upload tour-images" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'tour-images' 
    AND auth.role() = 'authenticated'
);

-- Allow users to update/delete their own uploads
CREATE POLICY "Users can update own tour-images" ON storage.objects FOR UPDATE USING (
    bucket_id = 'tour-images' 
    AND auth.uid() = owner
);

CREATE POLICY "Users can delete own tour-images" ON storage.objects FOR DELETE USING (
    bucket_id = 'tour-images' 
    AND auth.uid() = owner
);
