import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const amount = Number(body?.amount);
    const returnUrl: string = body?.return_url || "https://ligafund.ru/thank-you";
    const description: string = body?.description || "Пожертвование в Фонд «Выпускники Лицея «Лига»";
    const donorName: string | null = body?.donor_name ?? null;
    const donorEmail: string | null = body?.donor_email ?? null;
    const donorPhone: string | null = body?.donor_phone ?? null;
    // TODO: при привязке к конкретной кампании передавать campaign_id из фронта
    const campaignId: string | null = body?.campaign_id ?? null;

    if (!amount || amount < 1 || amount > 1_000_000) {
      return new Response(
        JSON.stringify({ error: "Некорректная сумма" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");
    if (!shopId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Платежная система не настроена" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Service-role client для записи donation в обход RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Сохраняем pending-донат
    const { data: donation, error: donationError } = await supabase
      .from("donations")
      .insert({
        amount,
        status: "pending",
        donor_name: donorName,
        donor_email: donorEmail,
        donor_phone: donorPhone,
        campaign_id: campaignId, // TODO: связать с конкретной кампанией
      })
      .select("id")
      .single();

    if (donationError || !donation) {
      console.error("donation insert error:", donationError);
      return new Response(
        JSON.stringify({ error: "Не удалось создать запись пожертвования" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const donationId = donation.id;
    const auth = btoa(`${shopId}:${secretKey}`);

    // 2. Создаём платёж в ЮKassa с metadata
    const ykResp = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency: "RUB" },
        confirmation: { type: "redirect", return_url: returnUrl },
        capture: true,
        description,
        metadata: {
          donation_id: donationId,
          // TODO: передавать реальный campaign_id, пока 'general'
          campaign_id: campaignId ?? "general",
        },
      }),
    });

    const data = await ykResp.json();

    if (!ykResp.ok) {
      console.error("YooKassa error:", data);
      // Помечаем донат как failed
      await supabase
        .from("donations")
        .update({ status: "failed" })
        .eq("id", donationId);
      return new Response(
        JSON.stringify({ error: data?.description || "Ошибка ЮKassa", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Сохраняем yookassa_payment_id
    await supabase
      .from("donations")
      .update({ yookassa_payment_id: data.id })
      .eq("id", donationId);

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        confirmation: data.confirmation,
        donation_id: donationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-payment exception:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
