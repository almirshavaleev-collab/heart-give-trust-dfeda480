import type { RecurringFrequency, RecurringStatus } from "@/hooks/useRecurringSubscriptions";

export const FREQUENCY_LABEL_RU: Record<string, string> = {
  weekly: "Каждую неделю",
  biweekly: "Раз в две недели",
  monthly: "Каждый месяц",
  month: "Каждый месяц",
  week: "Каждую неделю",
};

export const STATUS_META: Record<
  RecurringStatus,
  { label: string; tone: string; explainer: string }
> = {
  active: {
    label: "Активна",
    tone: "bg-emerald-100 text-emerald-700 border-emerald-200",
    explainer: "Регулярная поддержка активна. Списания идут по расписанию.",
  },
  past_due: {
    label: "Не удалось списать",
    tone: "bg-amber-100 text-amber-800 border-amber-200",
    explainer:
      "Мы пока не смогли провести очередное списание. Попробуем снова автоматически в ближайшее время.",
  },
  paused: {
    label: "На паузе",
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    explainer:
      "Регулярная поддержка приостановлена. Это могло произойти после нескольких неудачных попыток списания или по вашему запросу.",
  },
  canceled: {
    label: "Отменена",
    tone: "bg-muted text-muted-foreground border-border",
    explainer: "Подписка отменена. Спасибо за вашу поддержку!",
  },
};

export function frequencyLabel(f?: string | null) {
  if (!f) return "—";
  return FREQUENCY_LABEL_RU[f] ?? f;
}

export function formatCardBrand(t?: string | null) {
  if (!t) return "Карта";
  const m: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    mir: "Мир",
    maestro: "Maestro",
    unionpay: "UnionPay",
    jcb: "JCB",
    amex: "American Express",
  };
  return m[t.toLowerCase()] ?? t;
}

export function formatCard(brand?: string | null, last4?: string | null) {
  const b = formatCardBrand(brand);
  return last4 ? `${b} •• ${last4}` : b;
}

/** Returns "через 2 дня 3 часа" or "осталось менее минуты" */
export function formatDistanceToNowRu(iso: string | null): string {
  if (!iso) return "—";
  const target = new Date(iso).getTime();
  if (isNaN(target)) return "—";
  const diffMs = target - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const min = Math.floor(abs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  let core: string;
  if (day >= 1) {
    const restHr = hr % 24;
    core = restHr ? `${day} ${plural(day, "день","дня","дней")} ${restHr} ${plural(restHr,"час","часа","часов")}` : `${day} ${plural(day, "день","дня","дней")}`;
  } else if (hr >= 1) {
    const restMin = min % 60;
    core = restMin ? `${hr} ${plural(hr,"час","часа","часов")} ${restMin} мин` : `${hr} ${plural(hr,"час","часа","часов")}`;
  } else if (min >= 1) {
    core = `${min} ${plural(min, "минута","минуты","минут")}`;
  } else {
    core = "менее минуты";
  }
  return past ? `${core} назад` : `через ${core}`;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const ATTEMPT_STATUS_META: Record<string, { label: string; tone: string }> = {
  succeeded: { label: "Успешно", tone: "bg-emerald-100 text-emerald-700" },
  created_pending: { label: "Платёж создан", tone: "bg-sky-100 text-sky-700" },
  pending: { label: "В обработке", tone: "bg-sky-100 text-sky-700" },
  retry_scheduled: { label: "Повтор запланирован", tone: "bg-amber-100 text-amber-700" },
  create_failed: { label: "Ошибка создания", tone: "bg-rose-100 text-rose-700" },
  network_error: { label: "Сетевая ошибка", tone: "bg-rose-100 text-rose-700" },
  past_due: { label: "Превышен лимит попыток", tone: "bg-rose-100 text-rose-700" },
  failed: { label: "Не удалось", tone: "bg-rose-100 text-rose-700" },
  canceled: { label: "Отменено", tone: "bg-slate-100 text-slate-600" },
};

export function attemptMeta(status: string) {
  return ATTEMPT_STATUS_META[status] ?? { label: status, tone: "bg-muted text-muted-foreground" };
}