import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

/**
 * Recurring autopay engine.
 *
 * Responsibilities (intentionally narrow — the webhook is the source of truth):
 *   1. Pick due active subscriptions (with payment_method_id, not currently locked).
 *   2. Atomically lock each one via processing_at to prevent double charging.
 *   3. Create a pending donation row.
 *   4. POST to YooKassa with a deterministic Idempotence-Key.
 *   5. Persist yookassa_payment_id on the donation, log the attempt, release the lock.
 *
 * It does NOT update next_payment_at, last_charge_at or subscription status — that
 * is exclusively the webhook's job once payment.succeeded / payment.canceled arrives.
 *
 * DRY RUN: set RECURRING_DRY_RUN=true to skip the YooKassa POST.
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
};

function deterministicIdempotenceKey(subId: string, nextPaymentAt: string | null): string {
  // Same key for the same billing period — protects against retry/crash double-charge.
  const period = nextPaymentAt
    ? new Date(nextPaymentAt).toISOString().slice(0, 10) // YYYY-MM-DD
    : new Date().toISOString().slice(0, 10);
  return `autopay-${subId}-${period}`;
}

function log(phase: string, sub: string | null, extra: Record<string, unknown> = {}) {
  const parts = [`[recurring]`, `phase=${phase}`];
  if (sub) parts.push(`sub=${sub}`);
  for (const [k, v] of Object.entries(extra)) parts.push(`${k}=${v}`);
  console.log(parts.join(" "));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  log("cron_start", null);

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
    log("cron_abort", null, { reason: "missing_keys", mode });
    return new Response(JSON.stringify({ error: "YooKassa not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = shopId && secretKey ? btoa(`${shopId}:${secretKey}`) : "";

  // 1. Pull due subscriptions (status active, has saved PM, not currently locked).
  // Lock window: ignore subs whose processing_at is fresher than 10 minutes (stuck-lock recovery).
  const nowIso = new Date().toISOString();
  const lockHorizon = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: due, error: dueErr } = await supabase
    .from("donor_subscriptions")
    .select(
      "id, user_id, campaign_id, amount, currency, interval, status, payment_method_id, payment_method_type, next_payment_at",
    )
    .eq("status", "active")
    .lte("next_payment_at", nowIso)
    .not("payment_method_id", "is", null)
    .or(`processing_at.is.null,processing_at.lt.${lockHorizon}`)
    .limit(50);

  if (dueErr) {
    log("cron_query_error", null, { msg: dueErr.message });
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const subs = (due ?? []) as Subscription[];
  log("cron_selected", null, { mode, dry_run: dryRun, due_count: subs.length });

  let succeeded = 0; // accepted by YooKassa (final status from webhook)
  let failed = 0;
  let skipped = 0;

  for (const sub of subs) {
    if (!sub.payment_method_id) {
      skipped++;
      continue;
    }

    // 2. Atomic lock: only proceed if we win the UPDATE race.
    const { data: locked, error: lockErr } = await supabase
      .from("donor_subscriptions")
      .update({ processing_at: nowIso })
      .eq("id", sub.id)
      .eq("status", "active")
      .or(`processing_at.is.null,processing_at.lt.${lockHorizon}`)
      .select("id");

    if (lockErr || !locked || locked.length === 0) {
      log("lock_skip", sub.id, { reason: lockErr?.message ?? "race_lost" });
      skipped++;
      continue;
    }
    log("lock_acquire", sub.id);

    try {
      // 3. Create pending donation.
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
        log("donation_insert_error", sub.id, { msg: donationErr?.message ?? "n/a" });
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id,
          status: "internal_error",
          error_code: "donation_insert",
          error_description: donationErr?.message ?? null,
        });
        failed++;
        continue;
      }
      const donationId = donationRow.id;

      // 4. Idempotent POST to YooKassa (or dry-run).
      const idemKey = deterministicIdempotenceKey(sub.id, sub.next_payment_at);

      if (dryRun) {
        log("payment_create_dry_run", sub.id, { donation_id: donationId, idem: idemKey });
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id,
          donation_id: donationId,
          status: "dry_run",
          metadata: { idempotence_key: idemKey },
        });
        // Mark donation canceled so it doesn't sit pending forever.
        await supabase.from("donations").update({ status: "canceled" }).eq("id", donationId);
        skipped++;
        continue;
      }

      log("payment_create", sub.id, { donation_id: donationId, idem: idemKey });

      let ykResp: Response;
      try {
        ykResp = await fetch("https://api.yookassa.ru/v3/payments", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/json",
            "Idempotence-Key": idemKey,
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
            },
          }),
        });
      } catch (e) {
        log("payment_network_error", sub.id, { msg: String(e) });
        await supabase.from("donations").update({ status: "failed" }).eq("id", donationId);
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id,
          donation_id: donationId,
          status: "network_error",
          error_description: String(e),
        });
        failed++;
        continue;
      }

      const data = await ykResp.json().catch(() => ({}));

      if (!ykResp.ok) {
        log("payment_create_fail", sub.id, {
          http: ykResp.status,
          code: data?.code ?? "n/a",
          desc: data?.description ?? "n/a",
        });
        await supabase.from("donations").update({ status: "failed" }).eq("id", donationId);
        await supabase.from("subscription_charge_attempts").insert({
          subscription_id: sub.id,
          donation_id: donationId,
          status: "create_failed",
          error_code: data?.code ?? String(ykResp.status),
          error_description: data?.description ?? null,
        });

        if (typeof data?.description === "string" && /saved payment method/i.test(data.description)) {
          log("payment_create_fail", sub.id, { hint: "shop_recurring_disabled" });
        }
        failed++;
        continue;
      }

      // 5. Persist yookassa_payment_id; log the attempt. Webhook will reconcile.
      await supabase
        .from("donations")
        .update({ yookassa_payment_id: data.id })
        .eq("id", donationId);

      await supabase.from("subscription_charge_attempts").insert({
        subscription_id: sub.id,
        donation_id: donationId,
        yookassa_payment_id: data.id,
        status: `created:${data.status ?? "unknown"}`,
        metadata: { idempotence_key: idemKey },
      });

      log("payment_created", sub.id, {
        donation_id: donationId,
        payment_id: data.id,
        yk_status: data.status,
      });
      // We don't increment `succeeded` here — the webhook is the source of truth.
      succeeded++;
    } finally {
      // Release lock regardless of outcome.
      const { error: unlockErr } = await supabase
        .from("donor_subscriptions")
        .update({ processing_at: null })
        .eq("id", sub.id);
      if (unlockErr) log("lock_release_error", sub.id, { msg: unlockErr.message });
      else log("lock_release", sub.id);
    }
  }

  const ms = Date.now() - startedAt;
  log("cron_end", null, { due: subs.length, created: succeeded, failed, skipped, duration_ms: ms });

  return new Response(
    JSON.stringify({
      ok: true,
      dry_run: dryRun,
      due: subs.length,
      created: succeeded,
      failed,
      skipped,
      duration_ms: ms,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
