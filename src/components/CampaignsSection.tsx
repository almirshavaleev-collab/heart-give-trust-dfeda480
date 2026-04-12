import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getActiveCampaigns, formatAmount, getProgress } from "@/lib/campaigns";

const CampaignsSection = () => {
  const campaigns = getActiveCampaigns();

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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {campaigns.map((campaign) => {
            const progress = getProgress(campaign);
            return (
              <Link
                key={campaign.id}
                to={`/campaigns/${campaign.slug}`}
                className="group card-light overflow-hidden flex flex-col"
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={campaign.image}
                    alt={campaign.title}
                    loading="lazy"
                    width={800}
                    height={512}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-semibold text-foreground mb-1 leading-snug">
                    {campaign.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 flex-1">
                    {campaign.shortDescription}
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
                      {formatAmount(campaign.collectedAmount)} ₽
                    </span>
                    <span className="font-medium text-foreground">
                      из {formatAmount(campaign.goalAmount)} ₽
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
      </div>
    </section>
  );
};

export default CampaignsSection;
