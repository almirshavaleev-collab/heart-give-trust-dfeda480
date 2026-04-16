import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Webhook от ЮKassa. Должен ВСЕГДА возвращать 200, иначе ЮKassa будет ретраить.
// URL для настройки в личном кабинете ЮKassa:
//   https://<project>.supabase.co/functions/v1/yookassa-webhook
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (e) {
    console.error("Invalid JSON from YooKassa:", e);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event: string | undefined = payload?.event;
  const object: any = payload?.object ?? {};

  // 1. Логируем все входящие webhook'и
  try {
    await supabase.from("webhook_logs").insert({
      provider: "yookassa",
      event: event ?? null,
      payload,
    });
  } catch (e) {
    console.error("webhook_logs insert error:", e);
  }

  try {
    const paymentId: string | undefined = object?.id;
    const donationIdFromMeta: string | undefined = object?.metadata?.donation_id;

    if (event === "payment.succeeded" && paymentId) {
      // Ищем донат: сначала по yookassa_payment_id, затем по metadata.donation_id
      let donationId: string | null = null;

      const { data: byPayment } = await supabase
        .from("donations")
        .select("id")
        .eq("yookassa_payment_id", paymentId)
        .maybeSingle();

      if (byPayment?.id) {
        donationId = byPayment.id;
      } else if (donationIdFromMeta) {
        donationId = donationIdFromMeta;
      }

      if (donationId) {
        // TODO: при привязке к кампании — здесь же увеличивать campaigns.collected_amount
        await supabase
          .from("donations")
          .update({
            status: "succeeded",
            paid_at: new Date().toISOString(),
            yookassa_payment_id: paymentId,
          })
          .eq("id", donationId);
      } else {
        console.warn("payment.succeeded: donation not found", { paymentId, donationIdFromMeta });
      }
    } else if (event === "payment.canceled" && paymentId) {
      let donationId: string | null = null;
      const { data: byPayment } = await supabase
        .from("donations")
        .select("id")
        .eq("yookassa_payment_id", paymentId)
        .maybeSingle();
      if (byPayment?.id) donationId = byPayment.id;
      else if (donationIdFromMeta) donationId = donationIdFromMeta;

      if (donationId) {
        await supabase
          .from("donations")
          .update({ status: "canceled" })
          .eq("id", donationId);
      }
    }
  } catch (e) {
    console.error("yookassa-webhook processing error:", e);
  }

  // Всегда 200 OK
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
