import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Wallet,
  Calendar,
  CalendarDays,
  CalendarRange,
  Repeat,
  HeartHandshake,
  Users,
  UserPlus,
  Activity,
} from "lucide-react";

const DonationsTrendChart = lazy(() => import("./DonationsTrendChart"));

import MonthLeaderCard from "@/components/admin/MonthLeaderCard";
import UpcomingChargesCard from "@/components/admin/UpcomingChargesCard";

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  user_id: string | null;
  campaign_id: string | null;
  is_anonymous: boolean;
  payment_type: string;
  created_at: string;
  paid_at: string | null;
  yookassa_payment_id: string | null;
};

type SubscriptionRow = {
  id: string;
  amount: number;
  interval: string;
  status: string;
  is_test: boolean;
  next_payment_at: string | null;
};

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

export default function AdminDashboard() {
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const syncRecentPendingPayments = async () => {
    const { error } = await supabase.functions.invoke("sync-yookassa-payment", {
      body: { scope: "recent_pending", limit: 20 },
    });
    if (error) console.error("dashboard payment sync error:", error);
  };

  const refresh = async () => {
    const [donRes, subRes] = await Promise.all([
      (supabase as any)
        .from("donations")
        .select(
          "id, amount, status, donor_name, donor_email, donor_phone, user_id, campaign_id, is_anonymous, payment_type, created_at, paid_at, yookassa_payment_id",
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      (supabase as any)
        .from("donor_subscriptions")
        .select("id, amount, interval, status, is_test, next_payment_at"),
    ]);
    if (donRes.error) console.error(donRes.error);
    if (subRes.error) console.error(subRes.error);
    setDonations((donRes.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })));
    setSubscriptions(
      (subRes.data ?? []).map((s: any) => ({
        id: s.id,
        amount: Number(s.amount ?? 0),
        interval: s.interval,
        status: s.status,
        is_test: !!s.is_test,
        next_payment_at: s.next_payment_at,
      })),
    );
  };

  useEffect(() => {
    (async () => {
      await syncRecentPendingPayments();
      await refresh();
      setLoading(false);
    })();

    const channel = supabase
      .channel("admin-dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => refresh())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donor_subscriptions" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const succeeded = donations.filter((d) => d.status === "succeeded");
    const ref = (d: DonationRow) => new Date(d.paid_at ?? d.created_at);

    const now = new Date();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todaySum = succeeded.filter((d) => ref(d) >= startDay).reduce((s, d) => s + d.amount, 0);
    const weekSum = succeeded.filter((d) => ref(d) >= startWeek).reduce((s, d) => s + d.amount, 0);
    const monthSum = succeeded.filter((d) => ref(d) >= startMonth).reduce((s, d) => s + d.amount, 0);

    // Регулярные подписки (active, не тест)
    const activeSubs = subscriptions.filter((s) => s.status === "active" && !s.is_test);
    const activeSubsCount = activeSubs.length;
    const mrr = activeSubs.reduce((sum, s) => {
      const a = s.amount;
      switch (s.interval) {
        case "weekly":
        case "week":
          return sum + a * 4.345;
        case "biweekly":
          return sum + a * 2.1725;
        case "monthly":
        case "month":
        default:
          return sum + a;
      }
    }, 0);

    // Уникальный ключ донора
    const donorKey = (d: DonationRow) =>
      d.user_id ??
      (d.donor_email ? d.donor_email.toLowerCase() : null) ??
      d.donor_phone ??
      d.id;

    const monthSucceeded = succeeded.filter((d) => ref(d) >= startMonth);
    const activeDonorsMonth = new Set(monthSucceeded.map(donorKey)).size;

    // Новые доноры месяца — первое успешное в этом месяце
    const firstByKey = new Map<string, Date>();
    for (const d of succeeded) {
      const k = donorKey(d);
      const dt = ref(d);
      const prev = firstByKey.get(k);
      if (!prev || dt < prev) firstByKey.set(k, dt);
    }
    let newDonorsMonth = 0;
    for (const dt of firstByKey.values()) if (dt >= startMonth) newDonorsMonth += 1;

    const avg = succeeded.length ? succeeded.reduce((s, d) => s + d.amount, 0) / succeeded.length : 0;

    return {
      todaySum,
      weekSum,
      monthSum,
      activeSubsCount,
      mrr,
      activeDonorsMonth,
      newDonorsMonth,
      avg,
    };
  }, [donations, subscriptions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Аналитика фонда</h1>
          <p className="text-sm text-muted-foreground mt-1">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Аналитика фонда</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Здоровье фонда, рост поддержки и стабильность регулярных пожертвований
        </p>
      </div>

      {/* Секция 1 — Основные KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Собрано сегодня"
          value={formatRub(stats.todaySum)}
        />
        <KpiCard
          icon={<CalendarRange className="h-5 w-5" />}
          label="Собрано за неделю"
          value={formatRub(stats.weekSum)}
        />
        <KpiCard
          icon={<Calendar className="h-5 w-5" />}
          label="Собрано за месяц"
          value={formatRub(stats.monthSum)}
          accent
        />
        <KpiCard
          icon={<Repeat className="h-5 w-5" />}
          label="Регулярных подписок"
          value={stats.activeSubsCount.toLocaleString("ru-RU")}
          hint="активных доноров с recurring"
        />
        <KpiCard
          icon={<HeartHandshake className="h-5 w-5" />}
          label="Ежемесячный доход (MRR)"
          value={formatRub(stats.mrr)}
          hint="по активным подпискам"
        />
      </div>

      {/* Секция 2 — Метрики доноров */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DonorMetric
          icon={<Users className="h-4 w-4" />}
          label="Активных доноров за месяц"
          value={stats.activeDonorsMonth.toLocaleString("ru-RU")}
        />
        <DonorMetric
          icon={<UserPlus className="h-4 w-4" />}
          label="Новых доноров за месяц"
          value={stats.newDonorsMonth.toLocaleString("ru-RU")}
        />
        <DonorMetric
          icon={<Activity className="h-4 w-4" />}
          label="Средний размер пожертвования"
          value={formatRub(stats.avg)}
        />
      </div>

      {/* Секция 3 — Главный график */}
      <Suspense
        fallback={
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Загрузка графика...</p>
          </Card>
        }
      >
        <DonationsTrendChart donations={donations} />
      </Suspense>

      {/* Секция 4 — Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthLeaderCard donations={donations} />
        <UpcomingChargesCard />
      </div>

    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`p-6 ${accent ? "bg-primary text-primary-foreground border-primary" : ""}`}>
      <div className="flex items-center justify-between">
        <span
          className={`text-xs uppercase tracking-wide font-medium ${
            accent ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
        <span className={accent ? "text-primary-foreground/80" : "text-muted-foreground"}>{icon}</span>
      </div>
      <div className="mt-3 text-2xl lg:text-3xl font-bold tracking-tight">{value}</div>
      {hint && (
        <div
          className={`mt-1 text-xs ${
            accent ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {hint}
        </div>
      )}
    </Card>
  );
}

function DonorMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}
