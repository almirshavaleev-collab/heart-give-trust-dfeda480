export function formatRub(amount: number): string {
  const v = Number(amount) || 0;
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function statusLabel(status: string): string {
  switch (status) {
    case "succeeded": return "Успешно";
    case "pending": return "В обработке";
    case "canceled": return "Отменён";
    case "failed": return "Ошибка";
    case "refunded": return "Возвращён";
    default: return status;
  }
}

export function paymentMethodLabel(t: string | null): string {
  if (!t) return "—";
  const map: Record<string, string> = {
    bank_card: "Банковская карта",
    yoo_money: "ЮMoney",
    sbp: "СБП",
    sberbank: "Сбербанк Онлайн",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
  };
  return map[t] ?? t;
}

export function intervalLabel(i: string): string {
  switch (i) {
    case "weekly": return "Раз в неделю";
    case "biweekly": return "Раз в 2 недели";
    case "monthly": return "Раз в месяц";
    case "week": return "Еженедельно";
    case "month": return "Ежемесячно";
    case "quarter": return "Ежеквартально";
    case "year": return "Ежегодно";
    default: return i;
  }
}