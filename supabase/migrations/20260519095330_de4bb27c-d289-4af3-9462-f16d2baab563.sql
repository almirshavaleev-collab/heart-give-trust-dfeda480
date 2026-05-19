ALTER TABLE public.donor_subscriptions DROP CONSTRAINT IF EXISTS donor_subscriptions_interval_check;
ALTER TABLE public.donor_subscriptions ADD CONSTRAINT donor_subscriptions_interval_check
  CHECK ("interval" IN ('hourly','weekly','biweekly','monthly'));