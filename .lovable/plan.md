## Цель

Перенести отправку всех Supabase Auth писем (signup, magic link, recovery, invite, email change, reauthentication) с Lovable Email на собственный edge function `auth-email-resend`, который:
- принимает Send Email Hook от Supabase Auth,
- валидирует HMAC-подпись (`SEND_EMAIL_HOOK_SECRET`),
- рендерит русскоязычные HTML-шаблоны в фирменном стиле фонда «Лига»,
- отправляет через Resend (`api.resend.com`, домен `notify.ligafund.ru`),
- пишет лог отправки в новую таблицу `auth_email_log`.

Существующая Lovable email-инфраструктура (`auth-email-hook`, `process-email-queue`, `send-transactional-email`, `send-email-resend`) **не трогается** — это additive change. Финальный шаг — выключение Lovable Emails и включение Send Email Hook в Supabase Auth — выполняется только после успешного теста.

---

## Что будет создано

### 1. Edge function `supabase/functions/auth-email-resend/index.ts`
- `verify_jwt = false` (Supabase Auth подписывает payload своим webhook-секретом, не JWT).
- Читает `Authorization: Bearer <secret>` либо стандартные Standard Webhooks заголовки (`webhook-id`, `webhook-timestamp`, `webhook-signature`) и проверяет HMAC SHA-256 по `SEND_EMAIL_HOOK_SECRET` (формат `v1,whsec_...`).
- На invalid signature → 401, всё логируется.
- Парсит payload Supabase Auth Email Hook:
  ```
  { user: { email, ... }, email_data: { token, token_hash, redirect_to, email_action_type, site_url, ... } }
  ```
- По `email_action_type` выбирает шаблон (signup / recovery / magiclink / email_change / invite / reauthentication).
- Собирает confirmation URL: `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`.
- Отправляет через Resend (тот же контракт, что в `send-email-resend`):
  ```
  POST https://api.resend.com/emails
  from: RESEND_FROM_EMAIL  (например "Фонд Лига <noreply@notify.ligafund.ru>")
  to:   user.email
  subject: <по типу>
  html: <шаблон>
  ```
- Идемпотентность: по `(user_id, email_action_type, token_hash)` — если за последние 30 секунд такая же запись со статусом `sent`, второй раз не шлём (защита от ретраев Supabase).
- Пишет строку в `auth_email_log` со статусом `sent` / `failed` / `skipped_duplicate` и `resend_id` / `error`.
- На любую ошибку отправки → 500 c `{ ok: false, error }` (Supabase Auth ретраит).

### 2. Шаблоны `supabase/functions/_shared/auth-email-templates/*.ts`
Чистый HTML-as-string (без React Email — соответствует стилю существующих `transactional-email-templates`), все 6 типов на русском, бренд `Фонд «Лига»` из `_shared/brand.ts`:
- `signup.ts` — «Подтвердите регистрацию»
- `magic-link.ts` — «Ссылка для входа»
- `recovery.ts` — «Восстановление пароля»
- `invite.ts` — «Приглашение в личный кабинет»
- `email-change.ts` — «Подтверждение смены email»
- `reauthentication.ts` — «Код повторной аутентификации»

Стиль — premium minimalist white-first, как в проекте: фон `#FFFFFF`, текст `#0B1F3A`, primary-кнопка с radius 16px. Логотип через `<img>` на публичный URL (`/logo_h.svg` из домена сайта).

### 3. Конфигурация
Добавить блок в `supabase/config.toml`:
```
[functions.auth-email-resend]
  verify_jwt = false
```

### 4. Миграция: таблица `auth_email_log`
```
id uuid pk default gen_random_uuid()
created_at timestamptz default now()
user_id uuid null
email text not null
email_action_type text not null
status text not null         -- sent | failed | skipped_duplicate | invalid_signature
resend_id text null
error text null
token_hash text null         -- для дедупа, не сам токен
```
RLS: enable, политика — только админы могут SELECT (`has_role(auth.uid(),'admin')`). INSERT — service_role (через edge function).
Индекс `(email_action_type, token_hash, created_at desc)` для дедуп-проверки.

