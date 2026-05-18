import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDonorProfile, useUpdateProfile } from "@/hooks/useDonorData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, LogOut } from "lucide-react";
import { Info } from "lucide-react";
import { z } from "zod";
import { evaluatePassword, STRENGTH_LABEL, type PasswordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const passwordSchema = z.string().min(8, "Минимум 8 символов").max(72);

const STRENGTH_BAR: Record<PasswordStrength, { width: string; color: string }> = {
  empty:  { width: "w-0",     color: "bg-transparent" },
  weak:   { width: "w-1/3",   color: "bg-destructive" },
  medium: { width: "w-2/3",   color: "bg-amber-500" },
  strong: { width: "w-full",  color: "bg-emerald-500" },
};

export default function AccountSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useDonorProfile();
  const update = useUpdateProfile();
  const isDemo = !!profile?.is_demo;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [publicName, setPublicName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [wantsNotif, setWantsNotif] = useState(true);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const pwdEval = evaluatePassword(pwd);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setPublicName(profile.public_display_name ?? "");
      setIsPublic(profile.is_public_donor);
      setWantsNotif(profile.wants_notifications);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        public_display_name: publicName.trim() || null,
        is_public_donor: isPublic,
        wants_notifications: wantsNotif,
      });
      toast({ title: "Сохранено" });
    } catch (e) {
      toast({ title: "Ошибка", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handlePassword = async () => {
    const r = passwordSchema.safeParse(pwd);
    if (!r.success) {
      toast({ title: "Слабый пароль", description: r.error.issues[0].message, variant: "destructive" });
      return;
    }
    const { strength, hint } = evaluatePassword(pwd);
    if (strength === "weak") {
      toast({
        title: "Слабый пароль",
        description: hint ?? "Пароль слишком простой и легко угадывается. Используйте более сложный.",
        variant: "destructive",
      });
      return;
    }
    if (pwd !== pwd2) {
      toast({ title: "Пароли не совпадают", description: "Повторите пароль точно так же.", variant: "destructive" });
      return;
    }
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: r.data });
    setPwdLoading(false);
    if (error) {
      const msg = error.message || "";
      const isWeak =
        /weak|easy to guess|pwned|leaked|compromised/i.test(msg) ||
        (error as { code?: string }).code === "weak_password";
      toast({
        title: isWeak ? "Слабый пароль" : "Ошибка",
        description: isWeak
          ? "Пароль слишком простой и легко угадывается. Используйте более сложный."
          : msg,
        variant: "destructive",
      });
      return;
    }
    setPwd("");
    setPwd2("");
    toast({ title: "Пароль обновлён" });
  };

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Настройки</h1>
        <p className="text-muted-foreground mt-1 text-sm">Профиль, приватность и безопасность.</p>
      </div>

      {isDemo && (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Демо-аккаунт</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Это ознакомительный аккаунт. Смена email, пароля и удаление аккаунта отключены.
            </p>
          </div>
        </div>
      )}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-lg">Профиль</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full-name">Имя</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="public-name">Публичное имя (для списка жертвователей)</Label>
            <Input id="public-name" value={publicName} onChange={(e) => setPublicName(e.target.value)} maxLength={80} placeholder={fullName || "Например: Анна К."} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
            <div>
              <p className="text-sm font-medium">Показывать меня публично</p>
              <p className="text-xs text-muted-foreground">Имя будет видно в списке жертвователей сборов.</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
            <div>
              <p className="text-sm font-medium">Получать уведомления</p>
              <p className="text-xs text-muted-foreground">Новости фонда и подтверждения донатов на email.</p>
            </div>
            <Switch checked={wantsNotif} onCheckedChange={setWantsNotif} />
          </div>
          <Button onClick={handleSave} disabled={update.isPending || isDemo}>
            {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
          </Button>
        </CardContent>
      </Card>

      {!isDemo && <Card className="border-border">
        <CardHeader><CardTitle className="text-lg">Безопасность</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pwd">Новый пароль</Label>
            <Input id="new-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} />
            {pwd && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      STRENGTH_BAR[pwdEval.strength].width,
                      STRENGTH_BAR[pwdEval.strength].color,
                    )}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      pwdEval.strength === "weak" && "text-destructive",
                      pwdEval.strength === "medium" && "text-amber-600",
                      pwdEval.strength === "strong" && "text-emerald-600",
                    )}
                  >
                    {STRENGTH_LABEL[pwdEval.strength]}
                  </span>
                  {pwdEval.hint && (
                    <span className="text-xs text-muted-foreground">{pwdEval.hint}</span>
                  )}
                </div>
              </div>
            )}
            <ul className="text-xs text-muted-foreground leading-relaxed list-disc pl-4 space-y-0.5">
              <li>минимум 8 символов</li>
              <li>лучше добавить буквы и цифры</li>
              <li>не используйте популярные пароли (12345678, qwerty, password)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pwd-2">Повторите пароль</Label>
            <Input id="new-pwd-2" type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} minLength={8} />
            {pwd2 && pwd !== pwd2 && (
              <p className="text-xs text-destructive">Пароли не совпадают</p>
            )}
          </div>
          <Button onClick={handlePassword} disabled={pwdLoading || !pwd || !pwd2}>
            {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сменить пароль"}
          </Button>
        </CardContent>
      </Card>}

      <Card className="border-border">
        <CardContent className="p-5">
          <Button variant="outline" onClick={() => { signOut(); navigate("/"); }}>
            <LogOut className="w-4 h-4 mr-2" /> Выйти из аккаунта
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}