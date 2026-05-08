/**
 * Subscription repository — abstraction layer.
 *
 * Currently backed by localStorage (mock). Designed so the implementation
 * can be swapped for a Supabase-backed repo later without touching callers.
 * Just replace `getRepo()` to return a Supabase implementation that fulfils
 * the SubscriptionsRepo interface.
 */

export type SubscriptionFrequency = "weekly" | "biweekly" | "monthly";
export type SubscriptionStatus = "active" | "paused" | "canceled";

export interface DonorSubscription {
  id: string;
  user_id: string;
  amount: number;
  currency: "RUB";
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  campaign_id: string | null;
  campaign_title: string | null;
  created_at: string;
  next_payment_at: string | null;
  last_payment_at: string | null;
  paused_at: string | null;
  canceled_at: string | null;
}

export interface CreateSubscriptionInput {
  user_id: string;
  amount: number;
  frequency: SubscriptionFrequency;
  campaign_id?: string | null;
  campaign_title?: string | null;
}

export interface SubscriptionsRepo {
  list(userId: string): Promise<DonorSubscription[]>;
  create(input: CreateSubscriptionInput): Promise<DonorSubscription>;
  update(id: string, patch: Partial<DonorSubscription>): Promise<DonorSubscription>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = "ligafund:subscriptions";
const CHANGE_EVENT = "ligafund:subscriptions:changed";

function readAll(): DonorSubscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: DonorSubscription[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* ignore quota errors */
  }
}

export function computeNextPaymentAt(
  from: Date,
  frequency: SubscriptionFrequency,
): string {
  const next = new Date(from);
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next.toISOString();
}

export const subscriptionsChangeEvent = CHANGE_EVENT;

const localRepo: SubscriptionsRepo = {
  async list(userId) {
    return readAll().filter((s) => s.user_id === userId);
  },
  async create(input) {
    const now = new Date();
    const sub: DonorSubscription = {
      id: (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`),
      user_id: input.user_id,
      amount: input.amount,
      currency: "RUB",
      frequency: input.frequency,
      status: "active",
      campaign_id: input.campaign_id ?? null,
      campaign_title: input.campaign_title ?? null,
      created_at: now.toISOString(),
      next_payment_at: computeNextPaymentAt(now, input.frequency),
      last_payment_at: null,
      paused_at: null,
      canceled_at: null,
    };
    const all = readAll();
    all.unshift(sub);
    writeAll(all);
    return sub;
  },
  async update(id, patch) {
    const all = readAll();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Subscription not found");
    const updated = { ...all[idx], ...patch };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },
  async remove(id) {
    writeAll(readAll().filter((s) => s.id !== id));
  },
};

export function getSubscriptionsRepo(): SubscriptionsRepo {
  return localRepo;
}

export const FREQUENCY_LABEL: Record<SubscriptionFrequency, string> = {
  weekly: "Раз в неделю",
  biweekly: "Раз в 2 недели",
  monthly: "Раз в месяц",
};