import { useMemo, useState, Component, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

type DonationLite = {
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};

type Period = "days" | "weeks" | "months";

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

const fmtDayLabel = (d: Date) =>
  d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfISOWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}

class ChartsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Trend chart crashed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">График временно недоступен</p>
        </Card>
      );
    }
    return this.props.children;
  }
}

function Inner({ donations }: { donations: DonationLite[] }) {
  const [period, setPeriod] = useState<Period>("days");
  const succeeded = useMemo(() => donations.filter((d) => d.status === "succeeded"), [donations]);

  const data = useMemo(() => {
    const now = new Date();
    if (period === "days") {
      const days: { key: string; label: string; amount: number }[] = [];
      const today = startOfDay(now);
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push({ key: d.toISOString().slice(0, 10), label: fmtDayLabel(d), amount: 0 });
      }
      const map = new Map(days.map((x) => [x.key, x]));
      for (const don of succeeded) {
        const ref = startOfDay(new Date(don.paid_at ?? don.created_at));
        const slot = map.get(ref.toISOString().slice(0, 10));
        if (slot) slot.amount += don.amount;
      }
      return days;
    }
    if (period === "weeks") {
      const weeks: { key: string; label: string; amount: number }[] = [];
      const thisWeek = startOfISOWeek(now);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(thisWeek);
        d.setDate(thisWeek.getDate() - i * 7);
        weeks.push({
          key: d.toISOString().slice(0, 10),
          label: fmtDayLabel(d),
          amount: 0,
        });
      }
      const map = new Map(weeks.map((x) => [x.key, x]));
      for (const don of succeeded) {
        const ref = startOfISOWeek(new Date(don.paid_at ?? don.created_at));
        const slot = map.get(ref.toISOString().slice(0, 10));
        if (slot) slot.amount += don.amount;
      }
      return weeks;
    }
    const months: { key: string; label: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
        amount: 0,
      });
    }
    const map = new Map(months.map((x) => [x.key, x]));
    for (const don of succeeded) {
      const ref = new Date(don.paid_at ?? don.created_at);
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
      const slot = map.get(key);
      if (slot) slot.amount += don.amount;
    }
    return months;
  }, [period, succeeded]);

  const subtitle =
    period === "days"
      ? "Последние 30 дней, по дню оплаты"
      : period === "weeks"
      ? "Последние 12 недель, по неделе оплаты"
      : "Последние 12 месяцев, по месяцу оплаты";

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-muted-foreground mt-1" />
          <div>
            <h2 className="font-semibold text-lg">Динамика поступлений</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          className="bg-muted/50 rounded-full p-1 gap-0"
        >
          <ToggleGroupItem
            value="days"
            className="rounded-full px-4 h-8 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Дни
          </ToggleGroupItem>
          <ToggleGroupItem
            value="weeks"
            className="rounded-full px-4 h-8 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Недели
          </ToggleGroupItem>
          <ToggleGroupItem
            value="months"
            className="rounded-full px-4 h-8 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Месяцы
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ChartContainer
        config={{ amount: { label: "Сумма", color: "hsl(var(--primary))" } }}
        className="h-[300px] w-full"
      >
        <ResponsiveContainer>
          {period === "months" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : `${v}`)}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRub(Number(v))} />} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                interval={period === "days" ? 3 : 0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : `${v}`)}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRub(Number(v))} />} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
  );
}

export default function DonationsTrendChart({ donations }: { donations: DonationLite[] }) {
  return (
    <ChartsErrorBoundary>
      <Inner donations={donations} />
    </ChartsErrorBoundary>
  );
}