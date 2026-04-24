
-- Backfill missing profile emails from auth.users
UPDATE public.profiles p
SET email = u.email, updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.email = '')
  AND u.email IS NOT NULL;

-- Update request_link_donations_code to fall back to auth.users.email
CREATE OR REPLACE FUNCTION public.request_link_donations_code(_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_email text;
  v_last_requested timestamptz;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT email, link_email_last_requested_at
    INTO v_email, v_last_requested
  FROM public.profiles
  WHERE user_id = _user_id;

  IF v_email IS NULL OR v_email = '' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
    IF v_email IS NOT NULL AND v_email <> '' THEN
      UPDATE public.profiles SET email = v_email, updated_at = now() WHERE user_id = _user_id;
    END IF;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'no_email';
  END IF;

  IF v_last_requested IS NOT NULL AND v_last_requested > now() - interval '60 seconds' THEN
    INSERT INTO public.donor_link_audit (user_id, email, event, metadata)
    VALUES (_user_id, v_email, 'rate_limited',
      jsonb_build_object('seconds_since_last',
        EXTRACT(EPOCH FROM (now() - v_last_requested))::int));
    RAISE EXCEPTION 'rate_limited';
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  UPDATE public.profiles
  SET link_email_code_hash = public._hash_link_code(v_code),
      link_email_expires_at = now() + interval '15 minutes',
      link_email_last_requested_at = now(),
      link_email_attempts = 0,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.donor_link_audit (user_id, email, event)
  VALUES (_user_id, v_email, 'code_requested');

  RETURN v_code;
END;
$function$;

-- Update confirm_link_donations to also fall back to auth.users.email
CREATE OR REPLACE FUNCTION public.confirm_link_donations(_user_id uuid, _code text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_hash text;
  v_expires timestamptz;
  v_attempts int;
  v_updated int;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _code IS NULL OR length(_code) <> 6 THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  SELECT email, link_email_code_hash, link_email_expires_at, link_email_attempts
    INTO v_email, v_hash, v_expires, v_attempts
  FROM public.profiles
  WHERE user_id = _user_id;

  IF v_email IS NULL OR v_email = '' THEN
    SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'no_email'; END IF;

  IF v_hash IS NULL OR v_expires IS NULL OR v_expires < now() THEN
    INSERT INTO public.donor_link_audit (user_id, email, event)
    VALUES (_user_id, v_email, 'code_expired');
    RAISE EXCEPTION 'code_expired';
  END IF;

  IF v_attempts >= 5 THEN
    UPDATE public.profiles
    SET link_email_code_hash = NULL,
        link_email_expires_at = NULL,
        updated_at = now()
    WHERE user_id = _user_id;
    INSERT INTO public.donor_link_audit (user_id, email, event)
    VALUES (_user_id, v_email, 'too_many_attempts');
    RAISE EXCEPTION 'too_many_attempts';
  END IF;

  IF v_hash <> public._hash_link_code(_code) THEN
    UPDATE public.profiles
    SET link_email_attempts = link_email_attempts + 1,
        updated_at = now()
    WHERE user_id = _user_id;
    INSERT INTO public.donor_link_audit (user_id, email, event, metadata)
    VALUES (_user_id, v_email, 'invalid_code_attempt',
      jsonb_build_object('attempt', v_attempts + 1));
    RAISE EXCEPTION 'invalid_code';
  END IF;

  UPDATE public.donations
  SET user_id = _user_id
  WHERE user_id IS NULL
    AND status = 'succeeded'
    AND lower(donor_email) = lower(v_email);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.profiles
  SET link_email_code_hash = NULL,
      link_email_expires_at = NULL,
      link_email_attempts = 0,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.donor_link_audit (user_id, email, event)
  VALUES (_user_id, v_email, 'code_verified');

  INSERT INTO public.donor_link_audit (user_id, email, event, metadata)
  VALUES (_user_id, v_email, 'donations_linked',
    jsonb_build_object('count', v_updated));

  PERFORM public.evaluate_user_achievements(_user_id);

  RETURN v_updated;
END;
$function$;
