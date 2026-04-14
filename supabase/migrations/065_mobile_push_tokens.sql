CREATE TABLE IF NOT EXISTS public.mobile_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT,
    app_version TEXT,
    build_number TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, token)
);

-- Note: RLS ensures users can see their own tokens, but upserts in the API 
-- are safely handled using the service_role key to manage edge cases on login. 

ALTER TABLE public.mobile_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push tokens"
    ON public.mobile_push_tokens
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
