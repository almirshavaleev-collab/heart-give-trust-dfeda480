
-- 1. Extra columns
ALTER TABLE public.donor_subscriptions
  ADD COLUMN IF NOT EXISTS current_billing_key text,
  ADD COLUMN IF NOT EXISTS paused_reason text;

CREATE INDEX IF NOT EXISTS idx_donor_subscriptions_billing_key
  ON public.donor_subscriptions (current_billing_key)
  WHERE current_billing_key IS NOT NULL;

-- 2. Dedup of charge attempts (only when payment_id is known)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_charge_attempt_payment_status
  ON public.subscription_charge_attempts (subscription_id, yookassa_payment_id, status)
  WHERE yookassa_payment_id IS NOT NULL;

-- 3. Lifecycle event log
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view subscription events" ON public.subscription_events;
CREATE POLICY "Admins view subscription events"
ON public.subscription_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_subscription_events_sub
  ON public.subscription_events (subscription_id, created_at DESC);

-- 4. Admin metrics function
CREATE OR REPLACE FUNCTION public.admin_recurring_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active int;
  v_paused int;
  v_past_due int;
  v_canceled int;
  v_mrr numeric;
  v_attempts_30d int;
  v_failed_30d int;
  v_recovered_30d int;
  v_avg_lifetime_days numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT COUNT(*) FILTER (WHERE status = 'active'),
         COUNT(*) FILTER (WHERE status = 'paused'),
         COUNT(*) FILTER (WHERE status = 'past_due'),
         COUNT(*) FILTER (WHERE status = 'canceled')
  INTO v_active, v_paused, v_past_due, v_canceled
  FROM public.donor_subscriptions;

  -- MRR: normalize all active subscriptions to monthly equivalent
  SELECT COALESCE(SUM(
    CASE interval
      WHEN 'weekly'   THEN amount * 4.345
      WHEN 'biweekly' THEN amount * 2.1725
      WHEN 'monthly'  THEN amount
      ELSE 0
    END
  ), 0)
  INTO v_mrr
  FROM public.donor_subscriptions
  WHERE status = 'active';

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status IN ('create_failed','network_error','retry_scheduled','past_due'))
  INTO v_attempts_30d, v_failed_30d
  FROM public.subscription_charge_attempts
  WHERE created_at > now() - interval '30 days';

  -- Recovered = past_due → active transitions in last 30d
  SELECT COUNT(*) INTO v_recovered_30d
  FROM public.subscription_events
  WHERE event_type = 'recovered' AND created_at > now() - interval '30 days';

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(canceled_at, now()) - created_at)) / 86400.0), 0)
  INTO v_avg_lifetime_days
  FROM public.donor_subscriptions;

  RETURN jsonb_build_object(
    'active', v_active,
    'paused', v_paused,
    'past_due', v_past_due,
    'canceled', v_canceled,
    'mrr_rub', round(v_mrr, 2),
    'attempts_30d', v_attempts_30d,
    'failed_30d', v_failed_30d,
    'failed_rate_30d', CASE WHEN v_attempts_30d > 0
      THEN round((v_failed_30d::numeric / v_attempts_30d) * 100, 2) ELSE 0 END,
    'recovered_30d', v_recovered_30d,
    'avg_lifetime_days', round(v_avg_lifetime_days, 1),
    'generated_at', now()
  );
END;
$function$;
