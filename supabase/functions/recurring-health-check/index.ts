import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { alertLog, structuredLog, recordHeartbeat } from "../_shared/recurring.ts";

/**
 * Read-only health probe for the recurring billing pipeline.
 * Returns a snapshot suitable for dashboards or external monitoring.
 *
 * Thresholds (raise [recurring][ALERT] when crossed):
 *   - failure_rate_24h > 15%
 *   - pending_old_recurring > 50
 *   - stale_billing_keys > 10
 *   - stale_processing_locks > 10
 *   - reconcile_backlog (pending recurring >15min) > 25
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  structuredLog("health_check_start");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const m10 = new Date(now - 10 * 60_000).toISOString();
  const m15 = new Date(now - 15 * 60_000).toISOString();
  const h24 = new Date(now - 24 * 3_600_000).toISOString();

  async function count(table: string, build: (q: any) => any): Promise<number> {
    const q = build(supabase.from(table).select("id", { count: "exact", head: true }));
    const { count: c, error } = await q;
    if (error) {
      structuredLog("health_query_error", { table, msg: error.message });
      return -1;
    }
    return c ?? 0;
  }

  const [
    pending_old_recurring,
    stale_processing_locks,
    stale_billing_keys,
    attempts_24h,
    failed_24h,
    active_subs,
    past_due_subs,
    paused_subs,
  ] = await Promise.all([
    count("donations", (q) => q.eq("status", "pending").eq("payment_type", "recurring").lt("created_at", m15)),
    count("donor_subscriptions", (q) => q.lt("processing_at", m10).not("processing_at", "is", null)),
    count("donor_subscriptions", (q) => q.lt("updated_at", h24).not("current_billing_key", "is", null)),
    count("subscription_charge_attempts", (q) => q.gt("created_at", h24)),
    count("subscription_charge_attempts", (q) =>
      q.gt("created_at", h24).in("status", ["create_failed","network_error","retry_scheduled","past_due","paused"])),
    count("donor_subscriptions", (q) => q.eq("status", "active")),
    count("donor_subscriptions", (q) => q.eq("status", "past_due")),
    count("donor_subscriptions", (q) => q.eq("status", "paused")),
  ]);

  const failure_rate_24h = attempts_24h > 0
    ? Math.round((failed_24h / attempts_24h) * 1000) / 10
    : 0;

  const alerts: string[] = [];
  if (failure_rate_24h > 15) { alertLog("high_failure_rate", { rate: failure_rate_24h }); alerts.push("high_failure_rate"); }
  if (pending_old_recurring > 50) { alertLog("pending_backlog", { n: pending_old_recurring }); alerts.push("pending_backlog"); }
  if (pending_old_recurring > 25) alerts.push("reconcile_backlog");
  if (stale_billing_keys > 10) { alertLog("stale_billing_keys", { n: stale_billing_keys }); alerts.push("stale_billing_keys"); }
  if (stale_processing_locks > 10) { alertLog("stale_processing_locks", { n: stale_processing_locks }); alerts.push("stale_processing_locks"); }

  const healthy = alerts.length === 0;
  const summary = {
    healthy,
    alerts,
    failure_rate_24h,
    attempts_24h, failed_24h,
    pending_old_recurring,
    stale_billing_keys, stale_processing_locks,
    active_subs, past_due_subs, paused_subs,
    generated_at: new Date().toISOString(),
  };

  structuredLog("health_check_end", { healthy, alerts: alerts.join(",") || "none" });
  await recordHeartbeat(supabase, "recurring-health-check", healthy ? "healthy" : "degraded", summary);
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
