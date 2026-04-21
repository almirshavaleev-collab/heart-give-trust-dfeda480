
-- =========================
-- 1. PROFILES: extend
-- =========================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS public_display_name text,
  ADD COLUMN IF NOT EXISTS is_public_donor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS link_email_code text,
  ADD COLUMN IF NOT EXISTS link_email_expires_at timestamptz;

-- Allow user to INSERT their own profile (safety net; trigger creates it normally)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin can manage all profiles
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========================
-- 2. DONATIONS: extend
-- =========================
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RUB',
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'yookassa',
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS payment_method_type text,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;

-- Backfill payment_id from yookassa_payment_id where empty
UPDATE public.donations
SET payment_id = yookassa_payment_id
WHERE payment_id IS NULL AND yookassa_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donations_user_id ON public.donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON public.donations(donor_email);
CREATE INDEX IF NOT EXISTS idx_donations_campaign_id ON public.donations(campaign_id);

-- RLS: user sees their own donations
DROP POLICY IF EXISTS "Users can view own donations" ON public.donations;
CREATE POLICY "Users can view own donations"
  ON public.donations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================
-- 3. DONOR SUBSCRIPTIONS
-- =========================
CREATE TABLE IF NOT EXISTS public.donor_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  external_subscription_id text,
  payment_method_id text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'RUB',
  interval text NOT NULL DEFAULT 'month',
  status text NOT NULL DEFAULT 'active', -- active | paused | canceled
  next_payment_at timestamptz,
  paused_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donor_subscriptions_status_check CHECK (status IN ('active','paused','canceled')),
  CONSTRAINT donor_subscriptions_interval_check CHECK (interval IN ('week','month','quarter','year'))
);

CREATE INDEX IF NOT EXISTS idx_donor_subscriptions_user_id ON public.donor_subscriptions(user_id);

ALTER TABLE public.donor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions"
  ON public.donor_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all subscriptions"
  ON public.donor_subscriptions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_donor_subscriptions_updated_at
  BEFORE UPDATE ON public.donor_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- 4. ACHIEVEMENTS catalog
-- =========================
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON public.achievements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins manage achievements"
  ON public.achievements FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.achievements (code, title, description, icon, sort_order) VALUES
  ('first_donation', 'Первое пожертвование', 'Вы сделали свой первый вклад в добрые дела', 'Heart', 1),
  ('five_donations', '5 пожертвований', 'Вы поддержали фонд пять раз', 'Sparkles', 2),
  ('ten_thousand', 'Меценат', 'Суммарно пожертвовано 10 000 ₽ и более', 'Award', 3),
  ('recurring_helper', 'Регулярная помощь', 'Вы оформили регулярное пожертвование', 'Repeat', 4),
  ('three_campaigns', 'Широкое сердце', 'Вы поддержали 3 разных сбора', 'HandHeart', 5)
ON CONFLICT (code) DO NOTHING;

-- =========================
-- 5. USER ACHIEVEMENTS
-- =========================
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own achievements"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage user achievements"
  ON public.user_achievements FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========================
-- 6. Update handle_new_user trigger to fill full_name from metadata
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin_exists BOOLEAN;
  _assigned_role app_role;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO _admin_exists;

  IF _admin_exists THEN
    _assigned_role := 'user';
  ELSE
    _assigned_role := 'admin';
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _assigned_role);

  RETURN NEW;
END;
$function$;

-- Create the auth.users trigger if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END$$;

-- =========================
-- 7. Award achievements function
-- =========================
CREATE OR REPLACE FUNCTION public.evaluate_user_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
  v_total numeric;
  v_campaigns int;
  v_recurring int;
  v_ach_id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*), COALESCE(SUM(amount),0), COUNT(DISTINCT campaign_id)
  INTO v_count, v_total, v_campaigns
  FROM public.donations
  WHERE user_id = _user_id AND status = 'succeeded';

  SELECT COUNT(*) INTO v_recurring
  FROM public.donor_subscriptions
  WHERE user_id = _user_id AND status IN ('active','paused');

  -- first_donation
  IF v_count >= 1 THEN
    SELECT id INTO v_ach_id FROM public.achievements WHERE code = 'first_donation';
    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (_user_id, v_ach_id) ON CONFLICT DO NOTHING;
  END IF;

  -- five_donations
  IF v_count >= 5 THEN
    SELECT id INTO v_ach_id FROM public.achievements WHERE code = 'five_donations';
    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (_user_id, v_ach_id) ON CONFLICT DO NOTHING;
  END IF;

  -- ten_thousand
  IF v_total >= 10000 THEN
    SELECT id INTO v_ach_id FROM public.achievements WHERE code = 'ten_thousand';
    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (_user_id, v_ach_id) ON CONFLICT DO NOTHING;
  END IF;

  -- recurring_helper
  IF v_recurring >= 1 THEN
    SELECT id INTO v_ach_id FROM public.achievements WHERE code = 'recurring_helper';
    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (_user_id, v_ach_id) ON CONFLICT DO NOTHING;
  END IF;

  -- three_campaigns
  IF v_campaigns >= 3 THEN
    SELECT id INTO v_ach_id FROM public.achievements WHERE code = 'three_campaigns';
    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (_user_id, v_ach_id) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- =========================
-- 8. Link historical donations after email-code confirmation
-- =========================
CREATE OR REPLACE FUNCTION public.request_link_donations_code(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  UPDATE public.profiles
  SET link_email_code = v_code,
      link_email_expires_at = now() + interval '15 minutes',
      updated_at = now()
  WHERE user_id = _user_id;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_link_donations(_user_id uuid, _code text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_stored_code text;
  v_expires timestamptz;
  v_updated int;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT email, link_email_code, link_email_expires_at
  INTO v_email, v_stored_code, v_expires
  FROM public.profiles
  WHERE user_id = _user_id;

  IF v_email IS NULL THEN RAISE EXCEPTION 'no_email'; END IF;
  IF v_stored_code IS NULL OR v_expires IS NULL OR v_expires < now() THEN
    RAISE EXCEPTION 'code_expired';
  END IF;
  IF v_stored_code <> _code THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  UPDATE public.donations
  SET user_id = _user_id
  WHERE user_id IS NULL
    AND status = 'succeeded'
    AND lower(donor_email) = lower(v_email);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE public.profiles
  SET link_email_code = NULL, link_email_expires_at = NULL, updated_at = now()
  WHERE user_id = _user_id;

  PERFORM public.evaluate_user_achievements(_user_id);

  RETURN v_updated;
END;
$$;
