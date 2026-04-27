-- Add soft-delete column
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON public.campaigns (deleted_at);

-- Update the existing trigger function: allow delete only when archived,
-- but also allow soft-delete (UPDATE deleted_at) for archived even with donations.
CREATE OR REPLACE FUNCTION public.prevent_campaign_delete_with_donations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status <> 'archived' THEN
    IF EXISTS (SELECT 1 FROM public.donations WHERE campaign_id = OLD.id) THEN
      RAISE EXCEPTION 'Нельзя удалить сбор: по нему уже есть пожертвования. Переведите сбор в статус "Архив".';
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;

-- Public RLS: hide deleted campaigns
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;
CREATE POLICY "Anyone can view active campaigns"
ON public.campaigns
FOR SELECT
TO public
USING (
  ((status = ANY (ARRAY['active'::text, 'completed'::text])) AND deleted_at IS NULL)
  OR has_role(auth.uid(), 'admin'::app_role)
);
