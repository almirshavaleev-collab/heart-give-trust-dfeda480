// Recurring sandbox / simulation helpers.
// All entry points here MUST be admin-gated by the caller and require cfg.testMode=true.
// They never call the real YooKassa API and never increment campaign collected amounts.

import {
  getEffectiveTimings,
  nextRunAtFor,
  retryAfterAt,
  type RecurringConfig,
} from "./recurring-config.ts";
import { structuredLog, type Frequency } from "./recurring.ts";

// deno-lint-ignore no-explicit-any
type SB = any;

export type SimulationKind =
  | "success"
  | "failure"
  | "fail"
  | "cancel"
  | "timeout"
  | "network_error"
  | "expired_card"
  | "duplicate_webhook"
  | "reconcile_delay"
  | "stale_lock"
  | "webhook_replay";

export interface SimSubscription {
  id: string;
  user_id: string | null;
  campaign_id: string | null;
  amount: number;
  currency: string;
  interval: Frequency;
  retry_count: number;
  status: string;
  payment_method_type: string | null;
  is_test?: boolean;
}

export const SANDBOX_META = { is_test: true, simulated: true, sandbox_version: 1 } as const;

function testLog(ns: "test" | "simulate" | "dry_run", phase: string, ctx: Record<string, unknown> = {}) {
  structuredLog(`${ns}_${phase}`, ctx);
}

/**
 * Shadow-mode end-to-end cycle. Creates a synthetic donation + attempt + event,
 * advances next_payment_at, never calls YooKassa, never bumps campaign collected.
 */
export async function simulateChargeCycle(
  supabase: SB,
  sub: SimSubscription,
  cfg: RecurringConfig,
): Promise<{ outcome: "succeeded" | "failed"; donationId: string | null }> {
  // Decide outcome
  let outcome: "succeeded" | "failed";
  if (cfg.forceSuccess) outcome = "succeeded";
  else if (cfg.forceFailure) outcome = "failed";
  else outcome = Math.random() < 0.9 ? "succeeded" : "failed";

  testLog("dry_run", "cycle_start", { sub: sub.id, outcome, force_success: cfg.forceSuccess, force_failure: cfg.forceFailure });

  // 1. Synthetic donation (NOT linked to campaign increment).
  const { data: donation, error: dErr } = await supabase
    .from("donations")
    .insert({
      amount: sub.amount,
      currency: sub.currency,
      campaign_id: sub.campaign_id,
      user_id: sub.user_id,
      payment_type: "recurring",
      is_recurring: true,
      is_anonymous: false,
      payment_method_type: sub.payment_method_type,
      status: outcome === "succeeded" ? "succeeded" : "failed",
      paid_at: outcome === "succeeded" ? new Date().toISOString() : null,
      is_test: true,
      payment_provider: "sandbox",
    })
    .select("id")
    .single();
  if (dErr) {
    testLog("dry_run", "donation_insert_error", { sub: sub.id, msg: dErr.message });
    return { outcome, donationId: null };
  }

  // 2. Attempt log
  await supabase.from("subscription_charge_attempts").insert({
    subscription_id: sub.id,
    donation_id: donation.id,
    status: outcome === "succeeded" ? "test_succeeded" : "test_failed",
    error_code: outcome === "failed" ? "test_simulated_failure" : null,
    error_description: outcome === "failed" ? "Simulated failure (shadow mode)" : null,
    is_test: true,
    metadata: { ...SANDBOX_META, shadow: true, force_success: cfg.forceSuccess, force_failure: cfg.forceFailure },
  });

  // 3. Event
  await supabase.from("subscription_events").insert({
    subscription_id: sub.id,
    event_type: "test_payment_simulated",
    metadata: { ...SANDBOX_META, donation_id: donation.id, outcome },
  });

  // 4. Advance subscription state — DO NOT touch campaign collected.
  const nowIso = new Date().toISOString();
  if (outcome === "succeeded") {
    await supabase.from("donor_subscriptions").update({
      last_charge_at: nowIso,
      next_payment_at: nextRunAtFor(sub.interval, cfg).toISOString(),
      retry_count: 0,
      processing_at: null,
      current_billing_key: null,
      last_failure_reason: null,
      last_failure_code: null,
    }).eq("id", sub.id);
  } else {
    await supabase.from("donor_subscriptions").update({
      retry_count: sub.retry_count + 1,
      last_retry_at: nowIso,
      next_payment_at: retryAfterAt(cfg).toISOString(),
      processing_at: null,
      current_billing_key: null,
      last_failure_reason: "test_simulated_failure",
      last_failure_code: "test_simulated_failure",
    }).eq("id", sub.id);
  }

  testLog("dry_run", "cycle_end", { sub: sub.id, outcome, donation_id: donation.id });
  return { outcome, donationId: donation.id };
}

