import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];

const emptyCampaign: Partial<CampaignInsert> = {
  title: '', slug: '', short_description: '', full_description: '',
  cover_image: '', target_amount: 0, collected_amount: 0,
  status: 'draft', beneficiary: '', purpose: '', sort_order: 0,
};

export default function AdminCampaigns() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<Partial<CampaignInsert>>(emptyCampaign);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  const uploadImage = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Допустимы только JPEG, PNG и WebP');
    }
    if (file.size > MAX_SIZE) {
      throw new Error('Размер файла не должен превышать 5 МБ');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    console.log('[upload] bucket:', 'campaign-images');
    console.log('[upload] original name:', file.name);
    console.log('[upload] safe path:', safeName);

    const { error } = await supabase.storage.from('campaign-images').upload(safeName, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) {
      console.error('[upload] error:', error);
      throw new Error(`Не удалось загрузить обложку: ${error.message}`);
    }
    const { data: { publicUrl } } = supabase.storage.from('campaign-images').getPublicUrl(safeName);
    console.log('[upload] publicUrl:', publicUrl);
    return publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Клиентская валидация
      if (!form.title?.trim()) throw new Error('Укажите название сбора');
      if (!form.slug?.trim()) throw new Error('Укажите slug (URL)');
      if (!form.target_amount || Number(form.target_amount) <= 0) {
        throw new Error('Целевая сумма должна быть больше 0');
      }
      if (Number(form.collected_amount ?? 0) < 0) {
        throw new Error('Собранная сумма не может быть отрицательной');
      }

      let coverImage = form.cover_image;
      if (imageFile) {
        coverImage = await uploadImage(imageFile);
      }

      const payload = { ...form, cover_image: coverImage } as CampaignInsert;

      if (editing) {
        const { error } = await supabase.from('campaigns').update(payload).eq('id', editing.id);
        if (error) throw new Error(`Ошибка обновления: ${error.message}`);
      } else {
        const { error } = await supabase.from('campaigns').insert(payload);
        if (error) throw new Error(`Ошибка создания: ${error.message}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
      setOpen(false);
      setEditing(null);
      setForm(emptyCampaign);
      setImageFile(null);
      toast.success(editing ? 'Сбор обновлён' : 'Сбор создан');
    },
    onError: (err: Error) => toast.error(err.message || 'Ошибка сохранения'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
      toast.success('Сбор удалён');
    },
    onError: (err: Error) => {
      const msg = err.message?.includes('пожертвования')
        ? 'Нельзя удалить сбор: по нему уже есть пожертвования. Переведите его в статус «Завершён».'
        : err.message || 'Не удалось удалить сбор';
      toast.error(msg);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('campaigns').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
      toast.success('Статус обновлён');
    },
    onError: (err: Error) => toast.error(err.message || 'Не удалось обновить статус'),
  });

  const openNew = () => { setEditing(null); setForm(emptyCampaign); setImageFile(null); setOpen(true); };
  const openEdit = (c: Campaign) => { setEditing(c); setForm(c); setImageFile(null); setOpen(true); };

  const statusLabel = (s: string) => ({ active: 'Активный', completed: 'Завершён', draft: 'Черновик' }[s] || s);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Сборы</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Добавить сбор</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Цель</TableHead>
                <TableHead className="text-right">Собрано</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>
                    <Select
                      value={c.status}
                      onValueChange={(v) => statusMutation.mutate({ id: c.id, status: v })}
                    >
                      <SelectTrigger className={`h-8 w-[140px] text-xs font-medium ${
                        c.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                        c.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        <SelectValue>{statusLabel(c.status)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Черновик</SelectItem>
                        <SelectItem value="active">Активный</SelectItem>
                        <SelectItem value="completed">Завершён</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">{Number(c.target_amount).toLocaleString('ru-RU')} ₽</TableCell>
                  <TableCell className="text-right">{Number(c.collected_amount).toLocaleString('ru-RU')} ₽</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {Number(c.collected_amount) >= Number(c.target_amount) && c.status !== 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => statusMutation.mutate({ id: c.id, status: 'completed' })}
                          title="Перевести сбор в статус «Завершён»"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Завершить
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingCampaign(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет сборов</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать сбор' : 'Новый сбор'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Название</label>
                <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Slug (URL)</label>
                <Input value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Краткое описание</label>
              <Textarea value={form.short_description || ''} onChange={(e) => setForm({ ...form, short_description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Полное описание</label>
              <Textarea value={form.full_description || ''} onChange={(e) => setForm({ ...form, full_description: e.target.value })} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Получатель</label>
                <Input value={form.beneficiary || ''} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Цель сбора</label>
                <Input value={form.purpose || ''} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Целевая сумма ₽</label>
                <Input type="number" value={form.target_amount || 0} onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Собрано ₽</label>
                <Input type="number" value={form.collected_amount || 0} onChange={(e) => setForm({ ...form, collected_amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Статус</label>
                <Select value={form.status || 'draft'} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="active">Активный</SelectItem>
                    <SelectItem value="completed">Завершён</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Порядок</label>
                <Input type="number" value={(form as any).sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) } as any)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Обложка</label>
              <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              {form.cover_image && <p className="text-xs text-muted-foreground truncate">Текущее: {form.cover_image}</p>}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
