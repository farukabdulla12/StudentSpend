CREATE TABLE IF NOT EXISTS public.student_features (
    user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(payload) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own student features"
    ON public.student_features;
CREATE POLICY "Users can read their own student features"
    ON public.student_features
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own student features"
    ON public.student_features;
CREATE POLICY "Users can insert their own student features"
    ON public.student_features
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own student features"
    ON public.student_features;
CREATE POLICY "Users can update their own student features"
    ON public.student_features
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE
    ON public.student_features
    TO authenticated;
