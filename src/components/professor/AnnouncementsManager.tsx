import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCohort } from '@/contexts/CohortContext';
import { useCourse } from '@/contexts/CourseContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleEditor } from '@/components/ui/simple-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function AnnouncementsManager({ userId }: { userId: string }) {
  const { selectedCohort, effectiveCutoffDate } = useCohort();
  const { selectedCourseId } = useCourse();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const load = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { load(); }, [selectedCohort, effectiveCutoffDate]);

  const filteredItems = useMemo(() => {
    if (!selectedCohort) return items;
    return items.filter(item => {
      const date = item.created_at?.split('T')[0];
      if (!date) return true;
      return date >= selectedCohort.start_date && date <= effectiveCutoffDate;
    });
  }, [items, selectedCohort, effectiveCutoffDate]);

  const add = async () => {
    if (!title.trim() || !content.trim()) return;
    const { error } = await supabase.from('announcements').insert({ title, content, created_by: userId });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setContent('');
    load();
    toast({ title: 'Aviso publicado!' });
  };

  const update = async () => {
    if (!editing || !editTitle.trim()) return;
    const { error } = await supabase.from('announcements').update({ title: editTitle, content: editContent }).eq('id', editing.id);
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
    setEditing(item);
  };

  return (
    <div className="space-y-6">
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Novo Aviso</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><Label>Conteúdo</Label><SimpleEditor value={content} onChange={setContent} placeholder="Escreva o aviso aqui..." /></div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Publicar Aviso</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Avisos Existentes</h3>
        {filteredItems.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-card p-3 rounded-md border">
            <div>
              <span className="font-body font-medium">{item.title}</span>
              <p className="text-sm text-muted-foreground line-clamp-1">{item.content}</p>
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
          <DialogHeader><DialogTitle>Editar Aviso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div><Label>Conteúdo</Label><SimpleEditor value={editContent} onChange={setEditContent} placeholder="Escreva o aviso aqui..." /></div>
            <Button onClick={update}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
