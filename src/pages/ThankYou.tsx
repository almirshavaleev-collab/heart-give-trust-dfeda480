import { Link } from "react-router-dom";
import { Heart, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PENDING_PAYMENT_KEY = "ligafund:pending_payment";

const ThankYou = () => {
  const [isRecurring, setIsRecurring] = useState(false);

  useEffect(() => {
    document.title = "Спасибо за поддержку — Фонд «Лига»";

    const syncPayment = async () => {
      let pending: { donation_id?: string | null; payment_id?: string | null } | null = null;
      try {
        const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
        pending = raw ? JSON.parse(raw) : null;
      } catch { /* ignore */ }

      if ((pending as { payment_type?: string } | null)?.payment_type === "recurring") {
        setIsRecurring(true);
      }

      if (!pending?.donation_id && !pending?.payment_id) return;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await supabase.functions.invoke("sync-yookassa-payment", {
          body: {
            donation_id: pending.donation_id ?? null,
            payment_id: pending.payment_id ?? null,
          },
        });
        if (!error && data?.results?.some((r: { status?: string }) => r.status === "succeeded")) {
          try { localStorage.removeItem(PENDING_PAYMENT_KEY); } catch { /* ignore */ }
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
    };

    syncPayment();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-lg w-full text-center card-light p-10 md:p-12">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 ring-8 ring-primary/5">
          {isRecurring ? <Repeat className="w-8 h-8 text-primary" /> : <Heart className="w-8 h-8 text-primary" />}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          {isRecurring ? "Спасибо! Вы оформили регулярную поддержку фонда." : "Спасибо за поддержку ❤️"}
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {isRecurring
            ? "Управлять регулярной поддержкой — ставить на паузу или отменять — можно в личном кабинете в разделе «Регулярная помощь»."
            : "Ваш вклад помогает выпускникам лицея «Лига» воплощать важные проекты. Мы свяжемся с вами после подтверждения платежа."}
        </p>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to={isRecurring ? "/account/subscriptions" : "/"}>
            {isRecurring ? "В личный кабинет" : "Вернуться на главную"}
          </Link>
        </Button>
      </div>
    </main>
  );
};

export default ThankYou;
