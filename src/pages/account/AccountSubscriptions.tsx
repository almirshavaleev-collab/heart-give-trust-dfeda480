import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDonorSubscriptions, useUpdateSubscription } from "@/hooks/useDonorData";
import { formatRub, formatDate, intervalLabel } from "@/lib/donor-format";
import { Repeat, Pause, Play, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
        <div className="grid gap-4">
          {(data ?? []).map((s) => (
            <Card key={s.id} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{formatRub(s.amount)} · {intervalLabel(s.interval)}</CardTitle>
                    <p className="text-xs text-muted-foreground">Создано {formatDate(s.created_at)}</p>
                  </div>
                </div>
                <Badge variant={s.status === "active" ? "default" : s.status === "paused" ? "secondary" : "outline"}>
                  {s.status === "active" ? "Активна" : s.status === "paused" ? "На паузе" : "Отменена"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {s.status === "active" && s.next_payment_at && <>Следующее списание: <b>{formatDate(s.next_payment_at)}</b></>}
                  {s.status === "paused" && s.paused_at && <>На паузе с {formatDate(s.paused_at)}</>}
                  {s.status === "canceled" && s.canceled_at && <>Отменена {formatDate(s.canceled_at)}</>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {s.status === "active" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handlePause(s.id)}><Pause className="w-4 h-4 mr-1" /> Пауза</Button>
                      <Button size="sm" variant="outline" onClick={() => handleCancel(s.id)}><X className="w-4 h-4 mr-1" /> Отменить</Button>
                    </>
                  )}
                  {s.status === "paused" && (
                    <>
                      <Button size="sm" onClick={() => handleResume(s.id)}><Play className="w-4 h-4 mr-1" /> Возобновить</Button>
                      <Button size="sm" variant="outline" onClick={() => handleCancel(s.id)}><X className="w-4 h-4 mr-1" /> Отменить</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}