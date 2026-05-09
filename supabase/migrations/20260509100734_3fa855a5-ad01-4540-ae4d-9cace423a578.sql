
-- ========= Pre-realtime hardening =========

-- 1. billing_cycle_key on donations (nullable for one-time compatibility)
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS billing_cycle_key text;

CREATE UNIQUE INDEX IF NOT EXISTS donations_billing_cycle_uniq
  ON public.donations (billing_cycle_key)
  WHERE billing_cycle_key IS NOT NULL;

-- 2. billing_cycle_key on charge attempts + partial unique
ALTER TABLE public.subscription_charge_attempts
  ADD COLUMN IF NOT EXISTS billing_cycle_key text;

-- Allow multiple create_failed/network_error retries for the same cycle,
-- but block duplicate "real" attempts.
CREATE UNIQUE INDEX IF NOT EXISTS sca_billing_cycle_uniq
  ON public.subscription_charge_attempts (subscription_id, billing_cycle_key)
  WHERE billing_cycle_key IS NOT NULL
    AND status NOT IN ('create_failed','network_error','internal_error','dry_run');

-- 3. Webhook idempotency (provider+event+object_id)
CREATE UNIQUE INDEX IF NOT EXISTS webhook_logs_event_object_uniq
  ON public.webhook_logs (provider, event, object_id)
  WHERE event IS NOT NULL AND object_id IS NOT NULL;

-- 4. Heartbeats table for cron runs
CREATE TABLE IF NOT EXISTS public.recurring_cron_heartbeats (
  job text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text,
  last_payload jsonb
);

ALTER TABLE public.recurring_cron_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view heartbeats" ON public.recurring_cron_heartbeats;
CREATE POLICY "Admins can view heartbeats"
  ON public.recurring_cron_heartbeats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Helper indexes
CREATE INDEX IF NOT EXISTS idx_subs_processing_stale
  ON public.donor_subscriptions (processing_at) WHERE processing_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subs_billing_key_stale
  ON public.donor_subscriptions (updated_at) WHERE current_billing_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_payment_id
  ON public.donations (yookassa_payment_id) WHERE yookassa_payment_id IS NOT NULL;

