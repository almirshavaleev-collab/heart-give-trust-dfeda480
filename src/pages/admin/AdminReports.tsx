import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Report = Database['public']['Tables']['reports']['Row'];
type ReportInsert = Database['public']['Tables']['reports']['Insert'];

const emptyReport: Partial<ReportInsert> = { title: '', year: new Date().getFullYear(), category: '' };

export default function AdminReports() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<ReportInsert>>(emptyReport);
  const [file, setFile] = useState<File | null>(null);
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('reports').select('*').order('year', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Выберите PDF-файл');
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('report-files').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('report-files').getPublicUrl(path);

      const payload: ReportInsert = {
        title: form.title!,
        file_url: publicUrl,
        year: form.year || null,
        category: form.category || null,
      };

      const { error } = await supabase.from('reports').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      setOpen(false); setForm(emptyReport); setFile(null);
      toast.success('Отчёт загружен');
    },
    onError: (e) => toast.error(e.message || 'Ошибка загрузки'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-reports'] }); toast.success('Отчёт удалён'); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Отчёты</h1>
        <Button onClick={() => { setForm(emptyReport); setFile(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Загрузить отчёт
        </Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Загрузка...</p> : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Год</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Файл</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.year || '—'}</TableCell>
                  <TableCell>{r.category || '—'}</TableCell>
                  <TableCell>
                    {r.file_url ? (
                      <a href={r.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <FileText className="h-3.5 w-3.5" />PDF<ExternalLink className="h-3 w-3" />
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {reports.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет отчётов</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить отчёт</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название</label>
              <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Год</label>
                <Input type="number" value={form.year || ''} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Категория</label>
                <Input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Финансовый, годовой..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">PDF-файл</label>
              <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Загрузка...' : 'Загрузить'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
