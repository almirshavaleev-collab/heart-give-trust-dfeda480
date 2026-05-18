import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type DonorProfile = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  display_name: string | null;
  public_display_name: string | null;
  is_public_donor: boolean;
  wants_notifications: boolean;
  is_demo?: boolean;
};

export type DonorDonation = {
  id: string;
  amount: number;
  status: string;
  payment_type: string;
  is_anonymous: boolean;
  is_recurring: boolean;
  payment_method_type: string | null;
  paid_at: string | null;
  created_at: string;
  campaign_id: string | null;
  campaign?: { id: string; title: string; slug: string } | null;
};

export type DonorSubscription = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  amount: number;
  currency: string;
  interval: string;
  status: "active" | "paused" | "canceled";
  next_payment_at: string | null;
  paused_at: string | null;
  canceled_at: string | null;
  created_at: string;
};

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

export type UserAchievement = {
  id: string;
  achievement_id: string;
  awarded_at: string;
  achievement: Achievement;
};

export function useDonorProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["donor-profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DonorProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, phone, display_name, public_display_name, is_public_donor, wants_notifications, is_demo")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as DonorProfile) ?? null;
    },
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<DonorProfile>) => {
      if (!user) throw new Error("not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["donor-profile"] }),
  });
}

export function useDonorDonations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["donor-donations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DonorDonation[]> => {
      const { data, error } = await supabase
        .from("donations")
        .select("id, amount, status, payment_type, is_anonymous, is_recurring, payment_method_type, paid_at, created_at, campaign_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as DonorDonation[];
      const ids = Array.from(new Set(rows.map((r) => r.campaign_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: camps } = await supabase
          .from("campaigns")
          .select("id, title, slug")
          .in("id", ids);
        const map = new Map((camps ?? []).map((c) => [c.id, c]));
        rows.forEach((r) => {
          if (r.campaign_id) r.campaign = (map.get(r.campaign_id) as DonorDonation["campaign"]) ?? null;
        });
      }
      return rows;
    },
  });
}

export function useDonorSubscriptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["donor-subscriptions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DonorSubscription[]> => {
      const { data, error } = await supabase
        .from("donor_subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DonorSubscription[];
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DonorSubscription> }) => {
      const { error } = await supabase.from("donor_subscriptions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["donor-subscriptions"] }),
  });
}

export function useUserAchievements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-achievements", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserAchievement[]> => {
      const [{ data: ua, error: e1 }, { data: catalog, error: e2 }] = await Promise.all([
        supabase.from("user_achievements").select("id, achievement_id, awarded_at").eq("user_id", user!.id),
        supabase.from("achievements").select("*").order("sort_order"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const map = new Map((catalog ?? []).map((a) => [a.id, a as Achievement]));
      return (ua ?? []).map((row) => ({
        ...(row as { id: string; achievement_id: string; awarded_at: string }),
        achievement: map.get(row.achievement_id)!,
      })).filter((x) => x.achievement);
    },
  });
}

export function useAchievementsCatalog() {
  return useQuery({
    queryKey: ["achievements-catalog"],
    queryFn: async (): Promise<Achievement[]> => {
      const { data, error } = await supabase.from("achievements").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });
}