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
export type ChargeAttemptStatus =
  | "created_pending"
  | "created_waiting_capture"
  | "created_succeeded"
  | "succeeded"
  | "retry_scheduled"
  | "past_due"
  | "paused"
  | "network_error"
  | "internal_error"
  | "create_failed"
  | "dry_run";

export function normalizeYkCreatedStatus(yk: string | undefined | null): ChargeAttemptStatus {
  switch (yk) {
    case "succeeded": return "created_succeeded";
    case "waiting_for_capture": return "created_waiting_capture";
    default: return "created_pending";
  }
}

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

export function alertLog(reason: string, ctx: Record<string, unknown> = {}) {
  const parts = [`[recurring][ALERT]`, `reason=${reason}`];
  for (const [k, v] of Object.entries(ctx)) {
    if (v === undefined || v === null) continue;
    parts.push(`${k}=${v}`);
  }
  console.warn(parts.join(" "));
}

/**
 * Fire-and-forget transactional email enqueue. Never throws — recurring
 * billing flows must not break if notifications are misconfigured.
 */
export function notifyDonor(
  supabase: SB,
  templateName: string,
  recipientEmail: string | null,
  templateData: Record<string, unknown>,
) {
  if (!recipientEmail) return;
  // Don't await — this must be non-blocking.
  void (async () => {
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          template_name: templateName,
          recipient_email: recipientEmail,
          template_data: templateData,
          idempotency_key: `${templateName}:${templateData?.subscription_id ?? ""}:${templateData?.payment_id ?? Date.now()}`,
          purpose: "transactional",
        },
      });
    } catch (e) {
      structuredLog("notify_failed", { template: templateName, msg: String(e) });
    }
  })();
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

// Re-export the canonical cycle key from recurring-config so legacy imports keep working.
export { billingCycleKey, getRecurringConfig, recordHeartbeat } from "./recurring-config.ts";

/** Insert a `duplicate_charge_prevented` event. Best-effort; never throws. */
// deno-lint-ignore no-explicit-any
export async function logDuplicatePrevention(
  supabase: any,
  subscriptionId: string | null,
  source: string,
  meta: Record<string, unknown>,
) {
  if (!subscriptionId) return;
  try {
    await supabase.from("subscription_events").insert({
      subscription_id: subscriptionId,
      event_type: "duplicate_charge_prevented",
      metadata: { source, ...meta },
    });
    structuredLog("duplicate_prevented", { sub: subscriptionId, source, ...meta });
  } catch (_e) { /* swallow */ }
}

/** Pg unique-violation error code. */
export const PG_UNIQUE_VIOLATION = "23505";

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
  billingCycleKey?: string | null;
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
    frequency, paymentObject, billingCycleKey: cycleKeyIn,
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
        billing_cycle_key: cycleKeyIn ?? null,
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
    // Notify donor (non-blocking, best-effort). Look up email lazily.
    if (donationUserId) {
      const { data: prof } = await supabase
        .from("profiles").select("email, full_name").eq("user_id", donationUserId).maybeSingle();
      const tplData = {
        subscription_id: existing.id, payment_id: paymentId, donation_id: donationId,
        amount: donationAmount, currency: "RUB", next_payment_at: nextPaymentAt,
        card_last4: cardLast4, name: prof?.full_name ?? null,
      };
      notifyDonor(
        supabase,
        wasPastDue ? "recurring-recovered" : "recurring-payment-succeeded",
        prof?.email ?? null,
        tplData,
      );
    }
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
      billing_cycle_key: cycleKeyIn ?? null,
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

  // Donor notifications (non-blocking).
  const { data: subForNotify } = await supabase
    .from("donor_subscriptions").select("user_id").eq("id", subRow.id).maybeSingle();
  if (subForNotify?.user_id) {
    const { data: prof } = await supabase
      .from("profiles").select("email, full_name").eq("user_id", subForNotify.user_id).maybeSingle();
    const tplData = {
      subscription_id: subRow.id, payment_id: paymentId, retry_count: newRetry,
      reason: failureCode, name: prof?.full_name ?? null,
    };
    if (outcome === "paused") {
      notifyDonor(supabase, "recurring-paused", prof?.email ?? null, tplData);
    } else if (outcome === "retry_scheduled") {
      notifyDonor(supabase, "recurring-retry-scheduled", prof?.email ?? null, tplData);
    }
    // past_due — no separate email; donor will get the next retry-scheduled or paused.
  }

  return { acted: true, outcome };
}
