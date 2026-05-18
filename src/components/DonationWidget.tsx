import { useState, useEffect, useMemo } from "react";
import { Heart, Check, Loader2, Sparkles, Target, UserCheck, Repeat, Star, ShieldCheck, LogIn } from "lucide-react";
import sbpLogo from "@/assets/payments/sbp.png";
import mirLogo from "@/assets/payments/mir.png";
import sberPayLogo from "@/assets/payments/sberpay.png";
import tPayLogo from "@/assets/payments/tpay.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getSubscriptionsRepo } from "@/lib/subscriptions-repo";
import { Link } from "react-router-dom";

const presetsOneTime = [500, 1000, 3000, 5000];
const presetsRecurring = [300, 500, 1000];
const RECURRING_POPULAR = 500;
const MAX_AMOUNT = 500_000;
const MIN_AMOUNT = 1;

/**
 * MVP/Mock-режим оформления регулярных подписок.
 * 'mock' — создаём подписку в БД БЕЗ оплаты (для демо/MVP).
 * 'live' — реальный YooKassa-поток создания платёжного метода и автосписаний.
 * Когда вернёмся к боевой оплате — просто меняем значение на 'live'.
 */
const RECURRING_MODE: "mock" | "live" = "mock";

type Frequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "test_5min"
  | "test_20min"
  | "test_60min";
const frequencyOptions: { id: Frequency; label: string; popular?: boolean }[] = [
  { id: "weekly", label: "Раз в неделю" },
  { id: "biweekly", label: "Раз в 2 недели" },
  { id: "monthly", label: "Раз в месяц", popular: true },
];
const testFrequencyOptions: { id: Frequency; label: string }[] = [
  { id: "test_5min", label: "Каждые 5 минут" },
  { id: "test_20min", label: "Каждые 20 минут" },
  { id: "test_60min", label: "Каждый час" },
];
const isTestFrequency = (f: Frequency) => f.startsWith("test_");

type PaymentMethod = "sbp" | "card" | "sber" | "tinkoff";
const PAYMENT_METHOD_KEY = "ligafund:payment_method";
const PENDING_PAYMENT_KEY = "ligafund:pending_payment";

const paymentMethods: {
  id: PaymentMethod;
  title: string;
  caption: string;
  logo: string;
}[] = [
  { id: "sbp", title: "СБП", caption: "Система быстрых платежей", logo: sbpLogo },
  { id: "card", title: "Картой онлайн", caption: "Банковские карты Мир", logo: mirLogo },
  { id: "sber", title: "SberPay", caption: "Оплата через Сбер", logo: sberPayLogo },
  { id: "tinkoff", title: "T‑Pay", caption: "Оплата через Т‑Банк", logo: tPayLogo },
];

export interface DonationWidgetCampaign {
  id: string;
  title: string;
  target_amount: number;
  collected_amount: number;
}

interface DonationWidgetProps {
  /**
   * "general"  — общий донат фонду (без цели)
   * "campaign" — целевой донат в конкретный сбор (передать campaign)
   */
  mode?: "general" | "campaign";
  campaign?: DonationWidgetCampaign | null;
  /** Скрыть внешнюю обёртку <section> (для встраивания на страницу сбора). */
  embedded?: boolean;
}

