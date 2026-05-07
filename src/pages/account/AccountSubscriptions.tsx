import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDonorSubscriptions, useUpdateSubscription } from "@/hooks/useDonorData";
import { formatRub, formatDate, intervalLabel } from "@/lib/donor-format";
import { Repeat, Pause, Play, X, Sparkles, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const statusMeta = {
  active:   { label: "Активна",  Icon: CheckCircle2, badge: "default" as const,  ring: "ring-primary/20", glow: "shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.25)]" },
  paused:   { label: "На паузе", Icon: PauseCircle,  badge: "secondary" as const, ring: "ring-border",     glow: "" },
  canceled: { label: "Отменена", Icon: XCircle,      badge: "outline" as const,   ring: "ring-border",     glow: "" },
};

export default function AccountSubscriptions() {
  const { data, isLoading } = useDonorSubscriptions();
  const update = useUpdateSubscription();

  const handlePause = async (id: string) => {
    await update.mutateAsync({ id, patch: { status: "paused", paused_at: new Date().toISOString() } });
    toast({ title: "Поставлено на паузу" });
  };
  const handleResume = async (id: string) => {
    await update.mutateAsync({ id, patch: { status: "active", paused_at: null } });
    toast({ title: "Возобновлено" });
  };
  const handleCancel = async (id: string) => {
    if (!confirm("Отменить регулярную помощь?")) return;
    await update.mutateAsync({ id, patch: { status: "canceled", canceled_at: new Date().toISOString() } });
    toast({ title: "Отменено" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Регулярная помощь</h1>
        <p className="text-muted-foreground mt-1 text-sm">Ваши подписки на регулярные пожертвования.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (data ?? []).length === 0 ? (
        <Card className="border-border">
          <CardContent className="text-center py-12 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <Repeat className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-medium">У вас пока нет регулярных пожертвований</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Регулярная помощь появится здесь после оформления подписки. Подключение готовится — мы скоро откроем эту возможность.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {(data ?? []).map((s) => {
              const meta = statusMeta[s.status as keyof typeof statusMeta] ?? statusMeta.canceled;
              const StatusIcon = meta.Icon;
              return (
                <Card
                  key={s.id}
                  className={cn(
                    "border-border bg-background/80 backdrop-blur-sm rounded-2xl ring-1 transition-all hover:shadow-lg",
                    meta.ring,
                    meta.glow,
                  )}
                >
                  <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-3 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                        <Repeat className="w-5 h-5 text-primary" />
                        {s.status === "active" && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg leading-tight">
                          {formatRub(s.amount)} <span className="text-muted-foreground font-medium">· {intervalLabel(s.interval)}</span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Оформлена {formatDate(s.created_at)}</p>
                      </div>
                    </div>
                    <Badge variant={meta.badge} className="gap-1.5 px-2.5 py-1 rounded-full">
                      <StatusIcon className="w-3.5 h-3.5" />
                      {meta.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                      {s.status === "active" && s.next_payment_at && (
                        <>Следующая поддержка: <span className="text-foreground font-medium">{formatDate(s.next_payment_at)}</span></>
                      )}
                      {s.status === "paused" && s.paused_at && (
                        <>На паузе с <span className="text-foreground font-medium">{formatDate(s.paused_at)}</span></>
                      )}
                      {s.status === "canceled" && s.canceled_at && (
                        <>Отменена <span className="text-foreground font-medium">{formatDate(s.canceled_at)}</span></>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => handlePause(s.id)}>
                            <Pause className="w-4 h-4 mr-1.5" /> Пауза
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleCancel(s.id)}>
                            <X className="w-4 h-4 mr-1.5" /> Отменить
                          </Button>
                        </>
                      )}
                      {s.status === "paused" && (
                        <>
                          <Button size="sm" className="rounded-full" onClick={() => handleResume(s.id)}>
                            <Play className="w-4 h-4 mr-1.5" /> Возобновить
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleCancel(s.id)}>
                            <X className="w-4 h-4 mr-1.5" /> Отменить
                          </Button>
                        </>
                      )}
                    </div>
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
    </div>
  );
}