CREATE TABLE public.donor_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_user_id UUID,
  donor_email TEXT,
  donor_phone TEXT,
  donor_key TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_donor_notes_key ON public.donor_notes(donor_key);

ALTER TABLE public.donor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view donor notes"
ON public.donor_notes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert donor notes"
ON public.donor_notes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update donor notes"
ON public.donor_notes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete donor notes"
ON public.donor_notes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_donor_notes_updated_at
BEFORE UPDATE ON public.donor_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();