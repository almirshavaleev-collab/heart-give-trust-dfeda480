create unique index if not exists donations_yookassa_payment_id_unique
on public.donations (yookassa_payment_id)
where yookassa_payment_id is not null;