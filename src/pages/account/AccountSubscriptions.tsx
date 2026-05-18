import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pause, Play, X, RotateCw, HeartHandshake, ArrowRight, Calendar, Clock,
  CreditCard, History, AlertCircle, CheckCircle2, Info, ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  useRecurringSubscriptions, fetchChargeAttempts, donorPause, donorResume, donorCancel, donorRetryNow,
  type RecurringSubscription, type ChargeAttempt,
} from "@/hooks/useRecurringSubscriptions";
import { supabase } from "@/integrations/supabase/client";
import { formatRub, formatDateTime, formatDate } from "@/lib/donor-format";
import {
  STATUS_META, frequencyLabel, formatCard, formatDistanceToNowRu, attemptMeta,
} from "@/lib/recurring-format";
import { cn } from "@/lib/utils";

export default function AccountSubscriptions() {
  const { data, loading, refetch } = useRecurringSubscriptions(30000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<RecurringSubscription | null>(null);
  const [historyOf, setHistoryOf] = useState<RecurringSubscription | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showHistory, setShowHistory] = useState(false);

  // tick every minute for countdown UI
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const wrap = async (id: string, fn: () => Promise<void>, success: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(success);
      await refetch();
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("rate_limited")) toast.error("Подождите немного перед следующей попыткой");
      else toast.error("Не удалось выполнить действие", { description: msg });
    } finally {
      setBusyId(null);
    }
  };

  const activeSubs = data.filter((s) => s.status !== "canceled");
  const canceledSubs = data.filter((s) => s.status === "canceled");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Регулярная поддержка</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Управляйте своими подписками: ставьте на паузу, возобновляйте или отменяйте.
          </p>
        </div>
        {activeSubs.length > 0 && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/#donate"><HeartHandshake className="w-4 h-4" /> Оформить ещё</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : activeSubs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          {activeSubs.map((s) => (
            <SubscriptionCard
              key={s.id}
              s={s}
              busy={busyId === s.id}
              now={now}
              onPause={() => wrap(s.id, () => donorPause(s.id), "Подписка поставлена на паузу")}
              onResume={() => wrap(s.id, () => donorResume(s.id), "Подписка возобновлена")}
              onRetry={() => wrap(s.id, () => donorRetryNow(s.id), "Запустили повторную попытку списания")}
              onCancel={() => setConfirmCancel(s)}
              onHistory={() => setHistoryOf(s)}
            />
          ))}
        </div>
      )}

      {canceledSubs.length > 0 && (
        <Collapsible open={showHistory} onOpenChange={setShowHistory} className="pt-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <History className="w-4 h-4" />
              История подписок ({canceledSubs.length})
              <ChevronDown className={cn("w-4 h-4 transition-transform", showHistory && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-4 mt-4">
            {canceledSubs.map((s) => (
              <SubscriptionCard
                key={s.id}
                s={s}
                busy={busyId === s.id}
                now={now}
                onPause={() => {}}
                onResume={() => {}}
                onRetry={() => {}}
                onCancel={() => {}}
                onHistory={() => setHistoryOf(s)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить регулярную поддержку?</AlertDialogTitle>
            <AlertDialogDescription>
              Автосписания прекратятся. Вы сможете в любой момент оформить новую подписку.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmCancel) return;
                const id = confirmCancel.id;
                setConfirmCancel(null);
                await wrap(id, () => donorCancel(id), "Регулярная поддержка отменена");
              }}
            >
              Отменить подписку
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HistoryDialog s={historyOf} onClose={() => setHistoryOf(null)} />
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed border-2 border-border bg-gradient-to-br from-background to-secondary/30 rounded-2xl">
      <CardContent className="text-center py-14 space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
          <HeartHandshake className="w-7 h-7 text-primary" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <p className="font-semibold text-lg">У вас пока нет активных регулярных пожертвований</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Регулярные пожертвования помогают фонду планировать помощь на месяцы вперёд.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full">
          <Link to="/#donate">Оформить поддержку <ArrowRight className="w-4 h-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({
  s, busy, now, onPause, onResume, onRetry, onCancel, onHistory,
}: {
  s: RecurringSubscription;
  busy: boolean;
  now: number;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onHistory: () => void;
}) {
  const meta = STATUS_META[s.status] ?? STATUS_META.active;
  const isActive = s.status === "active";
  const isPaused = s.status === "paused";
  const isPastDue = s.status === "past_due";
  const isCanceled = s.status === "canceled";

  const nextPaymentText = s.next_payment_at
    ? formatDistanceToNowRu(s.next_payment_at)
    : "—";

  return (
    <Card className="rounded-2xl border-border overflow-hidden">
      <CardContent className="p-5 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl md:text-3xl font-bold tracking-tight">
                {formatRub(Number(s.amount))}
              </span>
              <span className="text-sm text-muted-foreground">/ {frequencyLabel(s.frequency)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Оформлена {formatDate(s.created_at)}
            </p>
          </div>
          <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs font-medium", meta.tone)}>
            {meta.label}
          </Badge>
        </div>

        {/* Explainer */}
        <div className="flex gap-2.5 rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
          <span>{meta.explainer}</span>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <Meta icon={Calendar} label="Следующее списание"
            value={isCanceled ? "—" : isPaused ? "На паузе" : nextPaymentText}
            sub={s.next_payment_at && !isCanceled && !isPaused ? formatDateTime(s.next_payment_at) : undefined}
          />
          <Meta icon={CheckCircle2} label="Последнее списание"
            value={s.last_charge_at ? formatDate(s.last_charge_at) : "Ещё не было"}
          />
          <Meta icon={CreditCard} label="Метод оплаты"
            value={formatCard(s.card_type, s.card_last4)}
            sub={s.card_expiry || undefined}
          />
        </div>

        {/* Past-due countdown banner */}
        {isPastDue && s.next_payment_at && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              Повторная попытка списания {formatDistanceToNowRu(s.next_payment_at)}.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <Button variant="ghost" size="sm" onClick={onHistory} className="text-muted-foreground gap-2">
            <History className="w-4 h-4" /> История списаний
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            {isPastDue && (
              <Button size="sm" variant="outline" onClick={onRetry} disabled={busy} className="rounded-full gap-2">
                <RotateCw className={cn("w-4 h-4", busy && "animate-spin")} /> Попробовать сейчас
              </Button>
            )}
            {(isActive || isPastDue) && (
              <Button size="sm" variant="outline" onClick={onPause} disabled={busy} className="rounded-full gap-2">
                <Pause className="w-4 h-4" /> Пауза
              </Button>
            )}
            {isPaused && (
              <Button size="sm" onClick={onResume} disabled={busy} className="rounded-full gap-2">
                <Play className="w-4 h-4" /> Возобновить
              </Button>
            )}
            {!isCanceled && (
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}
                className="rounded-full gap-2 text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" /> Отменить
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Meta({
  icon: Icon, label, value, sub,
}: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 font-medium text-foreground truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function HistoryDialog({ s, onClose }: { s: RecurringSubscription | null; onClose: () => void }) {
  const [items, setItems] = useState<ChargeAttempt[] | null>(null);
  const [donationMap, setDonationMap] = useState<Record<string, { amount: number; paid_at: string | null; status: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!s) { setItems(null); setDonationMap({}); setError(null); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const attempts = await fetchChargeAttempts(s.id);
        if (cancelled) return;
        setItems(attempts);
        const ids = attempts.map((a) => a.donation_id).filter(Boolean) as string[];
        if (ids.length > 0) {
          const { data: donations } = await supabase
            .from("donations")
            .select("id, amount, paid_at, status")
            .in("id", ids);
          if (!cancelled && donations) {
            const map: Record<string, { amount: number; paid_at: string | null; status: string }> = {};
            donations.forEach((d: any) => { map[d.id] = { amount: Number(d.amount), paid_at: d.paid_at, status: d.status }; });
            setDonationMap(map);
          }
        } else {
          setDonationMap({});
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("[history] load error", e);
          setError(e?.message || "Не удалось загрузить историю");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Refresh every 20s while dialog is open
    const t = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [s]);

  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>История списаний</DialogTitle>
          <DialogDescription>
            Все попытки автосписаний по этой подписке.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-rose-600">
            <AlertCircle className="w-5 h-5 mx-auto mb-2" />
            {error}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Пока нет попыток списания.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => {
              const m = attemptMeta(a.status);
              const d = a.donation_id ? donationMap[a.donation_id] : undefined;
              return (
                <li key={a.id}
                  className="rounded-xl border border-border bg-background p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("rounded-full text-xs border-transparent", m.tone)}>
                        {m.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(d?.paid_at || a.created_at)}</span>
                    </div>
                    {a.error_description && (
                      <p className="mt-1.5 text-xs text-rose-600 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="break-words">{a.error_description}</span>
                      </p>
                    )}
                    {a.yookassa_payment_id && (
                      <p className="mt-1 text-[11px] text-muted-foreground font-mono truncate">
                        ID: {a.yookassa_payment_id}
                      </p>
                    )}
                  </div>
                  {d && (
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-foreground">{formatRub(d.amount)}</div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}