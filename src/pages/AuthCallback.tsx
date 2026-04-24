import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ALLOWED_NEXT_PATHS = new Set<string>([
  "/reset-password",
  "/account/overview",
  "/account/donations",
  "/account/subscriptions",
  "/account/achievements",
  "/account/settings",
]);
const DEFAULT_NEXT = "/reset-password";

function safeNext(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  // Только относительные пути, без protocol-relative и без обратных слэшей
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return DEFAULT_NEXT;
  }
  // Отрезаем query/hash для проверки по whitelist
  const pathOnly = raw.split("?")[0].split("#")[0];
  return ALLOWED_NEXT_PATHS.has(pathOnly) ? raw : DEFAULT_NEXT;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const search = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(
          window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
        );

        const code = search.get("code");
        const next = safeNext(search.get("next"));
        const errDesc = search.get("error_description") || hash.get("error_description");

        if (errDesc) {
          if (!cancelled) setError(errDesc);
          return;
        }

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            if (!cancelled) setError("Ссылка восстановления устарела или недействительна. Запросите новую ссылку.");
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session) {
          navigate(next, { replace: true });
        } else {
          setError("Ссылка восстановления устарела или недействительна. Запросите новую ссылку.");
        }
      } catch {
        if (!cancelled) {
          setError("Ссылка восстановления устарела или недействительна. Запросите новую ссылку.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-secondary/20">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-32">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <CardTitle>Восстановление пароля</CardTitle>
            <CardDescription>
              {error ? "Не удалось подтвердить ссылку" : "Подтверждаем ссылку из письма"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!error ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Проверяем ссылку восстановления...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button asChild className="w-full">
                  <Link to="/auth?mode=reset">Запросить новую ссылку</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
