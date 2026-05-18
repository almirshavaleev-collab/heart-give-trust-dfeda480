
-- 1. Drop sandbox/test admin RPC functions
DROP FUNCTION IF EXISTS public.admin_create_sandbox_subscription(numeric, text, uuid, integer);
DROP FUNCTION IF EXISTS public.admin_destroy_sandbox_data();
DROP FUNCTION IF EXISTS public.admin_fast_forward_subscription(uuid, integer);
DROP FUNCTION IF EXISTS public.admin_recent_test_events(integer);
DROP FUNCTION IF EXISTS public.admin_log_sandbox_action(text, jsonb);
DROP FUNCTION IF EXISTS public.admin_set_setting(text, jsonb);
DROP FUNCTION IF EXISTS public.admin_get_settings();
DROP FUNCTION IF EXISTS public.admin_recurring_metrics_extended();
DROP FUNCTION IF EXISTS public.reset_test_data();
DROP FUNCTION IF EXISTS public.is_test_user_or_admin();

-- 2. Drop sandbox-only tables (data already wiped)
DROP TABLE IF EXISTS public.sandbox_audit_log;
DROP TABLE IF EXISTS public.admin_settings;

-- 3. Production-only validation trigger: no test_* intervals, no auto is_test marking
CREATE OR REPLACE FUNCTION public.validate_donor_subscription()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.interval NOT IN ('weekly','biweekly','monthly') THEN
    RAISE EXCEPTION 'invalid interval: %, must be weekly|biweekly|monthly', NEW.interval;
  END IF;
  IF NEW.status NOT IN ('active','past_due','paused','canceled') THEN
    RAISE EXCEPTION 'invalid status: %, must be active|past_due|paused|canceled', NEW.status;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  -- Force production flags
  NEW.is_test := false;
  IF NEW.created_via IS NULL OR NEW.created_via IN ('test_recurring','mock','sandbox') THEN
    NEW.created_via := 'yookassa';
  END IF;
  RETURN NEW;
END;
$function$;
