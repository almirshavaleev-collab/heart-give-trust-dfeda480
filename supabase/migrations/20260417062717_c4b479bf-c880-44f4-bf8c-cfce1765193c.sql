-- 1. completed_at column
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill: existing completed campaigns get updated_at as completed_at
UPDATE public.campaigns
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- 2. Trigger to maintain completed_at automatically
CREATE OR REPLACE FUNCTION public.handle_campaign_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
      NEW.completed_at = now();
    ELSIF NEW.status <> 'completed' THEN
      NEW.completed_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_status_change ON public.campaigns;
CREATE TRIGGER trg_campaign_status_change
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.handle_campaign_status_change();

-- 3. Validation constraints
ALTER TABLE public.campaigns
DROP CONSTRAINT IF EXISTS campaigns_target_amount_positive;
ALTER TABLE public.campaigns
ADD CONSTRAINT campaigns_target_amount_positive CHECK (target_amount > 0);

ALTER TABLE public.campaigns
DROP CONSTRAINT IF EXISTS campaigns_collected_amount_nonneg;
ALTER TABLE public.campaigns
ADD CONSTRAINT campaigns_collected_amount_nonneg CHECK (collected_amount >= 0);

-- 4. Prevent deletion of campaigns that have donations
CREATE OR REPLACE FUNCTION public.prevent_campaign_delete_with_donations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.donations WHERE campaign_id = OLD.id) THEN
    RAISE EXCEPTION 'Нельзя удалить сбор: по нему уже есть пожертвования. Переведите сбор в статус "Завершён" или "Архив".';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_campaign_delete ON public.campaigns;
CREATE TRIGGER trg_prevent_campaign_delete
BEFORE DELETE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.prevent_campaign_delete_with_donations();

-- 5. Enable Realtime
ALTER TABLE public.campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.donations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'campaigns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'donations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
  END IF;
END $$;