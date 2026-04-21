import { Link } from "react-router-dom";
import { Heart, ListOrdered, Repeat, Target, Award, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDonorDonations, useDonorSubscriptions, useUserAchievements, useDonorProfile } from "@/hooks/useDonorData";
import { formatRub, formatDate, statusLabel } from "@/lib/donor-format";

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="border-border">
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

export default function AccountOverview() {
  const { data: profile } = useDonorProfile();
  const { data: donations, isLoading: dLoading } = useDonorDonations();
  const { data: subs } = useDonorSubscriptions();
  const { data: achievements } = useUserAchievements();

  const succeeded = (donations ?? []).filter((d) => d.status === "succeeded");
  const total = succeeded.reduce((s, d) => s + Number(d.amount), 0);
  const campaigns = new Set(succeeded.map((d) => d.campaign_id).filter(Boolean)).size;
  const last = succeeded[0];
  const activeSub = (subs ?? []).find((s) => s.status === "active");

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
          <StatCard icon={Repeat} label="Регулярная помощь" value={activeSub ? "Активна" : "Не оформлена"} hint={activeSub ? `${formatRub(activeSub.amount)} / мес` : undefined} />
        </div>
      )}

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