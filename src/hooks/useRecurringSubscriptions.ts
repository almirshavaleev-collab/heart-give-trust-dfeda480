import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recurringFlags } from "@/lib/recurring-config";

export type RecurringStatus = "active" | "paused" | "past_due" | "canceled";
export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "month" | "week";

export type RecurringSubscription = {
  id: string;
  status: RecurringStatus;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  next_payment_at: string | null;
  last_charge_at: string | null;
  card_last4: string | null;
  card_type: string | null;
  card_expiry: string | null;
  paused_reason: string | null;
  campaign_id: string | null;
  created_at: string;
  is_test?: boolean;
};

export function useRecurringSubscriptions(pollMs: number = 30000) {
  const [data, setData] = useState<RecurringSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const { data, error } = await (supabase as any).rpc("donor_my_subscriptions");
    if (!mounted.current) return;
    if (error) {
      setError(error.message);
      console.error("[recurring] fetch error", error);
    } else {
      setData((data ?? []) as RecurringSubscription[]);
    }
    setLoading(false);
  }, []);

  const debouncedRefetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { void refetch(); }, 500);
  }, [refetch]);

  useEffect(() => {
    mounted.current = true;
    refetch();
    // Polling fallback. When realtime is on, slow down polling.
    const interval = recurringFlags.realtimeDonor ? Math.max(60000, pollMs * 2) : Math.max(5000, pollMs);
    const t = setInterval(refetch, interval);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (recurringFlags.realtimeDonor) {
      (async () => {
        const { data: who } = await supabase.auth.getUser();
        const uid = who?.user?.id;
        if (!uid || !mounted.current) return;
        channel = supabase
          .channel(`donor-subs-${uid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "donor_subscriptions", filter: `user_id=eq.${uid}` },
            () => debouncedRefetch(),
          )
          .subscribe();
      })();
    }

    return () => {
      mounted.current = false;
      clearInterval(t);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refetch, debouncedRefetch, pollMs]);

  return { data, loading, error, refetch };
}

export type ChargeAttempt = {
  id: string;
  status: string;
  yookassa_payment_id: string | null;
  donation_id: string | null;
  error_code: string | null;
  error_description: string | null;
  metadata: any;
  created_at: string;
};

export async function fetchChargeAttempts(subscriptionId: string): Promise<ChargeAttempt[]> {
  const { data, error } = await (supabase as any).rpc("donor_my_charge_attempts", {
    _subscription_id: subscriptionId,
    _limit: 50,
  });
  if (error) {
    console.error("[recurring] attempts error", error);
    throw error;
  }
  return (data ?? []) as ChargeAttempt[];
}

export async function donorPause(id: string) {
  const { error } = await (supabase as any).rpc("donor_pause_subscription", { _id: id });
  if (error) throw error;
}
export async function donorResume(id: string) {
  const { error } = await (supabase as any).rpc("donor_resume_subscription", { _id: id });
  if (error) throw error;
}
export async function donorCancel(id: string) {
  const { error } = await (supabase as any).rpc("donor_cancel_subscription", { _id: id });
  if (error) throw error;
}
export async function donorRetryNow(id: string) {
  const { error } = await (supabase as any).rpc("donor_retry_subscription_now", { _id: id });
  if (error) throw error;
}