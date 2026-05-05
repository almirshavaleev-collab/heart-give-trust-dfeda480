import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Heart } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const emailSchema = z.string().trim().email({ message: "Некорректный email" }).max(255);
const passwordSchema = z.string().min(8, { message: "Минимум 8 символов" }).max(72);
const nameSchema = z.string().trim().min(1, { message: "Введите имя" }).max(100);

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const fromPath = fromState ? `${fromState.pathname ?? ""}${fromState.search ?? ""}${fromState.hash ?? ""}` : null;
  const redirect = fromPath || searchParams.get("redirect") || "/account/overview";

  const [tab, setTab] = useState<"login" | "signup" | "reset">("login");

  // login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // signup
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupStatus, setSignupStatus] = useState<"idle" | "confirmation-sent" | "account-exists">("idle");

  // reset
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRes = emailSchema.safeParse(loginEmail);
    const passRes = passwordSchema.safeParse(loginPassword);
    if (!emailRes.success || !passRes.success) {
      toast({ title: "Проверьте форму", description: emailRes.success ? passRes.error.issues[0].message : emailRes.error.issues[0].message, variant: "destructive" });
      return;
    }
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailRes.data, password: passRes.data });
    setLoginLoading(false);
    if (error) {
      toast({ title: "Не удалось войти", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Добро пожаловать!" });
    navigate(redirect, { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupStatus("idle");
    const nameRes = nameSchema.safeParse(signupName);
    const emailRes = emailSchema.safeParse(signupEmail);
    const passRes = passwordSchema.safeParse(signupPassword);
    if (!nameRes.success || !emailRes.success || !passRes.success) {
      const issue = !nameRes.success ? nameRes.error.issues[0].message
        : !emailRes.success ? emailRes.error.issues[0].message
        : passRes.error!.issues[0].message;
      toast({ title: "Проверьте форму", description: issue, variant: "destructive" });
      return;
    }
    setSignupLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: emailRes.data,
      password: passRes.data,
      options: {
        emailRedirectTo: `${window.location.origin}/account/overview`,
        data: { full_name: nameRes.data },
      },
    });
    setSignupLoading(false);
    if (error) {
      toast({ title: "Не удалось зарегистрироваться", description: error.message, variant: "destructive" });
      return;
    }

    const isExistingAccount = (data.user?.identities?.length ?? 0) === 0;

    if (isExistingAccount) {
      setSignupStatus("account-exists");
      return;
    }

    setSignupStatus("confirmation-sent");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRes = emailSchema.safeParse(resetEmail);
    if (!emailRes.success) {
      toast({ title: "Некорректный email", variant: "destructive" });
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailRes.data, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      return;
    }
    setResetSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/20">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-32">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Личный кабинет</CardTitle>
            <CardDescription>Войдите или создайте аккаунт жертвователя</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
                <TabsTrigger value="reset">Сброс</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Пароль</Label>
                    <Input id="login-password" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Войти"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-6">
                {signupStatus !== "idle" ? (
                  <div className="text-center space-y-3 py-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Heart className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold">
                      {signupStatus === "confirmation-sent" ? "Подтвердите email" : "Аккаунт уже существует"}
                    </h3>
                    {signupStatus === "confirmation-sent" ? (
                      <p className="text-sm text-muted-foreground">
                        Мы отправили письмо с ссылкой подтверждения на <b>{signupEmail}</b>. Откройте его, чтобы активировать аккаунт.
                      </p>
                    ) : (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          Для адреса <b>{signupEmail}</b> уже существует аккаунт, поэтому новое письмо подтверждения не отправлялось.
                        </p>
                        <p>
                          Войдите в кабинет или используйте вкладку «Сброс», если нужно восстановить пароль.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="su-name">Имя</Label>
                      <Input id="su-name" type="text" autoComplete="name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-email">Email</Label>
                      <Input id="su-email" type="email" autoComplete="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-password">Пароль</Label>
                      <Input id="su-password" type="password" autoComplete="new-password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={8} />
                      <p className="text-xs text-muted-foreground">Минимум 8 символов</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={signupLoading}>
                      {signupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Создать аккаунт"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="reset" className="space-y-4 mt-6">
                {resetSent ? (
                  <div className="text-center space-y-3 py-4">
                    <h3 className="font-semibold">Письмо отправлено</h3>
                    <p className="text-sm text-muted-foreground">
                      Если аккаунт существует, на <b>{resetEmail}</b> придёт ссылка для восстановления пароля.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rp-email">Email</Label>
                      <Input id="rp-email" type="email" autoComplete="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={resetLoading}>
                      {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Отправить ссылку"}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Регистрируясь, вы принимаете{" "}
              <Link to="/legal#terms" className="underline hover:text-foreground">пользовательское соглашение</Link>{" "}
              и{" "}
              <Link to="/legal#privacy" className="underline hover:text-foreground">политику конфиденциальности</Link>.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}