-- 6. Admin timeseries RPC (server-side aggregation)
CREATE OR REPLACE FUNCTION public.admin_recurring_timeseries(_days int DEFAULT 14)
RETURNS TABLE(day date, attempts int, succeeded int, failed int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (now()::date - (GREATEST(1, LEAST(_days, 90)) - 1) * INTERVAL '1 day')::date,
      now()::date, INTERVAL '1 day'
    )::date AS day
  )
  SELECT d.day,
    COALESCE(COUNT(a.id) FILTER (WHERE a.id IS NOT NULL), 0)::int AS attempts,
    COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'succeeded'), 0)::int AS succeeded,
    COALESCE(COUNT(a.id) FILTER (WHERE a.status IN
      ('create_failed','network_error','retry_scheduled','past_due','paused')), 0)::int AS failed
  FROM days d
  LEFT JOIN public.subscription_charge_attempts a
    ON a.created_at::date = d.day
  GROUP BY d.day
  ORDER BY d.day;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recurring_timeseries(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recurring_timeseries(int) TO authenticated;

-- 7. Readiness aggregation RPC
CREATE OR REPLACE FUNCTION public.admin_recurring_readiness()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_now timestamptz := now();
  v_pending_old int;
  v_stale_exec int;
  v_stale_billing int;
  v_failed_24h int;
  v_attempts_24h int;
  v_retries_queued int;
  v_last_charge timestamptz;
  v_last_webhook timestamptz;
  v_cron jsonb;
  v_components jsonb;
  v_overall text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT COUNT(*) INTO v_pending_old FROM public.donations
   WHERE status='pending' AND payment_type='recurring' AND created_at < v_now - interval '15 minutes';

  SELECT COUNT(*) INTO v_stale_exec FROM public.donor_subscriptions
   WHERE processing_at IS NOT NULL AND processing_at < v_now - interval '10 minutes';

  SELECT COUNT(*) INTO v_stale_billing FROM public.donor_subscriptions
   WHERE current_billing_key IS NOT NULL AND updated_at < v_now - interval '24 hours';

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status IN ('create_failed','network_error','retry_scheduled','past_due','paused'))
    INTO v_attempts_24h, v_failed_24h
    FROM public.subscription_charge_attempts
   WHERE created_at > v_now - interval '24 hours';

  SELECT COUNT(*) INTO v_retries_queued FROM public.donor_subscriptions
   WHERE status IN ('active','past_due') AND next_payment_at <= v_now AND retry_count > 0;

  SELECT MAX(last_charge_at) INTO v_last_charge FROM public.donor_subscriptions;
  SELECT MAX(created_at) INTO v_last_webhook FROM public.webhook_logs;

  SELECT jsonb_object_agg(job, jsonb_build_object('last_run_at', last_run_at, 'status', last_status))
    INTO v_cron FROM public.recurring_cron_heartbeats;

  v_components := jsonb_build_object(
    'cron', v_cron,
    'webhook', jsonb_build_object(
      'last_event_at', v_last_webhook,
      'lag_min', CASE WHEN v_last_webhook IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (v_now - v_last_webhook))/60 END,
      'status', CASE
        WHEN v_last_webhook IS NULL THEN 'unknown'
        WHEN v_last_webhook < v_now - interval '24 hours' THEN 'degraded'
        ELSE 'healthy' END
    ),
    'locks', jsonb_build_object(
      'stale_exec', v_stale_exec, 'stale_billing', v_stale_billing,
      'status', CASE WHEN v_stale_exec > 10 OR v_stale_billing > 10 THEN 'critical'
        WHEN v_stale_exec > 0 OR v_stale_billing > 0 THEN 'degraded' ELSE 'healthy' END
    ),
    'orphans', jsonb_build_object(
      'pending_old_recurring', v_pending_old,
      'status', CASE WHEN v_pending_old > 50 THEN 'critical'
        WHEN v_pending_old > 10 THEN 'degraded' ELSE 'healthy' END
    ),
    'retries', jsonb_build_object(
      'queued', v_retries_queued, 'failed_24h', v_failed_24h, 'attempts_24h', v_attempts_24h,
      'failure_rate', CASE WHEN v_attempts_24h > 0
        THEN round((v_failed_24h::numeric / v_attempts_24h) * 100, 2) ELSE 0 END,
      'status', CASE WHEN v_attempts_24h > 0 AND v_failed_24h::numeric / v_attempts_24h > 0.30 THEN 'critical'
        WHEN v_attempts_24h > 0 AND v_failed_24h::numeric / v_attempts_24h > 0.15 THEN 'degraded'
        ELSE 'healthy' END
    ),
    'last_success', jsonb_build_object('charge_at', v_last_charge)
  );

  v_overall := CASE
    WHEN v_components @> '{"locks":{"status":"critical"}}' OR
         v_components @> '{"orphans":{"status":"critical"}}' OR
         v_components @> '{"retries":{"status":"critical"}}' THEN 'critical'
    WHEN v_components::text LIKE '%"degraded"%' THEN 'degraded'
    ELSE 'healthy' END;

  RETURN jsonb_build_object(
    'overall', v_overall, 'generated_at', v_now, 'components', v_components
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recurring_readiness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recurring_readiness() TO authenticated;

-- 8. Lock down donor RPCs
REVOKE ALL ON FUNCTION public.donor_my_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donor_my_subscriptions() TO authenticated;
REVOKE ALL ON FUNCTION public.donor_my_charge_attempts(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donor_my_charge_attempts(uuid, int) TO authenticated;
REVOKE ALL ON FUNCTION public.donor_pause_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donor_pause_subscription(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.donor_resume_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donor_resume_subscription(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.donor_cancel_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donor_cancel_subscription(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.donor_retry_subscription_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donor_retry_subscription_now(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_recurring_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recurring_metrics() TO authenticated;

-- 9. Realtime opt-in (donor + events + attempts) for staged rollout.
ALTER TABLE public.donor_subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_events REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_charge_attempts REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.donor_subscriptions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_charge_attempts; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
