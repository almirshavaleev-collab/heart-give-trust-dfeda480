import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, RotateCw, Play, X, RefreshCw, Repeat, History, Activity, User,
  AlertTriangle, CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { formatRub, formatDateTime, formatDate } from "@/lib/donor-format";
import {
  STATUS_META, frequencyLabel, formatCard, attemptMeta, formatDistanceToNowRu,
} from "@/lib/recurring-format";
import { cn } from "@/lib/utils";

export default function AdminRecurringDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const [sub, setSub] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, a, e] = await Promise.all([
      (supabase as any).from("donor_subscriptions").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("subscription_charge_attempts").select("*")
        .eq("subscription_id", id).order("created_at", { ascending: false }).limit(100),
      (supabase as any).from("subscription_events").select("*")
        .eq("subscription_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    setSub(s.data);
    setAttempts(a.data ?? []);
    setEvents(e.data ?? []);
    if (s.data?.user_id) {
      const { data: p } = await (supabase as any)
        .from("profiles").select("user_id, email, full_name, phone")
        .eq("user_id", s.data.user_id).maybeSingle();
      setProfile(p);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const action = async (act: string, label: string) => {
    setBusy(act);
    const { data, error } = await supabase.functions.invoke("admin-recurring", {
      body: { action: act, subscription_id: id },
    });
    setBusy(null);
    if (error || !(data as any)?.ok) {
      toast.error("Не удалось", { description: (data as any)?.error || error?.message });
    } else {
      toast.success(label);
      load();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (!sub) {
    return (
      <div className="space-y-3">
        <Link to="/admin/recurring" className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> К дашборду
        </Link>
        <p className="text-muted-foreground">Подписка не найдена.</p>
      </div>
    );
  }

  const meta = STATUS_META[sub.status as keyof typeof STATUS_META] ?? STATUS_META.active;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/admin/recurring" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> К дашборду
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{sub.id}</span>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-5 md:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-3xl font-bold">{formatRub(Number(sub.amount))}</span>
                <span className="text-muted-foreground">/ {frequencyLabel(sub.interval)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Создана {formatDate(sub.created_at)}
              </p>
            </div>
            <Badge variant="outline" className={cn("rounded-full px-3 py-1", meta.tone)}>{meta.label}</Badge>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <Field label="Следующее списание"
              value={sub.next_payment_at ? formatDateTime(sub.next_payment_at) : "—"}
              sub={sub.next_payment_at ? formatDistanceToNowRu(sub.next_payment_at) : undefined} />
            <Field label="Последнее списание"
              value={sub.last_charge_at ? formatDateTime(sub.last_charge_at) : "—"} />
            <Field icon={CreditCard} label="Карта" value={formatCard(sub.card_type, sub.card_last4)}
              sub={sub.card_expiry || undefined} />
            <Field label="Попытки/ошибки"
              value={`${sub.retry_count ?? 0}`}
              sub={sub.last_failure_reason || undefined} />
          </div>

          {sub.current_billing_key && (
            <div className="flex items-center gap-2 text-xs rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-amber-900">
              <AlertTriangle className="w-4 h-4" />
              <span>Активный billing lock: <span className="font-mono">{sub.current_billing_key}</span></span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {sub.status !== "canceled" && (
              <Button size="sm" variant="outline" disabled={!!busy}
                onClick={() => action("retry_now", "Запланирована повторная попытка")}
                className="rounded-full gap-2">
                <RotateCw className={cn("w-4 h-4", busy === "retry_now" && "animate-spin")} /> Retry now
              </Button>
            )}
            {(sub.status === "paused" || sub.status === "past_due") && (
              <Button size="sm" disabled={!!busy}
                onClick={() => action("resume_subscription", "Подписка возобновлена")}
                className="rounded-full gap-2"><Play className="w-4 h-4" /> Resume</Button>
            )}
            {sub.status !== "canceled" && (
              <Button size="sm" variant="ghost" disabled={!!busy}
                onClick={() => action("cancel_subscription", "Подписка отменена")}
                className="rounded-full gap-2 text-destructive">
                <X className="w-4 h-4" /> Cancel
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!!busy}
              onClick={() => action("force_reconcile_subscription", "Reconcile запущен")}
              className="rounded-full gap-2">
              <RefreshCw className={cn("w-4 h-4", busy === "force_reconcile_subscription" && "animate-spin")} /> Reconcile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> Донор
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Имя:</span> {profile?.full_name || "—"}</div>
          <div><span className="text-muted-foreground">Email:</span> {profile?.email || "—"}</div>
          <div><span className="text-muted-foreground">Телефон:</span> {profile?.phone || "—"}</div>
          <div className="font-mono text-xs text-muted-foreground pt-1">user_id: {sub.user_id}</div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Попытки списания
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Пока нет попыток</p>
            ) : (
              <ul className="space-y-2 max-h-[480px] overflow-y-auto">
                {attempts.map((a) => {
                  const m = attemptMeta(a.status);
                  return (
                    <li key={a.id} className="text-sm border border-border rounded-xl p-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("rounded-full text-[11px] border-transparent", m.tone)}>
                          {m.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                      </div>
                      {a.error_description && (
                        <p className="text-xs text-rose-600 mt-1">{a.error_description}</p>
                      )}
                      {a.yookassa_payment_id && (
                        <p className="text-[11px] text-muted-foreground font-mono mt-1 truncate">
                          {a.yookassa_payment_id}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> События
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Событий ещё нет</p>
            ) : (
              <ul className="space-y-2 max-h-[480px] overflow-y-auto">
                {events.map((e) => (
                  <li key={e.id} className="text-sm border border-border rounded-xl p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        <Repeat className="w-3 h-3 mr-1" /> {e.event_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
                    </div>
                    {e.metadata && Object.keys(e.metadata).length > 0 && (
                      <pre className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                        {JSON.stringify(e.metadata, null, 0)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label, value, sub, icon: Icon,
}: { label: string; value: string; sub?: string; icon?: any }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </div>
      <div className="font-medium mt-1 truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}