
-- 1. Backfill legacy charge_attempts statuses to canonical names.
UPDATE public.subscription_charge_attempts
SET status = CASE
  WHEN status LIKE 'created:succeeded'             THEN 'created_succeeded'
  WHEN status LIKE 'created:pending'               THEN 'created_pending'
  WHEN status LIKE 'created:waiting_for_capture'   THEN 'created_waiting_capture'
  WHEN status LIKE 'created:%'                     THEN 'created_pending'
  ELSE status
END
WHERE status LIKE 'created:%';

UPDATE public.subscription_charge_attempts
SET status = 'internal_error'
WHERE status NOT IN (
  'created_pending','created_waiting_capture','created_succeeded',
  'succeeded','retry_scheduled','past_due','paused',
  'network_error','internal_error','create_failed','dry_run'
);

ALTER TABLE public.subscription_charge_attempts
  DROP CONSTRAINT IF EXISTS subscription_charge_attempts_status_check;
ALTER TABLE public.subscription_charge_attempts
  ADD CONSTRAINT subscription_charge_attempts_status_check
  CHECK (status IN (
    'created_pending','created_waiting_capture','created_succeeded',
    'succeeded','retry_scheduled','past_due','paused',
    'network_error','internal_error','create_failed','dry_run'
  ));

-- Donor RPCs
CREATE OR REPLACE FUNCTION public.donor_pause_subscription(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT user_id INTO v_owner FROM public.donor_subscriptions WHERE id = _id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.donor_subscriptions
  SET status='paused', paused_at=now(), paused_reason='donor_paused',
      processing_at=NULL, current_billing_key=NULL, updated_at=now()
  WHERE id=_id AND status IN ('active','past_due');
  INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
  VALUES (_id, 'paused', jsonb_build_object('source','donor','actor',auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.donor_resume_subscription(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT user_id INTO v_owner FROM public.donor_subscriptions WHERE id = _id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.donor_subscriptions
  SET status='active', paused_at=NULL, paused_reason=NULL, retry_count=0,
      last_failure_reason=NULL, last_failure_code=NULL,
      processing_at=NULL, current_billing_key=NULL,
      next_payment_at=now(), updated_at=now()
  WHERE id=_id AND status IN ('paused','past_due');
  INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
  VALUES (_id, 'resumed', jsonb_build_object('source','donor','actor',auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.donor_cancel_subscription(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT user_id INTO v_owner FROM public.donor_subscriptions WHERE id = _id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.donor_subscriptions
  SET status='canceled', canceled_at=now(),
      processing_at=NULL, current_billing_key=NULL, updated_at=now()
  WHERE id=_id AND status <> 'canceled';
  INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
  VALUES (_id, 'canceled', jsonb_build_object('source','donor','actor',auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.donor_my_subscriptions()
RETURNS TABLE (
  id uuid, status text, amount numeric, currency text, frequency text,
  next_payment_at timestamptz, last_charge_at timestamptz,
  card_last4 text, card_type text, card_expiry text,
  paused_reason text, campaign_id uuid, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, status, amount, currency, "interval" AS frequency,
         next_payment_at, last_charge_at,
         card_last4, card_type, card_expiry,
         paused_reason, campaign_id, created_at
  FROM public.donor_subscriptions
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.donor_pause_subscription(uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.donor_resume_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.donor_cancel_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.donor_my_subscriptions()        FROM anon;
GRANT  EXECUTE ON FUNCTION public.donor_pause_subscription(uuid)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.donor_resume_subscription(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.donor_cancel_subscription(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.donor_my_subscriptions()        TO authenticated;
