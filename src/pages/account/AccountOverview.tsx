import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Heart, ListOrdered, Repeat, Target, Award, Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDonorDonations, useUserAchievements, useDonorProfile } from "@/hooks/useDonorData";
import { useRecurringSubscriptions, type RecurringSubscription } from "@/hooks/useRecurringSubscriptions";
import { formatRub, formatDate, statusLabel } from "@/lib/donor-format";
import { frequencyLabel } from "@/lib/recurring-format";

function StatCard({ icon: Icon, label, value, hint, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; hint?: string; onClick?: () => void }) {
  const interactive = !!onClick;
  return (
    <Card
      className={`border-border ${interactive ? "cursor-pointer transition-colors hover:bg-secondary/30" : ""}`}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-foreground truncate">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function isTestSub(s: RecurringSubscription): boolean {
  return !!s.is_test || s.frequency === "hourly";
}

function monthlyEquivalent(s: RecurringSubscription): number {
  const a = Number(s.amount) || 0;
  switch (s.frequency) {
    case "weekly":
    case "week":
      return a * 4.345;
    case "biweekly":
      return a * 2.1725;
    case "monthly":
    case "month":
      return a;
    default:
      return 0; // exclude hourly/test from estimate
  }
}

function pluralActive(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} активная подписка`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} активные подписки`;
  return `${n} активных подписок`;
}

export default function AccountOverview() {
  const { data: profile } = useDonorProfile();
  const { data: donations, isLoading: dLoading } = useDonorDonations();
  const { data: subs } = useRecurringSubscriptions();
  const { data: achievements } = useUserAchievements();
  const [subsOpen, setSubsOpen] = useState(false);

  const succeeded = (donations ?? []).filter((d) => d.status === "succeeded");
  const total = succeeded.reduce((s, d) => s + Number(d.amount), 0);
  const campaigns = new Set(succeeded.map((d) => d.campaign_id).filter(Boolean)).size;
  const last = succeeded[0];

  const activeSubs = useMemo(() => (subs ?? []).filter((s) => s.status === "active"), [subs]);
  const prodActive = activeSubs.filter((s) => !isTestSub(s));
  const monthlyEst = prodActive.reduce((sum, s) => sum + monthlyEquivalent(s), 0);

  const recurringValue =
    activeSubs.length === 0
      ? "Не оформлена"
      : activeSubs.length === 1
      ? "Активна"
      : pluralActive(activeSubs.length);

  const recurringHint =
    activeSubs.length === 0
      ? undefined
      : activeSubs.length === 1
      ? `${formatRub(activeSubs[0].amount)} / ${frequencyLabel(activeSubs[0].frequency).toLowerCase()}`
      : monthlyEst > 0
      ? `≈ ${formatRub(Math.round(monthlyEst))} / мес`
      : "Тестовые подписки";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Здравствуйте{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-muted-foreground mt-1">Спасибо, что поддерживаете фонд.</p>
      </div>

      {dLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Heart} label="Всего пожертвовано" value={formatRub(total)} />
          <StatCard icon={ListOrdered} label="Количество донатов" value={succeeded.length} />
          <StatCard icon={Target} label="Поддержано сборов" value={campaigns} />
          <StatCard
            icon={Repeat}
            label="Регулярная помощь"
            value={recurringValue}
            hint={recurringHint}
            onClick={activeSubs.length > 0 ? () => setSubsOpen(true) : undefined}
          />
        </div>
      )}

      <Dialog open={subsOpen} onOpenChange={setSubsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Активные регулярные подписки</DialogTitle>
            <DialogDescription>
              {activeSubs.length > 0
                ? `Всего активных: ${activeSubs.length}${monthlyEst > 0 ? ` · ≈ ${formatRub(Math.round(monthlyEst))} / мес` : ""}`
                : "Пока нет активных подписок"}
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {activeSubs.map((s) => {
              const test = isTestSub(s);
              return (
                <li key={s.id} className={`py-3 flex items-center justify-between gap-3 ${test ? "opacity-70" : ""}`}>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {formatRub(s.amount)} / {frequencyLabel(s.frequency).toLowerCase()}
                    </span>
                    {test && (
                      <Badge variant="outline" className="text-[10px] rounded-full">Тестовая</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="pt-2">
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link to="/account/subscriptions" onClick={() => setSubsOpen(false)}>
                Управлять подписками <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Последние пожертвования</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/account/donations">Все</Link></Button>
          </CardHeader>
          <CardContent>
            {dLoading ? (
              <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : succeeded.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="Пока нет пожертвований"
                hint="Сделайте первое доброе дело — поддержите фонд или конкретный сбор."
                cta={<Button asChild><Link to="/#donate">Поддержать</Link></Button>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {succeeded.slice(0, 5).map((d) => (
                  <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {d.campaign?.title ?? "Общий вклад в фонд"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.paid_at ?? d.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatRub(d.amount)}</p>
                      <Badge variant="secondary" className="text-[10px]">{statusLabel(d.status)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Достижения</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/account/achievements">Все</Link></Button>
          </CardHeader>
          <CardContent>
            {(achievements ?? []).length === 0 ? (
              <EmptyState icon={Sparkles} title="Пока нет наград" hint="Сделайте пожертвование, чтобы открыть первое достижение." />
            ) : (
              <ul className="space-y-2">
                {(achievements ?? []).slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 p-2 rounded-xl bg-secondary/40">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.achievement.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.achievement.description}</p>
                    </div>
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

function EmptyState({ icon: Icon, title, hint, cta }: { icon: React.ComponentType<{ className?: string }>; title: string; hint?: string; cta?: React.ReactNode }) {
  return (
    <div className="text-center py-8 px-4 space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-sm">{title}</p>
        {hint && <p className="text-xs text-muted-foreground max-w-sm mx-auto">{hint}</p>}
      </div>
      {cta}
    </div>
  );
}