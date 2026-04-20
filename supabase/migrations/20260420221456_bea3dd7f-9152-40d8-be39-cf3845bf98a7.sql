-- Allow 'archived' as a valid status value.
-- We use a CHECK constraint with whitelist to keep things explicit.
-- Drop existing check (if any) to avoid duplicates.
DO $$
DECLARE
  c_name text;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.campaigns'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.campaigns DROP CONSTRAINT %I', c_name);
  END LOOP;
END$$;

ALTER TABLE public.campaigns
ADD CONSTRAINT campaigns_status_check
CHECK (status IN ('draft', 'active', 'completed', 'archived'));

-- Update public RLS to exclude archived from public list
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;

CREATE POLICY "Anyone can view active campaigns"
ON public.campaigns
FOR SELECT
TO public
USING (
  (
    status IN ('active', 'completed')
    AND visible = true
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);