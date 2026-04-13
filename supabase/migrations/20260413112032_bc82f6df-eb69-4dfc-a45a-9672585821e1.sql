
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  full_description TEXT,
  cover_image TEXT,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  collected_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'completed', 'draft')),
  beneficiary TEXT,
  purpose TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active campaigns" ON public.campaigns
  FOR SELECT USING (status = 'active' OR status = 'completed' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- News table
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published news" ON public.news
  FOR SELECT USING (published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage news" ON public.news
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_url TEXT,
  year INTEGER,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reports" ON public.reports
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage reports" ON public.reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-images', 'campaign-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('news-images', 'news-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('report-files', 'report-files', true);

-- Storage policies
CREATE POLICY "Public read campaign images" ON storage.objects FOR SELECT USING (bucket_id = 'campaign-images');
CREATE POLICY "Admins upload campaign images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete campaign images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'campaign-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read news images" ON storage.objects FOR SELECT USING (bucket_id = 'news-images');
CREATE POLICY "Admins upload news images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'news-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete news images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'news-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read report files" ON storage.objects FOR SELECT USING (bucket_id = 'report-files');
CREATE POLICY "Admins upload report files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete report files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'report-files' AND public.has_role(auth.uid(), 'admin'));
