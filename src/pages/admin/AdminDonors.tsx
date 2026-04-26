import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ArrowUpDown,
  Repeat,
  Mail,
  Phone,
  Crown,
  Sparkles,
  Heart,
  Users,
  Trash2,
} from "lucide-react";

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  user_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  campaign_id: string | null;
  is_anonymous: boolean;
  payment_type: string;
  created_at: string;
  paid_at: string | null;
};

type DonorAggregate = {
  key: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  totalAmount: number;
  donationCount: number;
  lastDonationAt: string | null;
  hasSubscription: boolean;
  donations: DonationRow[];
};

type DonorStatus = "Меценат" | "Постоянный" | "Поддерживает" | "Новый";

type CampaignLite = { id: string; title: string };

type DonorNote = {
  id: string;
  donor_key: string;
  note: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDateTime = (s: string) => new Date(s).toLocaleString("ru-RU");

function donorKey(d: DonationRow): string {
  if (d.user_id) return `u:${d.user_id}`;
  if (d.donor_email) return `e:${d.donor_email.toLowerCase()}`;
  if (d.donor_phone) return `p:${d.donor_phone}`;
  return `x:${d.id}`;
}

function getDonorStatus(agg: DonorAggregate): DonorStatus {
  if (agg.totalAmount >= 50000) return "Меценат";
  if (agg.donationCount >= 5) return "Постоянный";
  if (agg.donationCount >= 2) return "Поддерживает";
  return "Новый";
}

const statusBadge = (s: DonorStatus) => {
  switch (s) {
    case "Меценат":
      return (
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary gap-1">
          <Crown className="h-3 w-3" /> Меценат
        </Badge>
      );
    case "Постоянный":
      return (
        <Badge variant="outline" className="border-primary/40 text-primary gap-1">
          <Sparkles className="h-3 w-3" /> Постоянный
        </Badge>
      );
    case "Поддерживает":
      return (
        <Badge variant="secondary" className="gap-1">
          <Heart className="h-3 w-3" /> Поддерживает
        </Badge>
      );
    default:
      return <Badge variant="outline">Новый</Badge>;
  }
};

export default function AdminDonors() {
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"amount" | "count" | "last">("amount");

  const [openDonor, setOpenDonor] = useState<DonorAggregate | null>(null);
  const [notes, setNotes] = useState<DonorNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const { toast } = useToast();

  const refresh = async () => {
    const [d, c] = await Promise.all([
      (supabase as any)
        .from("donations")
        .select(
          "id, amount, status, user_id, donor_name, donor_email, donor_phone, campaign_id, is_anonymous, payment_type, created_at, paid_at",
        )
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(2000),
      (supabase as any).from("campaigns").select("id, title"),
    ]);
    if (d.error) console.error(d.error);
    if (c.error) console.error(c.error);
    setDonations((d.data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })));
    setCampaigns(c.data ?? []);
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();

    const channel = supabase
      .channel("admin-donors-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donations" },
        () => refresh(),
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

  const donors = useMemo<DonorAggregate[]>(() => {
    const map = new Map<string, DonorAggregate>();
    for (const d of donations) {
      const key = donorKey(d);
      let agg = map.get(key);
      if (!agg) {
        agg = {
          key,
          user_id: d.user_id,
          name: d.is_anonymous ? "Аноним" : (d.donor_name || "—"),
          email: d.donor_email,
          phone: d.donor_phone,
          totalAmount: 0,
          donationCount: 0,
          lastDonationAt: null,
          hasSubscription: false,
          donations: [],
        };
        map.set(key, agg);
      }
      agg.totalAmount += d.amount;
      agg.donationCount += 1;
      agg.donations.push(d);
      const ts = d.paid_at ?? d.created_at;
      if (!agg.lastDonationAt || new Date(ts) > new Date(agg.lastDonationAt)) {
        agg.lastDonationAt = ts;
      }
      if (d.payment_type === "recurring" || d.payment_type === "monthly") {
        agg.hasSubscription = true;
      }
      // Обновим имя/контакты из самого свежего платежа с данными
      if (!d.is_anonymous) {
        if (d.donor_name && (agg.name === "—" || agg.name === "Аноним")) agg.name = d.donor_name;
        if (!agg.email && d.donor_email) agg.email = d.donor_email;
        if (!agg.phone && d.donor_phone) agg.phone = d.donor_phone;
      }
    }
    return Array.from(map.values());
  }, [donations]);

  const filtered = useMemo(() => {
    let list = donors.filter((agg) => {
      const status = getDonorStatus(agg);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [agg.name, agg.email, agg.phone].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "amount") return b.totalAmount - a.totalAmount;
      if (sortBy === "count") return b.donationCount - a.donationCount;
      const at = a.lastDonationAt ? new Date(a.lastDonationAt).getTime() : 0;
      const bt = b.lastDonationAt ? new Date(b.lastDonationAt).getTime() : 0;
      return bt - at;
    });
    return list;
  }, [donors, search, statusFilter, sortBy]);

  // ---- Карточка донора + заметки ----
  const loadNotes = async (key: string) => {
    const { data, error } = await (supabase as any)
      .from("donor_notes")
      .select("*")
      .eq("donor_key", key)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setNotes(data ?? []);
  };

  const handleOpenDonor = async (agg: DonorAggregate) => {
    setOpenDonor(agg);
    setNoteDraft("");
    setNotes([]);
    await loadNotes(agg.key);
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
      toast({ title: "Не удалось удалить заметку", description: error.message, variant: "destructive" });
      return;
    }
    if (openDonor) await loadNotes(openDonor.key);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Доноры</h1>
          <p className="text-sm text-muted-foreground mt-1">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Доноры</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Уникальные жертвователи и их активность
        </p>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat icon={<Users className="h-4 w-4" />} label="Всего доноров" value={donors.length.toLocaleString("ru-RU")} />
        <MiniStat
          icon={<Crown className="h-4 w-4" />}
          label="Меценатов"
          value={donors.filter((d) => getDonorStatus(d) === "Меценат").length.toLocaleString("ru-RU")}
        />
        <MiniStat
          icon={<Sparkles className="h-4 w-4" />}
          label="Постоянных"
          value={donors.filter((d) => getDonorStatus(d) === "Постоянный").length.toLocaleString("ru-RU")}
        />
        <MiniStat
          icon={<Repeat className="h-4 w-4" />}
          label="С подпиской"
          value={donors.filter((d) => d.hasSubscription).length.toLocaleString("ru-RU")}
        />
      </div>

      <Card className="p-6">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск: имя, email, телефон..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="Меценат">Меценаты</SelectItem>
              <SelectItem value="Постоянный">Постоянные</SelectItem>
              <SelectItem value="Поддерживает">Поддерживают</SelectItem>
              <SelectItem value="Новый">Новые</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger>
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">По сумме</SelectItem>
              <SelectItem value="count">По количеству</SelectItem>
              <SelectItem value="last">По последнему донату</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground mb-3">
          Показано {filtered.length} из {donors.length}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет доноров по выбранным фильтрам</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Донор</th>
                  <th className="py-2 pr-4 font-medium">Контакты</th>
                  <th className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setSortBy("amount")}
                    >
                      Сумма <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setSortBy("count")}
                    >
                      Донатов <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setSortBy("last")}
                    >
                      Последний <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((agg) => {
                  const status = getDonorStatus(agg);
                  return (
                    <tr
                      key={agg.key}
                      className="border-b last:border-0 hover:bg-secondary/40 transition-colors cursor-pointer"
                      onClick={() => handleOpenDonor(agg)}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agg.name}</span>
                          {agg.hasSubscription && (
                            <Repeat className="h-3.5 w-3.5 text-primary" aria-label="Подписка" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          {agg.email && <span>{agg.email}</span>}
                          {agg.phone && <span>{agg.phone}</span>}
                          {!agg.email && !agg.phone && "—"}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-semibold whitespace-nowrap">{formatRub(agg.totalAmount)}</td>
                      <td className="py-3 pr-4">{agg.donationCount}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {agg.lastDonationAt ? fmtDate(agg.lastDonationAt) : "—"}
                      </td>
                      <td className="py-3">{statusBadge(status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Показаны первые 200 записей. Уточните фильтры для просмотра остальных.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Карточка донора */}
      <Sheet open={!!openDonor} onOpenChange={(o) => !o && setOpenDonor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {openDonor && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {openDonor.name}
                  {openDonor.hasSubscription && <Repeat className="h-4 w-4 text-primary" />}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
                  {statusBadge(getDonorStatus(openDonor))}
                  <span className="text-xs">
                    {openDonor.donationCount} донат(ов) · {formatRub(openDonor.totalAmount)}
                  </span>
                </SheetDescription>
              </SheetHeader>

              {/* Контакты */}
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

              {/* Заметки */}
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

                {notes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {notes.map((n) => (
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

              {/* История платежей */}
              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-2">История платежей</h3>
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

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </Card>
  );
}