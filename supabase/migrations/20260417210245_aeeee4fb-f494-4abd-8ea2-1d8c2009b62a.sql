-- Public-safe view of donations for display on campaign pages
-- Uses SECURITY INVOKER (default) so RLS of querying user applies to underlying table.
-- We expose ONLY whitelisted, non-PII columns and only succeeded donations.

CREATE OR REPLACE VIEW public.public_donations
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.campaign_id,
  d.amount,
  d.is_anonymous,
  CASE WHEN d.is_anonymous THEN NULL ELSE d.donor_name END AS donor_name,
  d.paid_at,
  d.created_at,
  d.status
FROM public.donations d
WHERE d.status = 'succeeded';

-- Grant read access to anon and authenticated roles
GRANT SELECT ON public.public_donations TO anon, authenticated;

-- Add a permissive SELECT policy on donations limited strictly to succeeded rows,
-- so the view (running as invoker) can return rows for unauthenticated visitors.
-- Email/phone/yookassa_payment_id are NOT exposed because the view only selects safe columns.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'donations'
      AND policyname = 'Public can view succeeded donations via view'
  ) THEN
    CREATE POLICY "Public can view succeeded donations via view"
      ON public.donations
      FOR SELECT
      TO anon, authenticated
      USING (status = 'succeeded');
  END IF;
END$$;