### 5. Секреты
- `RESEND_API_KEY` ✅ уже есть
- `RESEND_FROM_EMAIL` ✅ уже есть (нужно убедиться, что значение вида `Фонд Лига <noreply@notify.ligafund.ru>` и домен верифицирован в Resend)
- `SEND_EMAIL_HOOK_SECRET` ⚠️ **новый секрет**, нужно сгенерировать (`whsec_<base64>`) и тем же значением прописать в Supabase Auth Hooks.

### 6. Admin UI (мини-расширение `EmailTestingCard`)
Добавить вкладку «Auth email logs»: таблица последних 50 записей `auth_email_log` с фильтром по типу. Никаких новых страниц — встраиваем в текущую карточку.

---

## Порядок включения (после деплоя кода и миграции)

1. Деплой `auth-email-resend` + миграция `auth_email_log`.
2. Smoke-тест: вручную вызвать function через curl с валидной подписью и проверить, что письмо приходит и появляется лог.
3. В **Lovable → Cloud → Emails** выключить Lovable Emails (`toggle_project_emails: enabled=false`) — это вернёт auth-почту на дефолтный путь Supabase, но не сломает приложение.
4. В Supabase Auth → Hooks → Send Email Hook включить:
   - URL: `https://uqiggzylreezigjumxmf.supabase.co/functions/v1/auth-email-resend`
   - Secret: значение `SEND_EMAIL_HOOK_SECRET`.
5. Проверить полный цикл: signup на тестовый ящик → письмо от `notify.ligafund.ru` → клик → `/auth/callback` → `/account/overview`.
6. Проверить recovery (вкладка «Сброс» в `/auth`) и email-change.

Откат: выключить Send Email Hook в Supabase Auth → авто-возврат на дефолтные письма Supabase. Код hook остаётся в проекте, ничего удалять не нужно.

---

## Что НЕ трогаем

- `auth-email-hook`, `process-email-queue`, `send-transactional-email`, `enqueue_email`, `email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens` — Lovable email infrastructure остаётся как есть, только перестанет получать события (после шага 3).
- `send-email-resend` — продолжает работать как универсальный transactional sender для админки.
- Auth flow в `src/pages/Auth.tsx`, `src/hooks/useAuth.ts`, `AuthCallback.tsx` — без изменений.
- YooKassa, recurring, donations — без изменений.

---

## Технические детали (для разработки)

**HMAC-проверка (Standard Webhooks v1):**
```ts
const secret = Deno.env.get("SEND_EMAIL_HOOK_SECRET")!.replace(/^v1,whsec_/, "");
const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
const expected = base64(hmacSHA256(base64Decode(secret), signedPayload));
// сравнить со списком подписей в `webhook-signature` (формат "v1,<sig> v1,<sig2>")
// + проверить |now - webhookTimestamp| < 5 минут
```

**Структура payload Supabase:**
```ts
type Payload = {
  user: { id: string; email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to: string;
    email_action_type:
      | "signup" | "recovery" | "magiclink"
      | "invite" | "email_change" | "reauthentication";
    site_url: string;
  };
};
```

**Confirmation URL:** строим внутри hook как `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}` — это стандартный verify endpoint Supabase, тот же, что генерит дефолтный шаблон.

**TypeScript:** function использует `npm:@supabase/supabase-js@2`, никаких React Email — собирается без `deno.json`.

---

## Открытые вопросы

1. Текущее значение `RESEND_FROM_EMAIL` — это адрес на верифицированном `notify.ligafund.ru`? Если нет — Resend вернёт 403 при первой же отправке.
2. Хочешь ли ты **сразу** включить Send Email Hook в Supabase Auth (шаг 4) после реализации, или сначала только задеплоить и потестить вручную (рекомендуется)?
3. Логотип в письмах — использовать `https://ligacommunity.ru/logo_h.svg` или загрузить отдельный PNG в storage `email-assets`?
