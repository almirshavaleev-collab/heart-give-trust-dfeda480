import { useState, useEffect } from "react";
import { Heart, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const presets = [500, 1000, 3000, 5000];
const MAX_AMOUNT = 500_000;
const MIN_AMOUNT = 1;

const DonationWidget = () => {
  const [amount, setAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const rawAmount = amount ?? (customAmount ? Math.floor(Number(customAmount)) : 0);
  const activeAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
  const amountTooHigh = activeAmount > MAX_AMOUNT;
  const amountValid = activeAmount >= MIN_AMOUNT && !amountTooHigh;

  // Когда включается анонимный режим — подставляем "Аноним" и чистим телефон
  useEffect(() => {
    if (anonymous) {
      setName("Аноним");
      setPhone("");
    } else if (name === "Аноним") {
      setName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anonymous]);

  const handlePreset = (val: number) => {
    setAmount(val);
    setCustomAmount("");
  };

  const handleCustom = (val: string) => {
    // Только цифры, без минусов / плюсов / e
    const cleaned = val.replace(/[^\d]/g, "");
    setCustomAmount(cleaned);
    setAmount(null);
  };

  const nameValid = anonymous ? true : name.trim().length > 0;
  const canSubmit = amountValid && nameValid && consent && !loading;

  const handleSubmit = async () => {
    if (loading) return;

    if (!amountValid) {
      if (amountTooHigh) {
        toast({
          title: "Сумма слишком большая",
          description: `Максимальная сумма — ${MAX_AMOUNT.toLocaleString("ru-RU")} ₽`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Некорректная сумма",
          description: "Введите положительную сумму пожертвования",
          variant: "destructive",
        });
      }
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

    if (!consent) {
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

      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          amount: activeAmount,
          return_url: `${window.location.origin}/thank-you`,
          description: recurring
            ? `Ежемесячное пожертвование ${activeAmount} ₽`
            : `Пожертвование ${activeAmount} ₽`,
          donor_name: finalName,
          donor_email: finalEmail,
          donor_phone: finalPhone,
          // TODO: при донате со страницы конкретной кампании передавать campaign_id
          campaign_id: null,
        },
      });

      if (error) throw error;

      const url = data?.confirmation?.confirmation_url;
      if (url) {
        window.location.href = url;
        return;
      }

      throw new Error(data?.error || "Не удалось создать платёж");
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

  return (
    <>
      <section id="donate" className="py-24 md:py-32 section-alt">
        <div className="container max-w-xl">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">Сделать вклад</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Поддержать фонд</h2>
          </div>

          <div className="card-light p-8 md:p-10">
            {/* Toggle разово/ежемесячно */}
            <div className="flex rounded-xl bg-secondary p-1 mb-8">
              <button
                onClick={() => setRecurring(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  !recurring ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Разово
              </button>
              <button
                onClick={() => setRecurring(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  recurring ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Ежемесячно
              </button>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {presets.map((val) => (
                <button
                  key={val}
                  onClick={() => handlePreset(val)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all border ${
                    amount === val
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border hover:border-foreground/20"
                  }`}
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
                if (["-", "+", "e", "E", ".", ","].includes(e.key)) {
                  e.preventDefault();
                }
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
            {amountTooHigh && (
              <p className="text-xs text-destructive mb-4 text-center">
                Максимальная сумма — {MAX_AMOUNT.toLocaleString("ru-RU")} ₽
              </p>
            )}
            {!amountTooHigh && <div className="mb-4" />}

            {/* Fields */}
            <div className="space-y-3 mb-6">
              <div>
                <div className="flex items-center justify-between gap-4 mb-2 px-1">
                  <label htmlFor="donor-name" className="text-sm font-medium text-foreground">
                    Ваше имя
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none py-1.5 -my-1.5">
                    <span
                      className={`text-sm transition-colors ${
                        anonymous ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
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

            {/* Consent */}
            <label className="flex items-start gap-3 mb-8 cursor-pointer">
              <div
                onClick={() => setConsent(!consent)}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  consent ? "bg-primary border-primary" : "border-border"
                }`}
              >
                {consent && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Я согласен(а) на обработку персональных данных и ознакомлен(а) с{" "}
                <a href="#privacy" className="text-foreground hover:underline">политикой конфиденциальности</a> и{" "}
                <a href="#terms" className="text-foreground hover:underline">пользовательским соглашением</a>
              </span>
            </label>

            <Button
              size="xl"
              className="w-full"
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
                  <Heart className="w-5 h-5" />
                  Поддержать {amountValid ? `${activeAmount.toLocaleString("ru-RU")} ₽` : ""}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Безопасная оплата через ЮKassa
            </p>
          </div>
        </div>
      </section>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-2xl max-w-md border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">Не удалось перейти к оплате</DialogTitle>
            <DialogDescription className="text-base leading-relaxed mt-2">
              Попробуйте ещё раз чуть позже или воспользуйтесь банковскими реквизитами фонда.
            </DialogDescription>
          </DialogHeader>
          <Button className="mt-4" asChild>
            <a href="#details" onClick={() => setShowModal(false)}>
              Перейти к реквизитам
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DonationWidget;
