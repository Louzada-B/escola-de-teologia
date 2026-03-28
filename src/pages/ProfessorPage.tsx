import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Upload, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

export default function ProfessorPage() {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Gestão de Conteúdo</h1>
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList className="bg-card border">
          <TabsTrigger value="modules">Módulos & Aulas</TabsTrigger>
          <TabsTrigger value="announcements">Avisos</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="quizzes">Questionários</TabsTrigger>
          <TabsTrigger value="books">Livros</TabsTrigger>
        </TabsList>

        <TabsContent value="modules"><ModulesManager userId={user!.id} /></TabsContent>
        <TabsContent value="announcements"><AnnouncementsManager userId={user!.id} /></TabsContent>
        <TabsContent value="events"><EventsManager userId={user!.id} /></TabsContent>
        <TabsContent value="quizzes"><QuizzesManager userId={user!.id} /></TabsContent>
        <TabsContent value="books"><BooksManager userId={user!.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ModulesManager({ userId }: { userId: string }) {
  const [modules, setModules] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);

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

  const deleteModule = async (id: string) => {
    await supabase.from('modules').delete().eq('id', id);
    loadData();
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
            <select
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full border rounded-md p-2 bg-background text-foreground"
            >
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

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Módulos Existentes</h3>
        {modules.map(m => (
          <div key={m.id} className="flex items-center justify-between bg-card p-3 rounded-md border">
            <span className="font-body">{m.title} ({lessons.filter(l => l.module_id === m.id).length} aulas)</span>
            <Button variant="ghost" size="icon" onClick={() => deleteModule(m.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnouncementsManager({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const add = async () => {
    if (!title.trim() || !content.trim()) return;
    const { error } = await supabase.from('announcements').insert({ title, content, created_by: userId });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setContent('');
    toast({ title: 'Aviso publicado!' });
  };

  return (
    <Card className="card-academic">
      <CardHeader><CardTitle className="font-heading text-lg">Novo Aviso</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div><Label>Conteúdo</Label><Textarea value={content} onChange={e => setContent(e.target.value)} rows={4} /></div>
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Publicar Aviso</Button>
      </CardContent>
    </Card>
  );
}

function EventsManager({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('aula');

  const add = async () => {
    if (!title.trim() || !eventDate) return;
    const { error } = await supabase.from('calendar_events').insert({
      title, description, event_date: eventDate, event_type: eventType, created_by: userId,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setDescription(''); setEventDate(''); setEventType('aula');
    toast({ title: 'Evento criado!' });
  };

  return (
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
              <option value="aula">Aula Síncrona</option>
              <option value="prova">Prova</option>
              <option value="evento">Evento</option>
            </select>
          </div>
        </div>
        <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Criar Evento</Button>
      </CardContent>
    </Card>
  );
}

function QuizzesManager({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'objetiva' | 'dissertativa' | 'verdadeiro_falso'>('objetiva');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [expectedText, setExpectedText] = useState('');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState('');

  useEffect(() => {
    supabase.from('quizzes').select('*').order('created_at').then(({ data }) => setQuizzes(data || []));
  }, []);

  const createQuiz = async () => {
    if (!title.trim()) return;
    const { data, error } = await supabase.from('quizzes').insert({ title, created_by: userId }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setQuizzes([...quizzes, data]);
    setTitle('');
    toast({ title: 'Questionário criado!' });
  };

  const resetQuestionForm = () => {
    setQuestionText('');
    setQuestionType('objetiva');
    setOptions(['', '', '', '']);
    setCorrectOption(0);
    setExpectedText('');
  };

  const addQuestion = async () => {
    if (!selectedQuiz || !questionText.trim()) return;

    const insertData: any = {
      quiz_id: selectedQuiz,
      question: questionText,
      question_type: questionType,
      order_index: 0,
    };

    if (questionType === 'objetiva') {
      insertData.options = options.filter(o => o.trim());
      insertData.correct_option = correctOption;
    } else if (questionType === 'verdadeiro_falso') {
      insertData.options = ['Verdadeiro', 'Falso'];
      insertData.correct_option = correctOption;
    } else {
      insertData.options = [];
      insertData.correct_option = null;
      insertData.expected_text = expectedText || null;
    }

    const { error } = await supabase.from('quiz_questions').insert(insertData);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    resetQuestionForm();
    toast({ title: 'Pergunta adicionada!' });
  };

  return (
    <div className="space-y-6">
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Novo Questionário</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Quiz Aula 1" /></div>
          <Button onClick={createQuiz}><Plus className="w-4 h-4 mr-1" /> Criar</Button>
        </CardContent>
      </Card>

      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Adicionar Pergunta</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Questionário</Label>
            <select value={selectedQuiz} onChange={e => setSelectedQuiz(e.target.value)} className="w-full border rounded-md p-2 bg-background text-foreground">
              <option value="">Selecione</option>
              {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
          </div>
          <div><Label>Pergunta</Label><Textarea value={questionText} onChange={e => setQuestionText(e.target.value)} /></div>
          <div>
            <Label>Tipo de Pergunta</Label>
            <select value={questionType} onChange={e => setQuestionType(e.target.value as any)} className="w-full border rounded-md p-2 bg-background text-foreground">
              <option value="objetiva">Objetiva</option>
              <option value="dissertativa">Dissertativa</option>
              <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
            </select>
          </div>

          {questionType === 'objetiva' && (
            <>
              {options.map((opt, i) => (
                <div key={i}>
                  <Label>Opção {i + 1} {i === correctOption ? '(correta)' : ''}</Label>
                  <Input value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} />
                </div>
              ))}
              <div>
                <Label>Opção correta</Label>
                <select value={correctOption} onChange={e => setCorrectOption(Number(e.target.value))} className="w-full border rounded-md p-2 bg-background text-foreground">
                  {options.map((_, i) => <option key={i} value={i}>Opção {i + 1}</option>)}
                </select>
              </div>
            </>
          )}

          {questionType === 'verdadeiro_falso' && (
            <div>
              <Label>Resposta correta</Label>
              <select value={correctOption} onChange={e => setCorrectOption(Number(e.target.value))} className="w-full border rounded-md p-2 bg-background text-foreground">
                <option value={0}>Verdadeiro</option>
                <option value={1}>Falso</option>
              </select>
            </div>
          )}

          {questionType === 'dissertativa' && (
            <div>
              <Label>Texto esperado (referência para correção)</Label>
              <Textarea value={expectedText} onChange={e => setExpectedText(e.target.value)} placeholder="Resposta esperada do aluno..." />
            </div>
          )}

          <Button onClick={addQuestion}><Plus className="w-4 h-4 mr-1" /> Adicionar Pergunta</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BooksManager({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [description, setDescription] = useState('');

  const add = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from('book_promotions').insert({
      title, author, cover_url: coverUrl || null, purchase_url: purchaseUrl || null,
      description, created_by: userId,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setAuthor(''); setCoverUrl(''); setPurchaseUrl(''); setDescription('');
    toast({ title: 'Livro adicionado!' });
  };

  return (
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
  );
}
