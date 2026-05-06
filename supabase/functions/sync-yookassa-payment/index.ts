import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

type DonationRow = {
  id: string;
  amount: number | string;
  status: string;
  campaign_id: string | null;
  user_id: string | null;
  yookassa_payment_id: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function verifyPayment(paymentId: string) {
  const creds = [
    {
      label: "production",
      shopId: Deno.env.get("YOOKASSA_PROD_SHOP_ID"),
      secret: Deno.env.get("YOOKASSA_PROD_SECRET_KEY"),
    },
    {
      label: "test",
      shopId: Deno.env.get("YOOKASSA_SHOP_ID"),
      secret: Deno.env.get("YOOKASSA_SECRET_KEY"),
    },
  ];

  for (const c of creds) {
    if (!c.shopId || !c.secret) continue;
    const auth = btoa(`${c.shopId}:${c.secret}`);
    const resp = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const data = await resp.json().catch(() => ({}));
    console.log(
      `[sync-yookassa-payment] verify ${c.label} payment_id=${paymentId} http=${resp.status} status=${data?.status ?? "n/a"} test=${data?.test ?? "n/a"}`,
    );
    if (resp.ok) return { label: c.label, data };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const donationId: string | null = body?.donation_id ?? null;
    const paymentId: string | null = body?.payment_id ?? null;
    const scope: "single" | "recent_pending" = body?.scope === "recent_pending" ? "recent_pending" : "single";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (scope === "recent_pending") {
      const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
      const userId = claimsRes?.claims?.sub as string | undefined;
      if (claimsErr || !userId) return json({ error: "Unauthorized" }, 401);

      const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);
    }

    let donations: DonationRow[] = [];
    if (scope === "recent_pending") {
      const limit = Math.min(Math.max(Number(body?.limit ?? 20), 1), 50);
      const { data, error } = await supabase
        .from("donations")
        .select("id, amount, status, campaign_id, user_id, yookassa_payment_id")
        .eq("status", "pending")
        .not("yookassa_payment_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      donations = data ?? [];
    } else {
      if (!donationId && !paymentId) return json({ error: "Не указан платеж" }, 400);
      let q = supabase
        .from("donations")
        .select("id, amount, status, campaign_id, user_id, yookassa_payment_id")
        .limit(1);
      q = donationId ? q.eq("id", donationId) : q.eq("yookassa_payment_id", paymentId!);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (data) donations = [data];
    }

    const results = [];
    for (const donation of donations) {
      const ykPaymentId = donation.yookassa_payment_id ?? paymentId;
      if (!ykPaymentId) {
        results.push({ donation_id: donation.id, result: "missing_payment_id" });
        continue;
      }

      const verified = await verifyPayment(ykPaymentId);
      if (!verified?.data) {
        results.push({ donation_id: donation.id, payment_id: ykPaymentId, result: "verification_failed" });
        continue;
      }

      const payment = verified.data;
      if (payment.status === "succeeded" && payment.paid === true) {
        const { data: updatedRows, error: updErr } = await supabase
          .from("donations")
          .update({
            status: "succeeded",
            paid_at: payment.captured_at ?? new Date().toISOString(),
            yookassa_payment_id: ykPaymentId,
            payment_method_type: payment?.payment_method?.type ?? null,
          })
          .eq("id", donation.id)
          .neq("status", "succeeded")
          .select("id");
        if (updErr) throw updErr;

        const wasUpdated = (updatedRows?.length ?? 0) > 0;
        let logResult = wasUpdated ? "accepted" : "already_processed";
        if (wasUpdated && donation.campaign_id) {
          const { error: rpcErr } = await supabase.rpc("increment_campaign_collected", {
            _campaign_id: donation.campaign_id,
            _amount: Number(donation.amount),
          });
          if (rpcErr) {
            console.error("increment_campaign_collected error:", rpcErr);
            logResult = "accepted_campaign_increment_failed";
          } else {
            logResult = "accepted_with_campaign";
          }
        }

        await supabase.from("webhook_logs").insert({
          provider: "yookassa",
          event: "runtime.payment_sync",
          payload: { source: "sync-yookassa-payment", payment, verified_with: verified.label },
          source_ip: "runtime-sync",
          object_id: ykPaymentId,
          object_status: payment.status,
          donation_id: donation.id,
          result: logResult,
        });

        if (wasUpdated && donation.user_id) {
          const { error: achErr } = await supabase.rpc("evaluate_user_achievements", {
            _user_id: donation.user_id,
          });
          if (achErr) console.error("evaluate_user_achievements error:", achErr);
        }

        results.push({ donation_id: donation.id, payment_id: ykPaymentId, status: "succeeded", result: logResult });
      } else if (payment.status === "canceled") {
        await supabase.from("donations").update({ status: "canceled" }).eq("id", donation.id).neq("status", "succeeded");
        results.push({ donation_id: donation.id, payment_id: ykPaymentId, status: "canceled", result: "accepted" });
      } else {
        results.push({ donation_id: donation.id, payment_id: ykPaymentId, status: payment.status, result: "pending" });
      }
    }

    console.log(`[sync-yookassa-payment] scope=${scope} checked=${donations.length} updated=${results.filter((r) => r.status === "succeeded").length}`);
    return json({ ok: true, checked: donations.length, results });
  } catch (e) {
    console.error("sync-yookassa-payment exception:", e);
    return json({ error: (e as Error).message }, 500);
  }
});