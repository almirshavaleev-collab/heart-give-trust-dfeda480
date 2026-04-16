import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const amount = Number(body?.amount);
    const returnUrl: string = body?.return_url || "https://ligafund.ru/thank-you";
    const description: string = body?.description || "Пожертвование в Фонд «Выпускники Лицея «Лига»";

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

    const auth = btoa(`${shopId}:${secretKey}`);

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
      }),
    });

    const data = await ykResp.json();

    if (!ykResp.ok) {
      console.error("YooKassa error:", data);
      return new Response(
        JSON.stringify({ error: data?.description || "Ошибка ЮKassa", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        confirmation: data.confirmation,
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
