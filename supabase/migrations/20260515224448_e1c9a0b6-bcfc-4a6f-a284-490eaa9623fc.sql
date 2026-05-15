-- auth_email_log: журнал отправок Supabase Auth писем через собственный Resend hook
CREATE TABLE IF NOT EXISTS public.auth_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  email text NOT NULL,
  email_action_type text NOT NULL,
  status text NOT NULL,
  resend_id text NULL,
  error text NULL,
  token_hash text NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_email_log_created_at
  ON public.auth_email_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_email_log_dedup
  ON public.auth_email_log (email_action_type, token_hash, created_at DESC);

ALTER TABLE public.auth_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read auth email log"
  ON public.auth_email_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));