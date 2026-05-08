-- Allow 'recurring' as a valid payment_type (keep 'monthly' for backward compat)
ALTER TABLE public.donations
  DROP CONSTRAINT IF EXISTS donations_payment_type_check;

ALTER TABLE public.donations
  ADD CONSTRAINT donations_payment_type_check
  CHECK (payment_type = ANY (ARRAY['one_time'::text, 'monthly'::text, 'recurring'::text]));

-- Subscription needs to remember which payment instrument was saved (card / sbp / etc.)
ALTER TABLE public.donor_subscriptions
  ADD COLUMN IF NOT EXISTS payment_method_type text;

-- Helpful index for the autopay engine: pull due active subscriptions with a saved method
CREATE INDEX IF NOT EXISTS idx_donor_subscriptions_due
  ON public.donor_subscriptions (next_payment_at)
  WHERE status = 'active' AND payment_method_id IS NOT NULL;