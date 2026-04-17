import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import {
  useCompletedCampaigns,
  formatAmount,
  getProgress,
  formatCompletedDate,
} from "@/hooks/useCampaigns";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  limit?: number;
  showHeader?: boolean;
}

const CompletedCampaignsSection = ({ limit = 6, showHeader = true }: Props) => {
  const { data: campaigns = [], isLoading } = useCompletedCampaigns(limit);

  if (!isLoading && campaigns.length === 0) return null;

  return (
    <section id="completed-campaigns" className="py-20 md:py-28 section-alt">
      <div className="container">
        {showHeader && (
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Уже помогли
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Завершённые сборы
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Эти проекты уже закрыты благодаря вашей поддержке. Спасибо каждому, кто принял участие.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden opacity-80">
                <Skeleton className="h-44 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => {
              const progress = getProgress(c.target_amount, c.collected_amount);
              return (
                <Link
                  key={c.id}
                  to={`/campaigns/${c.slug}`}
                  className="group relative rounded-2xl border border-border bg-card overflow-hidden flex flex-col transition-all hover:border-foreground/20"
                >
                  {/* Image with overlay */}
                  <div className="relative h-44 overflow-hidden bg-secondary">
                    {c.cover_image ? (
                      <img
                        src={c.cover_image}
                        alt={c.title}
                        loading="lazy"
                        className="w-full h-full object-cover grayscale-[35%] opacity-90 transition-all duration-500 group-hover:grayscale-0 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        Нет фото
                      </div>
                    )}
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/95 backdrop-blur text-xs font-medium text-foreground shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
                      Сбор завершён
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-semibold text-foreground mb-1 leading-snug">
                      {c.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 flex-1">
                      {c.short_description}
                    </p>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Итог</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Собрано {formatAmount(c.collected_amount)} ₽
                      </span>
                      <span className="text-muted-foreground">
                        из {formatAmount(c.target_amount)} ₽
                      </span>
                    </div>
                    {c.completed_at && (
                      <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                        Завершён {formatCompletedDate(c.completed_at)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default CompletedCampaignsSection;
