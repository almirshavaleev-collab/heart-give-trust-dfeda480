
-- 1) Безопасная функция сброса тестовых данных (доступна только админам)
CREATE OR REPLACE FUNCTION public.reset_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_donations int;
  v_campaigns int;
  v_webhooks int;
  v_subs int;
  v_notes int;
  v_audit int;
  v_user_ach int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  DELETE FROM public.webhook_logs;            GET DIAGNOSTICS v_webhooks = ROW_COUNT;
  DELETE FROM public.donor_subscriptions;     GET DIAGNOSTICS v_subs = ROW_COUNT;
  DELETE FROM public.donor_notes;             GET DIAGNOSTICS v_notes = ROW_COUNT;
  DELETE FROM public.donor_link_audit;        GET DIAGNOSTICS v_audit = ROW_COUNT;
  DELETE FROM public.user_achievements;       GET DIAGNOSTICS v_user_ach = ROW_COUNT;
  DELETE FROM public.donations;               GET DIAGNOSTICS v_donations = ROW_COUNT;
  DELETE FROM public.campaigns;               GET DIAGNOSTICS v_campaigns = ROW_COUNT;

  RETURN jsonb_build_object(
    'donations', v_donations,
    'campaigns', v_campaigns,
    'webhook_logs', v_webhooks,
    'donor_subscriptions', v_subs,
    'donor_notes', v_notes,
    'donor_link_audit', v_audit,
    'user_achievements', v_user_ach,
    'reset_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_test_data() TO authenticated;

-- 2) Первичный production cleanup (выполняется один раз сейчас, миграция запускается с правами владельца БД)
DELETE FROM public.webhook_logs;
DELETE FROM public.donor_subscriptions;
DELETE FROM public.donor_notes;
DELETE FROM public.donor_link_audit;
DELETE FROM public.user_achievements;
DELETE FROM public.donations;
DELETE FROM public.campaigns;
