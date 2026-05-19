CREATE OR REPLACE FUNCTION public.validate_donor_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.interval NOT IN ('hourly','weekly','biweekly','monthly') THEN
    RAISE EXCEPTION 'invalid interval: %, must be hourly|weekly|biweekly|monthly', NEW.interval;
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