/** Single deterministic simulation action (admin manual). */
export async function simulateAction(
  supabase: SB,
  kind: SimulationKind,
  sub: SimSubscription,
  cfg: RecurringConfig,
  opts: { dryRun?: boolean } = {},
): Promise<Record<string, unknown>> {
  if (!cfg.testMode) throw new Error("testMode disabled");

  const evtMeta: Record<string, unknown> = { kind, simulated: true, actor: "admin" };
  testLog("simulate", kind, { sub: sub.id });

  switch (kind) {
    case "success": {
      await insertSimEvent(supabase, sub.id, "charge_started" as SimulationKind, { ...evtMeta, phase: "start" });
      const r = await simulateChargeCycle(supabase, sub, { ...cfg, forceSuccess: true, forceFailure: false });
      await insertSimEvent(supabase, sub.id, "charge_succeeded" as SimulationKind, { ...evtMeta, donation_id: r.donationId });
      await insertSimEvent(supabase, sub.id, "next_cycle_scheduled" as SimulationKind, { ...evtMeta });
      await insertSimEvent(supabase, sub.id, kind, { ...evtMeta, donation_id: r.donationId });
      return { ok: true, ...r };
    }
    case "fail":
    case "failure": {
      await insertSimEvent(supabase, sub.id, "charge_started" as SimulationKind, { ...evtMeta, phase: "start" });
      const r = await simulateChargeCycle(supabase, sub, { ...cfg, forceSuccess: false, forceFailure: true });
      await supabase.from("donor_subscriptions").update({
        status: "past_due",
        last_failure_reason: "insufficient_funds",
        last_failure_code: "insufficient_funds",
      }).eq("id", sub.id);
      await insertSimEvent(supabase, sub.id, "charge_failed" as SimulationKind, { ...evtMeta, reason: "insufficient_funds", donation_id: r.donationId });
      await insertSimEvent(supabase, sub.id, "retry_scheduled" as SimulationKind, { ...evtMeta });
      await insertSimEvent(supabase, sub.id, kind, { ...evtMeta, donation_id: r.donationId });
      return { ok: true, ...r };
    }
    case "cancel": {
      await supabase.from("donor_subscriptions").update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        next_payment_at: null,
        processing_at: null,
        current_billing_key: null,
      }).eq("id", sub.id);
      await insertSimEvent(supabase, sub.id, "subscription_canceled" as SimulationKind, evtMeta);
      await insertSimEvent(supabase, sub.id, kind, evtMeta);
      return { ok: true };
    }
    case "timeout": {
      await insertSimEvent(supabase, sub.id, "charge_started" as SimulationKind, { ...evtMeta, phase: "start" });
      // Just log + simulate retry scheduling. Sleep is bounded.
      await new Promise((r) => setTimeout(r, Math.min(2000, cfg.simulateTimeoutMs)));
      // Pending attempt — webhook never arrived
      await supabase.from("subscription_charge_attempts").insert({
        subscription_id: sub.id, status: "pending",
        error_code: "simulated_timeout", error_description: "Simulated timeout (no webhook)",
        is_test: true,
        metadata: { ...SANDBOX_META, kind, provider_status: "timeout" },
      });
      await insertSimEvent(supabase, sub.id, "charge_timeout" as SimulationKind, { ...evtMeta, provider_status: "timeout" });
      await insertSimEvent(supabase, sub.id, kind, evtMeta);
      return { ok: true };
    }
    case "network_error": {
      await supabase.from("subscription_charge_attempts").insert({
        subscription_id: sub.id, status: "test_failed",
        error_code: "simulated_network_error", error_description: "Simulated network error",
        is_test: true,
        metadata: { ...SANDBOX_META, kind },
      });
      await insertSimEvent(supabase, sub.id, kind, evtMeta);
      return { ok: true };
    }
    case "expired_card": {
      await supabase.from("donor_subscriptions").update({
        status: "paused",
        paused_at: new Date().toISOString(),
        paused_reason: "expired_card",
        last_failure_code: "expired_card",
        processing_at: null, current_billing_key: null,
      }).eq("id", sub.id);
      await insertSimEvent(supabase, sub.id, kind, evtMeta);
      return { ok: true };
    }
    case "duplicate_webhook": {
      // Idempotency probe: insert twice with same yk_payment_id, second one MUST be deduped by unique idx.
      const fakePid = `sim_dup_${Date.now()}`;
      const a1 = await supabase.from("subscription_charge_attempts").insert({
        subscription_id: sub.id, status: "test_succeeded",
        yookassa_payment_id: fakePid,
        is_test: true,
        metadata: { ...SANDBOX_META, kind, attempt: 1 },
      }).select("id");
      const a2 = await supabase.from("subscription_charge_attempts").insert({
        subscription_id: sub.id, status: "test_succeeded",
        yookassa_payment_id: fakePid,
        is_test: true,
        metadata: { ...SANDBOX_META, kind, attempt: 2 },
      });
      const dedup = !!a2.error;
      structuredLog("dedupe_test", { sub: sub.id, prevented: dedup, msg: a2.error?.message });
      await insertSimEvent(supabase, sub.id, kind, { ...evtMeta, dedupe_prevented: dedup, payment_id: fakePid });
      return { ok: true, dedupe_prevented: dedup, attempt_id: a1.data?.[0]?.id ?? null };
    }
    case "reconcile_delay": {
      // Create an old-looking pending donation so reconcile picks it up.
      const fakePid = `sim_reconcile_${Date.now()}`;
      const fifteenMinAgo = new Date(Date.now() - 16 * 60_000).toISOString();
      const { data, error } = await supabase.from("donations").insert({
        amount: sub.amount, currency: sub.currency,
        campaign_id: sub.campaign_id, user_id: sub.user_id,
        payment_type: "recurring", is_recurring: true, is_anonymous: false,
        status: "pending", yookassa_payment_id: fakePid, created_at: fifteenMinAgo,
        is_test: true, payment_provider: "sandbox",
      }).select("id").single();
      await insertSimEvent(supabase, sub.id, kind, { ...evtMeta, donation_id: data?.id, payment_id: fakePid });
      return { ok: !error, donation_id: data?.id ?? null, error: error?.message };
    }
    case "stale_lock": {
      const t = getEffectiveTimings(cfg);
      const stale = new Date(Date.now() - (t.execLockTtlMs + 60_000)).toISOString();
      await supabase.from("donor_subscriptions").update({
        processing_at: stale,
        current_billing_key: `sim_stale_${sub.id}_${Date.now()}`,
      }).eq("id", sub.id);
      await insertSimEvent(supabase, sub.id, kind, { ...evtMeta, stale_at: stale });
      return { ok: true, stale_at: stale };
    }
    case "webhook_replay": {
      // Sandbox-only safety guard.
      if (!sub.is_test) {
        return { ok: false, error: "sandbox_only" };
      }
      // Idempotency probe: emit a timeline event ONLY.
      // No new donation, no new attempt, no campaign mutation, no email,
      // no retry_count / next_payment_at change.
      const { data: lastAttempt } = await supabase
        .from("subscription_charge_attempts")
        .select("id, donation_id, yookassa_payment_id, created_at, status")
        .eq("subscription_id", sub.id)
        .in("status", ["succeeded", "test_succeeded"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (opts.dryRun) {
        return {
          ok: true,
          dry_run: true,
          would_replay_attempt_id: lastAttempt?.id ?? null,
          would_replay_donation_id: lastAttempt?.donation_id ?? null,
          idempotent: true,
        };
      }
      const meta = {
        ...SANDBOX_META,
        kind,
        idempotent: true,
        replay_mode: "sandbox" as const,
        replayed_attempt_id: lastAttempt?.id ?? null,
        replayed_donation_id: lastAttempt?.donation_id ?? null,
        replayed_payment_id: lastAttempt?.yookassa_payment_id ?? null,
      };
      await supabase.from("subscription_events").insert({
        subscription_id: sub.id,
        event_type: "charge_webhook_replayed",
        metadata: meta,
      });
      return { ok: true, replayed_attempt_id: lastAttempt?.id ?? null, replayed_donation_id: lastAttempt?.donation_id ?? null, idempotent: true };
    }
  }
}

async function insertSimEvent(supabase: SB, subId: string, kind: SimulationKind, meta: Record<string, unknown>) {
  await supabase.from("subscription_events").insert({
    subscription_id: subId,
    event_type: `simulate_${kind}`,
    metadata: meta,
  });
}

/** Build a minimal YK-shaped webhook payload from a previous attempt for replay-tests. */
export function buildReplayWebhookPayload(
  paymentId: string,
  subscriptionId: string,
  amount: number,
  status: "succeeded" | "canceled" = "succeeded",
) {
  return {
    event: status === "succeeded" ? "payment.succeeded" : "payment.canceled",
    type: "notification",
    object: {
      id: paymentId,
      status,
      amount: { value: Number(amount).toFixed(2), currency: "RUB" },
      metadata: {
        subscription_id: subscriptionId,
        payment_type: "recurring",
        type: "recurring",
        replayed: "true",
      },
      payment_method: { id: `pm_replay_${subscriptionId}`, type: "bank_card", saved: true },
    },
  };
}
