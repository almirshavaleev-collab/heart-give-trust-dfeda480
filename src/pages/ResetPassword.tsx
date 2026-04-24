import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const passwordSchema = z.string().min(8, { message: "Минимум 8 символов" }).max(72);

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Признаки recovery-ссылки в URL (hash для implicit flow, query для PKCE/code flow)
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hasRecoveryHash = hash.includes("type=recovery") || hash.includes("access_token");
    const hasRecoveryQuery = search.includes("type=recovery") || search.includes("code=");
    const looksLikeRecoveryLink = hasRecoveryHash || hasRecoveryQuery;

    // Сначала подписываемся, чтобы не пропустить PASSWORD_RECOVERY/SIGNED_IN из URL
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session) setValid(true);
        setReady(true);
      } else if (event === "INITIAL_SESSION") {
        if (session) setValid(true);
        // Если нет признаков recovery в URL — можно считать инициализацию завершённой
        if (!looksLikeRecoveryLink) setReady(true);
      } else if (event === "SIGNED_OUT") {
        setValid(false);
      }
    });

    // Параллельно — проверяем уже существующую сессию
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setValid(true);
        setReady(true);
      } else if (!looksLikeRecoveryLink) {
        // Нет сессии и нет recovery-параметров — ссылка невалидна
        setReady(true);
      }
      // Иначе ждём PASSWORD_RECOVERY из onAuthStateChange
    });

    // Защитный таймаут, чтобы не показывать спиннер бесконечно
    const timeout = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = passwordSchema.safeParse(password);
    if (!res.success) {
      toast({ title: "Слабый пароль", description: res.error.issues[0].message, variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Пароли не совпадают", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: res.data });
    setLoading(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Пароль обновлён" });
    navigate("/account/overview", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/20">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-32">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <CardTitle>Новый пароль</CardTitle>
            <CardDescription>Придумайте пароль для входа в личный кабинет</CardDescription>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Проверяем ссылку восстановления...</p>
              </div>
            ) : !valid ? (
              <p className="text-sm text-muted-foreground">
                Ссылка недействительна или истекла. Запросите восстановление пароля заново.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-pass">Новый пароль</Label>
                  <Input id="new-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conf-pass">Повторите пароль</Label>
                  <Input id="conf-pass" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить пароль"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}