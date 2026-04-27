-- Update public RLS policy on campaigns to rely solely on status
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;

CREATE POLICY "Anyone can view active campaigns"
ON public.campaigns
FOR SELECT
TO public
USING (
  (status IN ('active', 'completed'))
  OR has_role(auth.uid(), 'admin'::app_role)
);