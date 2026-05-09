# План: pre-realtime hardening recurring billing

Закрываем duplicate/idempotency, stale locks, feature flags. Затем поэтапный realtime и operational readiness page. Всё аддитивно, webhook остаётся source of truth, one-time flow не трогаем.

## 1. Duplicate / idempotency hardening (приоритет 1)

**Billing cycle key (детерминированный)**
- Формула: `billing_cycle_key = sha1(subscription_id || ':' || floor(epoch(next_payment_at)/3600))` — ведро в 1 час, устойчиво к мелким сдвигам времени.
- Уже есть `deterministicBillingKey` в `_shared/recurring.ts` — переименовать/обернуть в `billingCycleKey()` и использовать ВЕЗДЕ: process-recurring, retry, reconcile, donation insert, YooKassa Idempotence-Key, webhook dedupe.

**Жёсткая защита на уровне БД (миграция, аддитивно):**
- Новая колонка `donations.billing_cycle_key text` (nullable для совместимости с one-time).
- `CREATE UNIQUE INDEX donations_billing_cycle_uniq ON donations(billing_cycle_key) WHERE billing_cycle_key IS NOT NULL;` — гарантирует, что для одного цикла не создастся вторая donation. Конфликт = duplicate prevented.
- Аналогично `subscription_charge_attempts.billing_cycle_key` + partial unique index по `(subscription_id, billing_cycle_key)` для статусов != 'create_failed' (чтобы ретраи неудачных create были возможны).
- При попытке вставки duplicate → catch unique violation → INSERT в `subscription_events` событие `duplicate_charge_prevented` с reason/billing_cycle_key/source.

**increment_campaign_collected двойная защита:**
- Уже сделано через `.update({status:'succeeded'}).neq('status','succeeded').select('id')`. Усилим: если update вернул 0 строк — НЕ инкрементим И пишем `subscription_events: 'increment_skipped_already_succeeded'`. Покрыть webhook + reconcile + admin force-reconcile одинаково через `handleRecurringSuccess`.

**Webhook idempotency:**
- Уже есть `webhook_logs`. Добавить unique-индекс `(provider, event, object_id)` partial WHERE event IS NOT NULL — повтор того же события вернёт ok без побочных эффектов.

**retry_now:**
- `donor_retry_subscription_now` и admin retry — выставляют `next_payment_at = now()`, но НЕ создают платёж напрямую. Создаёт его cron под общим billing_cycle_key. Если в текущем bucket уже есть pending/succeeded donation с тем же ключом — cron skip + событие.

## 2. Stale lock recovery

- Конфигурируемые горизонты в `_shared/recurring.ts`:
  - `EXEC_LOCK_TTL_MIN = 10` (processing_at)
  - `BILLING_KEY_TTL_HR = 24` (current_billing_key)
- В `cleanup-recurring-artifacts` (уже есть) добавить:
  - reclaim stale `processing_at > 15min` → set null + `subscription_events: 'lock_reclaimed'` с metadata{age_min, billing_key}.
  - reclaim stale `current_billing_key` старше 24ч если соответствующий donation уже terminal (succeeded/failed/canceled) — clear key + событие `billing_key_reclaimed`.
  - alert если stale locks > threshold → `[recurring][ALERT]`.
- В `process-recurring-payments` добавить лог `stale_processing_detected` при захвате освобождённого по TTL лока.

## 3. Feature flags (единая точка)

Новый файл `supabase/functions/_shared/recurring-config.ts`:
```ts
export function getRecurringConfig() {
  return {
    dryRun: env('RECURRING_DRY_RUN') === 'true',
    enabled: env('RECURRING_ENABLED') !== 'false',
    realtimeDonor: env('RECURRING_REALTIME_DONOR') === 'true',
    realtimeAdmin: env('RECURRING_REALTIME_ADMIN') === 'true',
    execLockTtlMin: int('RECURRING_EXEC_LOCK_TTL_MIN', 10),
    billingKeyTtlHr: int('RECURRING_BILLING_KEY_TTL_HR', 24),
    maxRetries: int('RECURRING_MAX_RETRIES', 4),
    notifyThrottleHr: int('RECURRING_NOTIFY_THROTTLE_HR', 24),
  }
}
```
- Используется во всех recurring edge functions вместо разрозненных `Deno.env.get`.
- Frontend: `src/lib/recurring-config.ts` читает `import.meta.env.VITE_RECURRING_*` (только UI-флаги: realtimeDonor/realtimeAdmin). Для серверных значений — RPC `recurring_public_config()` (read-only, неконфиденциальное).

## 4. Realtime — поэтапный rollout

**Этап A — donor only** (за флагом `VITE_RECURRING_REALTIME_DONOR`):
- В `useRecurringSubscriptions`: подписка только на `donor_subscriptions` WHERE `user_id=eq.{auth.uid()}` (фильтр на сервере). Без full refetch — патчим локальный массив по payload.new/old.
- Debounce 500ms через `setTimeout` накопитель ID к refetch (точечный по `id`), не общий.
- Polling fallback 60s (вместо 30s) когда realtime активен.

