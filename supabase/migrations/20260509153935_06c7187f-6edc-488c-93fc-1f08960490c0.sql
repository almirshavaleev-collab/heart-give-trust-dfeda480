ALTER TABLE public.donor_subscriptions DROP CONSTRAINT IF EXISTS donor_subscriptions_interval_check;
ALTER TABLE public.donor_subscriptions DROP CONSTRAINT IF EXISTS donor_subscriptions_status_check;

ALTER TABLE public.donor_subscriptions
  ADD CONSTRAINT donor_subscriptions_interval_check
  CHECK ("interval" IN ('weekly','biweekly','monthly'));

ALTER TABLE public.donor_subscriptions
  ADD CONSTRAINT donor_subscriptions_status_check
  CHECK (status IN ('active','past_due','paused','canceled'));