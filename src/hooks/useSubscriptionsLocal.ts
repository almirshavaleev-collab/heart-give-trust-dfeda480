import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  CreateSubscriptionInput,
  DonorSubscription,
  SubscriptionFrequency,
  computeNextPaymentAt,
  getSubscriptionsRepo,
  subscriptionsChangeEvent,
} from "@/lib/subscriptions-repo";

/**
 * Reactive hook for the subscriptions repo. Reloads when the underlying
 * storage changes (in this tab via custom event, across tabs via the
 * native `storage` event).
 */
export function useSubscriptionsLocal() {
  const { user } = useAuth();
  const repo = getSubscriptionsRepo();
  const [data, setData] = useState<DonorSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await repo.list(user.id);
    rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setData(rows);
    setLoading(false);
  }, [repo, user]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(subscriptionsChangeEvent, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(subscriptionsChangeEvent, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const create = useCallback(
    async (input: Omit<CreateSubscriptionInput, "user_id">) => {
      if (!user) throw new Error("Требуется авторизация");
      return repo.create({ ...input, user_id: user.id });
    },
    [repo, user],
  );

  const pause = useCallback(
    (id: string) =>
      repo.update(id, { status: "paused", paused_at: new Date().toISOString() }),
    [repo],
  );

  const resume = useCallback(
    async (id: string, current: DonorSubscription) => {
      const now = new Date();
      return repo.update(id, {
        status: "active",
        paused_at: null,
        next_payment_at: computeNextPaymentAt(now, current.frequency),
      });
    },
    [repo],
  );

  const cancel = useCallback(
    (id: string) =>
      repo.update(id, {
        status: "canceled",
        canceled_at: new Date().toISOString(),
        next_payment_at: null,
      }),
    [repo],
  );

  const edit = useCallback(
    async (id: string, patch: { amount: number; frequency: SubscriptionFrequency }) => {
      const now = new Date();
      return repo.update(id, {
        amount: patch.amount,
        frequency: patch.frequency,
        next_payment_at: computeNextPaymentAt(now, patch.frequency),
      });
    },
    [repo],
  );

  const remove = useCallback((id: string) => repo.remove(id), [repo]);

  return { data, loading, refresh, create, pause, resume, cancel, edit, remove };
}