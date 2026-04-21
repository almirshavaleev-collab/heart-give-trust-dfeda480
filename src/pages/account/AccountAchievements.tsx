import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAchievementsCatalog, useUserAchievements } from "@/hooks/useDonorData";
import { Award, Heart, Sparkles, Repeat, HandHeart, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart, Sparkles, Award, Repeat, HandHeart,
};

export default function AccountAchievements() {
  const { data: catalog, isLoading } = useAchievementsCatalog();
  const { data: earned } = useUserAchievements();

  const earnedIds = new Set((earned ?? []).map((e) => e.achievement_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Достижения</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Маленькие отметки, чтобы поблагодарить вас за поддержку.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(catalog ?? []).map((a) => {
            const got = earnedIds.has(a.id);
            const Icon = (a.icon && ICONS[a.icon]) || Award;
            return (
              <Card key={a.id} className={cn("border-border transition-all", got ? "" : "opacity-60")}>
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                    got ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                  )}>
                    {got ? <Icon className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{a.title}</p>
                    {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}