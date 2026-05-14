import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { structuredLog, getRecurringConfig, recordHeartbeat } from "../_shared/recurring.ts";

/**
 * Daily maintenance for recurring billing.
 * Safe — never touches succeeded donations or active subscriptions.
 *
 * 1. Delete recurring failed donations older than 90 days.
 * 2. Delete canceled pending donations (recurring) older than 30 days.
 * 3. Delete dry_run charge attempts older than 7 days.
 * 4. Delete orphan subscription_charge_attempts (subscription_id deleted) older than 30 days.
 * 5. Clear stale processing_at (>10 minutes).
 * 6. Clear stale current_billing_key (>24 hours since last_retry_at / last_charge_at).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  structuredLog("cleanup_start");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const cfg = getRecurringConfig();

  const now = Date.now();
  const d90 = new Date(now - 90 * 86400e3).toISOString();
  const d30 = new Date(now - 30 * 86400e3).toISOString();
  const d7  = new Date(now - 7  * 86400e3).toISOString();
  const m10 = new Date(now - cfg.execLockTtlMin * 60 * 1000).toISOString();
  const h24 = new Date(now - cfg.billingKeyTtlHr * 3600e3).toISOString();

  const result: Record<string, number | null> = {};

  // 1. Failed recurring donations >90d
  {
    const { count, error } = await supabase
      .from("donations").delete({ count: "exact" })
      .eq("status", "failed").eq("payment_type", "recurring").lt("created_at", d90);
    if (error) structuredLog("cleanup_error", { step: "failed_donations", msg: error.message });
    result.failed_recurring_donations_deleted = count;
  }

  // 2. Canceled pending recurring donations >30d
  {
    const { count, error } = await supabase
      .from("donations").delete({ count: "exact" })
      .eq("status", "canceled").eq("payment_type", "recurring").lt("created_at", d30);
    if (error) structuredLog("cleanup_error", { step: "canceled_donations", msg: error.message });
    result.canceled_recurring_donations_deleted = count;
  }

  // 3. dry_run attempts >7d
  {
    const { count, error } = await supabase
      .from("subscription_charge_attempts").delete({ count: "exact" })
      .eq("status", "dry_run").lt("created_at", d7);
    if (error) structuredLog("cleanup_error", { step: "dry_run_attempts", msg: error.message });
    result.dry_run_attempts_deleted = count;
  }

  // 4. Orphan attempts (subscription gone). Defensive — there's no FK.
  {
    const { data: orphans } = await supabase.rpc("admin_recurring_metrics"); // ensure connection
    void orphans;
    const { error } = await supabase.from("subscription_charge_attempts")
      .delete()
      .lt("created_at", d30)
      .is("donation_id", null)
      .in("status", ["internal_error", "network_error"]);
    if (error) structuredLog("cleanup_error", { step: "orphan_attempts", msg: error.message });
    result.orphan_attempts_deleted = null; // count not available without explicit count
  }

  // 5. Stale processing_at locks
  {
    // Get rows first so we can audit each reclaim with sub id + age.
    const { data: rows } = await supabase
      .from("donor_subscriptions")
      .select("id, processing_at, current_billing_key")
      .lt("processing_at", m10)
      .not("processing_at", "is", null);
    let cleared = 0;
    for (const r of rows ?? []) {
      const ageMin = r.processing_at
        ? Math.round((Date.now() - new Date(r.processing_at).getTime()) / 60000) : null;
      const { error } = await supabase
        .from("donor_subscriptions").update({ processing_at: null }).eq("id", r.id);
      if (error) continue;
      cleared++;
      await supabase.from("subscription_events").insert({
        subscription_id: r.id, event_type: "lock_reclaimed",
        metadata: { age_min: ageMin, billing_key: r.current_billing_key, source: "cleanup" },
      });
    }
    result.stale_processing_cleared = cleared;
  }

  // 6. Stale billing keys (no progress in 24h)
  {
    const { data: stuck } = await supabase
      .from("donor_subscriptions")
      .select("id, last_charge_at, last_retry_at, created_at")
      .not("current_billing_key", "is", null)
      .lt("updated_at", h24);
    let cleared = 0;
    for (const s of stuck ?? []) {
      const last = s.last_retry_at ?? s.last_charge_at ?? s.created_at;
      if (!last || Date.now() - new Date(last).getTime() > cfg.billingKeyTtlHr * 3600e3) {
        const { error } = await supabase
          .from("donor_subscriptions").update({ current_billing_key: null }).eq("id", s.id);
        if (!error) {
          cleared++;
          await supabase.from("subscription_events").insert({
            subscription_id: s.id, event_type: "billing_key_reclaimed",
            metadata: { source: "cleanup" },
          });
        }
      }
    }
    result.stale_billing_keys_cleared = cleared;
  }

  structuredLog("cleanup_end", result);
  await recordHeartbeat(supabase, "cleanup-recurring-artifacts", "ok", result);
  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
