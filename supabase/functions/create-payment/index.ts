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
    const paymentType: "one_time" | "recurring" =
      rawPaymentType === "recurring" || rawPaymentType === "monthly" ? "recurring" : "one_time";
    const rawFrequency: string = body?.frequency ?? "monthly";
    const ALLOWED_FREQ = ["hourly","weekly","biweekly","monthly"] as const;
    type Freq = typeof ALLOWED_FREQ[number];
    const frequency: Freq = (ALLOWED_FREQ as readonly string[]).includes(rawFrequency)
      ? (rawFrequency as Freq) : "monthly";
    const isRecurring = paymentType === "recurring";

    // Маппинг выбранного на фронте метода в формат ЮKassa payment_method_data.type
    const paymentMethodMap: Record<string, string> = {
      sbp: "sbp",
      card: "bank_card",
      sber: "sberbank",
      tinkoff: "tinkoff_bank",
    };
    const rawPaymentMethod: string = body?.payment_method ?? "card";
    const ykPaymentMethodType: string = paymentMethodMap[rawPaymentMethod] ?? "bank_card";

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

    // Жёстко используем production-домен. Игнорируем body.return_url,
    // request host, auto-detected origin, beta/vercel/lovable превью —
    // после оплаты пользователь ВСЕГДА попадает только на ligafund.ru/thank-you.
    const PUBLIC_SITE_URL = "https://ligafund.ru";
    // Жёстко возвращаем пользователя на главную с маркером успеха.
    // /thank-you временно убран из flow — на некоторых доменных цепочках
    // (Lovable → beta.ligafund → VPS → ligafund.ru) он отдавал Vercel 404.
    let returnUrl = `${PUBLIC_SITE_URL}/?payment=success`;
    if (isRecurring) {
      returnUrl += "&mode=recurring";
    }

    console.log(
      `[create-payment] mode=${mode} amount=${amount} campaign_id=${campaignId ?? "general"} recurring=${isRecurring} frequency=${isRecurring ? frequency : "n/a"}`,
    );

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
        is_recurring: isRecurring,
        is_test: false,
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

    // 2. Создаём платёж в ЮKassa с metadata.
    //    Для recurring добавляем save_payment_method=true — после успешной оплаты
    //    YooKassa вернёт payment_method.id, который мы сохраним в donor_subscriptions
    //    и используем для off-session автоплатежей.
    console.log(
      `[create-payment] sending YK request donation_id=${donationId} save_payment_method=${isRecurring}`,
    );
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
        payment_method_data: { type: ykPaymentMethodType },
        save_payment_method: isRecurring,
        metadata: {
          donation_id: donationId,
          campaign_id: campaignId ?? "general",
          payment_type: paymentType,
          user_id: userId ?? "",
          type: isRecurring ? "recurring" : "one_time",
          frequency: paymentType === "recurring" ? frequency : "",
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
      `[create-payment] success mode=${mode} payment_id=${data.id} status=${data.status} confirmation_type=${data?.confirmation?.type ?? "n/a"} test=${data?.test ?? false} recurring=${isRecurring}`,
    );

    // 3. Сохраняем yookassa_payment_id
    await supabase
      .from("donations")
      .update({ yookassa_payment_id: data.id })
      .eq("id", donationId);

    // Подписка donor_subscriptions создаётся в webhook после успешной оплаты.

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
