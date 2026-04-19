ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS crop_settings jsonb;

COMMENT ON COLUMN public.campaigns.crop_settings IS 'Cover image crop settings: { x: number (-100..100, % offset), y: number (-100..100, % offset), scale: number (>=1), aspect: number (e.g. 16/9) }';