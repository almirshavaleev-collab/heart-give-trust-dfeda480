import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicDonation = {
  id: string;
  campaign_id: string | null;
  amount: number;
  is_anonymous: boolean;
  donor_name: string | null;
  paid_at: string | null;
  created_at: string;
  status: string;
};

const PAGE_SIZE = 8;

export const useCampaignDonations = (campaignId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["campaign-donations", campaignId],
    enabled: !!campaignId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("public_donations" as any)
        .select("*", { count: "exact" })
        .eq("campaign_id", campaignId!)
        .order("paid_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        items: (data ?? []) as unknown as PublicDonation[],
        total: count ?? 0,
        page: pageParam as number,
      };
    },
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });

  // Realtime: refresh on any new succeeded donation for this campaign
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`campaign-donations-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "donations",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["campaign-donations", campaignId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, queryClient]);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    items,
    total,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
};
