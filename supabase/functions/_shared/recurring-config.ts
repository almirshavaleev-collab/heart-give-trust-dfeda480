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

export function getEffectiveTimings(cfg: RecurringConfig) {
  return {
    execLockTtlMs: cfg.execLockTtlMin * 60_000,
    retryDelayMs: cfg.retryDelayHr * 3_600_000,
    intervalMs: {
      hourly: 3_600_000,
      weekly: 7 * 86_400_000,
      biweekly: 14 * 86_400_000,
      monthly: 30 * 86_400_000, // approximate; production path uses bumpNextPaymentAt's calendar math
    },
  };
}

export function nextRunAtFor(
  interval: "hourly" | "weekly" | "biweekly" | "monthly",
  cfg: RecurringConfig,
  from: Date = new Date(),
): Date {
  const t = getEffectiveTimings(cfg);
  return new Date(from.getTime() + t.intervalMs[interval]);
}

export function retryAfterAt(cfg: RecurringConfig, from: Date = new Date()): Date {
  const t = getEffectiveTimings(cfg);
  return new Date(from.getTime() + t.retryDelayMs);
}

/**
 * Deterministic billing cycle key — used as:
 *   - donations.billing_cycle_key (unique → blocks duplicate charge in same cycle)
 *   - subscription_charge_attempts.billing_cycle_key (unique per sub+cycle for non-error states)
 *   - YooKassa Idempotence-Key
 *
 * Bucket size is configurable; default 1 hour. Tolerates small clock skew.
 *
 * When `interval` is supplied, bucket is clamped to at most `intervalMs / 2` so that
 * consecutive cycles always produce distinct keys (critical for sub-hour test intervals
 * like test_5min / test_20min). Without this clamp, two cycles within the same hour
 * collide on the same key and trigger duplicate_charge_prevented forever.
 */
export function billingCycleKey(
  subscriptionId: string,
  nextPaymentAt: string | null,
  bucketHours = 1,
  interval?: string | null,
): string {
  const ms = nextPaymentAt ? new Date(nextPaymentAt).getTime() : Date.now();
  const baseBucketMs = Math.max(1, bucketHours) * 3600_000;
  const intervalMs = intervalToMs(interval);
  // Clamp to half the cycle length so each cycle gets a unique bucket while still
  // tolerating reasonable clock skew. Never go below 30s to avoid pathological keys.
  const bucketMs = intervalMs
    ? Math.max(30_000, Math.min(baseBucketMs, Math.floor(intervalMs / 2)))
    : baseBucketMs;
  const bucket = Math.floor(ms / bucketMs);
  return `cycle-${subscriptionId}-${bucket}`;
}

function intervalToMs(interval?: string | null): number | null {
  switch (interval) {
    case "hourly": return 3_600_000;
    case "weekly": return 7 * 86_400_000;
    case "biweekly": return 14 * 86_400_000;
    case "monthly": return 30 * 86_400_000;
    default: return null;
  }
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
