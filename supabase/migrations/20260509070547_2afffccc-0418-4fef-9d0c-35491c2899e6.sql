
-- Extend donor_subscriptions
ALTER TABLE public.donor_subscriptions
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_reason text,
  ADD COLUMN IF NOT EXISTS last_failure_code text,
  ADD COLUMN IF NOT EXISTS processing_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_type text,
  ADD COLUMN IF NOT EXISTS card_expiry text,
  ADD COLUMN IF NOT EXISTS payment_method_saved_at timestamptz;

-- Update validation trigger to include past_due
CREATE OR REPLACE FUNCTION public.validate_donor_subscription()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.interval NOT IN ('weekly','biweekly','monthly') THEN
    RAISE EXCEPTION 'invalid interval: %, must be weekly|biweekly|monthly', NEW.interval;
  END IF;
  IF NEW.status NOT IN ('active','past_due','paused','canceled') THEN
    RAISE EXCEPTION 'invalid status: %, must be active|past_due|paused|canceled', NEW.status;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  RETURN NEW;
END;
$function$;

-- Audit table for charge attempts
CREATE TABLE IF NOT EXISTS public.subscription_charge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  donation_id uuid,
  yookassa_payment_id text,
  status text NOT NULL,
  error_code text,
  error_description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_charge_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view charge attempts" ON public.subscription_charge_attempts;
CREATE POLICY "Admins view charge attempts"
ON public.subscription_charge_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_donor_subscriptions_due
  ON public.donor_subscriptions (next_payment_at)
  WHERE status = 'active' AND payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donor_subscriptions_processing
  ON public.donor_subscriptions (processing_at)
  WHERE processing_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_charge_attempts_subscription
  ON public.subscription_charge_attempts (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_donations_yookassa_payment_id
  ON public.donations (yookassa_payment_id)
  WHERE yookassa_payment_id IS NOT NULL;
