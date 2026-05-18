import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  handleRecurringFailure,
  handleRecurringSuccess,
  structuredLog,
  type Frequency,
} from "../_shared/recurring.ts";

/**
 * Admin-only operations for recurring billing (production-only).
 * Actions: metrics, overview, integrity_scan, inspector, check_invariants,
 *          resume_subscription, cancel_subscription, retry_now,
 *          force_next_payment, clear_locks,
 *          force_reconcile_donation, force_reconcile_subscription,
 *          cron_tick, run_recurring_now, run_reconcile_now, run_cleanup_now, run_health_check_now
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

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const action = String(body?.action ?? "");
  structuredLog("admin_action", { actor: userId, action });

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
      case "cron_tick": {
        const a = await invokeFn("process-recurring-payments");
        const b = await invokeFn("reconcile-recurring-payments");
        const c = await invokeFn("cleanup-recurring-artifacts");
        return ok({ process: a, reconcile: b, cleanup: c });
      }
      case "run_recurring_now":   return ok({ result: await invokeFn("process-recurring-payments") });
      case "run_reconcile_now":   return ok({ result: await invokeFn("reconcile-recurring-payments") });
      case "run_cleanup_now":     return ok({ result: await invokeFn("cleanup-recurring-artifacts") });
      case "run_health_check_now":return ok({ result: await invokeFn("recurring-health-check") });

      case "force_next_payment": {
        const subId = String(body?.subscription_id ?? "");
        if (!subId) return bad("subscription_id required");
        await supabase.from("donor_subscriptions").update({
          next_payment_at: new Date(Date.now() - 1000).toISOString(),
        }).eq("id", subId);
        await supabase.from("subscription_events").insert({
          subscription_id: subId, event_type: "force_next_payment",
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
          subscription_id: subId, event_type: "clear_locks",
          metadata: { actor: userId },
        });
        return ok({ subscription_id: subId });
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
        return ok({ subscription_id: subId });
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

      default:
        return bad("unknown action");
    }
  } catch (e) {
    structuredLog("admin_action_error", { msg: String(e) });
    return bad(String(e), 500);
  }
});
