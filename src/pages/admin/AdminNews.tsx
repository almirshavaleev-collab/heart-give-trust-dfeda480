import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type News = Database['public']['Tables']['news']['Row'];
type NewsInsert = Database['public']['Tables']['news']['Insert'];

const emptyNews: Partial<NewsInsert> = {
  title: '', excerpt: '', content: '', cover_image: '', published: false, published_at: null,
};

export default function AdminNews() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<News | null>(null);
  const [form, setForm] = useState<Partial<NewsInsert>>(emptyNews);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const qc = useQueryClient();

  const { data: news = [], isLoading } = useQuery({
    queryKey: ['admin-news'],
    queryFn: async () => {
      const { data, error } = await supabase.from('news').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadImage = async (file: File) => {
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('news-images').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('news-images').getPublicUrl(path);
    return publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let coverImage = form.cover_image;
      if (imageFile) coverImage = await uploadImage(imageFile);

      const payload = {
        ...form,
        cover_image: coverImage,
        published_at: form.published ? (form.published_at || new Date().toISOString()) : null,
      } as NewsInsert;

      if (editing) {
        const { error } = await supabase.from('news').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('news').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-news'] });
      setOpen(false); setEditing(null); setForm(emptyNews); setImageFile(null);
      toast.success(editing ? 'Новость обновлена' : 'Новость создана');
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-news'] }); toast.success('Новость удалена'); },
  });

  const openNew = () => { setEditing(null); setForm(emptyNews); setImageFile(null); setOpen(true); };
  const openEdit = (n: News) => { setEditing(n); setForm(n); setImageFile(null); setOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Новости</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Добавить новость</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Загрузка...</p> : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заголовок</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {news.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${n.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {n.published ? 'Опубликовано' : 'Черновик'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {n.published_at ? new Date(n.published_at).toLocaleDateString('ru-RU') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {news.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Нет новостей</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать новость' : 'Новая новость'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Заголовок</label>
              <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Анонс</label>
              <Textarea value={form.excerpt || ''} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Контент</label>
              <Textarea value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Обложка</label>
              <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.published || false} onCheckedChange={(v) => setForm({ ...form, published: v })} />
              <label className="text-sm font-medium">Опубликовать</label>
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
