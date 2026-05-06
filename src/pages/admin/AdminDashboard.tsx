import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Wallet,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Activity,
  Percent,
  Trophy,
  Clock,
  XCircle,
  Repeat,
  HeartHandshake,
  Users,
} from "lucide-react";

const DonationsCharts = lazy(() => import("./DonationsCharts"));

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  campaign_id: string | null;
  is_anonymous: boolean;
  payment_type: string;
  created_at: string;
  paid_at: string | null;
  yookassa_payment_id: string | null;
};

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";
const fmtDateTime = (s: string) => new Date(s).toLocaleString("ru-RU");

export default function AdminDashboard() {
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const syncRecentPendingPayments = async () => {
    const { data, error } = await supabase.functions.invoke("sync-yookassa-payment", {
      body: { scope: "recent_pending", limit: 20 },
    });
    if (error) {
      console.error("dashboard payment sync error:", error);
    } else {
      console.log("dashboard payment sync result:", data);
    }
  };

  const refresh = async () => {
    const { data, error } = await (supabase as any)
      .from("donations")
      .select(
        "id, amount, status, donor_name, donor_email, donor_phone, campaign_id, is_anonymous, payment_type, created_at, paid_at, yookassa_payment_id",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) console.error(error);
    setDonations((data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })));
  };

  useEffect(() => {
    (async () => {
      await syncRecentPendingPayments();
      await refresh();
      setLoading(false);
    })();

    const channel = supabase
      .channel("admin-dashboard-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donations" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const succeeded = donations.filter((d) => d.status === "succeeded");
    const pending = donations.filter((d) => d.status === "pending");
    const canceled = donations.filter((d) => d.status === "canceled" || d.status === "failed");

    const total = succeeded.reduce((s, d) => s + d.amount, 0);

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ref = (d: DonationRow) => new Date(d.paid_at ?? d.created_at);

    const monthSum = succeeded
      .filter((d) => ref(d) >= startMonth)
      .reduce((s, d) => s + d.amount, 0);
    const todaySum = succeeded
      .filter((d) => ref(d) >= startDay)
      .reduce((s, d) => s + d.amount, 0);

    const avg = succeeded.length ? total / succeeded.length : 0;
    const conversion = donations.length ? (succeeded.length / donations.length) * 100 : 0;

    const isRecurring = (d: DonationRow) =>
      d.payment_type === "recurring" || d.payment_type === "monthly";
    const recurringSucceeded = succeeded.filter(isRecurring);

    // Уникальные подписчики по email/phone/user_id-like
    const subscriberKeys = new Set<string>();
    for (const d of recurringSucceeded) {
      const key = (d.donor_email || d.donor_phone || d.id).toLowerCase();
      subscriberKeys.add(key);
    }

    // MRR — сумма уникальных подписок (по последнему платежу каждого ключа)
    const lastByKey = new Map<string, DonationRow>();
    for (const d of recurringSucceeded) {
      const key = (d.donor_email || d.donor_phone || d.id).toLowerCase();
      const prev = lastByKey.get(key);
      if (!prev || ref(d) > ref(prev)) lastByKey.set(key, d);
    }
    const mrr = Array.from(lastByKey.values()).reduce((s, d) => s + d.amount, 0);

    const largest = succeeded.reduce<DonationRow | null>(
      (best, d) => (!best || d.amount > best.amount ? d : best),
      null,
    );
    const lastSucceeded = succeeded[0] ?? null;

    return {
      succeeded,
      total,
      monthSum,
      todaySum,
      avg,
      conversion,
      pendingCount: pending.length,
      canceledCount: canceled.length,
      recurringCount: recurringSucceeded.length,
      activeSubscribers: subscriberKeys.size,
      mrr,
      largest,
      lastSucceeded,
      successCount: succeeded.length,
      totalCount: donations.length,
    };
  }, [donations]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Дашборд</h1>
          <p className="text-sm text-muted-foreground mt-1">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Аналитика поступлений, подписки и ключевые показатели
        </p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Собрано сегодня"
          value={formatRub(stats.todaySum)}
        />
        <KpiCard
          icon={<Calendar className="h-5 w-5" />}
          label="Собрано за месяц"
          value={formatRub(stats.monthSum)}
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Собрано всего"
          value={formatRub(stats.total)}
          accent
        />
        <KpiCard
          icon={<Repeat className="h-5 w-5" />}
          label="Оформлено регулярных платежей"
          value={stats.activeSubscribers.toLocaleString("ru-RU")}
          hint="доноров с хотя бы одним регулярным платежом"
        />
        <KpiCard
          icon={<HeartHandshake className="h-5 w-5" />}
          label="MRR (ориентир)"
          value={formatRub(stats.mrr)}
          hint="ежемесячный регулярный доход"
        />
        <KpiCard
          icon={<Activity className="h-5 w-5" />}
          label="Средний чек"
          value={formatRub(stats.avg)}
        />
        <KpiCard
          icon={<Percent className="h-5 w-5" />}
          label="Конверсия оплат"
          value={`${stats.conversion.toFixed(1)}%`}
          hint={`${stats.successCount} из ${stats.totalCount}`}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Успешных платежей"
          value={stats.successCount.toLocaleString("ru-RU")}
        />
      </div>

      {/* Графики */}
      <Suspense
        fallback={
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Загрузка графиков...</p>
          </Card>
        }
      >
        <DonationsCharts donations={donations} />
      </Suspense>

      {/* Сводка */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Trophy className="h-5 w-5 text-primary" />}
          label="Крупнейшее пожертвование"
          value={stats.largest ? formatRub(stats.largest.amount) : "—"}
          sub={stats.largest ? (stats.largest.donor_name || stats.largest.donor_email || "Аноним") : undefined}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
          label="Последнее успешное"
          value={stats.lastSucceeded ? formatRub(stats.lastSucceeded.amount) : "—"}
          sub={stats.lastSucceeded ? fmtDateTime(stats.lastSucceeded.paid_at ?? stats.lastSucceeded.created_at) : undefined}
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-muted-foreground" />}
          label="В ожидании оплаты"
          value={stats.pendingCount.toLocaleString("ru-RU")}
          sub="платежей в pending"
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5 text-destructive" />}
          label="Отменено / не прошло"
          value={stats.canceledCount.toLocaleString("ru-RU")}
          sub="canceled + failed"
        />
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
        <span className={`text-xs uppercase tracking-wide font-medium ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          {label}
        </span>
        <span className={accent ? "text-primary-foreground/80" : "text-muted-foreground"}>{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      {hint && (
        <div className={`mt-1 text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {hint}
        </div>
      )}
    </Card>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
          <div className="mt-1 text-xl font-bold truncate">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}