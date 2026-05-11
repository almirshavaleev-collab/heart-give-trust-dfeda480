import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  handleRecurringFailure,
  handleRecurringSuccess,
  structuredLog,
  type Frequency,
} from "../_shared/recurring.ts";
import { getRecurringConfig } from "../_shared/recurring-config.ts";
import {
  buildReplayWebhookPayload,
  simulateAction,
  type SimulationKind,
  type SimSubscription,
} from "../_shared/recurring-test.ts";

/**
 * Admin-only operations for recurring billing.
 *
 * POST { action, ...args }
 *   - action: "metrics"               — returns admin_recurring_metrics()
 *   - action: "resume_subscription"   { subscription_id }
 *   - action: "cancel_subscription"   { subscription_id }
 *   - action: "retry_now"             { subscription_id }   — schedules an immediate charge attempt
 *   - action: "force_reconcile_donation" { donation_id }
 *   - action: "force_reconcile_subscription" { subscription_id }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: who } = await userClient.auth.getUser();
  const userId = who?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const action = String(body?.action ?? "");
  structuredLog("admin_action", { actor: userId, action });

  const cfg = getRecurringConfig();
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  async function invokeFn(name: string, payload: unknown = {}) {
    const r = await fetch(`${projectUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep text */ }
    return { status: r.status, ok: r.ok, data };
  }

  async function loadSimSub(subId: string): Promise<SimSubscription | null> {
    const { data } = await supabase
      .from("donor_subscriptions")
      .select("id,user_id,campaign_id,amount,currency,interval,retry_count,status,payment_method_type")
      .eq("id", subId).maybeSingle();
    if (!data) return null;
    return {
      ...data,
      interval: (data.interval === "weekly" || data.interval === "biweekly") ? data.interval : "monthly",
    } as SimSubscription;
  }

  async function fetchPayment(id: string) {
    const rawMode = (Deno.env.get("YOOKASSA_MODE") ?? "test").trim().toLowerCase();
    const mode: "production" | "test" = rawMode === "production" ? "production" : "test";
    const list = [
      { shopId: Deno.env.get("YOOKASSA_PROD_SHOP_ID"), secret: Deno.env.get("YOOKASSA_PROD_SECRET_KEY") },
      { shopId: Deno.env.get("YOOKASSA_SHOP_ID"), secret: Deno.env.get("YOOKASSA_SECRET_KEY") },
    ];
    if (mode === "test") list.reverse();
    for (const c of list) {
      if (!c.shopId || !c.secret) continue;
      const auth = btoa(`${c.shopId}:${c.secret}`);
      const r = await fetch(`https://api.yookassa.ru/v3/payments/${id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data?.id) return data;
    }
    return null;
  }

  function ok(payload: unknown) {
    return new Response(JSON.stringify({ ok: true, ...(payload as object) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  function bad(msg: string, code = 400) {
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: code, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    switch (action) {
      case "metrics": {
        const { data, error } = await userClient.rpc("admin_recurring_metrics");
        if (error) return bad(error.message, 500);
        return ok({ metrics: data });
      }

      // ─── Settings / runtime flags ────────────────────────────────────────
      case "get_settings": {
        const { data, error } = await userClient.rpc("admin_get_settings");
        if (error) return bad(error.message, 500);
        return ok({ settings: data });
      }
      case "set_setting": {
        const key = String(body?.key ?? "");
        if (!key) return bad("key required");
        const { error } = await userClient.rpc("admin_set_setting", { _key: key, _value: body?.value });
        if (error) return bad(error.message, 500);
        return ok({ key, value: body?.value });
      }
      case "extended_metrics": {
        const { data, error } = await userClient.rpc("admin_recurring_metrics_extended");
        if (error) return bad(error.message, 500);
        return ok({ metrics: data });
      }

      // ─── Sandbox CRUD ────────────────────────────────────────────────────
      case "create_sandbox_subscription": {
        const amount = Number(body?.amount ?? 0);
        const interval = String(body?.interval ?? "monthly");
        const campaign_id = body?.campaign_id ?? null;
        const next_in = Number(body?.next_in_seconds ?? 60);
        const { data, error } = await userClient.rpc("admin_create_sandbox_subscription", {
          _amount: amount, _interval: interval, _campaign_id: campaign_id,
          _next_in_seconds: next_in,
        });
        if (error) return bad(error.message, 400);
        return ok({ subscription_id: data });
      }
      case "fast_forward": {
        const subId = String(body?.subscription_id ?? "");
        const seconds = Number(body?.seconds ?? 60);
        if (!subId) return bad("subscription_id required");
        const { error } = await userClient.rpc("admin_fast_forward_subscription", {
          _id: subId, _seconds: seconds,
        });
        if (error) return bad(error.message, 400);
        return ok({ subscription_id: subId, seconds });
      }
      case "inspector": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        const { data, error } = await userClient.rpc("admin_subscription_inspector", { _id: subId });
        if (error) return bad(error.message, 500);
        return ok({ inspector: data });
      }
      case "integrity_scan": {
        const { data, error } = await userClient.rpc("admin_recurring_integrity_scan");
        if (error) return bad(error.message, 500);
        return ok({ scan: data });
      }
      case "check_invariants": {
        const issues: { kind: string; severity: "error" | "warning"; subscription_id?: string; detail: string }[] = [];
        const maxRetries = Math.max(1, Number(cfg.maxRetries ?? 5));

        // 1. Pending attempts per subscription > 1
        const { data: pendingAttempts } = await supabase
          .from("subscription_charge_attempts")
          .select("subscription_id")
          .eq("status", "pending");
        const pendingMap = new Map<string, number>();
        for (const a of pendingAttempts ?? []) {
          if (!a.subscription_id) continue;
          pendingMap.set(a.subscription_id, (pendingMap.get(a.subscription_id) ?? 0) + 1);
        }
        for (const [sid, n] of pendingMap) {
          if (n > 1) issues.push({ kind: "multiple_pending_attempts", severity: "error", subscription_id: sid, detail: `Subscription ${sid} has ${n} pending attempts` });
        }

        // 2. Canceled invariants + 5/6. retry_count, next_payment_at
        const { data: subs } = await supabase
          .from("donor_subscriptions")
          .select("id, status, next_payment_at, retry_count, is_test, canceled_at");
        const longAgo = Date.now() - 365 * 86400e3;
        for (const s of subs ?? []) {
          if (s.status === "canceled") {
            if (s.next_payment_at) issues.push({ kind: "canceled_with_next_payment", severity: "error", subscription_id: s.id, detail: `Canceled subscription ${s.id} still has next_payment_at` });
            if (pendingMap.get(s.id)) issues.push({ kind: "canceled_with_pending_attempt", severity: "error", subscription_id: s.id, detail: `Canceled subscription ${s.id} has pending attempt` });
          }
          if ((s.retry_count ?? 0) < 0) issues.push({ kind: "negative_retry_count", severity: "error", subscription_id: s.id, detail: `retry_count is negative` });
          if ((s.retry_count ?? 0) > maxRetries) issues.push({ kind: "retry_count_exceeds_max", severity: "warning", subscription_id: s.id, detail: `retry_count=${s.retry_count} > max=${maxRetries}` });
          if (s.next_payment_at && new Date(s.next_payment_at).getTime() < longAgo) {
            issues.push({ kind: "next_payment_far_past", severity: "warning", subscription_id: s.id, detail: `next_payment_at far in the past: ${s.next_payment_at}` });
          }
        }

        // 3. Test subscriptions must not affect campaigns: test succeeded donations with campaign_id
        const { data: leak } = await supabase
          .from("donations")
          .select("id, campaign_id")
          .eq("is_test", true).eq("status", "succeeded")
          .not("campaign_id", "is", null);
        // It's allowed to have campaign_id reference, but increment_campaign_collected must NOT have run.
        // We detect leakage if a donation's campaign_id matches and triggers increment — we just warn here.
        for (const d of leak ?? []) {
          issues.push({ kind: "test_donation_with_campaign", severity: "warning", detail: `Test donation ${d.id} references campaign ${d.campaign_id}` });
        }

        // 4. Succeeded attempts must have paid_at on linked donation
        const { data: succAttempts } = await supabase
          .from("subscription_charge_attempts")
          .select("id, donation_id, status")
          .in("status", ["succeeded", "test_succeeded"])
          .not("donation_id", "is", null)
          .limit(500);
        const dIds = (succAttempts ?? []).map((a: any) => a.donation_id).filter(Boolean);
        if (dIds.length > 0) {
          const { data: dons } = await supabase
            .from("donations").select("id, paid_at, status").in("id", dIds);
          const paidMap = new Map((dons ?? []).map((d: any) => [d.id, d]));
          for (const a of succAttempts ?? []) {
            const d: any = paidMap.get(a.donation_id);
            if (d && d.status === "succeeded" && !d.paid_at) {
              issues.push({ kind: "succeeded_without_paid_at", severity: "error", detail: `Donation ${d.id} succeeded but missing paid_at` });
            }
          }
        }

        // 7. duplicate succeeded attempts sharing the same donation_id per subscription
        {
          const { data: dupRows } = await supabase
            .from("subscription_charge_attempts")
            .select("subscription_id, donation_id, status")
            .in("status", ["succeeded", "test_succeeded"])
            .not("donation_id", "is", null)
            .limit(2000);
          const counts = new Map<string, { sub: string; donation: string; n: number }>();
          for (const a of dupRows ?? []) {
            if (!a.subscription_id || !a.donation_id) continue;
            const key = `${a.subscription_id}::${a.donation_id}`;
            const cur = counts.get(key) ?? { sub: a.subscription_id, donation: a.donation_id, n: 0 };
            cur.n += 1;
            counts.set(key, cur);
          }
          for (const v of counts.values()) {
            if (v.n > 1) {
              issues.push({
                kind: "duplicate_succeeded_attempts",
                severity: "warning",
                subscription_id: v.sub,
                detail: `Subscription ${v.sub} has ${v.n} succeeded attempts sharing donation_id ${v.donation}`,
              });
            }
          }
        }

        return ok({
          ok_invariants: issues.length === 0,
          checked_at: new Date().toISOString(),
          issues,
          summary: {
            errors: issues.filter(i => i.severity === "error").length,
            warnings: issues.filter(i => i.severity === "warning").length,
          },
        });
      }
      case "destroy_sandbox": {
        if (body?.confirm !== "DESTROY") return bad("confirm token required");
        const { data, error } = await userClient.rpc("admin_destroy_sandbox_data");
        if (error) return bad(error.message, 500);
        return ok({ destroyed: data });
      }
      case "audit_log": {
        const limit = Math.min(200, Math.max(1, Number(body?.limit ?? 50)));
        const { data, error } = await supabase
          .from("sandbox_audit_log")
          .select("id, actor, action, payload, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return bad(error.message, 500);
        return ok({ entries: data ?? [] });
      }

      // ─── Chaos runner: capped at 100 sandbox subs ────────────────────────
      case "chaos_run": {
        if (!cfg.testMode) return bad("test mode disabled", 403);
        const requested = Math.min(100, Math.max(1, Number(body?.count ?? 10)));
        const created: string[] = [];
        const presets: SimulationKind[] = [
          "success","failure","timeout","network_error",
          "expired_card","duplicate_webhook","reconcile_delay","stale_lock",
        ];
        for (let i = 0; i < requested; i++) {
          const interval = (["weekly","biweekly","monthly"] as const)[i % 3];
          const { data: subId, error } = await userClient.rpc("admin_create_sandbox_subscription", {
            _amount: 100 + (i % 10) * 10, _interval: interval, _campaign_id: null, _next_in_seconds: 30,
          });
          if (error) { structuredLog("chaos_create_error", { i, msg: error.message }); break; }
          created.push(subId as string);
        }
        // Apply random preset to each.
        let succeeded = 0, failed = 0, dedupe = 0;
        for (const subId of created) {
          const sub = await loadSimSub(subId);
          if (!sub) continue;
          const kind = presets[Math.floor(Math.random() * presets.length)];
          try {
            const r: any = await simulateAction(supabase, kind, sub, cfg);
            if (r?.outcome === "succeeded") succeeded++;
            else if (r?.outcome === "failed") failed++;
            if (r?.dedupe_prevented) dedupe++;
          } catch (e) {
            structuredLog("chaos_sim_error", { sub: subId, kind, msg: String(e) });
          }
        }
        await userClient.rpc("admin_log_sandbox_action", {
          _action: "chaos_run",
          _payload: { count: created.length, succeeded, failed, dedupe },
        });
        return ok({ created: created.length, succeeded, failed, dedupe_prevented: dedupe });
      }

      case "cron_tick": {
        // Sequentially run process → reconcile → cleanup.
        const a = await invokeFn("process-recurring-payments");
        const b = await invokeFn("reconcile-recurring-payments");
        const c = await invokeFn("cleanup-recurring-artifacts");
        return ok({ process: a, reconcile: b, cleanup: c });
      }

      // ─── Manual runners ──────────────────────────────────────────────────
      case "run_recurring_now":   return ok({ result: await invokeFn("process-recurring-payments") });
      case "run_reconcile_now":   return ok({ result: await invokeFn("reconcile-recurring-payments") });
      case "run_cleanup_now":     return ok({ result: await invokeFn("cleanup-recurring-artifacts") });
      case "run_health_check_now":return ok({ result: await invokeFn("recurring-health-check") });

      // ─── Test sandbox config ─────────────────────────────────────────────
      case "test_config":
        return ok({
          config: {
            test_mode: cfg.testMode,
            dry_run: cfg.dryRun,
            force_success: cfg.forceSuccess,
            force_failure: cfg.forceFailure,
            shadow_mode: cfg.testMode && cfg.dryRun,
            enabled: cfg.enabled,
          },
        });

      // ─── Force eligibility / clear locks (always allowed for admin) ──────
      case "force_next_payment": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        await supabase.from("donor_subscriptions").update({
          next_payment_at: new Date(Date.now() - 1000).toISOString(),
        }).eq("id", subId);
        await supabase.from("subscription_events").insert({
          subscription_id: subId, event_type: "test_force_next_payment",
          metadata: { actor: userId },
        });
        return ok({ subscription_id: subId });
      }
      case "clear_locks": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        await supabase.from("donor_subscriptions").update({
          processing_at: null, current_billing_key: null,
        }).eq("id", subId);
        await supabase.from("subscription_events").insert({
          subscription_id: subId, event_type: "test_clear_locks",
          metadata: { actor: userId },
        });
        return ok({ subscription_id: subId });
      }

      // ─── Deterministic simulations (test mode only) ──────────────────────
      case "simulate": {
        if (!cfg.testMode) return bad("test mode disabled", 403);
        const kind = String(body?.kind ?? "") as SimulationKind;
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        const sub = await loadSimSub(subId);
        if (!sub) return bad("subscription not found", 404);
        const dryRun = body?.dry_run === true;
        const result = await simulateAction(supabase, kind, sub, cfg, { dryRun });
        return ok({ kind, subscription_id: subId, ...result });
      }

      // ─── Replay tools (idempotency tests) ────────────────────────────────
      case "replay_webhook": {
        if (!cfg.testMode) return bad("test mode disabled", 403);
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        // Find the most recent payment_id for this sub.
        const { data: lastAttempt } = await supabase
          .from("subscription_charge_attempts")
          .select("yookassa_payment_id")
          .eq("subscription_id", subId)
          .not("yookassa_payment_id", "is", null)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const sub = await loadSimSub(subId);
        if (!sub) return bad("subscription not found", 404);
        const paymentId: string = String(body?.payment_id ?? lastAttempt?.yookassa_payment_id ?? `replay_${Date.now()}`);
        const status = (body?.status === "canceled" ? "canceled" : "succeeded") as "succeeded" | "canceled";
        const payload = buildReplayWebhookPayload(paymentId, subId, Number(sub.amount), status);
        structuredLog("test_replay_webhook", { sub: subId, payment_id: paymentId, status });
        const r = await invokeFn("yookassa-webhook", payload);
        return ok({ payment_id: paymentId, replay: r });
      }
      case "replay_reconcile": {
        if (!cfg.testMode) return bad("test mode disabled", 403);
        return ok({ result: await invokeFn("reconcile-recurring-payments") });
      }

      // ─── Recent test events ──────────────────────────────────────────────
      case "recent_test_events": {
        const limit = Number(body?.limit ?? 100);
        const { data, error } = await userClient.rpc("admin_recent_test_events", { _limit: limit });
        if (error) return bad(error.message, 500);
        return ok({ events: data ?? [] });
      }

      case "overview": {
        // Combined dashboard payload: metrics + recent failures + recoveries + stuck billing.
        const { data: metrics, error: mErr } = await userClient.rpc("admin_recurring_metrics");
        if (mErr) return bad(mErr.message, 500);

        const since30 = new Date(Date.now() - 30 * 86400e3).toISOString();
        const m10 = new Date(Date.now() - 10 * 60_000).toISOString();
        const h24 = new Date(Date.now() - 24 * 3_600_000).toISOString();
        const m15 = new Date(Date.now() - 15 * 60_000).toISOString();

        const [recentFailures, recoveries, stuckSubs, oldPending] = await Promise.all([
          supabase.from("subscription_charge_attempts")
            .select("subscription_id, donation_id, yookassa_payment_id, status, error_code, error_description, created_at")
            .in("status", ["create_failed","network_error","retry_scheduled","past_due","paused"])
            .gt("created_at", since30)
            .order("created_at", { ascending: false }).limit(50),
          supabase.from("subscription_events")
            .select("subscription_id, event_type, metadata, created_at")
            .eq("event_type", "recovered")
            .gt("created_at", since30)
            .order("created_at", { ascending: false }).limit(50),
          supabase.from("donor_subscriptions")
            .select("id, user_id, amount, interval, status, current_billing_key, processing_at, last_charge_at, last_retry_at, updated_at")
            .or(`processing_at.lt.${m10},current_billing_key.not.is.null`)
            .order("updated_at", { ascending: true }).limit(50),
          supabase.from("donations")
            .select("id, amount, user_id, yookassa_payment_id, created_at, payment_type")
            .eq("status", "pending").eq("payment_type", "recurring")
            .lt("created_at", m15)
            .order("created_at", { ascending: true }).limit(50),
        ]);

        return ok({
          metrics,
          recent_failures: recentFailures.data ?? [],
          recoveries: recoveries.data ?? [],
          stuck_billing: (stuckSubs.data ?? []).filter((s: any) => {
            const last = s.last_retry_at ?? s.last_charge_at ?? s.updated_at;
            return s.current_billing_key && (!last || Date.now() - new Date(last).getTime() > 24 * 3600e3)
              || (s.processing_at && new Date(s.processing_at).getTime() < Date.now() - 10 * 60_000);
          }),
          old_pending_donations: oldPending.data ?? [],
          generated_at: new Date().toISOString(),
        });
      }

      case "resume_subscription": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        await supabase.from("donor_subscriptions").update({
          status: "active",
          paused_at: null,
          paused_reason: null,
          retry_count: 0,
          last_failure_reason: null,
          last_failure_code: null,
          processing_at: null,
          current_billing_key: null,
          next_payment_at: new Date().toISOString(),
        }).eq("id", subId);
        await supabase.from("subscription_events").insert({
          subscription_id: subId, event_type: "resumed", metadata: { actor: userId, source: "admin" },
        });
        return ok({ subscription_id: subId });
      }

      case "cancel_subscription": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        await supabase.from("donor_subscriptions").update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          processing_at: null,
          current_billing_key: null,
        }).eq("id", subId);
        await supabase.from("subscription_events").insert({
          subscription_id: subId, event_type: "canceled", metadata: { actor: userId, source: "admin" },
        });
        return ok({ subscription_id: subId });
      }

      case "retry_now": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        // Make it eligible for the next cron tick: clear locks + due now.
        await supabase.from("donor_subscriptions").update({
          status: "active",
          processing_at: null,
          current_billing_key: null,
          next_payment_at: new Date().toISOString(),
        }).eq("id", subId);
        await supabase.from("subscription_events").insert({
          subscription_id: subId, event_type: "retry_scheduled",
          metadata: { actor: userId, source: "admin", manual: true },
        });
        return ok({ subscription_id: subId, hint: "Will be picked up by next cron tick" });
      }

      case "force_reconcile_donation": {
        const donationId = String(body?.donation_id ?? "");
        if (!donationId) return bad("donation_id required");
        const { data: d } = await supabase
          .from("donations")
          .select("id, amount, campaign_id, user_id, yookassa_payment_id, payment_type, status")
          .eq("id", donationId).maybeSingle();
        if (!d) return bad("donation not found", 404);
        if (!d.yookassa_payment_id) return bad("donation has no yookassa_payment_id");
        const obj = await fetchPayment(d.yookassa_payment_id);
        if (!obj) return bad("yookassa fetch failed", 502);
        const meta = obj?.metadata ?? {};
        const subscriptionId: string | null = meta?.subscription_id ?? null;
        const freqRaw = String(meta?.frequency ?? "monthly");
        const frequency: Frequency =
          freqRaw === "weekly" || freqRaw === "biweekly" ? freqRaw : "monthly";

        if (obj.status === "succeeded") {
          const { data: upd } = await supabase.from("donations").update({
            status: "succeeded", paid_at: new Date().toISOString(),
          }).eq("id", d.id).neq("status", "succeeded").select("id");
          if ((upd?.length ?? 0) > 0 && d.campaign_id && d.amount) {
            await supabase.rpc("increment_campaign_collected", {
              _campaign_id: d.campaign_id, _amount: d.amount,
            });
          }
          if (d.payment_type === "recurring") {
            await handleRecurringSuccess(supabase, {
              subscriptionId, donationId: d.id, donationAmount: Number(d.amount),
              donationCampaignId: d.campaign_id, donationUserId: d.user_id,
              frequency, paymentObject: obj,
            });
          }
        } else if (obj.status === "canceled") {
          await supabase.from("donations").update({ status: "canceled" })
            .eq("id", d.id).neq("status", "succeeded");
          if (subscriptionId && d.payment_type === "recurring") {
            await handleRecurringFailure(supabase, {
              subscriptionId, donationId: d.id, paymentId: obj?.id ?? null, paymentObject: obj,
            });
          }
        }
        return ok({ donation_id: d.id, yk_status: obj.status });
      }

      case "force_reconcile_subscription": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        // Reconcile every pending recurring donation tied to this user/sub via metadata,
        // then clear stale execution lock and billing key.
        const { data: sub } = await supabase
          .from("donor_subscriptions")
          .select("id, user_id, current_billing_key, last_charge_at, last_retry_at")
          .eq("id", subId).maybeSingle();
        if (!sub) return bad("subscription not found", 404);

        const { data: pendings } = await supabase
          .from("donations")
          .select("id, amount, campaign_id, user_id, yookassa_payment_id, payment_type")
          .eq("status", "pending")
          .eq("payment_type", "recurring")
          .eq("user_id", sub.user_id)
          .not("yookassa_payment_id", "is", null);

        let resolved = 0;
        for (const d of pendings ?? []) {
          const obj = await fetchPayment(d.yookassa_payment_id!);
          if (!obj) continue;
          const meta = obj?.metadata ?? {};
          if (meta?.subscription_id && meta.subscription_id !== subId) continue;
          const freqRaw = String(meta?.frequency ?? "monthly");
          const frequency: Frequency =
            freqRaw === "weekly" || freqRaw === "biweekly" ? freqRaw : "monthly";
          if (obj.status === "succeeded") {
            await supabase.from("donations").update({
              status: "succeeded", paid_at: new Date().toISOString(),
            }).eq("id", d.id).neq("status", "succeeded");
            await handleRecurringSuccess(supabase, {
              subscriptionId: subId, donationId: d.id, donationAmount: Number(d.amount),
              donationCampaignId: d.campaign_id, donationUserId: d.user_id,
              frequency, paymentObject: obj,
            });
            resolved++;
          } else if (obj.status === "canceled") {
            await supabase.from("donations").update({ status: "canceled" })
              .eq("id", d.id).neq("status", "succeeded");
            await handleRecurringFailure(supabase, {
              subscriptionId: subId, donationId: d.id, paymentId: obj?.id ?? null, paymentObject: obj,
            });
            resolved++;
          }
        }

        // Stale billing key recovery (>24h since any progress).
        const stale = sub.current_billing_key && (() => {
          const last = sub.last_retry_at ?? sub.last_charge_at;
          if (!last) return true;
          return Date.now() - new Date(last).getTime() > 24 * 60 * 60 * 1000;
        })();
        const patch: Record<string, unknown> = { processing_at: null };
        if (stale) patch.current_billing_key = null;
        await supabase.from("donor_subscriptions").update(patch).eq("id", subId);

        return ok({
          subscription_id: subId, scanned: pendings?.length ?? 0, resolved,
          billing_key_cleared: !!stale,
        });
      }

      default:
        return bad("unknown action");
    }
  } catch (e) {
    structuredLog("admin_action_error", { msg: String(e) });
    return bad(String(e), 500);
  }
});
