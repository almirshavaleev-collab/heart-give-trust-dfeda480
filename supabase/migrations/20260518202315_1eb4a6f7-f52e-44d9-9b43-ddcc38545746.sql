ALTER TABLE public.donor_subscriptions DROP CONSTRAINT IF EXISTS donor_subscriptions_interval_check;
ALTER TABLE public.donor_subscriptions ADD CONSTRAINT donor_subscriptions_interval_check
  CHECK ("interval" = ANY (ARRAY['weekly','biweekly','monthly','test_5min','test_20min','test_60min','month','week']));