import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDonorDonations } from "@/hooks/useDonorData";
import { formatRub, formatDate } from "@/lib/donor-format";
import { Heart, Search, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PAGE = 20;

export default function AccountDonations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useDonorDonations();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkStep, setLinkStep] = useState<"intro" | "code">("intro");
  const [code, setCode] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  const filtered = useMemo(() => {
    let rows = (data ?? []).filter((r) => r.status === "succeeded");
    if (typeFilter === "recurring") rows = rows.filter((r) => r.is_recurring);
    if (typeFilter === "one_time") rows = rows.filter((r) => !r.is_recurring);
    return rows;
  }, [data, typeFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice((page - 1) * PAGE, page * PAGE);

  const requestCode = async () => {
    if (!user) return;
    setLinkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "request-donation-link-code",
        { body: {} }
      );
      if (error) {
        // Try to extract structured error from response
        let code: string | undefined;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            code = body?.error;
          }
        } catch { /* ignore */ }
        if (code === "rate_limited") {
          toast({
            title: "Подождите немного",
            description: "Новый код можно запросить не чаще одного раза в минуту.",
            variant: "destructive",
          });
        } else if (code === "no_email") {
          toast({
            title: "Нет email",
            description: "К вашему аккаунту не привязан email.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Не удалось отправить код",
            description: "Попробуйте ещё раз через минуту.",
            variant: "destructive",
          });
        }
        return;
      }
      if ((data as any)?.success) {
        toast({
          title: "Код отправлен",
          description: `Мы отправили 6-значный код на ${user.email}. Срок действия — 15 минут.`,
        });
        setLinkStep("code");
      } else {
        toast({
          title: "Не удалось отправить код",
          description: "Попробуйте ещё раз позже.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Ошибка",
        description: "Не удалось запросить код. Попробуйте ещё раз.",
        variant: "destructive",
      });
    } finally {
      setLinkLoading(false);
    }
  };

  const confirmLink = async () => {
    if (!user || !code) return;
    setLinkLoading(true);
    try {
      const { data: count, error } = await supabase.rpc("confirm_link_donations", { _user_id: user.id, _code: code.trim() });
      if (error) throw error;
      toast({ title: "Готово", description: `Привязано пожертвований: ${count ?? 0}` });
      setLinkOpen(false);
      setLinkStep("intro");
      setCode("");
      qc.invalidateQueries({ queryKey: ["donor-donations"] });
      qc.invalidateQueries({ queryKey: ["user-achievements"] });
    } catch (e) {
      const msg = (e as Error).message || "";
      let description = "Попробуйте ещё раз.";
      if (msg.includes("invalid_code")) description = "Неверный код. Проверьте и попробуйте снова.";
      else if (msg.includes("code_expired")) description = "Срок действия кода истёк. Запросите новый код.";
      else if (msg.includes("too_many_attempts")) {
        description = "Слишком много неверных попыток. Запросите новый код.";
        setLinkStep("intro");
        setCode("");
      }
      toast({ title: "Не удалось привязать", description, variant: "destructive" });
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Мои пожертвования</h1>
          <p className="text-muted-foreground mt-1 text-sm">История всех ваших вкладов в фонд.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
          <Search className="w-4 h-4 mr-2" /> Найти мои прошлые пожертвования
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg">История</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="one_time">Разовые</SelectItem>
                <SelectItem value="recurring">Регулярные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : error ? (
            <p className="text-sm text-destructive">Не удалось загрузить пожертвования.</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Heart className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-medium">Пока пусто</p>
              <p className="text-sm text-muted-foreground">У вас пока нет успешных пожертвований.</p>
              <Button asChild><Link to="/#donate">Сделать первое пожертвование</Link></Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Сбор</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead className="hidden md:table-cell">Тип</TableHead>
                      <TableHead className="hidden md:table-cell">Публичность</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(d.paid_at ?? d.created_at)}</TableCell>
                        <TableCell className="text-sm">{d.campaign?.title ?? "Общий вклад"}</TableCell>
                        <TableCell className="font-semibold">{formatRub(d.amount)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{d.is_recurring ? "Регулярный" : "Разовый"}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{d.is_anonymous ? "Анонимно" : "Публично"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">Страница {page} из {pages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={linkOpen} onOpenChange={(v) => { setLinkOpen(v); if (!v) { setLinkStep("intro"); setCode(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Привязать прошлые пожертвования</DialogTitle>
            <DialogDescription>
              Мы найдём успешные пожертвования, сделанные с email <b>{user?.email}</b>, и привяжем их к вашему аккаунту.
            </DialogDescription>
          </DialogHeader>
          {linkStep === "intro" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Для подтверждения мы сгенерируем одноразовый код. Срок действия — 15 минут.
              </p>
              <Button onClick={requestCode} disabled={linkLoading} className="w-full">
                <Mail className="w-4 h-4 mr-2" /> Получить код подтверждения
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input placeholder="Введите 6-значный код" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))} />
              <Button onClick={confirmLink} disabled={linkLoading || code.length !== 6} className="w-full">
                Подтвердить и привязать
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}