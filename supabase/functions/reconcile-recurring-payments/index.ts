import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  handleRecurringFailure,
  handleRecurringSuccess,
  structuredLog,
  recordHeartbeat,
  billingCycleKey,
  getRecurringConfig,
  type Frequency,
} from "../_shared/recurring.ts";

/**
 * Reconciliation engine for recurring donations whose webhook never arrived.
 *
 * Selects donations where:
 *   - status = 'pending'
 *   - yookassa_payment_id IS NOT NULL
 *   - payment_type = 'recurring'
 *   - created_at older than 15 minutes
 *
 * For each, we ask YooKassa for the current state and apply the same shared
 * reconcile helpers used by the webhook. Idempotent — safe to run on a schedule.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  structuredLog("reconcile_start");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rawMode = (Deno.env.get("YOOKASSA_MODE") ?? "test").trim().toLowerCase();
  const mode: "production" | "test" = rawMode === "production" ? "production" : "test";
  const testCreds = {
    shopId: Deno.env.get("YOOKASSA_SHOP_ID"),
    secret: Deno.env.get("YOOKASSA_SECRET_KEY"),
    label: "test",
  };
  const prodCreds = {
    shopId: Deno.env.get("YOOKASSA_PROD_SHOP_ID"),
    secret: Deno.env.get("YOOKASSA_PROD_SECRET_KEY"),
    label: "production",
  };

  async function fetchPayment(id: string) {
    for (const creds of (mode === "production" ? [prodCreds, testCreds] : [testCreds, prodCreds])) {
      if (!creds.shopId || !creds.secret) continue;
      const auth = btoa(`${creds.shopId}:${creds.secret}`);
      const resp = await fetch(`https://api.yookassa.ru/v3/payments/${id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.id) return { data, creds: creds.label };
    }
    return null;
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pending, error } = await supabase
    .from("donations")
    .select("id, amount, campaign_id, user_id, yookassa_payment_id, payment_type, created_at")
    .eq("status", "pending")
    .eq("payment_type", "recurring")
    .not("yookassa_payment_id", "is", null)
    .lt("created_at", cutoff)
    .limit(50);

  if (error) {
    structuredLog("reconcile_query_error", { msg: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = pending ?? [];
  structuredLog("reconcile_selected", { count: rows.length });

  let resolved_succeeded = 0, resolved_canceled = 0, still_pending = 0, errors = 0;

  for (const d of rows) {
    const fetched = await fetchPayment(d.yookassa_payment_id!);
    if (!fetched) {
      structuredLog("reconcile_fetch_fail", { donation_id: d.id, payment_id: d.yookassa_payment_id });
      errors++;
      continue;
    }
    const obj = fetched.data;
    const status = String(obj?.status ?? "");
    const meta = obj?.metadata ?? {};
    const subscriptionId: string | null = meta?.subscription_id ?? null;
    const freqRaw = String(meta?.frequency ?? "monthly");
    const frequency: Frequency =
      freqRaw === "weekly" || freqRaw === "biweekly" ? freqRaw : "monthly";

    structuredLog("reconcile_payment", {
      donation_id: d.id, payment_id: obj?.id, yk_status: status, sub: subscriptionId,
    });

    if (status === "succeeded") {
      // Mirror the webhook's donation update + campaign increment + recurring reconcile.
      const { data: upd } = await supabase
        .from("donations")
        .update({ status: "succeeded", paid_at: new Date().toISOString() })
        .eq("id", d.id).neq("status", "succeeded").select("id");
      if ((upd?.length ?? 0) > 0 && d.campaign_id && d.amount) {
        await supabase.rpc("increment_campaign_collected", {
          _campaign_id: d.campaign_id, _amount: d.amount,
        });
      }
      await handleRecurringSuccess(supabase, {
        subscriptionId,
        donationId: d.id,
        donationAmount: Number(d.amount),
        donationCampaignId: d.campaign_id,
        donationUserId: d.user_id,
        frequency,
        paymentObject: obj,
        billingCycleKey: subscriptionId
          ? billingCycleKey(subscriptionId, null, getRecurringConfig().cycleBucketHours, frequency)
          : null,
      });
      resolved_succeeded++;
    } else if (status === "canceled") {
      await supabase.from("donations").update({ status: "canceled" }).eq("id", d.id).neq("status", "succeeded");
      if (subscriptionId) {
        await handleRecurringFailure(supabase, {
          subscriptionId, donationId: d.id, paymentId: obj?.id ?? null, paymentObject: obj,
        });
      }
      resolved_canceled++;
    } else {
      // pending / waiting_for_capture — leave it; we'll try again on the next tick.
      still_pending++;
    }
  }

  const ms = Date.now() - startedAt;
  structuredLog("reconcile_end", {
    selected: rows.length, resolved_succeeded, resolved_canceled, still_pending, errors, duration_ms: ms,
  });
  await recordHeartbeat(supabase, "reconcile-recurring-payments", "ok", {
    selected: rows.length, resolved_succeeded, resolved_canceled, still_pending, errors,
  });

  return new Response(
    JSON.stringify({
      ok: true, selected: rows.length, resolved_succeeded, resolved_canceled, still_pending, errors, duration_ms: ms,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
