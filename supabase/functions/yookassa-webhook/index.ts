import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Webhook от ЮKassa. Должен ВСЕГДА возвращать 200, иначе ЮKassa будет ретраить.
// URL для настройки в личном кабинете ЮKassa:
//   https://<project>.supabase.co/functions/v1/yookassa-webhook

// Доверенные IP-сети ЮKassa (актуальный список):
// https://yookassa.ru/developers/using-api/webhooks#ip
const YOOKASSA_ALLOWED_CIDRS = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const x = Number(p);
    if (!Number.isInteger(x) || x < 0 || x > 255) return null;
    n = (n << 8) + x;
  }
  return n >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isYookassaIp(ip: string | null): boolean {
  if (!ip) return false;
  // IPv6 — упрощённо: проверяем префикс
  if (ip.includes(":")) {
    return ip.toLowerCase().startsWith("2a02:5180:");
  }
  for (const cidr of YOOKASSA_ALLOWED_CIDRS) {
    if (cidr.includes(":")) continue;
    if (ipv4InCidr(ip, cidr)) return true;
  }
  return false;
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sourceIp = getClientIp(req);

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (e) {
    console.error("Invalid JSON from YooKassa:", e);
    await supabase.from("webhook_logs").insert({
      provider: "yookassa",
      event: null,
      payload: { error: "invalid_json" },
      source_ip: sourceIp,
      result: "rejected",
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event: string | undefined = payload?.event;
  const object: any = payload?.object ?? {};
  const paymentId: string | undefined = object?.id;
  const objectStatus: string | undefined = object?.status;
  const donationIdFromMeta: string | undefined = object?.metadata?.donation_id;

  // Базовая запись лога — дополним result в конце
  const baseLog = {
    provider: "yookassa",
    event: event ?? null,
    payload,
    source_ip: sourceIp,
    object_id: paymentId ?? null,
    object_status: objectStatus ?? null,
    donation_id: donationIdFromMeta ?? null,
  };

  const writeLog = async (result: string, donationId?: string | null) => {
    try {
      await supabase.from("webhook_logs").insert({
        ...baseLog,
        donation_id: donationId ?? baseLog.donation_id,
        result,
      });
    } catch (e) {
      console.error("webhook_logs insert error:", e);
    }
  };

  // 1. IP allowlist
  if (!isYookassaIp(sourceIp)) {
    console.warn("Webhook from untrusted IP:", sourceIp);
    await writeLog("rejected_ip");
    // Возвращаем 200, чтобы не давать атакующему сигнал
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (event === "payment.succeeded" && paymentId) {
      // 2. Дополнительная верификация через API ЮKassa
      const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
      const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");
      if (!shopId || !secretKey) {
        await writeLog("rejected_no_credentials");
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const auth = btoa(`${shopId}:${secretKey}`);
      const verifyResp = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const verifyData = await verifyResp.json();

      if (!verifyResp.ok || verifyData?.status !== "succeeded") {
        console.warn("Payment verification mismatch:", verifyData?.status);
        await writeLog("rejected_verification");
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Находим донат
      let donationId: string | null = null;
      let currentStatus: string | null = null;
      let donationCampaignId: string | null = null;
      let donationAmount: number | null = null;

      const { data: byPayment } = await supabase
        .from("donations")
        .select("id, status, campaign_id, amount")
        .eq("yookassa_payment_id", paymentId)
        .maybeSingle();

      if (byPayment?.id) {
        donationId = byPayment.id;
        currentStatus = byPayment.status;
        donationCampaignId = byPayment.campaign_id ?? null;
        donationAmount = Number(byPayment.amount);
      } else if (donationIdFromMeta) {
        const { data: byMeta } = await supabase
          .from("donations")
          .select("id, status, campaign_id, amount")
          .eq("id", donationIdFromMeta)
          .maybeSingle();
        donationId = byMeta?.id ?? null;
        currentStatus = byMeta?.status ?? null;
        donationCampaignId = byMeta?.campaign_id ?? null;
        donationAmount = byMeta?.amount != null ? Number(byMeta.amount) : null;
      }

      if (!donationId) {
        await writeLog("ignored_not_found");
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. Идемпотентность: если уже succeeded — ничего не делаем
      if (currentStatus === "succeeded") {
        await writeLog("already_processed", donationId);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 5. Обновляем статус доната (защита от гонки через .neq)
      const { data: updatedRows, error: updErr } = await supabase
        .from("donations")
        .update({
          status: "succeeded",
          paid_at: new Date().toISOString(),
          yookassa_payment_id: paymentId,
        })
        .eq("id", donationId)
        .neq("status", "succeeded")
        .select("id");

      if (updErr) {
        console.error("donation update error:", updErr);
        await writeLog("rejected_db_error", donationId);
      } else {
        // 6. Если донат целевой — атомарно увеличиваем сбор
        const wasUpdated = (updatedRows?.length ?? 0) > 0;
        if (wasUpdated && donationCampaignId && donationAmount && donationAmount > 0) {
          const { error: rpcErr } = await supabase.rpc("increment_campaign_collected", {
            _campaign_id: donationCampaignId,
            _amount: donationAmount,
          });
          if (rpcErr) {
            console.error("increment_campaign_collected error:", rpcErr);
            await writeLog("accepted_campaign_increment_failed", donationId);
          } else {
            await writeLog("accepted_with_campaign", donationId);
          }
        } else {
          await writeLog("accepted", donationId);
        }
      }
    } else if (event === "payment.canceled" && paymentId) {
      let donationId: string | null = null;
      let currentStatus: string | null = null;

      const { data: byPayment } = await supabase
        .from("donations")
        .select("id, status")
        .eq("yookassa_payment_id", paymentId)
        .maybeSingle();

      if (byPayment?.id) {
        donationId = byPayment.id;
        currentStatus = byPayment.status;
      } else if (donationIdFromMeta) {
        const { data: byMeta } = await supabase
          .from("donations")
          .select("id, status")
          .eq("id", donationIdFromMeta)
          .maybeSingle();
        donationId = byMeta?.id ?? null;
        currentStatus = byMeta?.status ?? null;
      }

      if (!donationId) {
        await writeLog("ignored_not_found");
      } else if (currentStatus === "succeeded" || currentStatus === "canceled") {
        // Не отменяем уже успешный донат и не дублируем canceled
        await writeLog("already_processed", donationId);
      } else {
        await supabase
          .from("donations")
          .update({ status: "canceled" })
          .eq("id", donationId)
          .neq("status", "succeeded");
        await writeLog("accepted", donationId);
      }
    } else {
      await writeLog("ignored_event");
    }
  } catch (e) {
    console.error("yookassa-webhook processing error:", e);
    await writeLog("rejected_exception");
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
