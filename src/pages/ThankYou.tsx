import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const PENDING_PAYMENT_KEY = "ligafund:pending_payment";

const ThankYou = () => {
  useEffect(() => {
    document.title = "Спасибо за поддержку — Фонд «Лига»";

    const syncPayment = async () => {
      let pending: { donation_id?: string | null; payment_id?: string | null } | null = null;
      try {
        const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
        pending = raw ? JSON.parse(raw) : null;
      } catch { /* ignore */ }

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
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Heart className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Спасибо за поддержку ❤️
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Ваш вклад помогает выпускникам лицея «Лига» воплощать важные проекты.
          Мы свяжемся с вами после подтверждения платежа.
        </p>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/">Вернуться на главную</Link>
        </Button>
      </div>
    </main>
  );
};

export default ThankYou;
