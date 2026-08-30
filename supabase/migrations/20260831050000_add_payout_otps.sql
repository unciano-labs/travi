-- Create OTPs table for payout verifications
CREATE TABLE IF NOT EXISTS public.payout_otps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Turn on RLS
ALTER TABLE public.payout_otps ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS naturally, but we can add a policy if needed.
-- We'll allow users to read their own OTPs if accessed from client (though it's better to keep it server-side)
CREATE POLICY "Users can manage their own otps" ON public.payout_otps
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
