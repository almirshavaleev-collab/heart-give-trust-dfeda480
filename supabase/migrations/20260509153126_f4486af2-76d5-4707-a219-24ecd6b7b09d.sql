
-- ============================================================
-- 1. Runtime feature flags
-- ============================================================
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.admin_settings enable row level security;

create policy "Admins read settings"
  on public.admin_settings for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create policy "Admins write settings"
  on public.admin_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

insert into public.admin_settings(key, value) values
  ('recurring_enabled',       'true'::jsonb),
  ('recurring_test_mode',     'false'::jsonb),
  ('recurring_dry_run',       'false'::jsonb),
  ('recurring_force_success', 'false'::jsonb),
  ('recurring_force_failure', 'false'::jsonb),
  ('sandbox_enabled',         'false'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- 2. is_test flags
-- ============================================================
alter table public.donor_subscriptions
  add column if not exists is_test boolean not null default false;
alter table public.donations
  add column if not exists is_test boolean not null default false;
alter table public.subscription_charge_attempts
  add column if not exists is_test boolean not null default false;

create index if not exists idx_donor_subs_is_test
  on public.donor_subscriptions(is_test) where is_test = true;
create index if not exists idx_donations_is_test
  on public.donations(is_test) where is_test = true;
create index if not exists idx_attempts_is_test
  on public.subscription_charge_attempts(is_test) where is_test = true;

-- ============================================================
-- 3. Sandbox audit log
-- ============================================================
create table if not exists public.sandbox_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.sandbox_audit_log enable row level security;

create policy "Admins read sandbox audit"
  on public.sandbox_audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

create index if not exists idx_sandbox_audit_created
  on public.sandbox_audit_log(created_at desc);

-- ============================================================
-- 4. Settings RPCs
-- ============================================================
create or replace function public.admin_get_settings()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  select jsonb_object_agg(key, value) into v from public.admin_settings;
  return coalesce(v, '{}'::jsonb);
end$$;

create or replace function public.admin_set_setting(_key text, _value jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  insert into public.admin_settings(key, value, updated_by, updated_at)
    values (_key, _value, auth.uid(), now())
  on conflict (key) do update
    set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  insert into public.sandbox_audit_log(actor, action, payload)
    values (auth.uid(), 'set_setting', jsonb_build_object('key',_key,'value',_value));
end$$;

create or replace function public.admin_log_sandbox_action(_action text, _payload jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  insert into public.sandbox_audit_log(actor, action, payload)
    values (auth.uid(), _action, _payload);
end$$;

-- ============================================================
-- 5. Sandbox subscription creator
-- ============================================================
create or replace function public.admin_create_sandbox_subscription(
  _amount numeric,
  _interval text,
  _campaign_id uuid default null,
  _next_in_seconds int default 60
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_enabled boolean;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  select (value)::boolean into v_enabled from public.admin_settings where key='sandbox_enabled';
  if not coalesce(v_enabled,false) then
    raise exception 'sandbox_disabled';
  end if;
  if _interval not in ('weekly','biweekly','monthly') then
    raise exception 'invalid_interval';
  end if;
  if _amount is null or _amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  insert into public.donor_subscriptions(
    user_id, campaign_id, amount, currency, interval, status,
    payment_method_id, payment_method_type,
    next_payment_at, is_test
  ) values (
    auth.uid(), _campaign_id, _amount, 'RUB', _interval, 'active',
    'sandbox-pm-' || gen_random_uuid()::text, 'sandbox',
    now() + make_interval(secs => greatest(10, least(_next_in_seconds, 86400))),
    true
  ) returning id into v_id;

  insert into public.subscription_events(subscription_id, event_type, metadata)
    values (v_id, 'sandbox_created',
      jsonb_build_object('is_test',true,'simulated',true,'sandbox_version',1,'actor',auth.uid()));

  insert into public.sandbox_audit_log(actor, action, payload)
    values (auth.uid(), 'create_sandbox_subscription',
      jsonb_build_object('id',v_id,'amount',_amount,'interval',_interval));
  return v_id;
end$$;

-- ============================================================
-- 6. Fast forward
-- ============================================================
create or replace function public.admin_fast_forward_subscription(_id uuid, _seconds int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_test boolean;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  select is_test into v_test from public.donor_subscriptions where id=_id;
  if not coalesce(v_test,false) then
    raise exception 'not_a_test_subscription';
  end if;
  update public.donor_subscriptions
    set next_payment_at = now() - make_interval(secs => greatest(0, _seconds)),
        updated_at = now()
    where id = _id;
  insert into public.sandbox_audit_log(actor, action, payload)
    values (auth.uid(), 'fast_forward', jsonb_build_object('id',_id,'seconds',_seconds));
end$$;

-- ============================================================
-- 7. Subscription inspector
-- ============================================================
create or replace function public.admin_subscription_inspector(_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_sub jsonb; v_attempts jsonb; v_events jsonb; v_webhooks jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  select to_jsonb(s.*) into v_sub from public.donor_subscriptions s where s.id=_id;
  select coalesce(jsonb_agg(to_jsonb(a.*) order by a.created_at desc), '[]'::jsonb)
    into v_attempts from public.subscription_charge_attempts a where a.subscription_id=_id;
  select coalesce(jsonb_agg(to_jsonb(e.*) order by e.created_at desc), '[]'::jsonb)
    into v_events from public.subscription_events e where e.subscription_id=_id;
  select coalesce(jsonb_agg(to_jsonb(w.*) order by w.created_at desc), '[]'::jsonb)
    into v_webhooks from public.webhook_logs w
    where w.payload->'object'->'metadata'->>'subscription_id' = _id::text;
  return jsonb_build_object('subscription',v_sub,'attempts',v_attempts,'events',v_events,'webhooks',v_webhooks);
end$$;

-- ============================================================
-- 8. Integrity scan
-- ============================================================
create or replace function public.admin_recurring_integrity_scan()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_issues jsonb := '[]'::jsonb;
declare v_count int;
declare v_ids uuid[];
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;

  -- Stale exec lock
  select count(*), array_agg(id) into v_count, v_ids
    from (select id from public.donor_subscriptions
          where processing_at is not null and processing_at < now() - interval '10 minutes'
          limit 20) t;
  if v_count > 0 then
    v_issues := v_issues || jsonb_build_object('kind','stale_exec_lock','severity','critical','count',v_count,'sample_ids',v_ids);
  end if;

  -- Stale billing key
  select count(*), array_agg(id) into v_count, v_ids
    from (select id from public.donor_subscriptions
          where current_billing_key is not null and updated_at < now() - interval '24 hours'
          limit 20) t;
  if v_count > 0 then
    v_issues := v_issues || jsonb_build_object('kind','stale_billing_key','severity','critical','count',v_count,'sample_ids',v_ids);
  end if;

  -- Orphan pending donations
  select count(*) into v_count from public.donations
    where status='pending' and payment_type='recurring' and created_at < now() - interval '15 minutes';
  if v_count > 0 then
    v_issues := v_issues || jsonb_build_object('kind','orphan_pending','severity','degraded','count',v_count);
  end if;

  -- Test data leaking into prod-like flow
  select count(*) into v_count from public.donations
    where is_test=true and status='succeeded' and campaign_id is not null and created_at > now() - interval '7 days';
  if v_count > 0 then
    v_issues := v_issues || jsonb_build_object('kind','test_succeeded_with_campaign','severity','warning','count',v_count);
  end if;

  return jsonb_build_object('generated_at', now(), 'issues', v_issues);
end$$;

-- ============================================================
-- 9. Extended metrics (sandbox-aware)
-- ============================================================
create or replace function public.admin_recurring_metrics_extended()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_sb_active int; v_sb_total int;
  v_sb_attempts int; v_sb_succeeded int; v_sb_failed int;
  v_dedupe int; v_stale_recovered int;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  select count(*) filter (where status='active'), count(*)
    into v_sb_active, v_sb_total
    from public.donor_subscriptions where is_test=true;
  select count(*),
         count(*) filter (where status='succeeded'),
         count(*) filter (where status in ('create_failed','network_error','retry_scheduled','past_due','paused'))
    into v_sb_attempts, v_sb_succeeded, v_sb_failed
    from public.subscription_charge_attempts where is_test=true;
  select count(*) into v_dedupe from public.subscription_events
    where event_type='duplicate_prevented' and created_at > now() - interval '24 hours';
  select count(*) into v_stale_recovered from public.subscription_events
    where event_type='stale_lock_reclaimed' and created_at > now() - interval '24 hours';

  return jsonb_build_object(
    'sandbox', jsonb_build_object(
      'active', v_sb_active, 'total', v_sb_total,
      'attempts', v_sb_attempts, 'succeeded', v_sb_succeeded, 'failed', v_sb_failed,
      'success_rate', case when v_sb_attempts>0 then round((v_sb_succeeded::numeric/v_sb_attempts)*100,2) else 0 end
    ),
    'dedupe_prevented_24h', v_dedupe,
    'stale_lock_recovered_24h', v_stale_recovered,
    'generated_at', now()
  );
end$$;

-- ============================================================
-- 10. Destroy sandbox data
-- ============================================================
create or replace function public.admin_destroy_sandbox_data()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_subs int; v_donations int; v_attempts int; v_events int;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;

  delete from public.subscription_events e
    where e.subscription_id in (select id from public.donor_subscriptions where is_test=true)
       or e.metadata->>'simulated' = 'true';
  get diagnostics v_events = row_count;

  delete from public.subscription_charge_attempts where is_test=true;
  get diagnostics v_attempts = row_count;

  delete from public.donations where is_test=true;
  get diagnostics v_donations = row_count;

  delete from public.donor_subscriptions where is_test=true;
  get diagnostics v_subs = row_count;

  insert into public.sandbox_audit_log(actor, action, payload)
    values (auth.uid(), 'destroy_sandbox_data',
      jsonb_build_object('subs',v_subs,'donations',v_donations,'attempts',v_attempts,'events',v_events));

  return jsonb_build_object('subs',v_subs,'donations',v_donations,'attempts',v_attempts,'events',v_events);
end$$;

-- ============================================================
-- 11. Update production metrics to EXCLUDE test rows
-- ============================================================
create or replace function public.admin_recurring_metrics()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_active int; v_paused int; v_past_due int; v_canceled int;
  v_mrr numeric; v_attempts_30d int; v_failed_30d int;
  v_recovered_30d int; v_avg_lifetime_days numeric;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;

  select count(*) filter (where status='active'),
         count(*) filter (where status='paused'),
         count(*) filter (where status='past_due'),
         count(*) filter (where status='canceled')
    into v_active, v_paused, v_past_due, v_canceled
    from public.donor_subscriptions where is_test=false;

  select coalesce(sum(case interval
      when 'weekly' then amount*4.345
      when 'biweekly' then amount*2.1725
      when 'monthly' then amount else 0 end),0)
    into v_mrr
    from public.donor_subscriptions where status='active' and is_test=false;

  select count(*),
         count(*) filter (where status in ('create_failed','network_error','retry_scheduled','past_due'))
    into v_attempts_30d, v_failed_30d
    from public.subscription_charge_attempts
    where created_at > now()-interval '30 days' and is_test=false;

  select count(*) into v_recovered_30d from public.subscription_events
    where event_type='recovered' and created_at > now()-interval '30 days';

  select coalesce(avg(extract(epoch from (coalesce(canceled_at, now()) - created_at))/86400.0),0)
    into v_avg_lifetime_days from public.donor_subscriptions where is_test=false;

  return jsonb_build_object(
    'active',v_active,'paused',v_paused,'past_due',v_past_due,'canceled',v_canceled,
    'mrr_rub', round(v_mrr,2),
    'attempts_30d',v_attempts_30d,'failed_30d',v_failed_30d,
    'failed_rate_30d', case when v_attempts_30d>0 then round((v_failed_30d::numeric/v_attempts_30d)*100,2) else 0 end,
    'recovered_30d',v_recovered_30d,
    'avg_lifetime_days', round(v_avg_lifetime_days,1),
    'generated_at', now()
  );
end$$;

create or replace function public.admin_recurring_timeseries(_days integer default 14)
returns table(day date, attempts integer, succeeded integer, failed integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::app_role) then
    raise exception 'forbidden: admin only';
  end if;
  return query
  with days as (
    select generate_series(
      (now()::date - (greatest(1, least(_days,90))-1) * interval '1 day')::date,
      now()::date, interval '1 day')::date as day
  )
  select d.day,
    coalesce(count(a.id) filter (where a.id is not null),0)::int as attempts,
    coalesce(count(a.id) filter (where a.status='succeeded'),0)::int as succeeded,
    coalesce(count(a.id) filter (where a.status in
      ('create_failed','network_error','retry_scheduled','past_due','paused')),0)::int as failed
  from days d
  left join public.subscription_charge_attempts a
    on a.created_at::date = d.day and a.is_test = false
  group by d.day
  order by d.day;
end$$;
