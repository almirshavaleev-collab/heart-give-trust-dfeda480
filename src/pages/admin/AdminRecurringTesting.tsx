import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

/* ─────────────────────────────────────────────────────────────────────────── */

type SandboxSub = {
  id: string; status: string; amount: number; currency: string;
  interval: string; next_payment_at: string | null; created_at: string;
  is_test: boolean; current_billing_key: string | null; processing_at: string | null;
  retry_count: number; last_charge_at: string | null;
};
type EventRow = {
  id: string; subscription_id: string | null; event_type: string;
  metadata: Record<string, unknown> | null; created_at: string;
};
type AuditRow = {
  id: string; actor: string | null; action: string; payload: any; created_at: string;
};
type IntegrityIssue = { kind: string; severity: string; count: number; sample_ids?: string[] };

const SIM_KINDS = [
  "success","failure","timeout","network_error",
  "expired_card","duplicate_webhook","reconcile_delay","stale_lock",
] as const;

const FLAG_KEYS = [
  "recurring_enabled","sandbox_enabled","recurring_test_mode","recurring_dry_run",
  "recurring_force_success","recurring_force_failure",
] as const;
type FlagKey = typeof FLAG_KEYS[number];

async function call(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-recurring", {
    body: { action, ...body },
  });
  if (error) throw error;
  if (data && typeof data === "object" && (data as any).error) {
    throw new Error(String((data as any).error));
  }
  return data as any;
}

/* ─────────────────────────────────────────────────────────────────────────── */

