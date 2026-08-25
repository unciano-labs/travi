-- Drop any old auth triggers that might fail during signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create website_roles table to define roles for a website
CREATE TABLE public.website_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(website_id, role)
);

ALTER TABLE public.website_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read website roles" ON public.website_roles FOR SELECT USING (true);

-- Create user_profiles table (1 per user globally)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to read own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow users to insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create user_roles table linking profiles to website_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    website_role_id UUID NOT NULL REFERENCES public.website_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_profile_id, website_role_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to read their own roles" ON public.user_roles FOR SELECT USING (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Allow users to insert their own roles" ON public.user_roles FOR INSERT WITH CHECK (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- ==========================================
-- DEVELOPMENT MOCK DATA (Requires existing user)
-- ==========================================
-- IMPORTANT: To insert mock data below, you must first create a user in your Supabase Authentication dashboard,
-- then copy their UUID and replace 'REPLACE_WITH_YOUR_AUTH_USER_ID' with it.

/*
INSERT INTO public.websites (id, user_id, name, subdomain) 
VALUES ('e4a3b8d1-7c9f-42e5-a6b1-0f8d9c2e3b4a', 'REPLACE_WITH_YOUR_AUTH_USER_ID', 'Orgy', 'localhost')
ON CONFLICT DO NOTHING;

INSERT INTO public.website_roles (id, website_id, role) VALUES 
('11111111-1111-1111-1111-111111111111', 'e4a3b8d1-7c9f-42e5-a6b1-0f8d9c2e3b4a', 'admin'),
('22222222-2222-2222-2222-222222222222', 'e4a3b8d1-7c9f-42e5-a6b1-0f8d9c2e3b4a', 'traveler'),
('33333333-3333-3333-3333-333333333333', 'e4a3b8d1-7c9f-42e5-a6b1-0f8d9c2e3b4a', 'organizer'),
('44444444-4444-4444-4444-444444444444', 'e4a3b8d1-7c9f-42e5-a6b1-0f8d9c2e3b4a', 'transporter')
ON CONFLICT DO NOTHING;

-- Create a mock user_profile for the admin user
INSERT INTO public.user_profiles (id, user_id, email, full_name) 
VALUES ('c3b4a2e5-7c9f-42e5-a6b1-0f8d9c2e3b4a', 'REPLACE_WITH_YOUR_AUTH_USER_ID', 'admin@example.com', 'Admin User')
ON CONFLICT DO NOTHING;

-- Insert an admin role for your first user (linking user_profile to website_role)
INSERT INTO public.user_roles (user_profile_id, website_role_id) 
VALUES ('c3b4a2e5-7c9f-42e5-a6b1-0f8d9c2e3b4a', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;
*/

-- To insert a transporter role, create a 4th user in the Supabase Dashboard and replace the UUID below:
-- INSERT INTO public.user_roles (user_id, website_id, role) 
-- VALUES ('REPLACE_WITH_NEW_USER_ID', 'e4a3b8d1-7c9f-42e5-a6b1-0f8d9c2e3b4a', 'transporter')
-- ON CONFLICT DO NOTHING;
