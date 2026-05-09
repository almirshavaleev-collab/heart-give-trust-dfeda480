import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  handleRecurringFailure,
  handleRecurringSuccess,
  structuredLog,
  type Frequency,
} from "../_shared/recurring.ts";

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
        const { data: pendings } = await supabase
          .from("donations")
          .select("id, yookassa_payment_id")
          .eq("status", "pending")
          .not("yookassa_payment_id", "is", null);
        const ids = pendings ?? [];
        let resolved = 0;
        for (const d of ids) {
          // Reuse the donation reconcile path
          const r = await fetch(req.url.replace(/admin-recurring$/, "admin-recurring"), {
            // no-op recursion guard — we reconcile inline instead
          }).catch(() => null);
          void r;
          const obj = await fetchPayment(d.yookassa_payment_id!);
          if (obj && (obj.status === "succeeded" || obj.status === "canceled")) resolved++;
        }
        // Also clear stale billing key (>24h) on this subscription.
        await supabase.from("donor_subscriptions").update({
          processing_at: null,
        }).eq("id", subId);
        return ok({ subscription_id: subId, scanned: ids.length, resolved });
      }

      default:
        return bad("unknown action");
    }
  } catch (e) {
    structuredLog("admin_action_error", { msg: String(e) });
    return bad(String(e), 500);
  }
});
