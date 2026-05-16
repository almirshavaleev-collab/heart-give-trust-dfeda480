import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DonationLite = {
  amount: number;
  status: string;
  campaign_id: string | null;
  created_at: string;
  paid_at: string | null;
};

type CampaignLite = {
  id: string;
  title: string;
  target_amount: number;
  collected_amount: number;
};

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

export default function MonthLeaderCard({ donations }: { donations: DonationLite[] }) {
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .select("id, title, target_amount, collected_amount");
      if (error) {
        console.error("MonthLeaderCard campaigns error:", error);
        return;
      }
      setCampaigns(
        (data ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          target_amount: Number(c.target_amount ?? 0),
          collected_amount: Number(c.collected_amount ?? 0),
        })),
      );
    })();
  }, []);

  const leader = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const totals = new Map<string, number>();
    for (const d of donations) {
      if (d.status !== "succeeded" || !d.campaign_id) continue;
      const ref = new Date(d.paid_at ?? d.created_at);
      if (ref < monthStart) continue;
      totals.set(d.campaign_id, (totals.get(d.campaign_id) ?? 0) + d.amount);
    }
    let topId: string | null = null;
    let topSum = 0;
    for (const [id, sum] of totals) {
      if (sum > topSum) {
        topSum = sum;
        topId = id;
      }
    }
    if (!topId) return null;
    const c = campaigns.find((x) => x.id === topId);
    return c ? { campaign: c, monthSum: topSum } : null;
  }, [donations, campaigns]);

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <Trophy className="h-5 w-5 text-primary mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Лидер месяца
          </div>
          {leader ? (
            <>
              <div className="mt-1 text-lg font-semibold truncate">{leader.campaign.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Собрано за месяц: <span className="text-foreground font-medium">{formatRub(leader.monthSum)}</span>
              </div>
              {leader.campaign.target_amount > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>
                      {formatRub(leader.campaign.collected_amount)} из {formatRub(leader.campaign.target_amount)}
                    </span>
                    <span className="font-medium text-foreground">
                      {Math.min(
                        100,
                        Math.round((leader.campaign.collected_amount / leader.campaign.target_amount) * 100),
                      )}
                      %
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      (leader.campaign.collected_amount / leader.campaign.target_amount) * 100,
                    )}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Нет данных за этот месяц</div>
          )}
        </div>
      </div>
    </Card>
  );
}