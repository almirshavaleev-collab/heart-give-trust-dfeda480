import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DonationRow = {
  id: string;
  amount: number;
  status: string;
  yookassa_payment_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  campaign_id: string | null;
  created_at: string;
  paid_at: string | null;
};

type WebhookLogRow = {
  id: string;
  provider: string;
  event: string | null;
  source_ip: string | null;
  object_id: string | null;
  object_status: string | null;
  donation_id: string | null;
  result: string | null;
  created_at: string;
};

const resultVariant = (r: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!r) return "outline";
  if (r === "accepted") return "default";
  if (r.startsWith("rejected")) return "destructive";
  if (r.startsWith("ignored") || r === "already_processed") return "secondary";
  return "outline";
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "succeeded") return "default";
  if (s === "canceled" || s === "failed") return "destructive";
  if (s === "pending") return "secondary";
  return "outline";
};

export default function AdminDonations() {
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [logs, setLogs] = useState<WebhookLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [d, l] = await Promise.all([
        (supabase as any)
          .from("donations")
          .select("id, amount, status, yookassa_payment_id, donor_name, donor_email, campaign_id, created_at, paid_at")
          .order("created_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("webhook_logs")
          .select("id, provider, event, source_ip, object_id, object_status, donation_id, result, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (d.error) console.error(d.error);
      if (l.error) console.error(l.error);
      setDonations(d.data ?? []);
      setLogs(l.data ?? []);
      setLoading(false);
    })();
  }, []);

  const fmt = (s: string) => new Date(s).toLocaleString("ru-RU");

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Пожертвования и вебхуки</h1>
        <p className="text-sm text-muted-foreground mt-1">Последние 20 записей по каждой таблице</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-4">Последние пожертвования</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : donations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет пожертвований</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Дата</th>
                  <th className="py-2 pr-4">Сумма</th>
                  <th className="py-2 pr-4">Статус</th>
                  <th className="py-2 pr-4">Донор</th>
                  <th className="py-2 pr-4">YooKassa ID</th>
                  <th className="py-2">Оплачено</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{fmt(d.created_at)}</td>
                    <td className="py-2 pr-4 font-medium">{Number(d.amount).toLocaleString("ru-RU")} ₽</td>
                    <td className="py-2 pr-4"><Badge variant={statusVariant(d.status)}>{d.status}</Badge></td>
                    <td className="py-2 pr-4">{d.donor_name || d.donor_email || "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{d.yookassa_payment_id?.slice(0, 12) ?? "—"}</td>
                    <td className="py-2 whitespace-nowrap">{d.paid_at ? fmt(d.paid_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-lg mb-4">Последние вебхуки ЮKassa</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет записей</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Дата</th>
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2 pr-4">Object ID</th>
                  <th className="py-2">Donation</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{fmt(l.created_at)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.event ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.object_status ?? "—"}</td>
                    <td className="py-2 pr-4"><Badge variant={resultVariant(l.result)}>{l.result ?? "—"}</Badge></td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.source_ip ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.object_id?.slice(0, 12) ?? "—"}</td>
                    <td className="py-2 font-mono text-xs">{l.donation_id?.slice(0, 8) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6 bg-secondary/30">
        <h3 className="font-semibold mb-2">SQL для проверки вручную</h3>
        <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto"><code>{`-- Последние 20 пожертвований
SELECT created_at, amount, status, donor_email, yookassa_payment_id
FROM public.donations
ORDER BY created_at DESC
LIMIT 20;

-- Последние 20 вебхуков
SELECT created_at, event, object_status, result, source_ip, object_id, donation_id
FROM public.webhook_logs
ORDER BY created_at DESC
LIMIT 20;`}</code></pre>
      </Card>
    </div>
  );
}
