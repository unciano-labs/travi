-- Migration 016: Create admin_audit_logs table

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON public.admin_audit_logs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.website_roles wr ON wr.id = ur.website_role_id
        JOIN public.user_profiles up ON up.id = ur.user_profile_id
        WHERE up.user_id = auth.uid() AND wr.role = 'admin'
      )
    );

-- Admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
    ON public.admin_audit_logs FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.website_roles wr ON wr.id = ur.website_role_id
        JOIN public.user_profiles up ON up.id = ur.user_profile_id
        WHERE up.user_id = auth.uid() AND wr.role = 'admin'
      )
    );
