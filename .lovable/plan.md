# Recurring QA / Sandbox Center

Превращение `/admin/recurring/testing` из monitoring panel в полноценную тестовую лабораторию. Всё additive, за feature flags, **production logic не трогаем**.

## Sandbox isolation guarantees (закрепляем в коде)

1. `donor_subscriptions.is_test = true` → cron pipeline пропускает реальный YooKassa charge (используем существующий `simulateChargeCycle`).
2. Sandbox donations создаются с `payment_provider='sandbox'` и `metadata.simulated=true` → `increment_campaign_collected` НЕ вызывается ни в webhook, ни в reconcile (добавим guard).
3. Sandbox emails не отправляются: `send-transactional-email` skip при `metadata.simulated=true`.
4. Все sandbox actions admin-gated + требуют `RECURRING_TEST_MODE=true` в DB-конфиге.

## 1. Schema (одна additive миграция)

```sql
-- Flags теперь живут в DB (env остаётся fallback)
create table public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
-- seed: recurring_enabled, recurring_test_mode, recurring_dry_run,
--       recurring_force_success, recurring_force_failure

-- is_test флаг на ключевых таблицах
alter table public.donor_subscriptions add column is_test boolean not null default false;
alter table public.donations            add column is_test boolean not null default false;
alter table public.subscription_charge_attempts add column is_test boolean not null default false;

-- Index для быстрого фильтра sandbox
create index idx_donor_subs_is_test on public.donor_subscriptions(is_test) where is_test = true;
```

RPC (admin-only, security definer):
- `admin_get_settings()` / `admin_set_setting(key, value)` — runtime flags.
- `admin_create_sandbox_subscription(amount, interval, campaign_id, donor_email, donor_name)`.
- `admin_fast_forward_subscription(id, seconds)` — двигает `next_payment_at` / `last_retry_at`.
- `admin_subscription_inspector(id)` — JSON: sub + последние attempts + events + webhook_logs.
- `admin_recurring_integrity_scan()` — возвращает массив issues `{kind, severity, count, sample_ids}`.
- `admin_recurring_metrics_extended()` — avg processing, retry success rate, dedupe count, stale-lock recoveries, shadow/simulated counts.

## 2. Edge function changes (минимально)

- `supabase/functions/_shared/recurring-config.ts` — `loadConfig()` сначала тянет из `admin_settings`, env как fallback.
- `process-recurring-payments` — если `sub.is_test=true` ИЛИ `dryRun` → ВСЕГДА `simulateChargeCycle`, никаких HTTP к YooKassa.
- `yookassa-webhook` + `reconcile-recurring-payments` — guard: если donation `is_test=true` → не вызывать `increment_campaign_collected`.
- `send-transactional-email` — skip при `payload.simulated === true`.
- `admin-recurring` — новые actions: `create_sandbox_subscription`, `fast_forward`, `inspector`, `integrity_scan`, `metrics_extended`, `chaos_run`, `cron_tick` (последовательно вызывает три cron функции через service role).

## 3. Frontend — `src/pages/admin/AdminRecurringTesting.tsx` (rewrite)

Раскладка через `Tabs`:

- **Overview** — sticky banner (SHADOW/PRODUCTION), extended metrics cards, кнопки `Run cron tick`, `Run integrity scan`, `Run chaos test`.
- **Subscriptions** — table (только `is_test=true` по умолчанию + toggle "show production"), realtime подписка на `donor_subscriptions`. Клик → Sheet inspector с табами Attempts / Events / Webhooks / Raw.
- **Create** — форма sandbox subscription creator.
- **Failures** — preset кнопки (8 штук) с выбором target sub.
- **Replay** — выбор payment_id, кнопки replay success/canceled/duplicate, таблица результатов.
- **Console** — live processing console (auto-refresh 2s, объединяет `subscription_events` + `webhook_logs` + `recurring_cron_heartbeats`).
- **Flags** — runtime feature flags panel, switches, persist через `admin_set_setting`.
- **Integrity** — таблица последнего scan с severity badges.

Новые компоненты:
- `src/components/admin/recurring/SandboxBanner.tsx`
- `src/components/admin/recurring/SubscriptionInspector.tsx` (Sheet + Tabs)
- `src/components/admin/recurring/EventTimeline.tsx` (vertical timeline с icons/colors)
- `src/components/admin/recurring/FastForwardButtons.tsx`
- `src/components/admin/recurring/LiveConsole.tsx`
- `src/components/admin/recurring/FlagsPanel.tsx`
- `src/components/admin/recurring/IntegrityTable.tsx`
- `src/components/admin/recurring/ChaosRunner.tsx`
- `src/components/admin/recurring/SandboxCreator.tsx`
- `src/lib/recurring-sandbox.ts` — клиентские helpers + типы.

Дизайн: shadcn (Card/Tabs/Sheet/Badge/Switch/ScrollArea), семантические токены, Stripe-like spacing, skeleton loaders, empty states.

## 4. Chaos testing

`admin-recurring` action `chaos_run` создаёт 100 sandbox subs, каждая получает рандомный preset (success/fail/timeout/duplicate/stale_lock), затем вызывает `process-recurring-payments` несколько раз. Возвращает summary `{succeeded, failed, recovered, stuck, dedupe_prevented}`.

## 5. Routes

`/admin/recurring/testing` остаётся; внутри tabs. Sidebar пункт переименуем на "QA Sandbox".

## 6. Что НЕ делаем

- Не трогаем `create-payment`, one-time flow, `sync-yookassa-payment`.
- Не меняем production schema колонок (только additive).
- Не включаем realtime broadcast для production subs (только sandbox + admin view).
- Не отправляем real emails / charges ни при каких action.

## Deliverables в финальном ответе

- Список новых routes/tabs.
- Список новых tables / RPC / edge actions.
- Список feature flags (DB).
- Изменённые edge functions.
- Sandbox isolation guarantees (5 пунктов выше).
