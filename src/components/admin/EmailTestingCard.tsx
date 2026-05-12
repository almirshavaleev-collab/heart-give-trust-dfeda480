import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";

type HistoryEntry = {
  to: string;
  subject: string;
  status: "ok" | "error";
  message?: string;
  id?: string;
  timestamp: string;
};

const RUSSIAN_SUBJECT = "Тестовое письмо";
const RUSSIAN_HTML = "Почта работает 🚀Фонд Лига";

const HISTORY_KEY = "admin.email-testing.history";
const MAX_HISTORY = 10;

export default function EmailTestingCard() {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Ligafund test email");
  const [html, setHtml] = useState("<p>Привет! Это тестовое письмо из админки. 🚀</p>");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [lastStatus, setLastStatus] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    // Prefill admin email if available
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email && !to) setTo(data.user.email);
    });
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = (entry: HistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const send = async (override?: { subject?: string; html?: string }) => {
    const finalSubject = override?.subject ?? subject;
    const finalHtml = override?.html ?? html;

    if (!to.trim()) {
      toast({ variant: "destructive", title: "Укажите email получателя" });
      return;
    }
    setLoading(true);
    setLastStatus("idle");
    setLastResponse(null);

    const startedAt = new Date().toISOString();
    try {
      const { data, error } = await supabase.functions.invoke("send-email-resend", {
        body: { to: to.trim(), subject: finalSubject, html: finalHtml },
      });

      setLastResponse(data ?? error);

      if (error || !data?.ok) {
        const msg = (data && (data.error || data.detail)) || error?.message || "unknown_error";
        setLastStatus("error");
        toast({
          variant: "destructive",
          title: "❌ Ошибка отправки",
          description: String(msg),
        });
        pushHistory({
          to: to.trim(),
          subject: finalSubject,
          status: "error",
          message: String(msg),
          timestamp: startedAt,
        });
      } else {
        setLastStatus("ok");
        toast({
          title: "✅ Письмо отправлено",
          description: data.id ? `Resend ID: ${data.id}` : "Resend принял письмо",
        });
        pushHistory({
          to: to.trim(),
          subject: finalSubject,
          status: "ok",
          id: data.id,
          timestamp: startedAt,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastResponse({ error: msg });
      setLastStatus("error");
      toast({ variant: "destructive", title: "❌ Сеть/исключение", description: msg });
      pushHistory({
        to: to.trim(),
        subject: finalSubject,
        status: "error",
        message: msg,
        timestamp: startedAt,
      });
    } finally {
      setLoading(false);
    }
  };

  const sendRussian = () =>
    send({
      subject: RUSSIAN_SUBJECT,
      html: RUSSIAN_HTML,
    });

  const fromEnv =
    // not available client-side, mostly informational
    "configured via RESEND_FROM_EMAIL secret";

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Email Testing (Resend)</h2>
        </div>
        <span className="text-xs text-muted-foreground">UTF-8 / кириллица поддерживается</span>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Кому</label>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="admin@example.com"
            disabled={loading}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Тема</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            disabled={loading}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">HTML / тело письма</label>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={5}
            disabled={loading}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          📧 Send test email
        </Button>
        <Button variant="outline" onClick={sendRussian} disabled={loading}>
          🇷🇺 Send Russian test
        </Button>
      </div>

      {/* Debug block */}
      <div className="rounded-lg border bg-secondary/30 p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Debug</span>
          <span className="flex items-center gap-1">
            {lastStatus === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
            {lastStatus === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
            <span className="text-muted-foreground">
              Status: {lastStatus === "idle" ? "—" : lastStatus}
            </span>
          </span>
        </div>
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">Function:</span> send-email-resend
        </div>
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">Sender:</span> {fromEnv}
        </div>
        <div>
          <div className="font-medium text-foreground mb-1">Resend response:</div>
          <pre className="max-h-40 overflow-auto rounded bg-background p-2 text-[11px] leading-snug">
{lastResponse ? JSON.stringify(lastResponse, null, 2) : "—"}
          </pre>
        </div>
      </div>

      {/* History */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Последние отправки (до {MAX_HISTORY})</h3>
          {history.length > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => {
                setHistory([]);
                try {
                  localStorage.removeItem(HISTORY_KEY);
                } catch {
                  /* ignore */
                }
              }}
            >
              очистить
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">История пуста.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {h.status === "ok" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <span className="font-medium truncate">{h.to}</span>
                  <span className="text-muted-foreground truncate">— {h.subject}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                  {h.id && <span className="font-mono">{h.id.slice(0, 8)}…</span>}
                  {h.message && <span className="text-destructive truncate max-w-[160px]">{h.message}</span>}
                  <span>{new Date(h.timestamp).toLocaleTimeString("ru-RU")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}