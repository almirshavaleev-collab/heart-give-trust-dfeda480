import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { structuredLog, getRecurringConfig } from "../_shared/recurring.ts";

/**
 * Admin-only operational readiness probe.
 * Wraps the admin_recurring_readiness RPC and adds feature-flag snapshot.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: who } = await userClient.auth.getUser();
  if (!who?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: who.user.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await userClient.rpc("admin_recurring_readiness");
  if (error) {
    structuredLog("readiness_error", { msg: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cfg = getRecurringConfig();
  return new Response(
    JSON.stringify({
      ...(data as object),
      flags: {
        enabled: cfg.enabled, dry_run: cfg.dryRun,
        realtime_donor: cfg.realtimeDonor,
        realtime_admin_detail: cfg.realtimeAdminDetail,
        realtime_admin_overview: cfg.realtimeAdminOverview,
        exec_lock_ttl_min: cfg.execLockTtlMin,
        billing_key_ttl_hr: cfg.billingKeyTtlHr,
        max_retries: cfg.maxRetries,
        cycle_bucket_hours: cfg.cycleBucketHours,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
