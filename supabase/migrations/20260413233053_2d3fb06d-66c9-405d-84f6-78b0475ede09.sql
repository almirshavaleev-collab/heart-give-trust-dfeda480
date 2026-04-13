
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger: auto-create profile + assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_exists BOOLEAN;
  _assigned_role app_role;
BEGIN
  -- Check if any admin exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO _admin_exists;

  -- First user becomes admin, rest become 'user'
  IF _admin_exists THEN
    _assigned_role := 'user';
  ELSE
    _assigned_role := 'admin';
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'email');

  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _assigned_role);

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Timestamp trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
