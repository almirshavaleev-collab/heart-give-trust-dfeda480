import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import {
  deterministicBillingKey,
  normalizeYkCreatedStatus,
  structuredLog,
} from "../_shared/recurring.ts";

/**
 * Recurring autopay engine.
 * Narrow responsibilities — webhook is the source of truth.
 *
 *   1. Pick due active subscriptions (no current_billing_key, not currently locked).
 *   2. Atomically lock via processing_at (short-lived execution lock).
 *   3. Set current_billing_key (long-lived billing lock, cleared by webhook).
 *   4. Create pending donation + POST to YooKassa with deterministic Idempotence-Key.
 *   5. Persist yookassa_payment_id and release execution lock.
 *
 * It does NOT update next_payment_at, last_charge_at or status — webhook does that
 * (and clears current_billing_key as part of the same reconcile).
 *
 * Recovery horizons:
 *   - processing_at older than 10 min  → considered stale, re-locked
 *   - current_billing_key older than 24h (last_retry_at / last_charge_at) → not enforced here;
 *     reconcile-recurring-payments resolves the underlying donation and clears it.
 *
 * DRY RUN: set RECURRING_DRY_RUN=true.
 */

type Subscription = {
  id: string;
  user_id: string | null;
  campaign_id: string | null;
  amount: number;
  currency: string;
  interval: "weekly" | "biweekly" | "monthly";
  status: string;
  payment_method_id: string | null;
  payment_method_type: string | null;
  next_payment_at: string | null;
  current_billing_key: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  structuredLog("cron_start");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const dryRun = (Deno.env.get("RECURRING_DRY_RUN") ?? "").toLowerCase() === "true";
  const rawMode = (Deno.env.get("YOOKASSA_MODE") ?? "test").trim().toLowerCase();
  const mode: "production" | "test" = rawMode === "production" ? "production" : "test";
  const shopId = mode === "production"
    ? Deno.env.get("YOOKASSA_PROD_SHOP_ID")
    : Deno.env.get("YOOKASSA_SHOP_ID");
  const secretKey = mode === "production"
    ? Deno.env.get("YOOKASSA_PROD_SECRET_KEY")
    : Deno.env.get("YOOKASSA_SECRET_KEY");

  if (!dryRun && (!shopId || !secretKey)) {
    structuredLog("cron_abort", { reason: "missing_keys", mode });
    return new Response(JSON.stringify({ error: "YooKassa not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const auth = shopId && secretKey ? btoa(`${shopId}:${secretKey}`) : "";

  const nowIso = new Date().toISOString();
  const execLockHorizon = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // 1. Eligible subs: due, has saved PM, no active billing key, not held by exec lock.
  const { data: due, error: dueErr } = await supabase
    .from("donor_subscriptions")
    .select(
      "id, user_id, campaign_id, amount, currency, interval, status, payment_method_id, payment_method_type, next_payment_at, current_billing_key",
    )
    .eq("status", "active")
    .lte("next_payment_at", nowIso)
    .not("payment_method_id", "is", null)
    .is("current_billing_key", null)
    .or(`processing_at.is.null,processing_at.lt.${execLockHorizon}`)
    .limit(50);

  if (dueErr) {
    structuredLog("cron_query_error", { msg: dueErr.message });
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const subs = (due ?? []) as Subscription[];
  structuredLog("cron_selected", { mode, dry_run: dryRun, due_count: subs.length });

  let payments_created = 0;
  let failed = 0;
  let skipped = 0;

  for (const sub of subs) {
    if (!sub.payment_method_id) { skipped++; continue; }

    const billingKey = deterministicBillingKey(sub.id, sub.next_payment_at);

    // 2+3. Atomic combined lock: short-term processing_at AND long-term billing_key.
    const { data: locked, error: lockErr } = await supabase
      .from("donor_subscriptions")
      .update({ processing_at: nowIso, current_billing_key: billingKey })
      .eq("id", sub.id)
      .eq("status", "active")
      .is("current_billing_key", null)
      .or(`processing_at.is.null,processing_at.lt.${execLockHorizon}`)
      .select("id");

    if (lockErr || !locked || locked.length === 0) {
      structuredLog("lock_skip", { sub: sub.id, reason: lockErr?.message ?? "race_lost" });
      skipped++;
      continue;
    }
    structuredLog("lock_acquire", { sub: sub.id, billing_key: billingKey });

    let releaseBillingKey = false; // only if we never created a payment
    try {
      // 4. Create pending donation
      const { data: donationRow, error: donationErr } = await supabase
        .from("donations")
        .insert({
          amount: sub.amount,
          status: "pending",
          currency: sub.currency,
          campaign_id: sub.campaign_id,
          is_anonymous: false,
          payment_type: "recurring",
          is_recurring: true,
          user_id: sub.user_id,
          payment_method_type: sub.payment_method_type,
        })
        .select("id")
        .single();

      if (donationErr || !donationRow) {
        structuredLog("donation_insert_error", { sub: sub.id, msg: donationErr?.message ?? "n/a" });
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id, status: "internal_error",
          error_code: "donation_insert", error_description: donationErr?.message ?? null,
        });
        failed++;
        releaseBillingKey = true;
        continue;
      }
      const donationId = donationRow.id;

      if (dryRun) {
        structuredLog("payment_create_dry_run", { sub: sub.id, donation_id: donationId, billing_key: billingKey });
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id, donation_id: donationId, status: "dry_run",
          metadata: { billing_key: billingKey },
        });
        await supabase.from("donations").update({ status: "canceled" }).eq("id", donationId);
        skipped++;
        releaseBillingKey = true;
        continue;
      }

      structuredLog("payment_create", { sub: sub.id, donation_id: donationId, billing_key: billingKey });

      let ykResp: Response;
      try {
        ykResp = await fetch("https://api.yookassa.ru/v3/payments", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/json",
            "Idempotence-Key": billingKey,
          },
          body: JSON.stringify({
            amount: { value: Number(sub.amount).toFixed(2), currency: sub.currency || "RUB" },
            capture: true,
            payment_method_id: sub.payment_method_id,
            description: "Регулярная поддержка фонда «Выпускники Лицея «Лига»",
            metadata: {
              donation_id: donationId,
              campaign_id: sub.campaign_id ?? "general",
              payment_type: "recurring",
              type: "recurring",
              user_id: sub.user_id ?? "",
              frequency: sub.interval,
              subscription_id: sub.id,
              autopay: "true",
              billing_key: billingKey,
            },
          }),
        });
      } catch (e) {
        structuredLog("payment_network_error", { sub: sub.id, msg: String(e) });
        await supabase.from("donations").update({ status: "failed" }).eq("id", donationId);
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id, donation_id: donationId, status: "network_error",
          error_description: String(e),
        });
        failed++;
        releaseBillingKey = true;
        continue;
      }

      const data = await ykResp.json().catch(() => ({}));

      if (!ykResp.ok) {
        structuredLog("payment_create_fail", {
          sub: sub.id, http: ykResp.status, code: data?.code ?? "n/a", desc: data?.description ?? "n/a",
        });
        await supabase.from("donations").update({ status: "failed" }).eq("id", donationId);
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id, donation_id: donationId, status: "create_failed",
          error_code: data?.code ?? String(ykResp.status), error_description: data?.description ?? null,
        });
        if (typeof data?.description === "string" && /saved payment method/i.test(data.description)) {
          structuredLog("payment_create_fail", { sub: sub.id, hint: "shop_recurring_disabled" });
        }
        failed++;
        releaseBillingKey = true;
        continue;
      }

      // 5. Payment created — webhook will reconcile + clear billing_key.
      await supabase.from("donations").update({ yookassa_payment_id: data.id }).eq("id", donationId);
      await supabase.from("subscription_charge_attempts").insert({
        subscription_id: sub.id, donation_id: donationId, yookassa_payment_id: data.id,
        status: normalizeYkCreatedStatus(data?.status),
        metadata: { billing_key: billingKey, yk_status: data?.status ?? null },
      });
      await supabase.from("subscription_events").insert({
        subscription_id: sub.id, event_type: "payment_created",
        metadata: { donation_id: donationId, payment_id: data.id, billing_key: billingKey, yk_status: data.status },
      });

      structuredLog("payment_created", {
        sub: sub.id, donation_id: donationId, payment_id: data.id, yk_status: data.status,
      });
      payments_created++;
    } finally {
      // Always release the short execution lock; release billing key only if no payment exists.
      const patch: Record<string, unknown> = { processing_at: null };
      if (releaseBillingKey) patch.current_billing_key = null;
      const { error: unlockErr } = await supabase.from("donor_subscriptions").update(patch).eq("id", sub.id);
      if (unlockErr) structuredLog("lock_release_error", { sub: sub.id, msg: unlockErr.message });
      else structuredLog("lock_release", { sub: sub.id, billing_key_released: releaseBillingKey });
    }
  }

  const ms = Date.now() - startedAt;
  structuredLog("cron_end", {
    due: subs.length, payments_created, failed, skipped, duration_ms: ms,
  });

  return new Response(
    JSON.stringify({
      ok: true, dry_run: dryRun, due: subs.length, payments_created, failed, skipped, duration_ms: ms,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
