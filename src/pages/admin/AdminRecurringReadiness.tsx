import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCcw } from "lucide-react";

type Status = "healthy" | "degraded" | "critical" | "unknown";

interface Readiness {
  overall: Status;
  generated_at: string;
  components: Record<string, any>;
  flags?: Record<string, any>;
}

const statusTone: Record<Status, string> = {
  healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
  degraded: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-rose-100 text-rose-800 border-rose-200",
  unknown: "bg-muted text-muted-foreground border-border",
};

const statusLabel: Record<Status, string> = {
  healthy: "Норма",
  degraded: "Внимание",
  critical: "Критично",
  unknown: "Неизвестно",
};

function fmtDate(v: any): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("ru-RU"); } catch { return String(v); }
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={statusTone[status]}>
      {statusLabel[status]}
    </Badge>
  );
}

export default function AdminRecurringReadiness() {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("recurring-readiness", { method: "POST" });
    if (error) setError(error.message);
    else setData(data as Readiness);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Operational readiness
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Автоматический мониторинг recurring billing. Обновляется каждые 30 секунд.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && <StatusBadge status={(data.overall ?? "unknown") as Status} />}
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Обновить
          </Button>
        </div>
      </header>

      {error && (
        <Card className="p-4 border-rose-200 bg-rose-50 text-rose-800 text-sm">{error}</Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.components ?? {}).map(([key, comp]) => {
              const status = (comp?.status as Status) ?? "unknown";
              return (
                <Card key={key} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold capitalize">{labelFor(key)}</h3>
                    <StatusBadge status={status} />
                  </div>
                  <dl className="text-sm space-y-1 text-muted-foreground">
                    {renderEntries(key, comp)}
                  </dl>
                </Card>
              );
            })}
          </div>

          {data.flags && (
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Feature flags</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {Object.entries(data.flags).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Снимок сделан: {fmtDate(data.generated_at)}
          </p>
        </>
      )}
    </div>
  );
}

function labelFor(key: string): string {
  const map: Record<string, string> = {
    cron: "Cron jobs",
    webhook: "YooKassa webhook",
    locks: "Блокировки",
    orphans: "Orphan donations",
    retries: "Retries 24h",
    last_success: "Последний успех",
  };
  return map[key] ?? key;
}

function renderEntries(key: string, comp: any) {
  if (!comp || typeof comp !== "object") return <dd>{String(comp ?? "—")}</dd>;
  if (key === "cron") {
    const entries = Object.entries(comp);
    if (!entries.length) return <dd>Нет данных</dd>;
    return entries.map(([job, info]: [string, any]) => (
      <div key={job} className="flex justify-between gap-2">
        <span>{job}</span>
        <span className="font-mono text-xs">{fmtDate(info?.last_run_at)}</span>
      </div>
    ));
  }
  return Object.entries(comp).filter(([k]) => k !== "status").map(([k, v]) => (
    <div key={k} className="flex justify-between gap-2">
      <span>{k}</span>
      <span className="font-mono text-xs">
        {typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v) ? fmtDate(v) : String(v ?? "—")}
      </span>
    </div>
  ));
}
