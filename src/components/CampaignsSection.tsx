import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useActiveCampaigns, formatAmount, getProgress } from "@/hooks/useCampaigns";
import { Skeleton } from "@/components/ui/skeleton";
import CampaignCover from "@/components/CampaignCover";

const CampaignsSection = () => {
  const { data: campaigns = [], isLoading } = useActiveCampaigns(4);

  return (
    <section id="campaigns" className="py-24 md:py-32">
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-accent uppercase tracking-wider mb-3">
            Помощь адресно
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Целевые сборы
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Каждый сбор — конкретная цель с прозрачной отчётностью. Выберите проект, который вам близок.
          </p>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-light overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-center text-muted-foreground">Активных сборов пока нет.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {campaigns.map((campaign) => {
                const progress = getProgress(campaign.target_amount, campaign.collected_amount);
                return (
                  <Link
                    key={campaign.id}
                    to={`/campaigns/${campaign.slug}`}
                    className="group card-light overflow-hidden flex flex-col"
                  >
                    <CampaignCover
                      src={campaign.cover_image}
                      alt={campaign.title}
                      cropSettings={(campaign as any).crop_settings}
                      className="rounded-none"
                      imgClassName="transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-semibold text-foreground mb-1 leading-snug">
                        {campaign.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 flex-1">
                        {campaign.short_description}
                      </p>

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span>Собрано</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatAmount(campaign.collected_amount)} ₽
                        </span>
                        <span className="font-medium text-foreground">
                          из {formatAmount(campaign.target_amount)} ₽
                        </span>
                      </div>

                      {/* CTA */}
                      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                          Подробнее
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Show all link */}
            <div className="text-center mt-10">
              <Link
                to="/campaigns"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
              >
                Смотреть все сборы
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default CampaignsSection;
