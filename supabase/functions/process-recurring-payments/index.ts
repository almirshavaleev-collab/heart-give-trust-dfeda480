import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

/**
 * Recurring autopay engine.
 *
 * Finds active donor_subscriptions whose next_payment_at <= now() and that have
 * a saved payment_method_id, then triggers off-session YooKassa payments using
 * that saved method (capture: true, no confirmation redirect).
 *
 * Designed to be called on a schedule (pg_cron / pg_net). Safe to invoke
 * manually for debugging — it's idempotent enough as long as we only run it on
 * subscriptions that are due.
 *
 * NB: requires "Forbidden to use saved payment method" not to be returned by
 * YooKassa, i.e. the shop must have recurring/autopayments enabled.
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

function bumpNextPaymentAt(from: Date, interval: Subscription["interval"]): string {
  const next = new Date(from);
  if (interval === "weekly") next.setDate(next.getDate() + 7);
  else if (interval === "biweekly") next.setDate(next.getDate() + 14);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  console.log("[process-recurring-payments] run started");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rawMode = (Deno.env.get("YOOKASSA_MODE") ?? "test").trim().toLowerCase();
  const mode: "production" | "test" = rawMode === "production" ? "production" : "test";
  const shopId = mode === "production"
    ? Deno.env.get("YOOKASSA_PROD_SHOP_ID")
    : Deno.env.get("YOOKASSA_SHOP_ID");
  const secretKey = mode === "production"
    ? Deno.env.get("YOOKASSA_PROD_SECRET_KEY")
    : Deno.env.get("YOOKASSA_SECRET_KEY");

  if (!shopId || !secretKey) {
    console.error(`[process-recurring-payments] missing YooKassa keys for mode=${mode}`);
    return new Response(
      JSON.stringify({ error: "YooKassa not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const auth = btoa(`${shopId}:${secretKey}`);

  // 1. Pull due subscriptions
  const nowIso = new Date().toISOString();
  const { data: due, error: dueErr } = await supabase
    .from("donor_subscriptions")
    .select("id, user_id, campaign_id, amount, currency, interval, status, payment_method_id, payment_method_type, next_payment_at")
    .eq("status", "active")
    .lte("next_payment_at", nowIso)
    .not("payment_method_id", "is", null)
    .limit(50);

  if (dueErr) {
    console.error("[process-recurring-payments] query error:", dueErr);
    return new Response(
      JSON.stringify({ error: dueErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const subs = (due ?? []) as Subscription[];
  console.log(`[process-recurring-payments] mode=${mode} due_count=${subs.length}`);

  let succeeded = 0;
  let failed = 0;

  for (const sub of subs) {
    if (!sub.payment_method_id) {
      console.warn(`[process-recurring-payments] skip sub=${sub.id} — no payment_method_id`);
      continue;
    }

    console.log(`[process-recurring-payments] autopayment started sub=${sub.id} amount=${sub.amount} pm=${sub.payment_method_id}`);

    // 2. Pre-create donation row in pending state so the webhook can match it.
    const { data: donationRow, error: donationErr } = await supabase
      .from("donations")
      .insert({
        amount: sub.amount,
        status: "pending",
        currency: sub.currency,
        donor_name: null,
        donor_email: null,
        donor_phone: null,
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
      console.error(`[process-recurring-payments] donation insert failed sub=${sub.id}:`, donationErr);
      failed++;
      continue;
    }
    const donationId = donationRow.id;

    // 3. Create off-session payment in YooKassa.
    let ykResp: Response;
    try {
      ykResp = await fetch("https://api.yookassa.ru/v3/payments", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
          "Idempotence-Key": `autopay-${sub.id}-${Date.now()}`,
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
      console.error(`[process-recurring-payments] network error sub=${sub.id}:`, e);
      await supabase.from("donations").update({ status: "failed" }).eq("id", donationId);
      failed++;
      continue;
    }

    const data = await ykResp.json().catch(() => ({}));

    if (!ykResp.ok) {
      console.error(
        `[process-recurring-payments] autopayment fail sub=${sub.id} http=${ykResp.status} code=${data?.code ?? "n/a"} desc=${data?.description ?? "n/a"}`,
      );
      await supabase.from("donations").update({ status: "failed" }).eq("id", donationId);

      // Specific YooKassa error: shop has no recurring permission.
      if (typeof data?.description === "string" && /saved payment method/i.test(data.description)) {
        console.warn(
          "[process-recurring-payments] YooKassa rejected saved payment method — likely shop is not enabled for autopayments.",
        );
      }
      failed++;
      continue;
    }

    // Persist YooKassa payment_id on donation so webhook can match.
    await supabase
      .from("donations")
      .update({ yookassa_payment_id: data.id })
      .eq("id", donationId);

    console.log(
      `[process-recurring-payments] autopayment success sub=${sub.id} donation_id=${donationId} payment_id=${data.id} status=${data.status}`,
    );

    // 4. Update subscription's next_payment_at + last_charge_at right away.
    //    The webhook will also do this, but we don't want to retry the same
    //    sub on the next cron tick if the webhook is delayed.
    const next = bumpNextPaymentAt(new Date(), sub.interval);
    const { error: subUpdErr } = await supabase
      .from("donor_subscriptions")
      .update({
        last_charge_at: new Date().toISOString(),
        next_payment_at: next,
      })
      .eq("id", sub.id);
    if (subUpdErr) {
      console.error(`[process-recurring-payments] sub update error sub=${sub.id}:`, subUpdErr);
    }

    succeeded++;
  }

  const ms = Date.now() - startedAt;
  console.log(
    `[process-recurring-payments] run finished due=${subs.length} succeeded=${succeeded} failed=${failed} duration_ms=${ms}`,
  );

  return new Response(
    JSON.stringify({ ok: true, due: subs.length, succeeded, failed, duration_ms: ms }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});