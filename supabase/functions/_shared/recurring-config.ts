// Centralized recurring config / feature flags. Single source of truth.
// Read-once per invocation; safe to call from any edge function.

function envStr(name: string, dflt = ""): string {
  return (Deno.env.get(name) ?? dflt).trim();
}
function envBool(name: string, dflt: boolean): boolean {
  const v = envStr(name).toLowerCase();
  if (v === "") return dflt;
  return v === "true" || v === "1" || v === "yes";
}
function envInt(name: string, dflt: number): number {
  const v = envStr(name);
  if (!v) return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export interface RecurringConfig {
  enabled: boolean;
  dryRun: boolean;
  realtimeDonor: boolean;
  realtimeAdminDetail: boolean;
  realtimeAdminOverview: boolean;
  execLockTtlMin: number;
  billingKeyTtlHr: number;
  maxRetries: number;
  retryDelayHr: number;
  notifyThrottleHr: number;
  cycleBucketHours: number;
}

export function getRecurringConfig(): RecurringConfig {
  return {
    enabled: envBool("RECURRING_ENABLED", true),
    dryRun: envBool("RECURRING_DRY_RUN", false),
    realtimeDonor: envBool("RECURRING_REALTIME_DONOR", false),
    realtimeAdminDetail: envBool("RECURRING_REALTIME_ADMIN_DETAIL", false),
    realtimeAdminOverview: envBool("RECURRING_REALTIME_ADMIN_OVERVIEW", false),
    execLockTtlMin: envInt("RECURRING_EXEC_LOCK_TTL_MIN", 10),
    billingKeyTtlHr: envInt("RECURRING_BILLING_KEY_TTL_HR", 24),
    maxRetries: envInt("RECURRING_MAX_RETRIES", 2),
    retryDelayHr: envInt("RECURRING_RETRY_DELAY_HR", 24),
    notifyThrottleHr: envInt("RECURRING_NOTIFY_THROTTLE_HR", 24),
    cycleBucketHours: envInt("RECURRING_CYCLE_BUCKET_HOURS", 1),
  };
}

/**
 * Deterministic billing cycle key — used as:
 *   - donations.billing_cycle_key (unique → blocks duplicate charge in same cycle)
 *   - subscription_charge_attempts.billing_cycle_key (unique per sub+cycle for non-error states)
 *   - YooKassa Idempotence-Key
 *
 * Bucket size is configurable; default 1 hour. Tolerates small clock skew.
 */
export function billingCycleKey(
  subscriptionId: string,
  nextPaymentAt: string | null,
  bucketHours = 1,
): string {
  const ms = nextPaymentAt ? new Date(nextPaymentAt).getTime() : Date.now();
  const bucketMs = Math.max(1, bucketHours) * 3600_000;
  const bucket = Math.floor(ms / bucketMs);
  return `cycle-${subscriptionId}-${bucket}`;
}

/** Append heartbeat for cron monitoring. Best-effort. */
// deno-lint-ignore no-explicit-any
export async function recordHeartbeat(supabase: any, job: string, status: string, payload?: unknown) {
  try {
    await supabase.from("recurring_cron_heartbeats").upsert(
      { job, last_run_at: new Date().toISOString(), last_status: status, last_payload: payload ?? null },
      { onConflict: "job" },
    );
  } catch (_e) { /* swallow */ }
}
