import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { recurringFlags } from "@/lib/recurring-config";

type Sub = {
  id: string; status: string; amount: number; currency: string;
  frequency: string; next_payment_at: string | null; campaign_id: string | null;
};

type TestEvent = {
  id: string; subscription_id: string; event_type: string;
  metadata: Record<string, unknown> | null; created_at: string;
};

const SIM_KINDS = [
  "success", "failure", "timeout", "network_error",
  "expired_card", "duplicate_webhook", "reconcile_delay", "stale_lock",
] as const;

async function call(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-recurring", {
    body: { action, ...body },
  });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data && (data as any).error) {
    throw new Error(String((data as any).error));
  }
  return data;
}

export default function AdminRecurringTesting() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [simKind, setSimKind] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const [s, e, c] = await Promise.all([
        supabase.rpc("donor_my_subscriptions"),
        call("recent_test_events", { limit: 50 }),
        call("test_config"),
      ]);
      setSubs((s.data ?? []) as Sub[]);
      setEvents((e as any)?.events ?? []);
      setConfig((c as any)?.config ?? null);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      const r = await fn();
      toast({ title: "OK", description: label });
      console.log(`[recurring][test] ${label}`, r);
      await refresh();
    } catch (e: any) {
      toast({ title: label, description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const testMode = (config as any)?.test_mode === true;
  const shadowMode = (config as any)?.shadow_mode === true;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recurring Testing Sandbox</h1>
          <p className="text-sm text-muted-foreground">
            Контролируемый recurring sandbox. Реальные списания {shadowMode ? "отключены" : "активны (вне shadow mode)"}.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {testMode ? <Badge variant="secondary">TEST MODE</Badge> : <Badge variant="outline">PROD MODE</Badge>}
          {shadowMode && <Badge>SHADOW MODE</Badge>}
        </div>
      </div>

      {!testMode && (
        <Card className="border-amber-300/40 bg-amber-50/40">
          <CardContent className="py-4 text-sm">
            Симуляции и replay-инструменты доступны только при <code>RECURRING_TEST_MODE=true</code>.
            Manual runners работают всегда.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Manual runners</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button disabled={!!busy} onClick={() => run("run_recurring_now", () => call("run_recurring_now"))}>
            Run recurring
          </Button>
          <Button disabled={!!busy} onClick={() => run("run_reconcile_now", () => call("run_reconcile_now"))}>
            Run reconcile
          </Button>
          <Button disabled={!!busy} onClick={() => run("run_cleanup_now", () => call("run_cleanup_now"))}>
            Run cleanup
          </Button>
          <Button disabled={!!busy} onClick={() => run("run_health_check_now", () => call("run_health_check_now"))}>
            Run health-check
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={refresh}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Test subscriptions ({subs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {subs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Нет подписок. Создайте recurring donation как обычный donor — или используйте production-данные.
            </p>
          )}
          {subs.map((s) => (
            <div key={s.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  <code className="text-xs">{s.id.slice(0, 8)}…</code>{" "}
                  · {s.amount} {s.currency} / {s.frequency}{" "}
                  · <Badge variant="outline">{s.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  next: {s.next_payment_at ? new Date(s.next_payment_at).toLocaleString() : "—"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm" variant="outline" disabled={!!busy}
                  onClick={() => run(`force_next ${s.id}`, () =>
                    call("force_next_payment", { subscription_id: s.id }))}>
                  Force next payment
                </Button>
                <Button size="sm" variant="outline" disabled={!!busy}
                  onClick={() => run(`clear_locks ${s.id}`, () =>
                    call("clear_locks", { subscription_id: s.id }))}>
                  Clear locks
                </Button>
                <Button size="sm" variant="outline" disabled={!!busy || !testMode}
                  onClick={() => run(`replay_webhook ${s.id}`, () =>
                    call("replay_webhook", { subscription_id: s.id, status: "succeeded" }))}>
                  Replay webhook
                </Button>
                <div className="flex items-center gap-1">
                  <Select value={simKind[s.id] ?? "success"}
                    onValueChange={(v) => setSimKind({ ...simKind, [s.id]: v })}>
                    <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIM_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!!busy || !testMode}
                    onClick={() => run(`simulate ${simKind[s.id] ?? "success"} ${s.id}`, () =>
                      call("simulate", { subscription_id: s.id, kind: simKind[s.id] ?? "success" }))}>
                    Simulate
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent simulated events ({events.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-96 overflow-auto text-xs font-mono">
            {events.length === 0 && (
              <p className="text-muted-foreground font-sans text-sm">Пока нет событий.</p>
            )}
            {events.map((e) => (
              <div key={e.id} className="border-b py-1">
                <span className="text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>{" "}
                <span className="font-bold">{e.event_type}</span>{" "}
                <span className="text-muted-foreground">{e.subscription_id.slice(0, 8)}…</span>{" "}
                <span>{JSON.stringify(e.metadata ?? {})}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active config</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">{JSON.stringify(config ?? {}, null, 2)}</pre>
          <p className="text-xs text-muted-foreground mt-2">
            Frontend flags: testMode={String(recurringFlags.testMode)}, dryRun={String(recurringFlags.dryRun)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}