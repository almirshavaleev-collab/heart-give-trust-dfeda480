import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SubLite = {
  amount: number;
  interval: string;
  next_payment_at: string | null;
};

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

export default function UpcomingChargesCard() {
  const [subs, setSubs] = useState<SubLite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("donor_subscriptions")
      .select("amount, interval, next_payment_at, status")
      .eq("status", "active");
    if (error) {
      console.error("UpcomingChargesCard error:", error);
      setLoading(false);
      return;
    }
    setSubs(
      (data ?? []).map((s: any) => ({
        amount: Number(s.amount ?? 0),
        interval: s.interval,
        next_payment_at: s.next_payment_at,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const { todayCount, todaySum, weekCount, weekSum } = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let tc = 0, ts = 0, wc = 0, ws = 0;
    for (const s of subs) {
      if (!s.next_payment_at) continue;
      const np = new Date(s.next_payment_at);
      if (np >= startOfDay && np < endOfDay) {
        tc += 1;
        ts += s.amount;
      }
      if (np >= now && np <= endOfWeek) {
        wc += 1;
        ws += s.amount;
      }
    }
    return { todayCount: tc, todaySum: ts, weekCount: wc, weekSum: ws };
  }, [subs]);

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <CalendarClock className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Ожидается списаний
          </div>
          {loading ? (
            <div className="mt-2 text-sm text-muted-foreground">Загрузка...</div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Сегодня</span>
                <span className="text-base font-semibold">
                  {formatRub(todaySum)}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    · {todayCount}
                  </span>
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Ближайшие 7 дней</span>
                <span className="text-base font-semibold">
                  {formatRub(weekSum)}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    · {weekCount}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}