import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Repeat, TrendingUp, AlertTriangle, CheckCircle2, PauseCircle,
  Wallet, RefreshCw, Activity, Clock, ExternalLink, FlaskConical,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip,
} from "recharts";
import { toast } from "sonner";
import { formatRub, formatDateTime } from "@/lib/donor-format";
import { attemptMeta } from "@/lib/recurring-format";
import { cn } from "@/lib/utils";

type Metrics = {
  active: number; paused: number; past_due: number; canceled: number;
  mrr_rub: number;
  attempts_30d: number; failed_30d: number; failed_rate_30d: number;
  recovered_30d: number; avg_lifetime_days: number;
  mock_count?: number; mock_active?: number; mock_mrr_rub?: number;
};
type Overview = {
  metrics: Metrics;
  recent_failures: any[];
  recoveries: any[];
  stuck_billing: any[];
  old_pending_donations: any[];
  generated_at: string;
};

export default function AdminRecurring() {
  const [data, setData] = useState<Overview | null>(null);
  const [chartData, setChartData] = useState<{ day: string; success: number; failed: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data: ov, error } = await supabase.functions.invoke("admin-recurring", {
      body: { action: "overview" },
    });
    if (error) {
      toast.error("Не удалось загрузить дашборд", { description: error.message });
    } else {
      setData(ov as Overview);
    }
    // Chart: attempts per day for last 14 days (admin RLS allows SELECT)
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data: attempts } = await (supabase as any)
      .from("subscription_charge_attempts")
      .select("status, created_at")
      .gt("created_at", since)
      .limit(2000);
    setChartData(buildChart(attempts ?? []));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Repeat className="w-6 h-6 text-primary" /> Регулярные пожертвования
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Метрики, ошибки и инструменты поддержки. Обновляется каждую минуту.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="rounded-full gap-2">
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} /> Обновить
        </Button>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : data ? (
        <>
          <KpiGrid m={data.metrics} />

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Списания за 14 дней
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="g-ok" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g-fail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RTooltip />
                    <Area type="monotone" dataKey="success" name="Успешно"
                      stroke="hsl(160 84% 39%)" fill="url(#g-ok)" strokeWidth={2} />
                    <Area type="monotone" dataKey="failed" name="Ошибки"
                      stroke="hsl(0 72% 51%)" fill="url(#g-fail)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <FailuresTable rows={data.recent_failures} />
            <RecoveriesTable rows={data.recoveries} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <StuckTable rows={data.stuck_billing} />
            <OldPendingTable rows={data.old_pending_donations} />
          </div>

          <p className="text-xs text-muted-foreground text-right">
            Снимок: {formatDateTime(data.generated_at)}
          </p>
        </>
      ) : null}
    </div>
  );
}

function buildChart(rows: { status: string; created_at: string }[]) {
  const buckets = new Map<string, { success: number; failed: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const k = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(k, { success: 0, failed: 0 });
  }
  for (const r of rows) {
    const d = new Date(r.created_at);
    const k = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(k);
    if (!b) continue;
    if (r.status === "succeeded") b.success += 1;
    else if (["create_failed", "network_error", "retry_scheduled", "past_due", "failed", "paused"].includes(r.status)) b.failed += 1;
  }
  return Array.from(buckets.entries()).map(([day, v]) => ({ day, ...v }));
}

function KpiGrid({ m }: { m: Metrics }) {
  const items = [
    { label: "Активных подписок", value: m.active, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "MRR", value: formatRub(m.mrr_rub), icon: Wallet, tone: "text-primary" },
    { label: "Past due", value: m.past_due, icon: AlertTriangle, tone: "text-amber-600" },
    { label: "На паузе", value: m.paused, icon: PauseCircle, tone: "text-slate-500" },
    { label: "Ошибки 30д", value: `${m.failed_30d} / ${m.attempts_30d}`,
      sub: `${m.failed_rate_30d}% сбойных`, icon: TrendingUp, tone: "text-rose-600" },
    { label: "Восстановлено 30д", value: m.recovered_30d, icon: Repeat, tone: "text-emerald-600" },
    { label: "Mock подписок",
      value: `${m.mock_active ?? 0} / ${m.mock_count ?? 0}`,
      sub: "активных / всего",
      icon: FlaskConical, tone: "text-amber-600" },
    { label: "Mock MRR",
      value: formatRub(m.mock_mrr_rub ?? 0),
      sub: "не учитывается в реальном MRR",
      icon: FlaskConical, tone: "text-amber-600" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <Card key={it.label} className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center", it.tone)}>
              <it.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="font-semibold text-lg leading-tight">{it.value}</div>
              {(it as any).sub && <div className="text-xs text-muted-foreground">{(it as any).sub}</div>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SubLink({ id }: { id: string }) {
  return (
    <Link to={`/admin/recurring/${id}`} className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1">
      {id.slice(0, 8)}<ExternalLink className="w-3 h-3" />
    </Link>
  );
}

function FailuresTable({ rows }: { rows: any[] }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" /> Недавние ошибки
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <Empty text="Ошибок не зафиксировано" /> : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {rows.map((r, i) => {
              const m = attemptMeta(r.status);
              return (
                <li key={i} className="text-sm border border-border rounded-xl p-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("rounded-full text-[11px] border-transparent", m.tone)}>
                        {m.label}
                      </Badge>
                      <SubLink id={r.subscription_id} />
                      <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                    </div>
                    {r.error_description && (
                      <p className="text-xs text-rose-600 mt-1 line-clamp-2">{r.error_description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecoveriesTable({ rows }: { rows: any[] }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Восстановления
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <Empty text="За 30 дней нет восстановлений" /> : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {rows.map((r, i) => (
              <li key={i} className="text-sm border border-border rounded-xl p-2.5 flex items-center gap-3 justify-between">
                <SubLink id={r.subscription_id} />
                <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StuckTable({ rows }: { rows: any[] }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" /> Зависшие списания
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <Empty text="Все чисто" /> : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {rows.map((r, i) => (
              <li key={i} className="text-sm border border-border rounded-xl p-2.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <SubLink id={r.id} />
                  <span className="text-xs">{formatRub(Number(r.amount))} / {r.interval}</span>
                  <span className="text-xs text-muted-foreground">{r.status}</span>
                </div>
                {r.processing_at && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Lock: {formatDateTime(r.processing_at)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OldPendingTable({ rows }: { rows: any[] }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-600" /> Старые pending (recurring)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <Empty text="Бэклога нет" /> : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} className="text-sm border border-border rounded-xl p-2.5 flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>
                <span className="text-xs">{formatRub(Number(r.amount))}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{text}</p>;
}