import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Upload, Trash2, Pencil } from 'lucide-react';

export default function ModulesManager({ userId }: { userId: string }) {
  const [modules, setModules] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);

  // Edit state
  const [editingModule, setEditingModule] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonDesc, setEditLessonDesc] = useState('');
  const [editLessonVideo, setEditLessonVideo] = useState('');

  const loadData = async () => {
    const { data: mods } = await supabase.from('modules').select('*').order('order_index');
    const { data: less } = await supabase.from('lessons').select('*, lesson_files(*)').order('order_index');
    setModules(mods || []);
    setLessons(less || []);
  };

  useEffect(() => { loadData(); }, []);

  const addModule = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from('modules').insert({
      title, description, created_by: userId, order_index: modules.length,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setDescription('');
    loadData();
    toast({ title: 'Módulo criado!' });
  };

  const updateModule = async () => {
    if (!editingModule || !editTitle.trim()) return;
    const { error } = await supabase.from('modules').update({ title: editTitle, description: editDesc }).eq('id', editingModule.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditingModule(null);
    loadData();
    toast({ title: 'Módulo atualizado!' });
  };

  const deleteModule = async (id: string) => {
    await supabase.from('modules').delete().eq('id', id);
    loadData();
  };

  const addLesson = async () => {
    if (!lessonTitle.trim() || !selectedModule) return;
    const moduleLessons = lessons.filter(l => l.module_id === selectedModule);
    const { data: lessonData, error } = await supabase.from('lessons').insert({
      title: lessonTitle, description: lessonDesc, video_url: videoUrl || null,
      module_id: selectedModule, order_index: moduleLessons.length,
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    if (files && lessonData) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `lessons/${lessonData.id}/${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('course-files').upload(path, file);
        if (!uploadErr) {
          await supabase.from('lesson_files').insert({
            lesson_id: lessonData.id, file_name: file.name, file_path: path,
            file_type: file.type, file_size: file.size,
          });
        }
      }
    }
    setLessonTitle(''); setLessonDesc(''); setVideoUrl(''); setFiles(null);
    loadData();
    toast({ title: 'Aula criada!' });
  };

  const updateLesson = async () => {
    if (!editingLesson || !editLessonTitle.trim()) return;
    const { error } = await supabase.from('lessons').update({
      title: editLessonTitle, description: editLessonDesc, video_url: editLessonVideo || null,
    }).eq('id', editingLesson.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditingLesson(null);
    loadData();
    toast({ title: 'Aula atualizada!' });
  };

  const deleteLesson = async (id: string) => {
    await supabase.from('lessons').delete().eq('id', id);
    loadData();
  };

  const openEditModule = (m: any) => {
    setEditTitle(m.title);
    setEditDesc(m.description || '');
    setEditingModule(m);
  };

  const openEditLesson = (l: any) => {
    setEditLessonTitle(l.title);
    setEditLessonDesc(l.description || '');
    setEditLessonVideo(l.video_url || '');
    setEditingLesson(l);
  };

  return (
    <div className="space-y-6">
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Novo Módulo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Antigo Testamento" /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do módulo" /></div>
          <Button onClick={addModule}><Plus className="w-4 h-4 mr-1" /> Criar Módulo</Button>
        </CardContent>
      </Card>

      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Nova Aula</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Módulo</Label>
            <select value={selectedModule} onChange={e => setSelectedModule(e.target.value)} className="w-full border rounded-md p-2 bg-background text-foreground">
              <option value="">Selecione um módulo</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div><Label>Título da Aula</Label><Input value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={lessonDesc} onChange={e => setLessonDesc(e.target.value)} /></div>
          <div><Label>Link do Vídeo (YouTube)</Label><Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
          <div>
            <Label>Arquivos (PDF, Word, PPT)</Label>
            <Input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={e => setFiles(e.target.files)} />
          </div>
          <Button onClick={addLesson}><Upload className="w-4 h-4 mr-1" /> Criar Aula</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold">Módulos Existentes</h3>
        {modules.map(m => {
          const moduleLessons = lessons.filter(l => l.module_id === m.id);
          return (
            <Card key={m.id} className="border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-body font-medium">{m.title} ({moduleLessons.length} aulas)</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditModule(m)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteModule(m.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {moduleLessons.length > 0 && (
                  <div className="pl-4 space-y-2">
                    {moduleLessons.map(l => (
                      <div key={l.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-md text-sm">
                        <span>{l.title}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLesson(l)}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteLesson(l.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Module Dialog */}
      <Dialog open={!!editingModule} onOpenChange={open => !open && setEditingModule(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Módulo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} /></div>
            <Button onClick={updateModule}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lesson Dialog */}
      <Dialog open={!!editingLesson} onOpenChange={open => !open && setEditingLesson(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Aula</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editLessonTitle} onChange={e => setEditLessonTitle(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea value={editLessonDesc} onChange={e => setEditLessonDesc(e.target.value)} /></div>
            <div><Label>Link do Vídeo</Label><Input value={editLessonVideo} onChange={e => setEditLessonVideo(e.target.value)} /></div>
            <Button onClick={updateLesson}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
