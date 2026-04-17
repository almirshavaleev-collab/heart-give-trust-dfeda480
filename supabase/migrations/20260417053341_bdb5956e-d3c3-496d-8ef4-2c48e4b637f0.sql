-- Добавляем флаг анонимности
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- Добавляем тип платежа (разовый / ежемесячный) — задел под подписки
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'one_time';

-- Ограничение допустимых значений
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'donations_payment_type_check'
  ) THEN
    ALTER TABLE public.donations
      ADD CONSTRAINT donations_payment_type_check
      CHECK (payment_type IN ('one_time', 'monthly'));
  END IF;
END $$;

-- Индекс для будущих фильтров в админке
CREATE INDEX IF NOT EXISTS donations_payment_type_idx
  ON public.donations (payment_type);
CREATE INDEX IF NOT EXISTS donations_is_anonymous_idx
  ON public.donations (is_anonymous);