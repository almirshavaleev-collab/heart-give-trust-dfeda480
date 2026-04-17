import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  cover_image: string | null;
  target_amount: number;
  collected_amount: number;
  beneficiary: string | null;
  purpose: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  completed_at?: string | null;
}

export function usePublishedCampaigns(limit?: number) {
  return useQuery<PublicCampaign[]>({
    queryKey: ["published-campaigns", limit],
    queryFn: async () => {
      let q = supabase
        .from("campaigns")
        .select("*")
        .in("status", ["active", "completed"])
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (limit) q = q.limit(limit);

      const { data, error } = await q;
      if (error) throw error;
      return data as PublicCampaign[];
    },
  });
}

export function useActiveCampaigns(limit?: number) {
  return useQuery<PublicCampaign[]>({
    queryKey: ["active-campaigns", limit],
    queryFn: async () => {
      let q = supabase
        .from("campaigns")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as PublicCampaign[];
    },
  });
}

export function useCompletedCampaigns(limit?: number) {
  return useQuery<PublicCampaign[]>({
    queryKey: ["completed-campaigns", limit],
    queryFn: async () => {
      let q = supabase
        .from("campaigns")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false, nullsFirst: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as PublicCampaign[];
    },
  });
}

export function useCampaignBySlug(slug: string) {
  return useQuery<PublicCampaign | null>({
    queryKey: ["campaign", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("slug", slug)
        .in("status", ["active", "completed"])
        .maybeSingle();
      if (error) throw error;
      return data as PublicCampaign | null;
    },
  });
}

export function useOtherCampaigns(currentSlug: string, limit = 3) {
  return useQuery<PublicCampaign[]>({
    queryKey: ["other-campaigns", currentSlug, limit],
    enabled: !!currentSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .in("status", ["active", "completed"])
        .neq("slug", currentSlug)
        .order("sort_order", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data as PublicCampaign[];
    },
  });
}

/**
 * Реалтайм-обновления: подписываемся на изменения campaigns/donations
 * и инвалидируем все связанные queries — суммы и прогресс
 * на странице будут обновляться без F5.
 */
export function useCampaignsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("campaigns-and-donations-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => {
          qc.invalidateQueries({ queryKey: ["active-campaigns"] });
          qc.invalidateQueries({ queryKey: ["completed-campaigns"] });
          qc.invalidateQueries({ queryKey: ["published-campaigns"] });
          qc.invalidateQueries({ queryKey: ["campaign"] });
          qc.invalidateQueries({ queryKey: ["other-campaigns"] });
          qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donations" },
        () => {
          // donations меняют collected_amount у campaign — обновим списки сборов тоже
          qc.invalidateQueries({ queryKey: ["active-campaigns"] });
          qc.invalidateQueries({ queryKey: ["completed-campaigns"] });
          qc.invalidateQueries({ queryKey: ["published-campaigns"] });
          qc.invalidateQueries({ queryKey: ["campaign"] });
          qc.invalidateQueries({ queryKey: ["donations-total"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString("ru-RU");
}

export function getProgress(target: number, collected: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((collected / target) * 100));
}

export function formatCompletedDate(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
