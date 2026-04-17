import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DonationWidget from "@/components/DonationWidget";
import { useCampaignBySlug, useOtherCampaigns, formatAmount, getProgress } from "@/hooks/useCampaigns";

const CampaignPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: campaign, isLoading } = useCampaignBySlug(slug ?? "");
  const { data: others = [] } = useOtherCampaigns(slug ?? "");

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-16">
          <div className="container pt-8 space-y-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-[420px] w-full rounded-2xl" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Сбор не найден</h1>
            <p className="text-muted-foreground mb-6">Такого сбора не существует или он был удалён.</p>
            <Button asChild>
              <Link to="/">На главную</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const progress = getProgress(campaign.target_amount, campaign.collected_amount);
  const remaining = campaign.target_amount - campaign.collected_amount;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-16">
        {/* Breadcrumb */}
        <div className="container pt-8 pb-4">
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Все сборы
          </Link>
        </div>

        {/* Hero image */}
        {campaign.cover_image && (
          <div className="container mb-10">
            <div className="rounded-2xl overflow-hidden max-h-[420px]">
              <img
                src={campaign.cover_image}
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="container max-w-4xl pb-24">
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Left: description */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {campaign.title}
                </h1>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  {campaign.full_description}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {campaign.beneficiary && (
                  <div className="card-light p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-foreground" />
                      <span className="text-sm font-medium text-foreground">Кому помогаем</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {campaign.beneficiary}
                    </p>
                  </div>
                )}
                {campaign.purpose && (
                  <div className="card-light p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <Target className="w-5 h-5 text-foreground" />
                      <span className="text-sm font-medium text-foreground">Цель сбора</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {campaign.purpose}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: progress + donation widget */}
            <div className="lg:col-span-1 space-y-6">
              <div className="card-light p-6">
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Прогресс</span>
                    <span className="font-semibold text-foreground">{progress}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Собрано</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatAmount(campaign.collected_amount)} ₽
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Цель</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatAmount(campaign.target_amount)} ₽
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between">
                    <span className="text-sm text-muted-foreground">Осталось</span>
                    <span className="text-sm font-semibold text-accent">
                      {formatAmount(Math.max(0, remaining))} ₽
                    </span>
                  </div>
                </div>
              </div>

              <DonationWidget
                mode="campaign"
                embedded
                campaign={{
                  id: campaign.id,
                  title: campaign.title,
                  target_amount: campaign.target_amount,
                  collected_amount: campaign.collected_amount,
                }}
              />
            </div>
          </div>
        </div>

        {/* Other campaigns */}
        {others.length > 0 && (
          <section className="py-16 section-alt">
            <div className="container">
              <h2 className="text-2xl font-bold text-foreground mb-8">Другие сборы</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {others.map((c) => {
                  const p = getProgress(c.target_amount, c.collected_amount);
                  return (
                    <Link
                      key={c.id}
                      to={`/campaigns/${c.slug}`}
                      className="group card-light overflow-hidden flex flex-col"
                    >
                      <div className="relative h-40 overflow-hidden bg-secondary">
                        {c.cover_image ? (
                          <img
                            src={c.cover_image}
                            alt={c.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                            Нет фото
                          </div>
                        )}
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{c.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">
                          {c.short_description}
                        </p>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatAmount(c.collected_amount)} ₽</span>
                          <span>из {formatAmount(c.target_amount)} ₽</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
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
        )}
      </main>

      <Footer />
    </div>
  );
};

export default CampaignPage;
