
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS link_email_code_hash text,
  ADD COLUMN IF NOT EXISTS link_email_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_email_last_requested_at timestamptz;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS link_email_code;

CREATE TABLE IF NOT EXISTS public.donor_link_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  event text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.donor_link_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view donor link audit" ON public.donor_link_audit;
CREATE POLICY "Admins view donor link audit"
  ON public.donor_link_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_donor_link_audit_user
  ON public.donor_link_audit(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public._hash_link_code(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(_code, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.request_link_donations_code(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_email IS NULL THEN
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

CREATE OR REPLACE FUNCTION public.confirm_link_donations(_user_id uuid, _code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_email IS NULL THEN RAISE EXCEPTION 'no_email'; END IF;

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
