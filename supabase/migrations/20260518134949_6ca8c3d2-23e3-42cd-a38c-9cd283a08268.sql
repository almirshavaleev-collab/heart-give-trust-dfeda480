ALTER TABLE public.donor_subscriptions
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'yookassa';

UPDATE public.donor_subscriptions
  SET created_via = 'mock'
  WHERE (payment_method_type = 'mock' OR is_test = true) AND created_via <> 'mock';

DROP FUNCTION IF EXISTS public.donor_my_subscriptions();

CREATE OR REPLACE FUNCTION public.donor_my_subscriptions()
 RETURNS TABLE(id uuid, status text, amount numeric, currency text, frequency text, next_payment_at timestamp with time zone, last_charge_at timestamp with time zone, card_last4 text, card_type text, card_expiry text, paused_reason text, campaign_id uuid, created_at timestamp with time zone, is_test boolean, created_via text, payment_method_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, status, amount, currency, "interval" AS frequency,
         next_payment_at, last_charge_at,
         card_last4, card_type, card_expiry,
         paused_reason, campaign_id, created_at, is_test, created_via, payment_method_type
  FROM public.donor_subscriptions
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_recurring_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_active int; v_paused int; v_past_due int; v_canceled int;
  v_mrr numeric; v_attempts_30d int; v_failed_30d int;
  v_recovered_30d int; v_avg_lifetime_days numeric;
  v_mock_count int; v_mock_active int; v_mock_mrr numeric;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;

  select count(*) filter (where status='active'),
         count(*) filter (where status='paused'),
         count(*) filter (where status='past_due'),
         count(*) filter (where status='canceled')
    into v_active, v_paused, v_past_due, v_canceled
    from public.donor_subscriptions
    where is_test=false and coalesce(payment_method_type,'') <> 'mock';

  select coalesce(sum(case interval
      when 'weekly' then amount*4.345
      when 'biweekly' then amount*2.1725
      when 'monthly' then amount else 0 end),0)
    into v_mrr
    from public.donor_subscriptions
    where status='active' and is_test=false and coalesce(payment_method_type,'') <> 'mock';

  select count(*), count(*) filter (where status='active'),
         coalesce(sum(case when status='active' then
           case interval
             when 'weekly' then amount*4.345
             when 'biweekly' then amount*2.1725
             when 'monthly' then amount else 0 end
           else 0 end), 0)
    into v_mock_count, v_mock_active, v_mock_mrr
    from public.donor_subscriptions
    where is_test=true or payment_method_type='mock' or created_via='mock';

  select count(*),
         count(*) filter (where status in ('create_failed','network_error','retry_scheduled','past_due'))
    into v_attempts_30d, v_failed_30d
    from public.subscription_charge_attempts
    where created_at > now()-interval '30 days' and is_test=false;

  select count(*) into v_recovered_30d from public.subscription_events
    where event_type='recovered' and created_at > now()-interval '30 days';

  select coalesce(avg(extract(epoch from (coalesce(canceled_at, now()) - created_at))/86400.0),0)
    into v_avg_lifetime_days from public.donor_subscriptions where is_test=false;

  return jsonb_build_object(
    'active',v_active,'paused',v_paused,'past_due',v_past_due,'canceled',v_canceled,
    'mrr_rub', round(v_mrr,2),
    'mock_count', v_mock_count,
    'mock_active', v_mock_active,
    'mock_mrr_rub', round(v_mock_mrr,2),
    'attempts_30d',v_attempts_30d,'failed_30d',v_failed_30d,
    'failed_rate_30d', case when v_attempts_30d>0 then round((v_failed_30d::numeric/v_attempts_30d)*100,2) else 0 end,
    'recovered_30d',v_recovered_30d,
    'avg_lifetime_days', round(v_avg_lifetime_days,1),
    'generated_at', now()
  );
end$function$;