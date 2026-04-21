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
import { z } from "zod";

const passwordSchema = z.string().min(8, "Минимум 8 символов").max(72);

export default function AccountSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useDonorProfile();
  const update = useUpdateProfile();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [publicName, setPublicName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [wantsNotif, setWantsNotif] = useState(true);
  const [pwd, setPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

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
    if (!r.success) { toast({ title: "Слабый пароль", description: r.error.issues[0].message, variant: "destructive" }); return; }
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: r.data });
    setPwdLoading(false);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    setPwd("");
    toast({ title: "Пароль обновлён" });
  };

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Настройки</h1>
        <p className="text-muted-foreground mt-1 text-sm">Профиль, приватность и безопасность.</p>
      </div>

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
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-lg">Безопасность</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-pwd">Новый пароль</Label>
            <Input id="new-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} />
          </div>
          <Button onClick={handlePassword} disabled={pwdLoading || !pwd}>
            {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сменить пароль"}
          </Button>
        </CardContent>
      </Card>

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