CREATE OR REPLACE FUNCTION public.increment_campaign_collected(
  _campaign_id uuid,
  _amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _campaign_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.campaigns
  SET collected_amount = collected_amount + _amount,
      updated_at = now()
  WHERE id = _campaign_id;
END;
$$;

-- Только сервер может вызывать
REVOKE ALL ON FUNCTION public.increment_campaign_collected(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_campaign_collected(uuid, numeric) FROM anon, authenticated;