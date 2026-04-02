import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCohort } from '@/contexts/CohortContext';
import { useCourse } from '@/contexts/CourseContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Upload, Trash2, Pencil, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EVENT_TYPES = [
  { value: 'aula', label: 'Aula' },
  { value: 'aula_especial', label: 'Aula Especial' },
  { value: 'aula_sincrona', label: 'Aula Síncrona' },
  { value: 'evento', label: 'Evento' },
];

export default function ModulesManager({ userId }: { userId: string }) {
  const { selectedCohort, effectiveCutoffDate } = useCohort();
  const { selectedCourseId } = useCourse();
  const [modules, setModules] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [professorName, setProfessorName] = useState('');
  const [eventType, setEventType] = useState('aula');
  const [mandatoryAttendance, setMandatoryAttendance] = useState(true);
  const [selectedModule, setSelectedModule] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingModule, setEditingModule] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonDesc, setEditLessonDesc] = useState('');
  const [editLessonVideo, setEditLessonVideo] = useState('');
  const [editLessonDate, setEditLessonDate] = useState('');
  const [editProfessorName, setEditProfessorName] = useState('');
  const [editEventType, setEditEventType] = useState('aula');
  const [editMandatoryAttendance, setEditMandatoryAttendance] = useState(true);
  const [editExistingFiles, setEditExistingFiles] = useState<any[]>([]);
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<any[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const { data: mods } = await supabase.from('modules').select('*').order('order_index');
    const { data: less } = await supabase.from('lessons').select('*, lesson_files(*)').order('order_index');
    setModules(mods || []);
    setLessons(less || []);
  };

  useEffect(() => { loadData(); }, [selectedCohort, effectiveCutoffDate]);

  // Filter lessons by cohort dates for display
  const filteredLessons = useMemo(() => {
    if (!selectedCohort) return lessons;
    return lessons.filter(l => {
      if (!l.scheduled_date) return true;
      return l.scheduled_date >= selectedCohort.start_date && l.scheduled_date <= selectedCohort.end_date;
    });
  }, [lessons, selectedCohort]);

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

  const sanitizeStorageFileName = (fileName: string) => {
    const extensionIndex = fileName.lastIndexOf('.');
    const extension = extensionIndex >= 0 ? fileName.slice(extensionIndex).toLowerCase() : '';
    const baseName = extensionIndex >= 0 ? fileName.slice(0, extensionIndex) : fileName;

    const sanitizedBaseName = baseName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    return `${sanitizedBaseName || 'arquivo'}-${crypto.randomUUID()}${extension}`;
  };

  const uploadFilesForLesson = async (lessonId: string, fileList: File[]) => {
    for (const file of fileList) {
      const path = `lessons/${lessonId}/${sanitizeStorageFileName(file.name)}`;
      const { error: uploadErr } = await supabase.storage.from('course-files').upload(path, file);

      if (uploadErr) {
        return `Não foi possível enviar "${file.name}": ${uploadErr.message}`;
      }

      const { error: insertErr } = await supabase.from('lesson_files').insert({
        lesson_id: lessonId,
        file_name: file.name,
        file_path: path,
        file_type: file.type,
        file_size: file.size,
      });

      if (insertErr) {
        await supabase.storage.from('course-files').remove([path]);
        return `O arquivo "${file.name}" foi enviado, mas não pôde ser registrado: ${insertErr.message}`;
      }
    }

    return null;
  };

  const addLesson = async () => {
    if (!lessonTitle.trim() || !selectedModule) return;
    const moduleLessons = lessons.filter(l => l.module_id === selectedModule);
    const { data: lessonData, error } = await supabase.from('lessons').insert({
      title: lessonTitle, description: lessonDesc, video_url: videoUrl || null,
      module_id: selectedModule, order_index: moduleLessons.length,
      scheduled_date: scheduledDate || null,
      professor_name: professorName || null,
      event_type: eventType,
      mandatory_attendance: mandatoryAttendance,
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

    let fileError: string | null = null;
    if (pendingFiles.length > 0 && lessonData) {
      fileError = await uploadFilesForLesson(lessonData.id, pendingFiles);
    }

    // Auto-create calendar event if date is set
    if (scheduledDate && lessonData) {
      await supabase.from('calendar_events').insert({
        title: lessonTitle,
        description: lessonDesc || null,
        event_date: scheduledDate,
        event_type: eventType,
        created_by: userId,
        lesson_id: lessonData.id,
      });
    }

    setLessonTitle(''); setLessonDesc(''); setVideoUrl(''); setScheduledDate('');
    setProfessorName(''); setEventType('aula'); setMandatoryAttendance(true);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadData();

    if (fileError) {
      toast({ title: 'Aula criada, mas o anexo falhou', description: fileError, variant: 'destructive' });
      return;
    }

    toast({ title: 'Aula criada!' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = '';
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEditPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = '';
    }
  };

  const removeEditPendingFile = (index: number) => {
    setEditPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const markExistingFileForDeletion = (file: any) => {
    setFilesToDelete(prev => [...prev, file]);
    setEditExistingFiles(prev => prev.filter(f => f.id !== file.id));
  };

  const updateLesson = async () => {
    if (!editingLesson || !editLessonTitle.trim()) return;
    const { error } = await supabase.from('lessons').update({
      title: editLessonTitle, description: editLessonDesc, video_url: editLessonVideo || null,
      scheduled_date: editLessonDate || null,
      professor_name: editProfessorName || null,
      event_type: editEventType,
      mandatory_attendance: editMandatoryAttendance,
    }).eq('id', editingLesson.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

    // Delete removed files
    for (const file of filesToDelete) {
      await supabase.storage.from('course-files').remove([file.file_path]);
      await supabase.from('lesson_files').delete().eq('id', file.id);
    }

    let fileError: string | null = null;
    if (editPendingFiles.length > 0) {
      fileError = await uploadFilesForLesson(editingLesson.id, editPendingFiles);
    }

    // Sync calendar event
    if (editLessonDate) {
      const { data: existing } = await supabase.from('calendar_events').select('id').eq('lesson_id', editingLesson.id).maybeSingle();
      if (existing) {
        await supabase.from('calendar_events').update({
          title: editLessonTitle,
          description: editLessonDesc || null,
          event_date: editLessonDate,
          event_type: editEventType,
        }).eq('id', existing.id);
      } else {
        await supabase.from('calendar_events').insert({
          title: editLessonTitle,
          description: editLessonDesc || null,
          event_date: editLessonDate,
          event_type: editEventType,
          created_by: userId,
          lesson_id: editingLesson.id,
        });
      }
    } else {
      // Remove calendar event if date was cleared
      await supabase.from('calendar_events').delete().eq('lesson_id', editingLesson.id);
    }

    setEditingLesson(null);
    setFilesToDelete([]);
    setEditPendingFiles([]);
    loadData();

    if (fileError) {
      toast({ title: 'Aula atualizada, mas o anexo falhou', description: fileError, variant: 'destructive' });
      return;
    }

    toast({ title: 'Aula atualizada!' });
  };

  const deleteLesson = async (id: string) => {
    await supabase.from('calendar_events').delete().eq('lesson_id', id);
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
    setEditLessonDate(l.scheduled_date || '');
    setEditProfessorName(l.professor_name || '');
    setEditEventType(l.event_type || 'aula');
    setEditMandatoryAttendance(l.mandatory_attendance ?? true);
    setEditExistingFiles(l.lesson_files || []);
    setEditPendingFiles([]);
    setFilesToDelete([]);
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
          <div><Label>Nome do Professor</Label><Input value={professorName} onChange={e => setProfessorName(e.target.value)} placeholder="Ex: Prof. João Silva" /></div>
          <div>
            <Label>Tipo de Evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="mandatory" checked={mandatoryAttendance} onCheckedChange={(v) => setMandatoryAttendance(!!v)} />
            <Label htmlFor="mandatory" className="cursor-pointer">Presença obrigatória</Label>
          </div>
          <div><Label>Data da Aula</Label><Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} /></div>
          <div><Label>Link do Vídeo (YouTube)</Label><Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
          <div>
            <Label>Arquivos (PDF, Word, PPT)</Label>
            <Input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={handleFileSelect} />
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded text-sm">
                      <span>{file.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePendingFile(i)}>
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <Button onClick={addLesson}><Upload className="w-4 h-4 mr-1" /> Criar Aula</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-heading font-semibold">Módulos Existentes</h3>
        {modules.map(m => {
          const moduleLessons = filteredLessons.filter(l => l.module_id === m.id);
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
                        <div>
                          <span>{l.title}</span>
                          {l.scheduled_date && (
                            <span className="ml-2 text-xs text-muted-foreground">({l.scheduled_date})</span>
                          )}
                        </div>
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
      <Dialog open={!!editingLesson} onOpenChange={open => { if (!open) { setEditingLesson(null); setFilesToDelete([]); setEditPendingFiles([]); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Aula</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editLessonTitle} onChange={e => setEditLessonTitle(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea value={editLessonDesc} onChange={e => setEditLessonDesc(e.target.value)} /></div>
            <div><Label>Nome do Professor</Label><Input value={editProfessorName} onChange={e => setEditProfessorName(e.target.value)} placeholder="Ex: Prof. João Silva" /></div>
            <div>
              <Label>Tipo de Evento</Label>
              <Select value={editEventType} onValueChange={setEditEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="edit-mandatory" checked={editMandatoryAttendance} onCheckedChange={(v) => setEditMandatoryAttendance(!!v)} />
              <Label htmlFor="edit-mandatory" className="cursor-pointer">Presença obrigatória</Label>
            </div>
            <div><Label>Data da Aula</Label><Input type="date" value={editLessonDate} onChange={e => setEditLessonDate(e.target.value)} /></div>
            <div><Label>Link do Vídeo</Label><Input value={editLessonVideo} onChange={e => setEditLessonVideo(e.target.value)} /></div>

            <div>
              <Label>Arquivos existentes</Label>
              {editExistingFiles.length === 0 && <p className="text-sm text-muted-foreground">Nenhum arquivo.</p>}
              <div className="space-y-1 mt-1">
                {editExistingFiles
                  .sort((a: any, b: any) => a.file_name.localeCompare(b.file_name))
                  .map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded text-sm">
                      <span>{file.file_name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markExistingFileForDeletion(file)}>
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <Label>Adicionar novos arquivos</Label>
              <Input ref={editFileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={handleEditFileSelect} />
              {editPendingFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {editPendingFiles
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded text-sm">
                        <span>{file.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeEditPendingFile(i)}>
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <Button onClick={updateLesson}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
