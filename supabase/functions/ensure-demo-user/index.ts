import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_EMAIL = "test@ligafund.ru";
const DEMO_PASSWORD = "test123";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Look up existing user
    let userId: string | null = null;
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === DEMO_EMAIL);
    if (existing) {
      userId = existing.id;
      // Ensure password and metadata are correct (idempotent)
      await admin.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), full_name: "Тестовый пользователь", demo_account: true },
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Тестовый пользователь", demo_account: true },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // 2. Upsert profile
    await admin.from("profiles").upsert({
      user_id: userId,
      email: DEMO_EMAIL,
      full_name: "Тестовый пользователь",
      display_name: "Тестовый пользователь",
      public_display_name: "Анна Т.",
      phone: "+7 999 000-00-00",
      is_public_donor: true,
      wants_notifications: true,
      is_demo: true,
    }, { onConflict: "user_id" });

    // 3. Seed donations (only if none yet)
    const { count: donationsCount } = await admin
      .from("donations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((donationsCount ?? 0) === 0) {
      // Try to attach to a real campaign if any exist
      const { data: camp } = await admin
        .from("campaigns")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      const campaignId = camp?.id ?? null;
      const now = Date.now();
      const day = 86400000;
      const rows = [
        { amount: 1000, days: 90 },
        { amount: 500, days: 60 },
        { amount: 2500, days: 30 },
        { amount: 1500, days: 14 },
        { amount: 500, days: 3 },
      ].map((r) => ({
        user_id: userId,
        amount: r.amount,
        status: "succeeded",
        currency: "RUB",
        payment_provider: "yookassa",
        payment_type: "one_time",
        is_anonymous: false,
        is_recurring: false,
        payment_method_type: "bank_card",
        donor_email: DEMO_EMAIL,
        donor_name: "Тестовый пользователь",
        campaign_id: campaignId,
        created_at: new Date(now - r.days * day).toISOString(),
        paid_at: new Date(now - r.days * day + 60000).toISOString(),
      }));
      await admin.from("donations").insert(rows);
    }

    // 4. Seed active subscription (only if none)
    const { count: subsCount } = await admin
      .from("donor_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((subsCount ?? 0) === 0) {
      const nextPayment = new Date(Date.now() + 7 * 86400000).toISOString();
      await admin.from("donor_subscriptions").insert({
        user_id: userId,
        amount: 500,
        currency: "RUB",
        interval: "monthly",
        status: "active",
        payment_method_id: "demo-pm-card",
        payment_method_type: "bank_card",
        card_last4: "4242",
        card_type: "Visa",
        card_expiry: "12/29",
        next_payment_at: nextPayment,
        last_charge_at: new Date(Date.now() - 23 * 86400000).toISOString(),
        is_test: true,
      });
    }

    // 5. Evaluate achievements via existing function
    await admin.rpc("evaluate_user_achievements", { _user_id: userId });

    return new Response(
      JSON.stringify({ ok: true, email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ensure-demo-user]", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});