import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
} from "lucide-react";

const DonationsCharts = lazy(() => import("./DonationsCharts"));

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  yookassa_payment_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  campaign_id: string | null;
  created_at: string;
  paid_at: string | null;
};

type WebhookLogRow = {
  id: string;
  provider: string;
  event: string | null;
  source_ip: string | null;
  object_id: string | null;
  object_status: string | null;
  donation_id: string | null;
  result: string | null;
  created_at: string;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "succeeded") return "default";
  if (s === "canceled" || s === "failed") return "destructive";
  if (s === "pending") return "secondary";
  return "outline";
};

const resultVariant = (r: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!r) return "outline";
  if (r === "accepted") return "default";
  if (r.startsWith("rejected")) return "destructive";
  if (r.startsWith("ignored") || r === "already_processed") return "secondary";
  return "outline";
};

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

const fmtDateTime = (s: string) => new Date(s).toLocaleString("ru-RU");
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

export default function AdminDonations() {
  const [allDonations, setAllDonations] = useState<DonationRow[]>([]);
  const [logs, setLogs] = useState<WebhookLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [d, l] = await Promise.all([
        (supabase as any)
          .from("donations")
          .select("id, amount, status, yookassa_payment_id, donor_name, donor_email, campaign_id, created_at, paid_at")
          .order("created_at", { ascending: false })
          .limit(1000),
        (supabase as any)
          .from("webhook_logs")
          .select("id, provider, event, source_ip, object_id, object_status, donation_id, result, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (d.error) console.error(d.error);
      if (l.error) console.error(l.error);
      setAllDonations((d.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })));
      setLogs(l.data ?? []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const succeeded = allDonations.filter((d) => d.status === "succeeded");
    const pending = allDonations.filter((d) => d.status === "pending");
    const canceled = allDonations.filter((d) => d.status === "canceled" || d.status === "failed");

    const total = succeeded.reduce((s, d) => s + d.amount, 0);

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const referenceDate = (d: DonationRow) => new Date(d.paid_at ?? d.created_at);

    const monthSum = succeeded
      .filter((d) => referenceDate(d) >= startMonth)
      .reduce((s, d) => s + d.amount, 0);
    const todaySum = succeeded
      .filter((d) => referenceDate(d) >= startDay)
      .reduce((s, d) => s + d.amount, 0);

    const avg = succeeded.length ? total / succeeded.length : 0;
    const conversion = allDonations.length ? (succeeded.length / allDonations.length) * 100 : 0;

    const largest = succeeded.reduce<DonationRow | null>(
      (best, d) => (!best || d.amount > best.amount ? d : best),
      null,
    );
    const lastSucceeded = succeeded[0] ?? null; // already sorted desc by created_at

    return {
      total,
      monthSum,
      todaySum,
      successCount: succeeded.length,
      avg,
      conversion,
      pendingCount: pending.length,
      canceledCount: canceled.length,
      largest,
      lastSucceeded,
      succeeded,
    };
  }, [allDonations]);

  // Daily aggregation — last 30 days
  const dailyData = useMemo(() => {
    const days: { date: string; label: string; amount: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        date: d.toISOString().slice(0, 10),
        label: fmtDate(d.toISOString()),
        amount: 0,
      });
    }
    const map = new Map(days.map((x) => [x.date, x]));
    for (const don of stats.succeeded) {
      const ref = new Date(don.paid_at ?? don.created_at);
      const key = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
        .toISOString()
        .slice(0, 10);
      const slot = map.get(key);
      if (slot) slot.amount += don.amount;
    }
    return days;
  }, [stats.succeeded]);

  // Monthly aggregation — last 12 months
  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
        amount: 0,
      });
    }
    const map = new Map(months.map((x) => [x.key, x]));
    for (const don of stats.succeeded) {
      const ref = new Date(don.paid_at ?? don.created_at);
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
      const slot = map.get(key);
      if (slot) slot.amount += don.amount;
    }
    return months;
  }, [stats.succeeded]);

  // Status breakdown
  const statusData = useMemo(() => {
    const buckets: Record<string, number> = { succeeded: 0, pending: 0, canceled: 0, failed: 0 };
    for (const d of allDonations) {
      if (buckets[d.status] !== undefined) buckets[d.status] += 1;
      else buckets[d.status] = 1;
    }
    return Object.entries(buckets).map(([status, count]) => ({ status, count }));
  }, [allDonations]);

  const recentSucceeded = useMemo(
    () => stats.succeeded.slice(0, 10),
    [stats.succeeded],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Дашборд пожертвований</h1>
          <p className="text-sm text-muted-foreground mt-1">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Дашборд пожертвований</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Сводка по сборам, динамика поступлений и активность за период
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Собрано всего"
          value={formatRub(stats.total)}
          accent
        />
        <KpiCard
          icon={<Calendar className="h-5 w-5" />}
          label="Собрано за месяц"
          value={formatRub(stats.monthSum)}
        />
        <KpiCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Собрано сегодня"
          value={formatRub(stats.todaySum)}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Успешных пожертвований"
          value={stats.successCount.toLocaleString("ru-RU")}
        />
        <KpiCard
          icon={<Activity className="h-5 w-5" />}
          label="Средний размер"
          value={formatRub(stats.avg)}
        />
        <KpiCard
          icon={<Percent className="h-5 w-5" />}
          label="Конверсия оплат"
          value={`${stats.conversion.toFixed(1)}%`}
          hint={`${stats.successCount} из ${allDonations.length}`}
        />
      </div>

      {/* Charts (lazy + error boundary so any failure doesn't blank the page) */}
      <Suspense
        fallback={
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Загрузка графиков...</p>
          </Card>
        }
      >
        <DonationsCharts donations={allDonations} />
      </Suspense>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryCard
            icon={<Trophy className="h-5 w-5 text-primary" />}
            label="Крупнейшее пожертвование"
            value={stats.largest ? formatRub(stats.largest.amount) : "—"}
            sub={stats.largest ? (stats.largest.donor_name || stats.largest.donor_email || "Аноним") : undefined}
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
            label="Последнее успешное"
            value={
              stats.lastSucceeded
                ? formatRub(stats.lastSucceeded.amount)
                : "—"
            }
            sub={
              stats.lastSucceeded
                ? fmtDateTime(stats.lastSucceeded.paid_at ?? stats.lastSucceeded.created_at)
                : undefined
            }
          />
          <SummaryCard
            icon={<Clock className="h-5 w-5 text-muted-foreground" />}
            label="В ожидании оплаты"
            value={stats.pendingCount.toLocaleString("ru-RU")}
            sub="платежей в статусе pending"
          />
          <SummaryCard
            icon={<XCircle className="h-5 w-5 text-destructive" />}
            label="Отменено / не прошло"
            value={stats.canceledCount.toLocaleString("ru-RU")}
            sub="canceled + failed"
          />
        </div>
      </div>

      {/* Recent successful donations */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">Последние успешные пожертвования</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Топ-10 оплаченных платежей</p>
          </div>
        </div>
        {recentSucceeded.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет успешных пожертвований</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Дата</th>
                  <th className="py-2 pr-4 font-medium">Сумма</th>
                  <th className="py-2 pr-4 font-medium">Статус</th>
                  <th className="py-2 pr-4 font-medium">Донор</th>
                  <th className="py-2 pr-4 font-medium">YooKassa ID</th>
                  <th className="py-2 font-medium">Оплачено</th>
                </tr>
              </thead>
              <tbody>
                {recentSucceeded.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">{fmtDateTime(d.created_at)}</td>
                    <td className="py-3 pr-4 font-semibold">{formatRub(d.amount)}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                    </td>
                    <td className="py-3 pr-4">{d.donor_name || d.donor_email || "—"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {d.yookassa_payment_id?.slice(0, 12) ?? "—"}
                    </td>
                    <td className="py-3 whitespace-nowrap text-muted-foreground">
                      {d.paid_at ? fmtDateTime(d.paid_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Technical info — collapsible */}
      <Collapsible>
        <Card className="p-0 overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-6 hover:bg-secondary/30 transition-colors group">
            <div className="text-left">
              <h2 className="font-semibold text-lg">Техническая информация</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Логи вебхуков ЮKassa и SQL для ручной проверки
              </p>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-6 pt-0 space-y-6 border-t">
              <div>
                <h3 className="font-semibold mb-3 mt-6">Последние вебхуки ЮKassa</h3>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Пока нет записей</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Дата</th>
                          <th className="py-2 pr-4 font-medium">Event</th>
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 pr-4 font-medium">Result</th>
                          <th className="py-2 pr-4 font-medium">IP</th>
                          <th className="py-2 pr-4 font-medium">Object ID</th>
                          <th className="py-2 font-medium">Donation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.slice(0, 20).map((l) => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="py-2 pr-4 whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                            <td className="py-2 pr-4 font-mono text-xs">{l.event ?? "—"}</td>
                            <td className="py-2 pr-4 font-mono text-xs">{l.object_status ?? "—"}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={resultVariant(l.result)}>{l.result ?? "—"}</Badge>
                            </td>
                            <td className="py-2 pr-4 font-mono text-xs">{l.source_ip ?? "—"}</td>
                            <td className="py-2 pr-4 font-mono text-xs">{l.object_id?.slice(0, 12) ?? "—"}</td>
                            <td className="py-2 font-mono text-xs">{l.donation_id?.slice(0, 8) ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">SQL для проверки вручную</h3>
                <pre className="text-xs bg-secondary/50 p-4 rounded-md overflow-x-auto">
                  <code>{`-- Последние 20 пожертвований
SELECT created_at, amount, status, donor_email, yookassa_payment_id
FROM public.donations
ORDER BY created_at DESC
LIMIT 20;

-- Последние 20 вебхуков
SELECT created_at, event, object_status, result, source_ip, object_id, donation_id
FROM public.webhook_logs
ORDER BY created_at DESC
LIMIT 20;`}</code>
                </pre>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
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
