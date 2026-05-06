import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown,
  ArrowUpDown,
  Target,
  HeartHandshake,
  Search,
  Download,
  Repeat,
  Mail,
  Phone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  yookassa_payment_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  user_id: string | null;
  campaign_id: string | null;
  is_anonymous: boolean;
  payment_type: string;
  created_at: string;
  paid_at: string | null;
};

type CampaignLite = { id: string; title: string };

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
  if (r === "accepted" || r === "accepted_with_campaign") return "default";
  if (r.startsWith("rejected") || r === "accepted_campaign_increment_failed") return "destructive";
  if (r.startsWith("ignored") || r === "already_processed") return "secondary";
  return "outline";
};

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

const fmtDateTime = (s: string) => new Date(s).toLocaleString("ru-RU");
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

function donorKey(d: DonationRow): string {
  if (d.user_id) return `u:${d.user_id}`;
  if (d.donor_email) return `e:${d.donor_email.toLowerCase()}`;
  if (d.donor_phone) return `p:${d.donor_phone}`;
  return `x:${d.id}`;
}

type DonorNote = {
  id: string;
  donor_key: string;
  note: string;
  created_at: string;
};

export default function AdminDonations() {
  const [allDonations, setAllDonations] = useState<DonationRow[]>([]);
  const [logs, setLogs] = useState<WebhookLogRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  const [loading, setLoading] = useState(true);

  const syncRecentPendingPayments = async () => {
    const { data, error } = await supabase.functions.invoke("sync-yookassa-payment", {
      body: { scope: "recent_pending", limit: 20 },
    });
    if (error) {
      console.error("donations payment sync error:", error);
    } else {
      console.log("donations payment sync result:", data);
    }
  };

  // Filters & sort
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all"); // all | general | campaign
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [anonFilter, setAnonFilter] = useState<string>("all"); // all | anon | named
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const refresh = async () => {
    const [d, l, c] = await Promise.all([
      (supabase as any)
        .from("donations")
        .select(
          "id, amount, status, yookassa_payment_id, donor_name, donor_email, donor_phone, user_id, campaign_id, is_anonymous, payment_type, created_at, paid_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      (supabase as any)
        .from("webhook_logs")
        .select("id, provider, event, source_ip, object_id, object_status, donation_id, result, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any).from("campaigns").select("id, title").order("title"),
    ]);
    if (d.error) console.error(d.error);
    if (l.error) console.error(l.error);
    if (c.error) console.error(c.error);
    setAllDonations((d.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })));
    setLogs(l.data ?? []);
    setCampaigns(c.data ?? []);
  };

  useEffect(() => {
    (async () => {
      await syncRecentPendingPayments();
      await refresh();
      setLoading(false);
    })();

    // Realtime: обновляем таблицу при любом изменении донатов и логов
    const channel = supabase
      .channel("admin-donations-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donations" },
        () => {
          refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "webhook_logs" },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const campaignTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of campaigns) m.set(c.id, c.title);
    return m;
  }, [campaigns]);

  const filteredDonations = useMemo(() => {
    let list = allDonations.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (typeFilter === "general" && d.campaign_id) return false;
      if (typeFilter === "campaign" && !d.campaign_id) return false;
      if (campaignFilter !== "all" && d.campaign_id !== campaignFilter) return false;
      if (anonFilter === "anon" && !d.is_anonymous) return false;
      if (anonFilter === "named" && d.is_anonymous) return false;
      if (paymentTypeFilter === "recurring") {
        if (d.payment_type !== "recurring" && d.payment_type !== "monthly") return false;
      } else if (paymentTypeFilter !== "all" && d.payment_type !== paymentTypeFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [
          d.donor_name,
          d.donor_email,
          d.donor_phone,
          d.yookassa_payment_id,
          campaignTitleById.get(d.campaign_id ?? "") ?? "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "amount") return (a.amount - b.amount) * dir;
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    });
    return list;
  }, [allDonations, statusFilter, typeFilter, campaignFilter, anonFilter, paymentTypeFilter, search, sortBy, sortDir, campaignTitleById]);

  // ---- Карточка донора (Sheet) ----
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [donorNotes, setDonorNotes] = useState<DonorNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const { toast } = useToast();

  const openDonor = useMemo(() => {
    if (!openKey) return null;
    const rows = allDonations.filter((d) => donorKey(d) === openKey);
    if (rows.length === 0) return null;
    const first = rows[0];
    const total = rows
      .filter((r) => r.status === "succeeded")
      .reduce((s, r) => s + r.amount, 0);
    return {
      key: openKey,
      user_id: first.user_id,
      name: first.is_anonymous ? "Аноним" : (first.donor_name || rows.find((r) => r.donor_name)?.donor_name || "—"),
      email: first.donor_email || rows.find((r) => r.donor_email)?.donor_email || null,
      phone: first.donor_phone || rows.find((r) => r.donor_phone)?.donor_phone || null,
      total,
      donations: rows,
    };
  }, [openKey, allDonations]);

  const loadNotes = async (key: string) => {
    const { data, error } = await (supabase as any)
      .from("donor_notes")
      .select("id, donor_key, note, created_at")
      .eq("donor_key", key)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setDonorNotes(data ?? []);
  };

  const handleOpenRow = async (d: DonationRow) => {
    const key = donorKey(d);
    setOpenKey(key);
    setNoteDraft("");
    setDonorNotes([]);
    await loadNotes(key);
  };

  const handleSaveNote = async () => {
    if (!openDonor || !noteDraft.trim()) return;
    setSavingNote(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("donor_notes").insert({
      donor_key: openDonor.key,
      donor_user_id: openDonor.user_id,
      donor_email: openDonor.email,
      donor_phone: openDonor.phone,
      note: noteDraft.trim(),
      created_by: userData.user?.id ?? null,
    });
    setSavingNote(false);
    if (error) {
      toast({ title: "Не удалось сохранить заметку", description: error.message, variant: "destructive" });
      return;
    }
    setNoteDraft("");
    await loadNotes(openDonor.key);
  };

  const handleDeleteNote = async (id: string) => {
    const { error } = await (supabase as any).from("donor_notes").delete().eq("id", id);
    if (error) {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
      return;
    }
    if (openDonor) await loadNotes(openDonor.key);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Донаты</h1>
          <p className="text-sm text-muted-foreground mt-1">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Донаты</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Операционный список платежей. Аналитика — на странице «Дашборд».
        </p>
      </div>

      {/* All donations — full table with filters */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-lg">Все пожертвования</h2>
            <p className="text-xs text-muted-foreground">
              Показано {filteredDonations.length} из {allDonations.length}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 self-start sm:self-auto"
            disabled={filteredDonations.length === 0}
            onClick={() => exportDonationsCSV(filteredDonations, campaignTitleById)}
          >
            <Download className="h-4 w-4" />
            Экспорт CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск: имя, email, телефон, ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="succeeded">Успешные</SelectItem>
              <SelectItem value="pending">В ожидании</SelectItem>
              <SelectItem value="canceled">Отменённые</SelectItem>
              <SelectItem value="failed">Ошибка</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Тип доната" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="general">Общий донат</SelectItem>
              <SelectItem value="campaign">В сбор</SelectItem>
            </SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger><SelectValue placeholder="Сбор" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все сборы</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anonFilter} onValueChange={setAnonFilter}>
            <SelectTrigger><SelectValue placeholder="Анонимность" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все донаты</SelectItem>
              <SelectItem value="anon">Только анонимные</SelectItem>
              <SelectItem value="named">С именем</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Тип платежа" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все платежи</SelectItem>
              <SelectItem value="one_time">Разовые</SelectItem>
              <SelectItem value="recurring">Подписки</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredDonations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет пожертвований по выбранным фильтрам</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => {
                        if (sortBy === "date") setSortDir(sortDir === "asc" ? "desc" : "asc");
                        else { setSortBy("date"); setSortDir("desc"); }
                      }}
                    >
                      Дата <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => {
                        if (sortBy === "amount") setSortDir(sortDir === "asc" ? "desc" : "asc");
                        else { setSortBy("amount"); setSortDir("desc"); }
                      }}
                    >
                      Сумма <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 pr-4 font-medium">Статус</th>
                  <th className="py-2 pr-4 font-medium">Тип</th>
                  <th className="py-2 pr-4 font-medium">Сбор</th>
                  <th className="py-2 pr-4 font-medium">Донор</th>
                  <th className="py-2 pr-4 font-medium">Контакты</th>
                  <th className="py-2 font-medium">Платёж</th>
                </tr>
              </thead>
              <tbody>
                {filteredDonations.slice(0, 200).map((d) => {
                  const campaignTitle = d.campaign_id ? campaignTitleById.get(d.campaign_id) : null;
                  const isRecurring = d.payment_type === "recurring" || d.payment_type === "monthly";
                  return (
                    <tr
                      key={d.id}
                      onClick={() => handleOpenRow(d)}
                      className={`border-b last:border-0 transition-colors align-top cursor-pointer ${
                        isRecurring ? "bg-primary/[0.04] hover:bg-primary/[0.08]" : "hover:bg-secondary/30"
                      }`}
                    >
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {fmtDateTime(d.created_at)}
                      </td>
                      <td className="py-3 pr-4 font-semibold whitespace-nowrap">{formatRub(d.amount)}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {d.campaign_id ? (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            <Target className="h-3 w-3 mr-1" /> В сбор
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <HeartHandshake className="h-3 w-3 mr-1" /> Общий
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 max-w-[200px] truncate">
                        {campaignTitle ? (
                          <span title={campaignTitle}>{campaignTitle}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {d.is_anonymous ? (
                          <span className="text-muted-foreground italic">Аноним</span>
                        ) : (
                          d.donor_name || <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {d.is_anonymous ? (
                          "—"
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {d.donor_email && <span>{d.donor_email}</span>}
                            {d.donor_phone && <span>{d.donor_phone}</span>}
                            {!d.donor_email && !d.donor_phone && "—"}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        {isRecurring ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-primary/40 bg-primary/10 text-primary"
                          >
                            <Repeat className="h-3 w-3 mr-1" /> Подписка
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Разовый
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredDonations.length > 200 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Показаны первые 200 записей. Уточните фильтры для просмотра остальных.
              </p>
            )}
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

      {/* Карточка донора */}
      <Sheet open={!!openDonor} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {openDonor && (
            <>
              <SheetHeader>
                <SheetTitle>{openDonor.name}</SheetTitle>
                <SheetDescription>
                  {openDonor.donations.length} платеж(ей) · сумма успешных {formatRub(openDonor.total)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-2 text-sm">
                {openDonor.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" /> {openDonor.email}
                  </div>
                )}
                {openDonor.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {openDonor.phone}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-2">Заметки</h3>
                <Textarea
                  placeholder="Добавить заметку о доноре..."
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={handleSaveNote} disabled={!noteDraft.trim() || savingNote}>
                    {savingNote ? "Сохранение..." : "Сохранить заметку"}
                  </Button>
                </div>

                {donorNotes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {donorNotes.map((n) => (
                      <div key={n.id} className="rounded-md border p-3 text-sm bg-secondary/30">
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-wrap">{n.note}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteNote(n.id)}
                            aria-label="Удалить заметку"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {fmtDateTime(n.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-2">Все платежи</h3>
                <div className="space-y-2">
                  {openDonor.donations.map((d) => {
                    const isRecurring = d.payment_type === "recurring" || d.payment_type === "monthly";
                    const campaignTitle = d.campaign_id ? campaignTitleById.get(d.campaign_id) : null;
                    return (
                      <div
                        key={d.id}
                        className={`rounded-md border p-3 text-sm flex items-center justify-between gap-3 ${
                          isRecurring ? "bg-primary/[0.04]" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{formatRub(d.amount)}</span>
                            <Badge variant={statusVariant(d.status)} className="text-[10px]">
                              {d.status}
                            </Badge>
                            {isRecurring ? (
                              <Badge variant="outline" className="text-[10px] border-primary/40 bg-primary/10 text-primary gap-1">
                                <Repeat className="h-3 w-3" /> Подписка
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Разовый</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {campaignTitle ? campaignTitle : "Общий донат"}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(d.paid_at ?? d.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------- CSV export ----------
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportDonationsCSV(rows: DonationRow[], titleById: Map<string, string>) {
  const headers = [
    "created_at",
    "paid_at",
    "status",
    "amount",
    "payment_type",
    "is_anonymous",
    "donor_name",
    "donor_email",
    "donor_phone",
    "yookassa_payment_id",
    "campaign_id",
    "campaign_title",
    "donation_type",
  ];

  const lines = [
    headers.join(";"),
    ...rows.map((d) =>
      [
        d.created_at,
        d.paid_at ?? "",
        d.status,
        d.amount,
        d.payment_type,
        d.is_anonymous ? "true" : "false",
        d.is_anonymous ? "Аноним" : (d.donor_name ?? ""),
        d.is_anonymous ? "" : (d.donor_email ?? ""),
        d.is_anonymous ? "" : (d.donor_phone ?? ""),
        d.yookassa_payment_id ?? "",
        d.campaign_id ?? "",
        d.campaign_id ? (titleById.get(d.campaign_id) ?? "") : "",
        d.campaign_id ? "campaign" : "general",
      ]
        .map(csvEscape)
        .join(";"),
    ),
  ];

  // UTF-8 BOM — Excel корректно откроет кириллицу
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `donations-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