**Этап B — admin detail** (флаг `VITE_RECURRING_REALTIME_ADMIN_DETAIL`):
- На `AdminRecurringDetail` realtime по `subscription_events`, `subscription_charge_attempts` WHERE `subscription_id=eq.{id}`.
- Append-only patching без рефетча всей страницы.

**Этап C — admin overview** (флаг `VITE_RECURRING_REALTIME_ADMIN_OVERVIEW`, по умолчанию OFF):
- Только агрегаты, не построчный realtime. Триггерим refetch overview не чаще 1 раз/10s через debounce.

Миграция: `ALTER PUBLICATION supabase_realtime ADD TABLE donor_subscriptions, subscription_events, subscription_charge_attempts;` + `REPLICA IDENTITY FULL` для всех трёх.

## 5. Admin dashboard — SQL aggregation

- Заменяем клиентские `.limit(2000)` на новые SECURITY DEFINER RPC (admin-only):
  - `admin_recurring_timeseries(_days int)` — серия по дням: attempts, succeeded, failed (для Recharts).
  - `admin_recurring_overview()` — KPI + топ-5 stuck/failures/backlog одним вызовом.
- Все RPC: `STABLE`, `SET search_path=public`, явный `has_role(auth.uid(),'admin')`, `REVOKE ALL FROM anon; GRANT EXECUTE TO authenticated`.

## 6. Security audit (RPC)

Для всех recurring RPC (donor_* и admin_*):
- `SET search_path = public` — есть, проверим единообразие.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;`
- `GRANT EXECUTE ON FUNCTION ... TO authenticated;`
- Никакого dynamic SQL, всё через параметры — есть.
- Owner-check на каждом donor_* — есть.

## 7. Readiness page (operational)

Новый edge endpoint `recurring-readiness` (admin-only через JWT verify в коде):
Возвращает JSON:
```
healthy|degraded|critical, components: {
  cron: {last_run_at, lag_min, status},
  reconcile: {last_run_at, lag_min, status},
  webhook: {last_event_at, lag_min, status},
  locks: {stale_exec, stale_billing, status},
  retries: {queued, failed_24h, status},
  notifications: {last_sent_at, status},
  orphans: {pending_old_recurring, status},
  realtime: {donor_enabled, admin_enabled},
  last_success: {charge_at, notification_at}
}
```
Тhresholds: healthy/degraded/critical с цветами в UI.

UI: `src/pages/admin/AdminRecurringReadiness.tsx` — карточки компонентов с цветовыми статусами (semantic tokens), refresh каждые 30s, кнопка "Проверить сейчас".

Для отслеживания "last cron run" — таблица `recurring_cron_heartbeats(job text pk, last_run_at, last_status, last_payload jsonb)` обновляется в конце каждого cron job.

## 8. Notifications polish

- Throttle: max 1 retry-email на 24h на subscription. Хранить в `subscription_events` (event_type='notification_sent', metadata.kind='retry_scheduled'), проверять перед отправкой.
- Email на duplicate_charge_prevented для admin (опционально, через флаг).

## 9. Порядок изменений

1. Миграция: `donations.billing_cycle_key` + unique index, `subscription_charge_attempts.billing_cycle_key` + partial unique, `webhook_logs` unique, `recurring_cron_heartbeats`, новые admin RPC, REVOKE/GRANT, realtime publication.
2. `_shared/recurring.ts` + новый `recurring-config.ts`: единый billingCycleKey, helpers с unique-violation handling, heartbeat helper.
3. Edge functions: process-recurring, reconcile, webhook, admin-recurring, cleanup, recurring-health-check, recurring-readiness — переход на shared config + cycle key + heartbeat.
4. Frontend: `recurring-config.ts`, realtime в `useRecurringSubscriptions` (этап A), AdminRecurringReadiness, swap timeseries на RPC.
5. Этапы B/C realtime — за флагами, по умолчанию OFF.

## Технические детали

**Backwards compatibility:**
- `billing_cycle_key` nullable; one-time donations его не пишут — partial unique index не аффектит их.
- Все новые env vars имеют дефолты — поведение не меняется без явного включения.
- Realtime по умолчанию OFF, polling работает как сейчас.
- Webhook unique по `(provider,event,object_id)` partial WHERE NOT NULL — старые записи без event не аффектятся.

**Файлы:**
- New: `supabase/functions/_shared/recurring-config.ts`, `supabase/functions/recurring-readiness/index.ts`, `src/lib/recurring-config.ts`, `src/pages/admin/AdminRecurringReadiness.tsx`, миграция.
- Edit: все recurring edge functions, `_shared/recurring.ts`, `useRecurringSubscriptions.ts`, `AdminRecurring.tsx`, `AdminRecurringDetail.tsx`, `AdminLayout.tsx` (nav), `App.tsx` (route), `config.toml`.

**Что НЕ трогаем:** create-payment, sync-yookassa-payment, one-time donation paths, существующие донорские UI потоки кроме hook-а подписок.
