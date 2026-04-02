import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCourse } from '@/contexts/CourseContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function BooksManager({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editPurchase, setEditPurchase] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const load = async () => {
    const { data } = await supabase.from('book_promotions').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from('book_promotions').insert({
      title, author, cover_url: coverUrl || null, purchase_url: purchaseUrl || null,
      description, created_by: userId,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setAuthor(''); setCoverUrl(''); setPurchaseUrl(''); setDescription('');
    load();
    toast({ title: 'Livro adicionado!' });
  };

  const update = async () => {
    if (!editing || !editTitle.trim()) return;
    const { error } = await supabase.from('book_promotions').update({
      title: editTitle, author: editAuthor, cover_url: editCover || null,
      purchase_url: editPurchase || null, description: editDesc,
    }).eq('id', editing.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditing(null);
    load();
    toast({ title: 'Livro atualizado!' });
  };

  const remove = async (id: string) => {
    await supabase.from('book_promotions').delete().eq('id', id);
    load();
  };

  const openEdit = (item: any) => {
    setEditTitle(item.title);
    setEditAuthor(item.author || '');
    setEditCover(item.cover_url || '');
    setEditPurchase(item.purchase_url || '');
    setEditDesc(item.description || '');
    setEditing(item);
  };

  return (
    <div className="space-y-6">
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Nova Promoção de Livro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><Label>Autor</Label><Input value={author} onChange={e => setAuthor(e.target.value)} /></div>
          <div><Label>URL da Capa</Label><Input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Link de Compra</Label><Input value={purchaseUrl} onChange={e => setPurchaseUrl(e.target.value)} placeholder="https://..." /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Adicionar Livro</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Livros Existentes</h3>
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-card p-3 rounded-md border">
            <div>
              <span className="font-body font-medium">{item.title}</span>
              <p className="text-sm text-muted-foreground">{item.author || 'Sem autor'}</p>
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
          <DialogHeader><DialogTitle>Editar Livro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div><Label>Autor</Label><Input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} /></div>
            <div><Label>URL da Capa</Label><Input value={editCover} onChange={e => setEditCover(e.target.value)} /></div>
            <div><Label>Link de Compra</Label><Input value={editPurchase} onChange={e => setEditPurchase(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} /></div>
            <Button onClick={update}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
