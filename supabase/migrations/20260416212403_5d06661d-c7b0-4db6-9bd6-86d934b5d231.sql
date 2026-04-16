ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS source_ip text,
  ADD COLUMN IF NOT EXISTS object_id text,
  ADD COLUMN IF NOT EXISTS object_status text,
  ADD COLUMN IF NOT EXISTS donation_id uuid,
  ADD COLUMN IF NOT EXISTS result text;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_object_id ON public.webhook_logs(object_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_result ON public.webhook_logs(result);