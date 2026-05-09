CREATE OR REPLACE FUNCTION public.admin_recent_test_events(_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid,
  subscription_id uuid,
  event_type text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT e.id, e.subscription_id, e.event_type, e.metadata, e.created_at
  FROM public.subscription_events e
  WHERE e.event_type LIKE 'simulate_%'
     OR e.event_type LIKE 'test_%'
     OR e.event_type = 'test_payment_simulated'
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recent_test_events(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_test_events(int) TO authenticated;