function SandboxBanner({ enabled, testMode }: { enabled: boolean; testMode: boolean }) {
  if (!enabled) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
        <span className="font-semibold">Sandbox отключён.</span>{" "}
        Включите <code className="text-xs">sandbox_enabled</code> во вкладке Flags для работы тестов.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-700">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="font-semibold">SANDBOX MODE</span> — все действия здесь изолированы от production.
          Реальные списания, увеличение сборов и письма заблокированы для <code>is_test=true</code>.
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">SANDBOX</Badge>
          {testMode && <Badge variant="outline" className="border-amber-500 text-amber-700">TEST</Badge>}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500", paused: "bg-amber-500",
    past_due: "bg-orange-500", canceled: "bg-zinc-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] ?? "bg-zinc-400"}`} />;
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function AdminRecurringTesting() {
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [extMetrics, setExtMetrics] = useState<any>(null);
  const [subs, setSubs] = useState<SandboxSub[]>([]);
  const [showProd, setShowProd] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityIssue[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspector, setInspector] = useState<any>(null);
  const [createForm, setCreateForm] = useState({ amount: 100, interval: "monthly", next_in_seconds: 60 });
  const [chaosCount, setChaosCount] = useState(10);

  const sandboxEnabled = settings?.sandbox_enabled === true;
  const testMode = settings?.recurring_test_mode === true;

  const refresh = useCallback(async () => {
    try {
      const [s, m, e, a] = await Promise.all([
        call("get_settings"),
        call("extended_metrics"),
        call("audit_log", { limit: 50 }),
        call("integrity_scan").catch(() => null),
      ]);
      setSettings(s.settings ?? {});
      setExtMetrics(m.metrics ?? null);
      setAudit(e.entries ?? []);
      if (a) setIntegrity(a.scan?.issues ?? []);

      // Subscriptions: filter by is_test by default
      const q = supabase.from("donor_subscriptions")
        .select("id,status,amount,currency,interval,next_payment_at,created_at,is_test,current_billing_key,processing_at,retry_count,last_charge_at")
        .order("created_at", { ascending: false }).limit(200);
      if (!showProd) q.eq("is_test", true);
      const subRes = await q;
      setSubs((subRes.data ?? []) as any);

      // Recent events (sandbox/test)
      const { data: evs } = await supabase.rpc("admin_recent_test_events", { _limit: 100 });
      setEvents((evs ?? []) as any);
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  }, [showProd]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh console tab every 2s
  useEffect(() => {
    if (tab !== "console") return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [tab, refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      toast({ title: "OK", description: label });
      await refresh();
    } catch (e: any) {
      toast({ title: label, description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const openInspector = async (id: string) => {
    setSelected(id); setInspector(null);
    try {
      const r = await call("inspector", { subscription_id: id });
      setInspector(r.inspector ?? null);
    } catch (e: any) {
      toast({ title: "Inspector", description: e.message, variant: "destructive" });
    }
  };

  const setFlag = async (key: FlagKey, value: boolean) => {
    await run(`flag ${key}`, () => call("set_setting", { key, value }));
  };

  const sandboxOnly = useMemo(() => subs.filter((s) => s.is_test), [subs]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring QA Sandbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Изолированная лаборатория recurring billing. Production не затрагивается.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={!!busy}>Обновить</Button>
        </div>
      </div>

      <SandboxBanner enabled={sandboxEnabled} testMode={testMode} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subs">Subscriptions</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="failures">Failures</TabsTrigger>
          <TabsTrigger value="chaos">Chaos</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
          <TabsTrigger value="integrity">Integrity</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* ───── OVERVIEW ───── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Sandbox active"  value={extMetrics?.sandbox?.active ?? 0} tone="amber" />
            <MetricCard label="Sandbox total"   value={extMetrics?.sandbox?.total ?? 0} tone="amber" />
            <MetricCard label="Success rate"    value={`${extMetrics?.sandbox?.success_rate ?? 0}%`} tone="amber" />
            <MetricCard label="Attempts"        value={extMetrics?.sandbox?.attempts ?? 0} tone="amber" />
            <MetricCard label="Dedupe (24h)"    value={extMetrics?.dedupe_prevented_24h ?? 0} tone="blue" />
            <MetricCard label="Stale recover"   value={extMetrics?.stale_lock_recovered_24h ?? 0} tone="blue" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Manual runners</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button disabled={!!busy} onClick={() => run("cron_tick", () => call("cron_tick"))}>
                Run cron tick
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => run("recurring", () => call("run_recurring_now"))}>
                Process payments
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => run("reconcile", () => call("run_reconcile_now"))}>
                Reconcile
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => run("cleanup", () => call("run_cleanup_now"))}>
                Cleanup
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => run("integrity", async () => {
                const r = await call("integrity_scan"); setIntegrity(r.scan?.issues ?? []); setTab("integrity");
              })}>
                Run integrity scan
              </Button>
              <DestroyButton busy={!!busy} onConfirm={() => run("destroy_sandbox", () => call("destroy_sandbox", { confirm: "DESTROY" }))} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── SUBSCRIPTIONS ───── */}
        <TabsContent value="subs" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={showProd} onCheckedChange={setShowProd} id="show-prod" />
              <Label htmlFor="show-prod">Показать production подписки</Label>
            </div>
            <p className="text-xs text-muted-foreground">{subs.length} записей</p>
          </div>
          <Card>
            <CardContent className="p-0 divide-y">
              {subs.length === 0 && <p className="p-6 text-sm text-muted-foreground">Подписок не найдено.</p>}
              {subs.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 cursor-pointer" onClick={() => openInspector(s.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusDot status={s.status} />
                    <div className="min-w-0">
                      <div className="text-sm font-mono truncate">{s.id.slice(0, 8)}…</div>
                      <div className="text-xs text-muted-foreground">
                        {s.amount} {s.currency} · {s.interval} · next: {s.next_payment_at ? new Date(s.next_payment_at).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.is_test
                      ? <Badge className="bg-amber-500 hover:bg-amber-500 text-white">SANDBOX</Badge>
                      : <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">PROD</Badge>}
                    <Badge variant="outline">{s.status}</Badge>
                    {s.is_test && (
                      <>
                        <Button size="sm" variant="outline" disabled={!!busy}
                          onClick={(e) => { e.stopPropagation(); run("sim_cycle", () => call("simulate", { subscription_id: s.id, kind: "success" })); }}>
                          ▶ Cycle
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!busy}
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); run("sim_cycle_fail", () => call("simulate", { subscription_id: s.id, kind: "failure" })); }}>
                          ✕ Fail
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setInspector(null); } }}>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader><SheetTitle>Subscription Inspector</SheetTitle></SheetHeader>
              {!inspector && <p className="text-sm text-muted-foreground mt-4">Загрузка…</p>}
              {inspector && (
                <div className="mt-4 space-y-4">
                  <Section title="Subscription">
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(inspector.subscription, null, 2)}</pre>
                  </Section>
                  {selected && inspector.subscription?.is_test && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={!!busy}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => run("sim_cycle", async () => {
                          const r = await call("simulate", { subscription_id: selected, kind: "success" });
                          await openInspector(selected);
                          return r;
                        })}>
                        ▶ Success cycle
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => run("sim_cycle_fail", async () => {
                          const r = await call("simulate", { subscription_id: selected, kind: "fail" });
                          await openInspector(selected);
                          return r;
                        })}>
                        ❌ Fail cycle
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        className="border-amber-500 text-amber-700 hover:bg-amber-50"
                        onClick={() => run("sim_timeout", async () => {
                          const r = await call("simulate", { subscription_id: selected, kind: "timeout" });
                          await openInspector(selected);
                          return r;
                        })}>
                        ⏳ Timeout cycle
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        className="border-zinc-400 text-zinc-700 hover:bg-zinc-100"
                        onClick={() => run("sim_cancel", async () => {
                          const r = await call("simulate", { subscription_id: selected, kind: "cancel" });
                          await openInspector(selected);
                          return r;
                        })}>
                        🚫 Cancel subscription
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        className="border-blue-500 text-blue-700 hover:bg-blue-50"
                        onClick={() => run("sim_webhook_replay", async () => {
                          const r = await call("simulate", { subscription_id: selected, kind: "webhook_replay" });
                          await openInspector(selected);
                          return r;
                        })}>
                        🔁 Replay webhook
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                        onClick={() => run("sim_webhook_replay_dry", async () => {
                          const r: any = await call("simulate", { subscription_id: selected, kind: "webhook_replay", dry_run: true });
                          if (r?.ok) {
                            toast({
                              title: "🧪 Dry replay OK",
                              description: [
                                `Attempt: ${r.would_replay_attempt_id ?? "—"}`,
                                `Donation: ${r.would_replay_donation_id ?? "—"}`,
                                `Idempotent: ${r.idempotent ? "true" : "false"}`,
                              ].join("\n"),
                            });
                          } else {
                            toast({ title: "Dry replay failed", description: r?.error ?? "unknown", variant: "destructive" as any });
                          }
                          return r;
                        })}>
                        🧪 Dry replay
                      </Button>
                      <Button size="sm" disabled={!!busy}
                        onClick={() => run("ff60", () => call("fast_forward", { subscription_id: selected, seconds: 60 }))}>
                        Fast-forward 60s
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        onClick={() => run("ff3600", () => call("fast_forward", { subscription_id: selected, seconds: 3600 }))}>
                        +1h
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        onClick={() => run("clear_locks", () => call("clear_locks", { subscription_id: selected }))}>
                        Clear locks
                      </Button>
                      <Button size="sm" variant="outline" disabled={!!busy}
                        onClick={() => run("invariants", async () => {
                          const r = await call("check_invariants");
                          if ((r?.summary?.errors ?? 0) === 0 && (r?.summary?.warnings ?? 0) === 0) {
                            toast({ title: "✅ Все инварианты соблюдены" });
                          } else {
                            toast({
                              title: `❌ ${r?.summary?.errors ?? 0} ошибок · ⚠ ${r?.summary?.warnings ?? 0} предупреждений`,
                              description: (r?.issues ?? []).slice(0, 5).map((i: any) => `${i.severity === "error" ? "❌" : "⚠"} ${i.detail}`).join("\n"),
                            });
                          }
                          return r;
                        })}>
                        🛡 Проверить инварианты
                      </Button>
                    </div>
                  )}
                  {Array.isArray(inspector.events) && inspector.events.length > 0 && (
                    <Section title="Timeline">
                      <div className="space-y-1 text-xs">
                        {[...(inspector.events as EventRow[])]
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .slice(-12)
                          .map((e, i, arr) => {
                            const t = e.event_type;
                            const icon = t.includes("succeeded") ? "✅"
                              : t.includes("failed") ? "❌"
                              : t.includes("timeout") ? "⏳"
                              : t.includes("canceled") ? "🚫"
                              : t.includes("replayed") ? "🔁"
                              : t.includes("started") ? "▶"
                              : t.includes("scheduled") ? "🔁"
                              : "•";
                            return (
                              <div key={e.id}>
                                <div className="flex items-center gap-2">
                                  <span className="w-4 text-center">{icon}</span>
                                  <span className="font-mono">{t}</span>
                                  {(e.metadata as any)?.idempotent === true && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-medium">idempotent</span>
                                  )}
                                  <span className="text-muted-foreground">· {new Date(e.created_at).toLocaleTimeString()}</span>
                                </div>
                                {i < arr.length - 1 && <div className="ml-2 text-muted-foreground">↓</div>}
                              </div>
                            );
                          })}
                      </div>
                    </Section>
                  )}
                  <Section title={`Attempts (${inspector.attempts?.length ?? 0})`}>
                    <ScrollArea className="h-48">
                      <pre className="text-xs">{JSON.stringify(inspector.attempts, null, 2)}</pre>
                    </ScrollArea>
                  </Section>
                  <Section title={`Events (${inspector.events?.length ?? 0})`}>
                    <ScrollArea className="h-48">
                      <pre className="text-xs">{JSON.stringify(inspector.events, null, 2)}</pre>
                    </ScrollArea>
                  </Section>
                  <Section title={`Webhooks (${inspector.webhooks?.length ?? 0})`}>
                    <ScrollArea className="h-48">
                      <pre className="text-xs">{JSON.stringify(inspector.webhooks, null, 2)}</pre>
                    </ScrollArea>
                  </Section>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* ───── CREATE ───── */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Create sandbox subscription</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-md">
              {!sandboxEnabled && (
                <p className="text-sm text-amber-700">Включите sandbox_enabled во вкладке Flags.</p>
              )}
              <div className="space-y-1">
                <Label>Сумма (RUB)</Label>
                <Input type="number" value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Интервал</Label>
                <Select value={createForm.interval}
                  onValueChange={(v) => setCreateForm({ ...createForm, interval: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">weekly</SelectItem>
                    <SelectItem value="biweekly">biweekly</SelectItem>
                    <SelectItem value="monthly">monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Первое списание через (сек)</Label>
                <Input type="number" value={createForm.next_in_seconds}
                  onChange={(e) => setCreateForm({ ...createForm, next_in_seconds: Number(e.target.value) })} />
              </div>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white" disabled={!!busy || !sandboxEnabled}
                onClick={() => run("create", () => call("create_sandbox_subscription", createForm))}>
                Создать sandbox подписку
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── FAILURES ───── */}
        <TabsContent value="failures" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Inject failure preset</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!testMode && <p className="text-sm text-amber-700">Требуется test mode.</p>}
              {sandboxOnly.length === 0 && <p className="text-sm text-muted-foreground">Нет sandbox подписок.</p>}
              {sandboxOnly.map((s) => (
                <div key={s.id} className="border rounded-lg p-3 space-y-2">
                  <div className="text-xs font-mono">{s.id.slice(0, 8)}… · {s.amount} · {s.interval}</div>
                  <div className="flex flex-wrap gap-2">
                    {SIM_KINDS.map((k) => {
                      const danger = k === "duplicate_webhook";
                      const btn = (
                        <Button key={k} size="sm" variant="outline"
                          className={danger ? "border-orange-400 text-orange-700" : ""}
                          disabled={!!busy || !testMode}
                          onClick={danger ? undefined : () => run(`sim ${k}`, () => call("simulate", { subscription_id: s.id, kind: k }))}>
                          {k}
                        </Button>
                      );
                      if (!danger) return btn;
                      return (
                        <ConfirmButton key={k} title="Подтвердите duplicate webhook"
                          description="Будет создан дубликат attempt с одинаковым payment_id для проверки идемпотентности."
                          trigger={btn}
                          onConfirm={() => run(`sim ${k}`, () => call("simulate", { subscription_id: s.id, kind: k }))} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── CHAOS ───── */}
        <TabsContent value="chaos" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Chaos runner</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-md">
              <p className="text-sm text-muted-foreground">
                Создаёт N sandbox подписок и применяет случайный preset к каждой. Hard cap: 100.
              </p>
              <div className="space-y-1">
                <Label>Количество</Label>
                <Input type="number" min={1} max={100} value={chaosCount}
                  onChange={(e) => setChaosCount(Math.min(100, Math.max(1, Number(e.target.value))))} />
              </div>
              <ConfirmButton
                title={`Запустить chaos test для ${chaosCount} подписок?`}
                description="Будут созданы sandbox подписки и применены случайные failure-сценарии. Production данные не затронуты."
                trigger={
                  <Button className="bg-amber-500 hover:bg-amber-600 text-white"
                    disabled={!!busy || !testMode || !sandboxEnabled}>
                    Запустить chaos
                  </Button>
                }
                onConfirm={() => run("chaos", () => call("chaos_run", { count: chaosCount }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── CONSOLE ───── */}
        <TabsContent value="console" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Live console</span>
                <Badge variant="outline">auto-refresh 2s</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] font-mono text-xs">
                {events.length === 0 && <p className="text-muted-foreground font-sans text-sm">Нет событий.</p>}
                {events.map((e) => (
                  <div key={e.id} className="border-b py-1.5">
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>{" "}
                    <span className="font-bold text-amber-600">{e.event_type}</span>{" "}
                    <span className="text-muted-foreground">{e.subscription_id?.slice(0, 8)}…</span>{" "}
                    <span>{JSON.stringify(e.metadata ?? {})}</span>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── FLAGS ───── */}
        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Runtime feature flags</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {FLAG_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-sm">{k}</div>
                    <div className="text-xs text-muted-foreground">текущее: {String(settings?.[k] ?? "—")}</div>
                  </div>
                  <Switch
                    checked={settings?.[k] === true}
                    onCheckedChange={(v) => setFlag(k, v)}
                    disabled={!!busy}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Если sandbox_enabled выключен — все sandbox действия становятся inert.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── INTEGRITY ───── */}
        <TabsContent value="integrity" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Integrity scan</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {integrity == null && <p className="text-sm text-muted-foreground">Запустите scan на вкладке Overview.</p>}
              {integrity && integrity.length === 0 && <p className="text-sm text-emerald-600">Issues не найдены ✓</p>}
              {integrity?.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-sm">{i.kind}</div>
                    <div className="text-xs text-muted-foreground">count: {i.count}</div>
                  </div>
                  <Badge className={
                    i.severity === "critical" ? "bg-red-600 hover:bg-red-600 text-white" :
                    i.severity === "degraded" ? "bg-orange-500 hover:bg-orange-500 text-white" :
                    "bg-amber-400 hover:bg-amber-400 text-white"
                  }>{i.severity}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── AUDIT ───── */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Sandbox audit log</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px]">
                {audit.length === 0 && <p className="text-sm text-muted-foreground">Пусто.</p>}
                {audit.map((a) => (
                  <div key={a.id} className="border-b py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-muted-foreground font-mono">{a.actor?.slice(0, 8) ?? "—"}…</div>
                    <pre className="mt-1 bg-muted p-2 rounded">{JSON.stringify(a.payload, null, 2)}</pre>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function MetricCard({ label, value, tone }: { label: string; value: any; tone: "amber" | "blue" | "green" }) {
  const cls =
    tone === "amber" ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700" :
    tone === "blue"  ? "border-blue-300 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-700" :
                       "border-emerald-300 bg-emerald-50/60";
  return (
    <div className={`rounded-xl border ${cls} px-4 py-3`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      {children}
    </div>
  );
}

function ConfirmButton({
  title, description, trigger, onConfirm,
}: { title: string; description: string; trigger: React.ReactNode; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Подтвердить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DestroyButton({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  return (
    <ConfirmButton
      title="Удалить ВСЕ sandbox данные?"
      description="Будут удалены все is_test=true подписки, donations, attempts и связанные events. Production данные не затронуты. Действие необратимо."
      trigger={
        <Button variant="destructive" disabled={busy}>Destroy sandbox data</Button>
      }
      onConfirm={onConfirm}
    />
  );
}