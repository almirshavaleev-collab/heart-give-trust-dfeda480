-- Donor-facing RPCs for recurring dashboard

CREATE OR REPLACE FUNCTION public.donor_my_charge_attempts(_subscription_id uuid, _limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  status text,
  yookassa_payment_id text,
  donation_id uuid,
  error_code text,
  error_description text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT user_id INTO v_owner FROM public.donor_subscriptions WHERE id = _subscription_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT a.id, a.status, a.yookassa_payment_id, a.donation_id,
         a.error_code, a.error_description, a.metadata, a.created_at
  FROM public.subscription_charge_attempts a
  WHERE a.subscription_id = _subscription_id
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$$;

-- Allow donor to trigger immediate retry for their past_due subscription.
-- Just resets schedule and clears locks — actual charge is done by recurring engine.
CREATE OR REPLACE FUNCTION public.donor_retry_subscription_now(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_status text;
  v_last_retry timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT user_id, status, last_retry_at
    INTO v_owner, v_status, v_last_retry
  FROM public.donor_subscriptions WHERE id = _id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_status NOT IN ('past_due','active') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  -- throttle: max 1 manual retry per 10 minutes
  IF v_last_retry IS NOT NULL AND v_last_retry > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  UPDATE public.donor_subscriptions
  SET next_payment_at = now(),
      processing_at = NULL,
      current_billing_key = NULL,
      last_retry_at = now(),
      updated_at = now()
  WHERE id = _id;

  INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
  VALUES (_id, 'manual_retry_requested', jsonb_build_object('source','donor','actor',auth.uid()));
END;
$$;