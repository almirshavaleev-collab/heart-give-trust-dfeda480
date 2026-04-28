import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const amount = Number(body?.amount);
    const description: string = body?.description || "Пожертвование в Фонд «Выпускники Лицея «Лига»";
    const donorName: string | null = body?.donor_name ?? null;
    const donorEmail: string | null = body?.donor_email ?? null;
    const donorPhone: string | null = body?.donor_phone ?? null;
    const campaignId: string | null = body?.campaign_id ?? null;
    const isAnonymous: boolean = Boolean(body?.is_anonymous);
    const rawPaymentType: string = body?.payment_type ?? "one_time";
    const paymentType: "one_time" | "monthly" =
      rawPaymentType === "monthly" ? "monthly" : "one_time";

    if (!amount || amount < 1 || amount > 1_000_000) {
      return new Response(
        JSON.stringify({ error: "Некорректная сумма" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ────────────────────────────────────────────────────────────
    // Режим работы ЮKassa: "production" | "test" (по умолчанию test)
    // ────────────────────────────────────────────────────────────
    const rawMode = (Deno.env.get("YOOKASSA_MODE") ?? "test").trim().toLowerCase();
    const mode: "production" | "test" = rawMode === "production" ? "production" : "test";

    const shopId = mode === "production"
      ? Deno.env.get("YOOKASSA_PROD_SHOP_ID")
      : Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = mode === "production"
      ? Deno.env.get("YOOKASSA_PROD_SECRET_KEY")
      : Deno.env.get("YOOKASSA_SECRET_KEY");

    // В production return_url по умолчанию — боевой домен с success-страницей.
    const defaultReturnUrl = mode === "production"
      ? "https://ligafund.ru/payment-success"
      : "https://ligafund.ru/thank-you";
    const returnUrl: string = body?.return_url || defaultReturnUrl;

    console.log(`[create-payment] mode=${mode} amount=${amount} campaign_id=${campaignId ?? "general"}`);

    if (!shopId || !secretKey) {
      console.error(`[create-payment] missing keys for mode=${mode}`);
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

    // Если пришёл JWT авторизованного пользователя — извлекаем user_id,
    // чтобы привязать донат к личному кабинету.
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: userRes } = await userClient.auth.getUser();
        userId = userRes?.user?.id ?? null;
      } catch (e) {
        console.warn("auth.getUser failed (non-fatal):", e);
      }
    }

    // 0. Серверная защита: если донат целевой — проверяем статус сбора.
    //    Платёж в неактивный сбор (completed/draft/archived) запрещён.
    if (campaignId) {
      const { data: campaign, error: campErr } = await supabase
        .from("campaigns")
        .select("id, status, title")
        .eq("id", campaignId)
        .maybeSingle();

      if (campErr) {
        console.error("campaign lookup error:", campErr);
        return new Response(
          JSON.stringify({ error: "Не удалось проверить сбор" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!campaign) {
        return new Response(
          JSON.stringify({ error: "Сбор не найден" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (campaign.status !== "active") {
        const message =
          campaign.status === "completed"
            ? "Сбор завершён — пожертвования больше не принимаются."
            : "Сбор сейчас недоступен для пожертвований.";
        return new Response(
          JSON.stringify({ error: message, code: "CAMPAIGN_NOT_ACTIVE" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 1. Сохраняем pending-донат
    const { data: donation, error: donationError } = await supabase
      .from("donations")
      .insert({
        amount,
        status: "pending",
        donor_name: donorName,
        donor_email: donorEmail,
        donor_phone: donorPhone,
        campaign_id: campaignId,
        is_anonymous: isAnonymous,
        payment_type: paymentType,
        user_id: userId,
        is_recurring: paymentType === "monthly",
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
          campaign_id: campaignId ?? "general",
        },
      }),
    });

    const data = await ykResp.json();

    if (!ykResp.ok) {
      console.error(`[create-payment] YooKassa error mode=${mode}:`, data);
      await supabase
        .from("donations")
        .update({ status: "failed" })
        .eq("id", donationId);
      return new Response(
        JSON.stringify({ error: data?.description || "Ошибка ЮKassa", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[create-payment] success mode=${mode} payment_id=${data.id} status=${data.status} confirmation_type=${data?.confirmation?.type ?? "n/a"} test=${data?.test ?? false}`,
    );

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
