import { Heart, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCampaignDonations, type PublicDonation } from "@/hooks/useCampaignDonations";
import { formatAmount } from "@/hooks/useCampaigns";

interface Props {
  campaignId: string;
}

const formatDateTime = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const getDisplayName = (d: PublicDonation) => {
  if (d.is_anonymous) return "Анонимное пожертвование";
  const name = d.donor_name?.trim();
  return name && name.length > 0 ? name : "Благотворитель";
};

const CampaignDonationsList = ({ campaignId }: Props) => {
  const { items, total, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useCampaignDonations(campaignId);

  return (
    <section className="mt-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Пожертвования</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Последние пожертвования по этому сбору
          {total > 0 && <span className="ml-1">· всего {total}</span>}
        </p>
      </div>

      <div className="card-light overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Heart className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">
              Пока нет отображаемых пожертвований
            </p>
            <p className="text-sm text-muted-foreground">
              Вы можете стать первым, кто поддержит этот сбор.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {getDisplayName(d)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDateTime(d.paid_at ?? d.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-semibold text-foreground tabular-nums">
                    {formatAmount(Number(d.amount))} ₽
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Загрузка…
              </>
            ) : (
              "Загрузить ещё"
            )}
          </Button>
        </div>
      )}
    </section>
  );
};

export default CampaignDonationsList;
