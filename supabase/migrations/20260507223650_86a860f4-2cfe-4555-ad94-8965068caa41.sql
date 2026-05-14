-- Allow guest subscriptions (user_id nullable)
ALTER TABLE public.donor_subscriptions
  ALTER COLUMN user_id DROP NOT NULL;

-- Track last successful charge
ALTER TABLE public.donor_subscriptions
  ADD COLUMN IF NOT EXISTS last_charge_at timestamptz;

-- Allow service-role/edge-functions and the user themselves to insert subscriptions
DROP POLICY IF EXISTS "Anyone can create subscription" ON public.donor_subscriptions;
CREATE POLICY "Anyone can create subscription"
  ON public.donor_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );

-- Validation: interval must be one of the supported values
CREATE OR REPLACE FUNCTION public.validate_donor_subscription()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.interval NOT IN ('weekly','biweekly','monthly') THEN
    RAISE EXCEPTION 'invalid interval: %, must be weekly|biweekly|monthly', NEW.interval;
  END IF;
  IF NEW.status NOT IN ('active','paused','canceled') THEN
    RAISE EXCEPTION 'invalid status: %', NEW.status;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS donor_subscriptions_validate ON public.donor_subscriptions;
CREATE TRIGGER donor_subscriptions_validate
  BEFORE INSERT OR UPDATE ON public.donor_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_donor_subscription();