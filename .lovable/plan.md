# Recurring Testing Infrastructure (Sandbox)

Цель: контролируемая sandbox-среда для тестирования recurring billing без реальных списаний. Всё additive, за feature-flags, production-safe. Не трогаем one-time, не переписываем существующий recurring flow.

## 1. Расширение конфига (`_shared/recurring-config.ts`)

Добавить в `RecurringConfig`:
- `testMode: boolean`           — `RECURRING_TEST_MODE`
- `forceSuccess: boolean`       — `RECURRING_FORCE_SUCCESS`
- `forceFailure: boolean`       — `RECURRING_FORCE_FAILURE`
- `simulateTimeoutMs: number`   — `RECURRING_SIMULATE_TIMEOUT_MS` (для simulate_timeout)

Новый helper `getEffectiveTimings(cfg)`:
- если `testMode=true` → ускоренные интервалы:
  - monthly = 2 min, biweekly = 1 min, weekly = 30 sec
  - retryDelayHr → 1 min (внутри как minutes)
  - execLockTtlMin → 2 min
- иначе — обычные значения из cfg.

Реализация: новые helper'ы `nextRunAtFor(interval, cfg)` и `retryAfterAt(cfg)` возвращают `Date`. Существующие константы НЕ переписываем — добавляем новые, callers переключаются осознанно.

Добавить frontend-зеркало в `src/lib/recurring-config.ts` (`VITE_RECURRING_TEST_MODE`, `VITE_RECURRING_DRY_RUN`) — только для UI badge.

## 2. Dry-run pipeline

В `process-recurring-payments`:
- если `cfg.dryRun=true` И НЕ `testMode` — оставляем текущее поведение (cancel donation, attempt=dry_run).
- если `cfg.testMode=true` И `cfg.dryRun=true` (shadow mode) — добавить новую ветку `simulateCycle()`:
  - НЕ дергаем YooKassa
  - создаём `donations` (status=succeeded если forceSuccess; failed если forceFailure; иначе случайно 90/10)
  - НЕ дергаем `increment_campaign_collected`
  - вставляем `subscription_charge_attempts` с `status=test_succeeded|test_failed`, `metadata.simulated=true`
  - вставляем `subscription_events` (`event_type=test_payment_simulated`)
  - обновляем `donor_subscriptions.next_payment_at` через `nextRunAtFor`, `last_charge_at=now()` при success, `retry_count++` при failure
  - всё логируется как `[recurring][dry_run]` / `[recurring][simulate]`

Реализуем как отдельный helper `_shared/recurring-test.ts` — `simulateChargeCycle(supabase, sub, cfg)` — чтобы не загрязнять production-путь. В `process-recurring-payments` ветка переключения занимает ~10 строк.

## 3. Manual runners + simulations (admin endpoint)

Расширить существующий `admin-recurring/index.ts` новыми actions (admin-only, проверка `has_role`):
- `run_recurring_now` → внутренний fetch на `process-recurring-payments`
- `run_reconcile_now` → fetch на `reconcile-recurring-payments`
- `run_cleanup_now` → fetch на `cleanup-recurring-artifacts`
- `run_health_check_now` → fetch на `recurring-health-check`
- `simulate` (поле `kind`):
  - `success`, `failure`, `timeout`, `network_error`, `expired_card`,
    `duplicate_webhook`, `reconcile_delay`, `stale_lock`
  - все требуют `subscription_id`, проверяют `cfg.testMode=true`, иначе 403
  - каждое действие пишет `subscription_events` с `event_type=simulate_<kind>` и `subscription_charge_attempts`
- `replay_webhook` → принимает `payment_id`, повторно вызывает `yookassa-webhook` с тем же payload (см. п.6)
- `replay_reconcile` → точечный reconcile одного donation_id
- `force_next_payment` → выставляет `next_payment_at = now() - 1 sec`
- `clear_locks` → `processing_at=NULL, current_billing_key=NULL` для одной подписки

Все simulate-* — только при `cfg.testMode`. Логи namespace `[recurring][simulate]`.

## 4. Idempotency / replay testing

`replay_webhook`: формирует синтетический payload с теми же `payment_id` и `metadata.subscription_id`/`billing_key` как у последней attempt. Отправляет в `yookassa-webhook`. Это даёт реальный тест:
- unique-индекс на `webhook_logs` (object_id+event)
- `billing_cycle_key` unique на donations
- `increment_campaign_collected` non-double

Никаких изменений в самом webhook не нужно — он уже идемпотентен.

## 5. Admin Testing UI: `/admin/recurring/testing`

Новый файл `src/pages/admin/AdminRecurringTesting.tsx`. Простой UI без премиум-полировки:
- Баннер «TEST MODE / SHADOW MODE» (читает `recurringFlags.testMode`, `dryRun`)
- Блок «Manual runners»: 4 кнопки → POST `admin-recurring` action
- Блок «Test subscription»: список подписок текущего админа (через `donor_my_subscriptions`) с действиями:
  - Force next payment now
  - Clear locks
  - Simulate (dropdown с 8 вариантами)
  - Replay last webhook
- Блок «Recent simulated events»: чтение `subscription_events` где `event_type LIKE 'simulate_%' OR 'test_%'` (через новый admin RPC `admin_recent_test_events()`)

Маршрут добавить в `App.tsx` под `/admin/recurring/testing`. Ссылка в `AdminLayout` навигации с пометкой «Testing» и значком только при `recurringFlags.testMode`.

Доступ: `RequireAuth` + проверка роли admin (как у остальных admin pages).

## 6. Structured logs

Расширить `structuredLog` namespaces — сейчас он принимает event-name. Добавим конвенцию: префиксы `test_*`, `simulate_*`, `dry_run_*`, `dedupe_*`, `lock_reclaimed_*`. Грепабельно по namespace.

## 7. Что НЕ делаем

- chaos testing, concurrent spawners, race generators, production realtime — отложено
- никаких изменений в webhook, в one-time create-payment, в sync-yookassa-payment
- не меняем существующие recurring SQL-функции — только добавляем `admin_recent_test_events()`

## Файлы

**Новые:**
- `supabase/functions/_shared/recurring-test.ts` — `simulateChargeCycle`, `simulateAction(kind, sub, cfg)`, `buildReplayWebhookPayload`
- `src/pages/admin/AdminRecurringTesting.tsx`
- migration: SQL-функция `admin_recent_test_events(_limit int)` (admin-only)

**Правим:**
- `supabase/functions/_shared/recurring-config.ts` — поля + `getEffectiveTimings`/`nextRunAtFor`
- `supabase/functions/process-recurring-payments/index.ts` — ветка shadow-simulate
- `supabase/functions/admin-recurring/index.ts` — новые actions
- `src/lib/recurring-config.ts` — флаги для UI
- `src/App.tsx` — роут
- `src/pages/admin/AdminLayout.tsx` — ссылка Testing
- `supabase/config.toml` — без изменений (admin-recurring уже зарегистрирован)

## Безопасность

- Все simulate / manual-runner actions — admin-role check + `cfg.testMode` guard.
- Никаких real charges в shadow mode (двойная защита: `dryRun` ИЛИ `testMode` без production credentials).
- Production остаётся on `RECURRING_TEST_MODE=false` и `RECURRING_DRY_RUN=false` — поведение не меняется.

После approval — реализую за один проход.
