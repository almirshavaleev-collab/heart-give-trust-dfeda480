import { useState } from "react";
import { Heart, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const presets = [500, 1000, 3000, 5000];

const DonationWidget = () => {
  const [amount, setAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeAmount = amount ?? (customAmount ? Number(customAmount) : 0);

  const handlePreset = (val: number) => {
    setAmount(val);
    setCustomAmount("");
  };

  const handleCustom = (val: string) => {
    setCustomAmount(val);
    setAmount(null);
  };

  const handleSubmit = async () => {
    if (!activeAmount || !consent || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          amount: activeAmount,
          return_url: `${window.location.origin}/thank-you`,
          description: recurring
            ? `Ежемесячное пожертвование ${activeAmount} ₽`
            : `Пожертвование ${activeAmount} ₽`,
          donor_name: name || null,
          donor_email: email || null,
          donor_phone: phone || null,
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
            {/* Toggle */}
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
              placeholder="Другая сумма, ₽"
              value={customAmount}
              onChange={(e) => handleCustom(e.target.value)}
              className="rounded-xl h-12 text-center text-base mb-6 bg-background border-border"
            />

            {/* Fields */}
            <div className="space-y-3 mb-6">
              <Input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-12 bg-background border-border" />
              <Input placeholder="Телефон" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl h-12 bg-background border-border" />
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-12 bg-background border-border" />
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
              disabled={!activeAmount || !consent || loading}
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
                  Поддержать {activeAmount ? `${activeAmount.toLocaleString("ru-RU")} ₽` : ""}
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
