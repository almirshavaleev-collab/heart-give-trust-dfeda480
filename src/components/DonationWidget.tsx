import { useState } from "react";
import { Heart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { DonationIntent } from "@/lib/donation";

const presets = [300, 500, 1000, 3000, 5000];

const DonationWidget = () => {
  const [amount, setAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
    if (!activeAmount || !consent) return;

    // TODO: Replace with createDonationIntent() when YooKassa is integrated
    const _intent: DonationIntent = {
      amount: activeAmount,
      currency: "RUB",
      recurring,
      donor: { name, phone, email },
    };

    // TODO: const result = await createDonationIntent(intent);
    // TODO: if (result.success) openYooKassaWidget(result.redirectUrl);
    setShowModal(true);
  };

  return (
    <>
      <section id="donate" className="py-24 md:py-32 bg-muted/30">
        <div className="container max-w-xl">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Сделать вклад</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Помочь фонду</h2>
          </div>

          <div className="bg-card rounded-3xl border border-border/50 p-8 md:p-10 card-elevated">
            {/* Toggle */}
            <div className="flex rounded-2xl bg-muted p-1 mb-8">
              <button
                onClick={() => setRecurring(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  !recurring ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                Разово
              </button>
              <button
                onClick={() => setRecurring(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  recurring ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                Ежемесячно
              </button>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
              {presets.map((val) => (
                <button
                  key={val}
                  onClick={() => handlePreset(val)}
                  className={`py-3 rounded-2xl text-sm font-semibold transition-all border ${
                    amount === val
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-card border-border hover:border-primary/30 text-foreground"
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
              className="rounded-2xl h-12 text-center text-base mb-6"
            />

            {/* Fields */}
            <div className="space-y-3 mb-6">
              <Input
                placeholder="Имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-2xl h-12"
              />
              <Input
                placeholder="Телефон"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-2xl h-12"
              />
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-2xl h-12"
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
                Я согласен(а) на обработку персональных данных и ознакомлен(а) с политикой конфиденциальности фонда
              </span>
            </label>

            <Button
              variant="hero"
              size="xl"
              className="w-full"
              disabled={!activeAmount || !consent}
              onClick={handleSubmit}
            >
              <Heart className="w-5 h-5" />
              Пожертвовать {activeAmount ? `${activeAmount.toLocaleString("ru-RU")} ₽` : ""}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Безопасная оплата · Онлайн-платежи скоро через ЮKassa
            </p>
          </div>
        </div>
      </section>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Онлайн-оплата скоро</DialogTitle>
            <DialogDescription className="text-base leading-relaxed mt-2">
              Онлайн-оплата будет подключена в ближайшее время. Пока вы можете воспользоваться реквизитами фонда ниже.
            </DialogDescription>
          </DialogHeader>
          <Button variant="hero" className="mt-4" asChild>
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
