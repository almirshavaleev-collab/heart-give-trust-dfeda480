import { useMemo, Component, ReactNode } from "react";
import { Card } from "@/components/ui/card";
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

const formatRub = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

class ChartsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Charts crashed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Графики временно недоступны</p>
        </Card>
      );
    }
    return this.props.children;
  }
}

function ChartsInner({ donations }: { donations: DonationLite[] }) {
  const succeeded = useMemo(() => donations.filter((d) => d.status === "succeeded"), [donations]);

  const dailyData = useMemo(() => {
    const days: { date: string; label: string; amount: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), label: fmtDate(d.toISOString()), amount: 0 });
    }
    const map = new Map(days.map((x) => [x.date, x]));
    for (const don of succeeded) {
      const ref = new Date(don.paid_at ?? don.created_at);
      const key = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).toISOString().slice(0, 10);
      const slot = map.get(key);
      if (slot) slot.amount += don.amount;
    }
    return days;
  }, [succeeded]);

  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; amount: number }[] = [];
    const now = new Date();
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
  }, [succeeded]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">Поступления за 30 дней</h2>
            <p className="text-xs text-muted-foreground mt-0.5">По дню оплаты</p>
          </div>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <ChartContainer config={{ amount: { label: "Сумма", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
          <ResponsiveContainer>
            <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={3} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : `${v}`)} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRub(Number(v))} />} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">Поступления по месяцам</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Последние 12 месяцев</p>
          </div>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <ChartContainer config={{ amount: { label: "Сумма", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
          <ResponsiveContainer>
            <LineChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : `${v}`)} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRub(Number(v))} />} />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Card>
    </div>
  );
}

export default function DonationsCharts({ donations }: { donations: DonationLite[] }) {
  return (
    <ChartsErrorBoundary>
      <ChartsInner donations={donations} />
    </ChartsErrorBoundary>
  );
}
