-- Add visibility flag to campaigns
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

-- Update public-read RLS policy to also require visibility
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;

CREATE POLICY "Anyone can view active campaigns"
ON public.campaigns
FOR SELECT
TO public
USING (
  (
    (status = 'active' OR status = 'completed')
    AND visible = true
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);