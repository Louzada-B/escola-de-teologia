import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCohort } from '@/contexts/CohortContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function EventsManager({ userId }: { userId: string }) {
  const { selectedCohort, effectiveCutoffDate } = useCohort();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('aula');
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState('aula');

  const load = async () => {
    const { data } = await supabase.from('calendar_events').select('*').order('event_date', { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { load(); }, [selectedCohort, effectiveCutoffDate]);

  const filteredItems = useMemo(() => {
    if (!selectedCohort) return items;
    return items.filter(item => {
      if (!item.event_date) return true;
      return item.event_date >= selectedCohort.start_date && item.event_date <= selectedCohort.end_date;
    });
  }, [items, selectedCohort]);

  const add = async () => {
    if (!title.trim() || !eventDate) return;
    const { error } = await supabase.from('calendar_events').insert({
      title, description, event_date: eventDate, event_type: eventType, created_by: userId,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setDescription(''); setEventDate(''); setEventType('aula');
    load();
    toast({ title: 'Evento criado!' });
  };

  const update = async () => {
    if (!editing || !editTitle.trim()) return;
    const { error } = await supabase.from('calendar_events').update({
      title: editTitle, description: editDesc, event_date: editDate, event_type: editType,
    }).eq('id', editing.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditing(null);
    load();
    toast({ title: 'Evento atualizado!' });
  };

  const remove = async (id: string) => {
    await supabase.from('calendar_events').delete().eq('id', id);
    load();
  };

  const openEdit = (item: any) => {
    setEditTitle(item.title);
    setEditDesc(item.description || '');
    setEditDate(item.event_date);
    setEditType(item.event_type);
    setEditing(item);
  };

  const typeLabel: Record<string, string> = { aula: 'Aula', aula_especial: 'Aula Especial', aula_sincrona: 'Aula Síncrona', prova: 'Prova', evento: 'Evento' };

  return (
    <div className="space-y-6">
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Novo Evento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} /></div>
            <div>
              <Label>Tipo</Label>
              <select value={eventType} onChange={e => setEventType(e.target.value)} className="w-full border rounded-md p-2 bg-background text-foreground">
                <option value="aula">Aula</option>
                <option value="aula_especial">Aula Especial</option>
                <option value="aula_sincrona">Aula Síncrona</option>
                <option value="prova">Prova</option>
                <option value="evento">Evento</option>
              </select>
            </div>
          </div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Criar Evento</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Eventos Existentes</h3>
        {filteredItems.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-card p-3 rounded-md border">
            <div>
              <span className="font-body font-medium">{item.title}</span>
              <p className="text-sm text-muted-foreground">{item.event_date} · {typeLabel[item.event_type] || item.event_type}</p>
            </div>
            <div className="flex gap-1">
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
          <DialogHeader><DialogTitle>Editar Evento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
              <div>
                <Label>Tipo</Label>
                <select value={editType} onChange={e => setEditType(e.target.value)} className="w-full border rounded-md p-2 bg-background text-foreground">
                  <option value="aula">Aula</option>
                  <option value="aula_especial">Aula Especial</option>
                  <option value="aula_sincrona">Aula Síncrona</option>
                  <option value="prova">Prova</option>
                  <option value="evento">Evento</option>
                </select>
              </div>
            </div>
            <Button onClick={update}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
