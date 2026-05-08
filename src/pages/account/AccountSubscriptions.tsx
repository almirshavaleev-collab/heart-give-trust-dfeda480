import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSubscriptionsLocal } from "@/hooks/useSubscriptionsLocal";
import {
  DonorSubscription, FREQUENCY_LABEL, SubscriptionFrequency,
} from "@/lib/subscriptions-repo";
import { formatRub, formatDate } from "@/lib/donor-format";
import {
  Repeat, Pause, Play, X, Sparkles, CheckCircle2, PauseCircle, XCircle,
  Pencil, HeartHandshake, ArrowRight, Calendar, Clock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const statusMeta = {
  active: {
    label: "Активна", Icon: CheckCircle2,
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-200/60",
    glow: "shadow-[0_10px_40px_-12px_rgba(16,185,129,0.25)]",
  },
  paused: {
    label: "На паузе", Icon: PauseCircle,
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    ring: "ring-amber-200/60", glow: "",
  },
  canceled: {
    label: "Отменена", Icon: XCircle,
    badgeClass: "bg-muted text-muted-foreground border-border",
    ring: "ring-border", glow: "",
  },
};

const FREQUENCIES: SubscriptionFrequency[] = ["weekly", "biweekly", "monthly"];

export default function AccountSubscriptions() {
  const { data, loading, pause, resume, cancel, edit, remove } = useSubscriptionsLocal();
  const [editing, setEditing] = useState<DonorSubscription | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<DonorSubscription | null>(null);

  const handlePause = async (s: DonorSubscription) => {
    await pause(s.id);
    toast({ title: "Поставлено на паузу", description: "Мы остановили напоминания о платеже." });
  };
  const handleResume = async (s: DonorSubscription) => {
    await resume(s.id, s);
    toast({ title: "Подписка возобновлена" });
  };
  const handleCancel = async () => {
    if (!confirmCancel) return;
    await cancel(confirmCancel.id);
    setConfirmCancel(null);
    toast({ title: "Регулярная поддержка отменена" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Регулярная поддержка</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Управляйте подписками: меняйте сумму, периодичность, ставьте на паузу или отменяйте.
          </p>
        </div>
        {data.length > 0 && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/#donate"><HeartHandshake className="w-4 h-4" /> Оформить ещё</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : data.length === 0 ? (
        <Card className="border-dashed border-2 border-border bg-gradient-to-br from-background to-secondary/30 rounded-2xl">
          <CardContent className="text-center py-14 space-y-5">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
              <HeartHandshake className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <p className="font-semibold text-lg">У вас пока нет регулярной поддержки</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Оформите подписку — это поможет фонду планировать программы и помогать стабильно.
              </p>
            </div>
            <Button asChild size="lg" className="rounded-full">
              <Link to="/#donate">
                Оформить поддержку <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {data.map((s) => {
              const meta = statusMeta[s.status];
              const StatusIcon = meta.Icon;
              return (
                <Card
                  key={s.id}
                  className={cn(
                    "border-border bg-background/70 backdrop-blur-md rounded-2xl ring-1 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5",
                    meta.ring, meta.glow,
                  )}
                >
                  <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-3 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                        <Repeat className="w-5 h-5 text-primary" />
                        {s.status === "active" && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg leading-tight">
                          {formatRub(s.amount)} <span className="text-muted-foreground font-medium">· {FREQUENCY_LABEL[s.frequency]}</span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Оформлена {formatDate(s.created_at)}
                          {s.campaign_title && <> · {s.campaign_title}</>}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("gap-1.5 px-2.5 py-1 rounded-full font-medium", meta.badgeClass)}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {meta.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoRow
                        icon={Calendar}
                        label="Следующий платёж"
                        value={s.status === "active" && s.next_payment_at ? formatDate(s.next_payment_at) : "—"}
                      />
                      <InfoRow
                        icon={Clock}
                        label="Последний платёж"
                        value={s.last_payment_at ? formatDate(s.last_payment_at) : "—"}
                      />
                    </div>

                    <ImpactText sub={s} />

                    {s.status !== "canceled" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {s.status === "active" && (
                          <>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => handlePause(s)}>
                              <Pause className="w-4 h-4" /> Пауза
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditing(s)}>
                              <Pencil className="w-4 h-4" /> Изменить
                            </Button>
                            <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => setConfirmCancel(s)}>
                              <X className="w-4 h-4" /> Отменить
                            </Button>
                          </>
                        )}
                        {s.status === "paused" && (
                          <>
                            <Button size="sm" className="rounded-full" onClick={() => handleResume(s)}>
                              <Play className="w-4 h-4" /> Возобновить
                            </Button>
                            <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => setConfirmCancel(s)}>
                              <X className="w-4 h-4" /> Отменить
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    {s.status === "canceled" && s.canceled_at && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-xs text-muted-foreground">
                          Отменена {formatDate(s.canceled_at)}
                        </p>
                        <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-destructive" onClick={async () => { await remove(s.id); toast({ title: "Удалено" }); }}>
                          Удалить из списка
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3">
            <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Регулярная поддержка пока работает через напоминания о повторном платеже и не является автоматическим списанием. Мы напомним вам, когда придёт время следующего взноса.
            </p>
          </div>
        </>
      )}

      <EditDialog
        sub={editing}
        onClose={() => setEditing(null)}
        onSave={async (id, patch) => {
          await edit(id, patch);
          setEditing(null);
          toast({ title: "Подписка обновлена" });
        }}
      />

      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить регулярную поддержку?</AlertDialogTitle>
            <AlertDialogDescription>
              Мы остановим напоминания о следующих платежах. Вы сможете оформить новую подписку в любой момент.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Не отменять</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Отменить подписку</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-secondary/40 px-3.5 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function ImpactText({ sub }: { sub: DonorSubscription }) {
  const perYear = sub.amount * (sub.frequency === "weekly" ? 52 : sub.frequency === "biweekly" ? 26 : 12);
  return (
    <p className="text-xs text-muted-foreground leading-relaxed">
      Ваш вклад за год — <span className="text-foreground font-medium">{formatRub(perYear)}</span>. Это помогает фонду планировать долгосрочные программы поддержки.
    </p>
  );
}

function EditDialog({
  sub, onClose, onSave,
}: {
  sub: DonorSubscription | null;
  onClose: () => void;
  onSave: (id: string, patch: { amount: number; frequency: SubscriptionFrequency }) => Promise<void>;
}) {
  const [amount, setAmount] = useState<number>(sub?.amount ?? 500);
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(sub?.frequency ?? "monthly");
  const [saving, setSaving] = useState(false);

  // Sync when opening with new sub
  if (sub && (amount === 0 || (sub.id !== editingRefId.current))) {
    editingRefId.current = sub.id;
    setAmount(sub.amount);
    setFrequency(sub.frequency);
  }

  if (!sub) return null;

  const valid = amount >= 1 && amount <= 500_000;

  return (
    <Dialog open={!!sub} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Изменить подписку</DialogTitle>
          <DialogDescription>Поменяйте сумму или периодичность. Дата следующего платежа будет пересчитана.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Сумма, ₽</Label>
            <Input
              id="edit-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={500_000}
              value={amount}
              onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Периодичность</Label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCIES.map((f) => {
                const active = frequency === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={cn(
                      "h-11 rounded-xl text-xs font-medium border transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border hover:border-foreground/30",
                    )}
                  >
                    {FREQUENCY_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true);
              try { await onSave(sub.id, { amount, frequency }); }
              finally { setSaving(false); }
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Track which sub is loaded into the dialog state to avoid stale form
const editingRefId: { current: string | null } = { current: null };