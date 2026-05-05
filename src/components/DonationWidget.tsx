import { useState, useEffect } from "react";
import { Heart, Check, Loader2, Sparkles, Target, UserCheck } from "lucide-react";
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

const presets = [500, 1000, 3000, 5000];
const MAX_AMOUNT = 500_000;
const MIN_AMOUNT = 1;

type PaymentMethod = "sbp" | "card" | "sber" | "tinkoff";
const PAYMENT_METHOD_KEY = "ligafund:payment_method";

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
  const [campaignClosed, setCampaignClosed] = useState(false);

  const [amount, setAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consentOffer, setConsentOffer] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

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
          payment_type: "one_time", // ежемесячные — задел на будущее
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
      {/* Тип платежа */}
      <div className="flex gap-2 rounded-xl bg-secondary p-1 mb-6">
        <button
          onClick={() => setRecurring(false)}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
            !recurring ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          Разово
        </button>
        <button
          type="button"
          disabled
          title="Скоро"
          className="flex-1 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/60 cursor-not-allowed inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          Ежемесячно
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-background/60 border border-border">
            скоро
          </span>
        </button>
      </div>

      {/* Presets — адаптивная сетка: 2 кол. в узком embedded, 4 на широком */}
      <div
        className={cn(
          "grid gap-2 mb-4",
          embedded ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
        )}
      >
        {presets.map((val) => (
          <button
            key={val}
            onClick={() => handlePreset(val)}
            className={cn(
              "h-12 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap",
              amount === val
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background border-border hover:border-foreground/20"
            )}
          >
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
          {paymentMethods.map(({ id, title, caption, Logo }) => {
            const active = selectedPaymentMethod === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedPaymentMethod(id)}
                aria-pressed={active}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-foreground/30 hover:shadow-md hover:-translate-y-px"
                )}
              >
                <span
                  className={cn(
                    "shrink-0 w-14 h-9 rounded-lg flex items-center justify-center transition-colors bg-white border border-border/60",
                    active && "border-primary/40"
                  )}
                >
                  <Logo className="max-h-6 w-auto" aria-label={title} />
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
        ) : (
          <>
            <Heart className="w-5 h-5 shrink-0" />
            <span>
              {isCampaign ? "Поддержать сбор" : "Поддержать"}
              {amountValid ? ` ${activeAmount.toLocaleString("ru-RU")} ₽` : ""}
            </span>
          </>
        )}
      </Button>

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
