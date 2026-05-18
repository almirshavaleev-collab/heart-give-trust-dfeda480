DROP FUNCTION IF EXISTS public.donor_my_subscriptions();
CREATE FUNCTION public.donor_my_subscriptions()
 RETURNS TABLE(id uuid, status text, amount numeric, currency text, frequency text, next_payment_at timestamp with time zone, last_charge_at timestamp with time zone, card_last4 text, card_type text, card_expiry text, paused_reason text, campaign_id uuid, created_at timestamp with time zone, is_test boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, status, amount, currency, "interval" AS frequency,
         next_payment_at, last_charge_at,
         card_last4, card_type, card_expiry,
         paused_reason, campaign_id, created_at, is_test
  FROM public.donor_subscriptions
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$function$;