const DonationWidget = ({ mode = "general", campaign = null, embedded = false }: DonationWidgetProps) => {
  const isCampaign = mode === "campaign" && campaign;
  // Регулярные пожертвования доступны ТОЛЬКО в главном виджете фонда.
  // В виджетах на страницах сборов оставляем только разовые платежи.
  const allowRecurring = !isCampaign;
  const [campaignClosed, setCampaignClosed] = useState(false);

  const [amount, setAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consentOffer, setConsentOffer] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mockSuccess, setMockSuccess] = useState(false);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(() => {
    if (typeof window === "undefined") return "card";
    try {
      const saved = localStorage.getItem(PAYMENT_METHOD_KEY) as PaymentMethod | null;
      if (saved && ["sbp", "card", "sber", "tinkoff"].includes(saved)) return saved;
    } catch { /* ignore */ }
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isMobile ? "sbp" : "card";
  });

  useEffect(() => {
    try { localStorage.setItem(PAYMENT_METHOD_KEY, selectedPaymentMethod); } catch { /* ignore */ }
  }, [selectedPaymentMethod]);

  // Авторизованный пользователь: автозаполнение из профиля
  const [authUser, setAuthUser] = useState<{ id: string; email: string | null } | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [isTestEligible, setIsTestEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setAuthUser({ id: user.id, email: user.email ?? null });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const fullName = profile?.full_name?.trim() || null;
      const profilePhone = profile?.phone?.trim() || null;

      setProfileName(fullName);
      // Заполняем только пустые поля, чтобы не затирать ввод пользователя
      setName((prev) => (prev ? prev : fullName ?? ""));
      setPhone((prev) => (prev ? prev : profilePhone ?? ""));
      setEmail((prev) => (prev ? prev : user.email ?? ""));

      // Test/admin eligibility for DEV recurring intervals (server-validated too).
      try {
        const { data: eligible } = await (supabase as any).rpc("is_test_user_or_admin");
        if (!cancelled) setIsTestEligible(!!eligible);
      } catch (e) {
        console.warn("[donation-widget] is_test_user_or_admin check failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rawAmount = amount ?? (customAmount ? Math.floor(Number(customAmount)) : 0);
  const activeAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
  const amountTooHigh = activeAmount > MAX_AMOUNT;
  const amountValid = activeAmount >= MIN_AMOUNT && !amountTooHigh;

  useEffect(() => {
    if (anonymous) {
      setName("Аноним");
      setPhone("");
    } else if (name === "Аноним") {
      // При выключении анонимного режима возвращаем имя из профиля, если оно есть
      setName(profileName ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anonymous]);

  const effectiveRecurring = allowRecurring && recurring;
  const presets = useMemo(
    () => (effectiveRecurring ? presetsRecurring : presetsOneTime),
    [effectiveRecurring],
  );

  // Если виджет переключился в campaign-режим — гарантированно сбрасываем recurring.
  useEffect(() => {
    if (!allowRecurring && recurring) setRecurring(false);
  }, [allowRecurring, recurring]);

  // При переключении режима подкручиваем сумму к разумному дефолту режима
  useEffect(() => {
    if (recurring) {
      setAmount(RECURRING_POPULAR);
      setCustomAmount("");
    } else {
      setAmount(1000);
      setCustomAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring]);

  const handlePreset = (val: number) => {
    setAmount(val);
    setCustomAmount("");
  };

  const handleCustom = (val: string) => {
    const cleaned = val.replace(/[^\d]/g, "");
    setCustomAmount(cleaned);
    setAmount(null);
  };

  const nameValid = anonymous ? true : name.trim().length > 0;
  const consent = consentOffer && consentPrivacy;
  const canSubmit = amountValid && nameValid && consent && !loading;

  const handleSubmit = async () => {
    if (loading) return;

    if (!amountValid) {
      toast({
        title: amountTooHigh ? "Сумма слишком большая" : "Некорректная сумма",
        description: amountTooHigh
          ? `Максимальная сумма — ${MAX_AMOUNT.toLocaleString("ru-RU")} ₽`
          : "Введите положительную сумму пожертвования",
        variant: "destructive",
      });
      return;
    }
    if (!nameValid) {
      toast({
        title: "Укажите имя",
        description: "Введите имя или включите анонимное пожертвование",
        variant: "destructive",
      });
      return;
    }
    if (!consentOffer) {
      toast({
        title: "Требуется согласие",
        description: "Подтвердите согласие с условиями публичной оферты",
        variant: "destructive",
      });
      return;
    }
    if (!consentPrivacy) {
      toast({
        title: "Требуется согласие",
        description: "Подтвердите согласие на обработку персональных данных",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const finalName = anonymous ? "Аноним" : name.trim();
      const finalPhone = anonymous ? null : (phone.trim() || null);
      const finalEmail = email.trim() || null;

      // === MVP MOCK FLOW для регулярных подписок ===
      // Никакой реальной оплаты: создаём запись подписки в БД и показываем success.
      if (effectiveRecurring && RECURRING_MODE === "mock") {
        if (!authUser) {
          toast({
            title: "Войдите в кабинет",
            description: "Регулярная поддержка доступна авторизованным пользователям.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const intervalDays = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
        const nextAt = new Date(Date.now() + intervalDays * 86400000).toISOString();
        const { error: subError } = await supabase.from("donor_subscriptions").insert({
          user_id: authUser.id,
          amount: activeAmount,
          currency: "RUB",
          interval: frequency,
          status: "active",
          payment_method_type: "mock",
          payment_method_id: `mock-${crypto.randomUUID()}`,
          next_payment_at: nextAt,
          campaign_id: isCampaign ? campaign!.id : null,
          is_test: true,
          created_via: "mock",
        });
        if (subError) throw new Error(subError.message);
        setMockSuccess(true);
        setLoading(false);
        return;
      }

      const description = isCampaign
        ? `Пожертвование в сбор: ${campaign!.title} — ${activeAmount} ₽`
        : `Пожертвование в Фонд «Выпускники Лицея «Лига» — ${activeAmount} ₽`;

      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          amount: activeAmount,
          return_url: `${window.location.origin}/thank-you`,
          description,
          donor_name: finalName,
          donor_email: finalEmail,
          donor_phone: finalPhone,
          campaign_id: isCampaign ? campaign!.id : null,
          is_anonymous: anonymous,
          payment_type: effectiveRecurring ? "recurring" : "one_time",
          frequency: effectiveRecurring ? frequency : undefined,
          payment_method: selectedPaymentMethod,
        },
      });

      // При non-2xx supabase.functions.invoke возвращает error c context: Response
      let errBody: { error?: string; code?: string } | null = null;
      if (error) {
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try { errBody = await ctx.clone().json(); } catch { /* ignore */ }
        }
      }
      const errCode = errBody?.code ?? (data as { code?: string } | null)?.code;
      const errMsg = errBody?.error ?? (data as { error?: string } | null)?.error ?? (error as Error | null)?.message;

      if (errCode === "CAMPAIGN_NOT_ACTIVE") {
        setCampaignClosed(true);
        toast({
          title: "Сбор завершён",
          description: "Этот сбор уже завершён. Вы можете поддержать фонд или выбрать другой актуальный сбор.",
          variant: "destructive",
        });
        return;
      }

      if (error) throw new Error(errMsg || error.message);

      const url = data?.confirmation?.confirmation_url;
      if (url) {
        try {
          localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({
            donation_id: data?.donation_id ?? null,
            payment_id: data?.id ?? null,
            created_at: new Date().toISOString(),
            payment_type: effectiveRecurring ? "recurring" : "one_time",
            frequency: effectiveRecurring ? frequency : null,
          }));
        } catch { /* ignore */ }
        // Mock subscription persistence (localStorage). Easily swappable for Supabase later.
        if (effectiveRecurring && authUser && !isTestFrequency(frequency)) {
          try {
            await getSubscriptionsRepo().create({
              user_id: authUser.id,
              amount: activeAmount,
              frequency: frequency as "weekly" | "biweekly" | "monthly",
              campaign_id: isCampaign ? campaign!.id : null,
              campaign_title: isCampaign ? campaign!.title : null,
            });
          } catch (err) {
            console.error("[subscriptions] failed to persist mock", err);
          }
        }
        window.location.href = url;
        return;
      }
      throw new Error(errMsg || "Не удалось создать платёж");
    } catch (e) {
      console.error("Donation error:", e);
      toast({
        title: "Ошибка оплаты",
        description: (e as Error).message || "Попробуйте ещё раз или используйте реквизиты ниже.",
        variant: "destructive",
      });
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Если сервер сообщил что сбор закрыт — заменяем виджет на блок благодарности
  if (campaignClosed && isCampaign) {
    return (
      <div className="card-light p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <Check className="w-6 h-6 text-foreground" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold text-foreground text-lg">Сбор завершён</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Пожертвования по этому сбору больше не принимаются. Спасибо всем, кто принял участие.
          </p>
        </div>
        <Button asChild className="w-full" size="lg">
          <a href="/#donate">
            <Heart className="w-4 h-4 mr-2" />
            Поддержать фонд
          </a>
        </Button>
      </div>
    );
  }

  // Mock success state — регулярная подписка создана локально, без оплаты
  if (mockSuccess) {
    const intervalLabel = frequency === "weekly" ? "раз в неделю" : frequency === "biweekly" ? "раз в 2 недели" : "раз в месяц";
    return (
      <div className={cn("card-light w-full text-center space-y-5", embedded ? "p-6" : "p-8 md:p-10")}>
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
          <Check className="w-7 h-7 text-primary" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="font-semibold text-foreground text-xl">Регулярная поддержка оформлена</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {activeAmount.toLocaleString("ru-RU")} ₽ · {intervalLabel}. Управлять подпиской можно в личном кабинете.
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
            Тестовый режим — без реального списания
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/account/subscriptions">Перейти в кабинет</Link>
          </Button>
          <Button variant="outline" size="lg" className="rounded-full" onClick={() => setMockSuccess(false)}>
            Оформить ещё одну
          </Button>
        </div>
      </div>
    );
  }

  const Card = (
    <div className={cn("card-light w-full", embedded ? "p-5 sm:p-6" : "p-8 md:p-10")}>
      {authUser && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3">
          <UserCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Вы вошли как{" "}
            <span className="text-foreground font-medium">
              {profileName || authUser.email || "пользователь"}
            </span>
            . Пожертвование будет привязано к вашему личному кабинету.
          </p>
        </div>
      )}
      {/* Тип платежа — segmented toggle. Скрыт на страницах сборов: там только разовый платёж. */}
      {allowRecurring && (
      <div
        role="tablist"
        aria-label="Тип пожертвования"
        className="relative flex gap-1 rounded-2xl bg-secondary/70 backdrop-blur-sm p-1 mb-5 border border-border/60 shadow-inner"
      >
        {[
          { id: "one_time" as const, label: "Разовое пожертвование", icon: Heart },
          { id: "recurring" as const, label: "Регулярная поддержка", icon: Repeat },
        ].map(({ id, label, icon: Icon }) => {
          const active = (id === "recurring") === recurring;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRecurring(id === "recurring")}
              className={cn(
                "relative flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all duration-300 whitespace-nowrap",
                active
                  ? "bg-background text-foreground shadow-md ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-4 h-4 transition-transform duration-300", active && "scale-110")} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* Периодичность — только для регулярной поддержки */}
      {allowRecurring && recurring && (
        <div className="mb-5 animate-fade-in">
          <p className="text-sm font-medium text-foreground mb-2.5 px-0.5">Как часто помогать?</p>
          <div className="grid grid-cols-3 gap-2">
            {frequencyOptions.map(({ id, label, popular }) => {
              const active = frequency === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFrequency(id)}
                  aria-pressed={active}
                  className={cn(
                    "relative h-12 rounded-xl text-xs sm:text-sm font-medium border transition-all duration-200 px-2",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-background border-border hover:border-foreground/30 text-foreground"
                  )}
                >
                  {popular && !active && (
                    <Star className="absolute top-1 right-1 w-3 h-3 text-primary fill-primary/40" aria-hidden />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed px-0.5">
            Регулярная помощь позволяет фонду планировать программы и помогать стабильно.
          </p>
          <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-relaxed px-0.5">
            Регулярная поддержка пока работает через напоминания о повторном платеже и не является автоматическим списанием.
          </p>
        </div>
      )}

      {/* Presets — адаптивная сетка: 2 кол. в узком embedded, 4 на широком */}
      <div
        className={cn(
          "grid gap-2 mb-4",
          recurring
            ? "grid-cols-3"
            : embedded ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
        )}
      >
        {presets.map((val) => (
          <button
            key={val}
            onClick={() => handlePreset(val)}
            className={cn(
              "relative h-12 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap",
              amount === val
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background border-border hover:border-foreground/20"
            )}
          >
            {recurring && val === RECURRING_POPULAR && amount !== val && (
              <Star className="absolute top-1 right-1 w-3 h-3 text-primary fill-primary/40" aria-hidden />
            )}
            {val.toLocaleString("ru-RU")} ₽
          </button>
        ))}
      </div>

      <Input
        type="number"
        inputMode="numeric"
        min={MIN_AMOUNT}
        max={MAX_AMOUNT}
        step={1}
        placeholder="Другая сумма, ₽"
        value={customAmount}
        onChange={(e) => handleCustom(e.target.value)}
        onKeyDown={(e) => {
          if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault();
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (/[^\d]/.test(pasted)) {
            e.preventDefault();
            const cleaned = pasted.replace(/[^\d]/g, "");
            if (cleaned) handleCustom(cleaned);
          }
        }}
        className="rounded-xl h-12 text-center text-base mb-2 bg-background border-border"
      />
      {amountTooHigh ? (
        <p className="text-xs text-destructive mb-5 text-center">
          Максимальная сумма — {MAX_AMOUNT.toLocaleString("ru-RU")} ₽
        </p>
      ) : (
        <div className="mb-5" />
      )}

      <div className="space-y-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-2 px-0.5">
            <label htmlFor="donor-name" className="text-sm font-medium text-foreground">
              Ваше имя
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 -my-1">
              <span
                className={cn(
                  "text-sm transition-colors",
                  anonymous ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                Анонимно
              </span>
              <Switch checked={anonymous} onCheckedChange={setAnonymous} />
            </label>
          </div>
          <Input
            id="donor-name"
            placeholder={anonymous ? "Аноним" : "Введите имя"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={anonymous}
            className="rounded-xl h-12 bg-background border-border disabled:bg-secondary/60 disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-100"
          />
        </div>
        <Input
          placeholder={anonymous ? "Не используется" : "Телефон"}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={anonymous}
          className="rounded-xl h-12 bg-background border-border disabled:bg-secondary/60 disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-100"
        />
        <Input
          placeholder={anonymous ? "Email (необязательно)" : "Email"}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl h-12 bg-background border-border"
        />
      </div>

      {/* Способ оплаты */}
      <div className="mb-6">
        <p className="text-sm font-medium text-foreground mb-3 px-0.5">Способ оплаты</p>
        <div className="grid grid-cols-2 gap-2">
          {paymentMethods.map(({ id, title, caption, logo }) => {
            const active = selectedPaymentMethod === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedPaymentMethod(id)}
                aria-pressed={active}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-200",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-foreground/30 hover:shadow-md hover:scale-[1.02]"
                )}
              >
                <span className="shrink-0 h-6 w-14 flex items-center justify-center">
                  <img
                    src={logo}
                    alt={title}
                    className="h-6 w-auto max-w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="flex-1 min-w-0 self-center">
                  <span className="block text-sm font-semibold text-foreground leading-tight">
                    {title}
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5 leading-tight truncate">
                    {caption}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={consentOffer}
            aria-label="Согласие с публичной офертой"
            onClick={() => setConsentOffer(!consentOffer)}
            className={cn(
              "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer",
              consentOffer ? "bg-primary border-primary" : "border-border"
            )}
          >
            {consentOffer && <Check className="w-3 h-3 text-primary-foreground" />}
          </button>
          <span
            className="text-xs text-muted-foreground leading-[1.55] flex-1 min-w-0 cursor-pointer select-none"
            onClick={() => setConsentOffer(!consentOffer)}
          >
            Я принимаю условия{" "}
            <a
              href="/offer"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
            >
              публичной оферты
            </a>
          </span>
        </div>
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={consentPrivacy}
            aria-label="Согласие на обработку персональных данных"
            onClick={() => setConsentPrivacy(!consentPrivacy)}
            className={cn(
              "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer",
              consentPrivacy ? "bg-primary border-primary" : "border-border"
            )}
          >
            {consentPrivacy && <Check className="w-3 h-3 text-primary-foreground" />}
          </button>
          <span
            className="text-xs text-muted-foreground leading-[1.55] flex-1 min-w-0 cursor-pointer select-none"
            onClick={() => setConsentPrivacy(!consentPrivacy)}
          >
            Я согласен(а) на{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
            >
              обработку персональных данных
            </a>
          </span>
        </div>
      </div>

      {allowRecurring && recurring && !authUser ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-50/40 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-900">
                Нужен личный кабинет
              </p>
              <p className="text-[13px] leading-relaxed text-amber-900/80">
                Регулярная поддержка доступна только зарегистрированным пользователям, чтобы вы могли управлять подпиской, изменять сумму и при необходимости приостанавливать помощь.
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="w-full bg-amber-600 hover:bg-amber-600/90 text-white">
            <Link to={`/auth?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.hash : "/")}`}>
              <LogIn className="w-4 h-4" />
              Войти или зарегистрироваться
            </Link>
          </Button>
        </div>
      ) : (
      <Button
        size="xl"
        className="w-full min-h-[52px] whitespace-normal text-center leading-tight"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Переход к оплате...
          </>
        ) : recurring ? (
          <>
            <Repeat className="w-5 h-5 shrink-0" />
            <span>
              Поддерживать регулярно
              {amountValid ? ` · ${activeAmount.toLocaleString("ru-RU")} ₽` : ""}
            </span>
          </>
        ) : (
          <>
            <Heart className="w-5 h-5 shrink-0" />
            <span>
              {isCampaign ? "Поддержать сбор" : "Помочь"}
              {amountValid ? ` ${activeAmount.toLocaleString("ru-RU")} ₽` : ""}
            </span>
          </>
        )}
      </Button>
      )}

      <p className="text-xs text-center text-muted-foreground mt-4">Безопасная оплата через ЮKassa</p>
    </div>
  );

  // Встроенный режим (например, на странице кампании) — без обёртки секции
  if (embedded) {
    return (
      <>
        {Card}
        <DonationModal show={showModal} onOpenChange={setShowModal} />
      </>
    );
  }

  return (
    <>
      <section
        id="donate"
        className={cn(
          "py-24 md:py-32",
          isCampaign ? "bg-background" : "section-alt"
        )}
      >
        <div className="container max-w-xl">
          <div className="text-center mb-10">
            <p
              className={cn(
                "text-sm font-semibold uppercase tracking-wider mb-3 inline-flex items-center gap-2",
                isCampaign ? "text-primary" : "text-accent"
              )}
            >
              {isCampaign ? <Target className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {isCampaign ? "Целевой сбор" : "Сделать вклад"}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              {isCampaign ? "Поддержать сбор" : "Поддержать фонд"}
            </h2>
            {!isCampaign && (
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Ваш вклад идёт в общий фонд и направляется туда, где помощь нужна сильнее всего.
              </p>
            )}
            {isCampaign && campaign && (
              <p className="mt-3 text-muted-foreground leading-relaxed">
                {campaign.title}
              </p>
            )}
          </div>

          {Card}
        </div>
      </section>

      <DonationModal show={showModal} onOpenChange={setShowModal} />
    </>
  );
};

const DonationModal = ({
  show,
  onOpenChange,
}: {
  show: boolean;
  onOpenChange: (v: boolean) => void;
}) => (
  <Dialog open={show} onOpenChange={onOpenChange}>
    <DialogContent className="rounded-2xl max-w-md border-border">
      <DialogHeader>
        <DialogTitle className="text-xl text-foreground">Не удалось перейти к оплате</DialogTitle>
        <DialogDescription className="text-base leading-relaxed mt-2">
          Попробуйте ещё раз чуть позже или воспользуйтесь банковскими реквизитами фонда.
        </DialogDescription>
      </DialogHeader>
      <Button className="mt-4" asChild>
        <a href="/#details" onClick={() => onOpenChange(false)}>
          Перейти к реквизитам
        </a>
      </Button>
    </DialogContent>
  </Dialog>
);

export default DonationWidget;
