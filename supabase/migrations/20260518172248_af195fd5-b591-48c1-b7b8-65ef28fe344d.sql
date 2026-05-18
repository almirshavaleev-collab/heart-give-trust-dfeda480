
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_user boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_donor_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.interval NOT IN ('weekly','biweekly','monthly','test_5min','test_20min','test_60min') THEN
    RAISE EXCEPTION 'invalid interval: %, must be weekly|biweekly|monthly|test_5min|test_20min|test_60min', NEW.interval;
  END IF;
  IF NEW.status NOT IN ('active','past_due','paused','canceled') THEN
    RAISE EXCEPTION 'invalid status: %, must be active|past_due|paused|canceled', NEW.status;
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  -- Hard guardrail: only test_user / admin can persist test_* intervals.
  IF NEW.interval LIKE 'test\_%' ESCAPE '\' THEN
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'test_interval_requires_authenticated_user';
    END IF;
    IF NOT (
      public.has_role(NEW.user_id, 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.user_id AND p.is_test_user = true)
    ) THEN
      RAISE EXCEPTION 'test_interval_not_allowed_for_user';
    END IF;
    NEW.is_test := true;
    IF NEW.created_via IS NULL OR NEW.created_via = 'yookassa' THEN
      NEW.created_via := 'test_recurring';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_test_user_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN true
    ELSE COALESCE(
      (SELECT is_test_user FROM public.profiles WHERE user_id = auth.uid()),
      false
    )
  END;
$function$;
