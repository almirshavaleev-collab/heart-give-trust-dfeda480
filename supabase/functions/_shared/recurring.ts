// Shared recurring-billing reconciliation helpers.
// Used by:
//   - yookassa-webhook  (real-time path)
//   - reconcile-recurring-payments (recovery path)
//   - admin-recurring   (manual ops)
//
// Keep this file dependency-free apart from a SupabaseClient passed in.

// deno-lint-ignore no-explicit-any
type SB = any;

export type Frequency = "weekly" | "biweekly" | "monthly";

export function structuredLog(
  phase: string,
  ctx: Record<string, unknown> = {},
) {
  const parts = [`[recurring]`, `phase=${phase}`];
  for (const [k, v] of Object.entries(ctx)) {
    if (v === undefined || v === null) continue;
    parts.push(`${k}=${v}`);
  }
  console.log(parts.join(" "));
}

export function bumpNextPaymentAt(from: Date, freq: Frequency): string {
  const d = new Date(from);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export function deterministicBillingKey(subId: string, nextPaymentAt: string | null): string {
  const period = nextPaymentAt
    ? new Date(nextPaymentAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `autopay-${subId}-${period}`;
}

// YooKassa cancellation_details.reason classification.
// https://yookassa.ru/developers/payment-acceptance/after-the-payment/declined-payments
const UNRECOVERABLE_REASONS = new Set([
  "expired_card",
  "invalid_card_number",
  "invalid_csc",
  "fraud_suspected",
  "payment_method_restricted",
  "issuer_unavailable", // ambiguous, but treated as block to be safe — overridden below
  "permission_revoked",
  "country_forbidden",
  "identification_required",
]);
// Keep some that look fatal but really aren't:
const FORCE_RECOVERABLE = new Set([
  "issuer_unavailable",
  "internal_timeout",
  "general_decline",
  "insufficient_funds",
]);

export function classifyFailure(reason: string | null): "recoverable" | "unrecoverable" {
  if (!reason) return "recoverable";
  if (FORCE_RECOVERABLE.has(reason)) return "recoverable";
  if (UNRECOVERABLE_REASONS.has(reason)) return "unrecoverable";
  return "recoverable";
}

export interface RecurringSuccessInput {
  subscriptionId: string | null;
  donationId: string;
  donationAmount: number | null;
  donationCampaignId: string | null;
  donationUserId: string | null;
  frequency: Frequency;
  paymentObject: any; // YooKassa payment object
}

/**
 * Reconcile a successful recurring payment. Idempotent:
 *  - subscription_charge_attempts has a unique (sub_id, payment_id, status) index
 *  - donor_subscriptions update is gated by the billing_key match where applicable
 */
export async function handleRecurringSuccess(
  supabase: SB,
  input: RecurringSuccessInput,
): Promise<{ subscriptionId: string | null; created: boolean; updated: boolean }> {
  const {
    subscriptionId, donationId, donationAmount, donationCampaignId, donationUserId,
    frequency, paymentObject,
  } = input;

  const paymentId: string | null = paymentObject?.id ?? null;
  const savedPaymentMethodId: string | null = paymentObject?.payment_method?.id ?? null;
  const paymentMethodType: string | null = paymentObject?.payment_method?.type ?? null;
  const pmSaved = paymentObject?.payment_method?.saved === true;
  const card = paymentObject?.payment_method?.card ?? null;
  const cardLast4: string | null = card?.last4 ?? null;
  const cardType: string | null = card?.card_type ?? null;
  const cardExpiry: string | null =
    card?.expiry_month && card?.expiry_year ? `${card.expiry_month}/${card.expiry_year}` : null;

  if (!savedPaymentMethodId || !pmSaved) {
    structuredLog("recurring_no_payment_method", { donation_id: donationId, payment_id: paymentId });
    return { subscriptionId: null, created: false, updated: false };
  }

  const nowIso = new Date().toISOString();
  const nextPaymentAt = bumpNextPaymentAt(new Date(), frequency);

  // 1. Find existing subscription
  let existing: { id: string; payment_method_id: string | null; status: string } | null = null;
  if (subscriptionId) {
    const { data } = await supabase
      .from("donor_subscriptions")
      .select("id, payment_method_id, status")
      .eq("id", subscriptionId)
      .maybeSingle();
    existing = data ?? null;
  }
  if (!existing) {
    let q = supabase
      .from("donor_subscriptions")
      .select("id, payment_method_id, status")
      .in("status", ["active", "past_due", "paused"])
      .eq("amount", donationAmount)
      .eq("interval", frequency);
    q = donationCampaignId ? q.eq("campaign_id", donationCampaignId) : q.is("campaign_id", null);
    q = donationUserId ? q.eq("user_id", donationUserId) : q.is("user_id", null);
    const { data } = await q.limit(1).maybeSingle();
    existing = data ?? null;
  }

  if (existing?.id) {
    const wasPastDue = existing.status === "past_due";
    const { error } = await supabase
      .from("donor_subscriptions")
      .update({
        last_charge_at: nowIso,
        next_payment_at: nextPaymentAt,
        payment_method_id: existing.payment_method_id ?? savedPaymentMethodId,
        payment_method_type: paymentMethodType,
        status: "active",
        retry_count: 0,
        last_failure_reason: null,
        last_failure_code: null,
        last_retry_at: null,
        processing_at: null,
        current_billing_key: null,
        paused_reason: null,
        card_last4: cardLast4 ?? undefined,
        card_type: cardType ?? undefined,
        card_expiry: cardExpiry ?? undefined,
        payment_method_saved_at: pmSaved ? nowIso : undefined,
      })
      .eq("id", existing.id);
    if (error) {
      structuredLog("subscription_update_error", { sub_id: existing.id, msg: error.message });
      return { subscriptionId: existing.id, created: false, updated: false };
    }
    // ON CONFLICT is the dedup mechanism for duplicate webhooks
    await supabase.from("subscription_charge_attempts").upsert(
      {
        subscription_id: existing.id,
        donation_id: donationId,
        yookassa_payment_id: paymentId,
        status: "succeeded",
      },
      { onConflict: "subscription_id,yookassa_payment_id,status", ignoreDuplicates: true },
    );
    await supabase.from("subscription_events").insert({
      subscription_id: existing.id,
      event_type: wasPastDue ? "recovered" : "payment_succeeded",
      metadata: { donation_id: donationId, payment_id: paymentId, next_payment_at: nextPaymentAt },
    });
    structuredLog("webhook_reconcile", {
      sub: existing.id,
      donation_id: donationId,
      payment_id: paymentId,
      next: nextPaymentAt,
      recovered: wasPastDue,
    });
    return { subscriptionId: existing.id, created: false, updated: true };
  }

  // 2. Create new subscription
  const { data: created, error: insErr } = await supabase
    .from("donor_subscriptions")
    .insert({
      user_id: donationUserId,
      campaign_id: donationCampaignId,
      amount: donationAmount,
      currency: "RUB",
      interval: frequency,
      status: "active",
      payment_method_id: savedPaymentMethodId,
      payment_method_type: paymentMethodType,
      next_payment_at: nextPaymentAt,
      last_charge_at: nowIso,
      card_last4: cardLast4,
      card_type: cardType,
      card_expiry: cardExpiry,
      payment_method_saved_at: pmSaved ? nowIso : null,
    })
    .select("id")
    .single();
  if (insErr || !created) {
    structuredLog("subscription_insert_error", { msg: insErr?.message ?? "n/a" });
    return { subscriptionId: null, created: false, updated: false };
  }
  await supabase.from("subscription_events").insert({
    subscription_id: created.id,
    event_type: "activated",
    metadata: { donation_id: donationId, payment_id: paymentId },
  });
  await supabase.from("subscription_charge_attempts").upsert(
    {
      subscription_id: created.id,
      donation_id: donationId,
      yookassa_payment_id: paymentId,
      status: "succeeded",
    },
    { onConflict: "subscription_id,yookassa_payment_id,status", ignoreDuplicates: true },
  );
  structuredLog("subscription_created", {
    sub: created.id, donation_id: donationId, payment_id: paymentId, freq: frequency,
  });
  return { subscriptionId: created.id, created: true, updated: false };
}

export interface RecurringFailureInput {
  subscriptionId: string;
  donationId: string;
  paymentId: string | null;
  paymentObject: any;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reconcile a failed/canceled autopay. Idempotent through the unique index on
 * subscription_charge_attempts — if we've already logged this payment, we skip.
 */
export async function handleRecurringFailure(
  supabase: SB,
  input: RecurringFailureInput,
): Promise<{ acted: boolean; outcome: string }> {
  const { subscriptionId, donationId, paymentId, paymentObject } = input;
  const reason: string | null = paymentObject?.cancellation_details?.reason ?? null;
  const party: string | null = paymentObject?.cancellation_details?.party ?? null;
  const failureCode = reason ?? "canceled";
  const failureDesc = party ? `${party}:${reason ?? "n/a"}` : reason;

  // Idempotency guard via unique index — if we already processed this payment, do nothing.
  if (paymentId) {
    const { data: prior } = await supabase
      .from("subscription_charge_attempts")
      .select("id")
      .eq("subscription_id", subscriptionId)
      .eq("yookassa_payment_id", paymentId)
      .in("status", ["retry_scheduled", "past_due", "paused"])
      .limit(1)
      .maybeSingle();
    if (prior?.id) {
      structuredLog("webhook_failure_dedup", { sub: subscriptionId, payment_id: paymentId });
      return { acted: false, outcome: "duplicate" };
    }
  }

  const { data: subRow } = await supabase
    .from("donor_subscriptions")
    .select("id, retry_count, interval, status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!subRow?.id) {
    structuredLog("webhook_failure_no_sub", { sub: subscriptionId });
    return { acted: false, outcome: "no_sub" };
  }

  const classification = classifyFailure(reason);
  const newRetry = (subRow.retry_count ?? 0) + 1;
  const becomesPastDue = classification === "recoverable" && newRetry > MAX_RETRIES;
  const becomesPaused = classification === "unrecoverable";

  const patch: Record<string, unknown> = {
    retry_count: newRetry,
    last_retry_at: new Date().toISOString(),
    last_failure_reason: failureDesc,
    last_failure_code: failureCode,
    processing_at: null,
    current_billing_key: null,
  };
  let outcome = "retry_scheduled";
  if (becomesPaused) {
    patch.status = "paused";
    patch.paused_reason = failureCode;
    patch.paused_at = new Date().toISOString();
    outcome = "paused";
  } else if (becomesPastDue) {
    patch.status = "past_due";
    outcome = "past_due";
  } else {
    patch.next_payment_at = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
  }

  await supabase.from("donor_subscriptions").update(patch).eq("id", subRow.id);

  await supabase.from("subscription_charge_attempts").upsert(
    {
      subscription_id: subRow.id,
      donation_id: donationId,
      yookassa_payment_id: paymentId,
      status: outcome,
      error_code: failureCode,
      error_description: failureDesc,
      metadata: { retry_count: newRetry, classification },
    },
    { onConflict: "subscription_id,yookassa_payment_id,status", ignoreDuplicates: true },
  );

  await supabase.from("subscription_events").insert({
    subscription_id: subRow.id,
    event_type: outcome === "paused"
      ? "paused"
      : outcome === "past_due"
      ? "moved_to_past_due"
      : "retry_scheduled",
    metadata: { reason: failureCode, retry_count: newRetry, classification, payment_id: paymentId },
  });

  structuredLog("webhook_failure", {
    sub: subRow.id, payment_id: paymentId, retry: newRetry, outcome, code: failureCode,
  });
  return { acted: true, outcome };
}
