import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleEditor } from '@/components/ui/simple-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const toLocalDatetimeInput = (isoString: string) => {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const nowLocalInput = () => toLocalDatetimeInput(new Date().toISOString());

export default function AnnouncementsManager({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [cohortId, setCohortId] = useState<string>('');
  const [scheduledAt, setScheduledAt] = useState(nowLocalInput());
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCohortId, setEditCohortId] = useState<string>('');
  const [editScheduledAt, setEditScheduledAt] = useState('');

  const load = async () => {
    const { data: ann } = await supabase
      .from('announcements')
      .select('*')
      .order('scheduled_at', { ascending: false });
    setItems(ann || []);
  };

  useEffect(() => {
    load();
    supabase.from('cohorts').select('*').order('year', { ascending: false }).then(({ data }) => setCohorts(data || []));
  }, []);

  const add = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: 'Preencha título e conteúdo', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('announcements').insert({
      title,
      content,
      created_by: userId,
      cohort_id: cohortId || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
    } as any);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setContent(''); setCohortId(''); setScheduledAt(nowLocalInput());
    load();
    toast({ title: 'Aviso salvo!' });
  };

  const update = async () => {
    if (!editing || !editTitle.trim()) return;
    const { error } = await supabase.from('announcements').update({
      title: editTitle,
      content: editContent,
      cohort_id: editCohortId || null,
      scheduled_at: new Date(editScheduledAt).toISOString(),
    } as any).eq('id', editing.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditing(null);
    load();
    toast({ title: 'Aviso atualizado!' });
  };

  const remove = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    load();
  };

  const openEdit = (item: any) => {
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditCohortId(item.cohort_id || '');
    setEditScheduledAt(toLocalDatetimeInput(item.scheduled_at));
    setEditing(item);
  };

  const isScheduled = (item: any) => new Date(item.scheduled_at) > new Date();

  return (
    <div className="space-y-6">
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Novo Aviso</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><Label>Conteúdo</Label><SimpleEditor value={content} onChange={setContent} placeholder="Escreva o aviso aqui..." /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Turma (opcional)</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as turmas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as turmas</SelectItem>
                  {cohorts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{!c.is_active ? ' (inativa)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Publicar em</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Salvar Aviso</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Avisos Cadastrados</h3>
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aviso cadastrado.</p>}
        {items.map(item => (
          <div key={item.id} className="flex items-start justify-between bg-card p-3 rounded-md border gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-body font-medium">{item.title}</span>
                {item.cohort_id
                  ? <Badge variant="outline" className="text-xs">{cohorts.find(c => c.id === item.cohort_id)?.name}</Badge>
                  : <Badge variant="secondary" className="text-xs">Todas as turmas</Badge>
                }
                {isScheduled(item) && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 gap-1">
                    <Clock className="w-3 h-3" /> Agendado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Publica em: {format(new Date(item.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(item.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Aviso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div><Label>Conteúdo</Label><SimpleEditor value={editContent} onChange={setEditContent} placeholder="Escreva o aviso aqui..." /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Turma (opcional)</Label>
                <Select value={editCohortId} onValueChange={setEditCohortId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as turmas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as turmas</SelectItem>
                    {cohorts.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Publicar em</Label>
                <Input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={e => setEditScheduledAt(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={update}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
