-- Donations table
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  yookassa_payment_id text UNIQUE,
  donor_name text,
  donor_email text,
  donor_phone text,
  campaign_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz NULL
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all donations"
  ON public.donations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Webhook logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'yookassa',
  event text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- View: total raised
CREATE OR REPLACE VIEW public.donations_total
WITH (security_invoker = true) AS
SELECT COALESCE(SUM(amount), 0)::numeric(14,2) AS total_raised
FROM public.donations
WHERE status = 'succeeded';

GRANT SELECT ON public.donations_total TO anon, authenticated;

-- Index for quick lookup by yookassa payment id
CREATE INDEX IF NOT EXISTS idx_donations_yookassa_payment_id ON public.donations(yookassa_payment_id);
CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON public.donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON public.donations(status);