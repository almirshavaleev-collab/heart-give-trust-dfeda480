
CREATE OR REPLACE FUNCTION public.donor_my_charge_attempts(_subscription_id uuid, _limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, status text, yookassa_payment_id text, donation_id uuid, error_code text, error_description text, metadata jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT s.user_id INTO v_owner
  FROM public.donor_subscriptions s
  WHERE s.id = _subscription_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT a.id, a.status, a.yookassa_payment_id, a.donation_id,
         a.error_code, a.error_description, a.metadata, a.created_at
  FROM public.subscription_charge_attempts a
  WHERE a.subscription_id = _subscription_id
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$function$;

REVOKE ALL ON FUNCTION public.donor_my_charge_attempts(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donor_my_charge_attempts(uuid, integer) TO authenticated;
