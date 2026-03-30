import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCohort } from '@/contexts/CohortContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type QuestionType = 'objetiva' | 'dissertativa' | 'verdadeiro_falso' | 'ligar_colunas';

interface VFPhrase { text: string; answer: boolean }
interface MatchPair { left: string; right: string }

function defaultQuestionState() {
  return {
    text: '',
    type: 'objetiva' as QuestionType,
    options: ['', '', '', ''],
    correctOption: 0,
    expectedText: '',
    vfPhrases: [{ text: '', answer: true }] as VFPhrase[],
    matchPairs: [{ left: '', right: '' }] as MatchPair[],
  };
}

export default function QuizzesManager({ userId }: { userId: string }) {
  const { selectedCohort, selectedCohortId, selectedCohortStudentIds, effectiveCutoffDate } = useCohort();
  const [title, setTitle] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState('');

  // New question form
  const [qForm, setQForm] = useState(defaultQuestionState());

  // Edit quiz dialog
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFrom, setEditFrom] = useState('');
  const [editUntil, setEditUntil] = useState('');
  const [editLessonId, setEditLessonId] = useState('');

  // Questions listing & editing
  const [quizQuestions, setQuizQuestions] = useState<Record<string, any[]>>({});
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [eqForm, setEqForm] = useState(defaultQuestionState());

  // Student quiz stats
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [quizResponses, setQuizResponses] = useState<{ quiz_id: string; user_id: string; score: number | null }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  const load = async () => {
    const [quizzesRes, lessonsRes, responsesRes, profilesRes] = await Promise.all([
      supabase.from('quizzes').select('*, quiz_questions(id), lessons(title, scheduled_date)').order('created_at'),
      supabase.from('lessons').select('id, title, scheduled_date, module_id').order('scheduled_date'),
      supabase.from('quiz_responses').select('quiz_id, user_id, score'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'aluno'),
    ]);
    let quizData = quizzesRes.data || [];
    setAllLessons(lessonsRes.data || []);

    // Filter by cohort dates
    if (selectedCohort) {
      quizData = quizData.filter((q: any) => {
        const lessonDate = q.lessons?.scheduled_date;
        if (!lessonDate) return true;
        return lessonDate >= selectedCohort.start_date && lessonDate <= effectiveCutoffDate;
      });
    }
    setQuizzes(quizData);

    if (responsesRes.data) setQuizResponses(responsesRes.data);
    if (profilesRes.data) {
      const filteredProfiles = selectedCohortId && selectedCohortStudentIds.length > 0
        ? profilesRes.data.filter((p: any) => selectedCohortStudentIds.includes(p.id))
        : selectedCohortId
        ? []
        : profilesRes.data;
      setStudents(filteredProfiles.map((p: any) => ({ id: p.id, name: p.full_name || p.email })));
    }
  };

  const loadQuestions = async (quizId: string) => {
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('order_index');
    setQuizQuestions(prev => ({ ...prev, [quizId]: data || [] }));
  };

  useEffect(() => { load(); }, [selectedCohort, effectiveCutoffDate]);

  const createQuiz = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from('quizzes').insert({
      title, created_by: userId,
      available_from: availableFrom || null,
      available_until: availableUntil || null,
      lesson_id: lessonId || null,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setAvailableFrom(''); setAvailableUntil(''); setLessonId('');
    load();
    toast({ title: 'Questionário criado!' });
  };

  const updateQuiz = async () => {
    if (!editing || !editTitle.trim()) return;
    const { error } = await supabase.from('quizzes').update({
      title: editTitle,
      available_from: editFrom || null,
      available_until: editUntil || null,
      lesson_id: editLessonId || null,
    }).eq('id', editing.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditing(null);
    load();
    toast({ title: 'Questionário atualizado!' });
  };

  const removeQuiz = async (id: string) => {
    await supabase.from('quizzes').delete().eq('id', id);
    load();
  };

  const openEdit = (q: any) => {
    setEditTitle(q.title);
    setEditFrom(q.available_from ? q.available_from.slice(0, 16) : '');
    setEditUntil(q.available_until ? q.available_until.slice(0, 16) : '');
    setEditLessonId(q.lesson_id || '');
    setEditing(q);
  };

  // Build insert data from form state
  function buildInsertData(form: ReturnType<typeof defaultQuestionState>) {
    const insertData: any = {
      question: form.text,
      question_type: form.type,
      order_index: 0,
    };
    if (form.type === 'objetiva') {
      insertData.options = form.options.filter(o => o.trim());
      insertData.correct_option = form.correctOption;
      insertData.expected_text = null;
    } else if (form.type === 'verdadeiro_falso') {
      // Store phrases as options, correct V/F mapping in expected_text
      const phrases = form.vfPhrases.filter(p => p.text.trim());
      insertData.options = phrases.map(p => p.text);
      insertData.correct_option = null;
      const vfAnswers: Record<string, string> = {};
      phrases.forEach((p, i) => { vfAnswers[String(i)] = p.answer ? 'verdadeiro' : 'falso'; });
      insertData.expected_text = JSON.stringify(vfAnswers);
    } else if (form.type === 'ligar_colunas') {
      const pairs = form.matchPairs.filter(p => p.left.trim() && p.right.trim());
      insertData.options = pairs;
      insertData.correct_option = null;
      insertData.expected_text = null;
    } else {
      insertData.options = [];
      insertData.correct_option = null;
      insertData.expected_text = form.expectedText || null;
    }
    return insertData;
  }

  const addQuestion = async () => {
    if (!selectedQuiz || !qForm.text.trim()) return;
    const insertData = { ...buildInsertData(qForm), quiz_id: selectedQuiz };
    const { error } = await supabase.from('quiz_questions').insert(insertData);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setQForm(defaultQuestionState());
    load();
    if (expandedQuiz === selectedQuiz) loadQuestions(selectedQuiz);
    toast({ title: 'Pergunta adicionada!' });
  };

  const removeQuestion = async (id: string, quizId: string) => {
    await supabase.from('quiz_questions').delete().eq('id', id);
    loadQuestions(quizId);
    load();
  };

  const openEditQuestion = (q: any) => {
    const form = defaultQuestionState();
    form.text = q.question;
    form.type = q.question_type || 'objetiva';

    if (form.type === 'objetiva') {
      form.options = Array.isArray(q.options) ? [...q.options as string[]] : ['', '', '', ''];
      while (form.options.length < 2) form.options.push('');
      form.correctOption = q.correct_option ?? 0;
    } else if (form.type === 'verdadeiro_falso') {
      const phrases = Array.isArray(q.options) ? (q.options as string[]) : [];
      let vfAnswers: Record<string, string> = {};
      try { vfAnswers = q.expected_text ? JSON.parse(q.expected_text) : {}; } catch {}
      form.vfPhrases = phrases.map((text, i) => ({
        text,
        answer: vfAnswers[String(i)] === 'verdadeiro',
      }));
      if (form.vfPhrases.length === 0) form.vfPhrases = [{ text: '', answer: true }];
    } else if (form.type === 'ligar_colunas') {
      form.matchPairs = Array.isArray(q.options) ? (q.options as MatchPair[]) : [{ left: '', right: '' }];
    } else {
      form.expectedText = q.expected_text || '';
    }

    setEqForm(form);
    setEditingQuestion(q);
  };

  const saveEditQuestion = async () => {
    if (!editingQuestion || !eqForm.text.trim()) return;
    const updateData = buildInsertData(eqForm);
    const { error } = await supabase.from('quiz_questions').update(updateData).eq('id', editingQuestion.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setEditingQuestion(null);
    loadQuestions(editingQuestion.quiz_id);
    toast({ title: 'Pergunta atualizada!' });
  };

  const toggleExpand = (quizId: string) => {
    if (expandedQuiz === quizId) {
      setExpandedQuiz(null);
    } else {
      setExpandedQuiz(quizId);
      if (!quizQuestions[quizId]) loadQuestions(quizId);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR') : '—';

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      objetiva: 'Objetiva', dissertativa: 'Dissertativa',
      verdadeiro_falso: 'V ou F', ligar_colunas: 'Ligar Colunas',
    };
    return map[t] || t;
  };

  return (
    <div className="space-y-6">
      {/* Criar questionário */}
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Novo Questionário</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Quiz Aula 1" /></div>
          <div>
            <Label>Aula vinculada</Label>
            <select value={lessonId} onChange={e => setLessonId(e.target.value)} className="w-full border rounded-md p-2 bg-background text-foreground">
              <option value="">Nenhuma (sem vínculo)</option>
              {allLessons.map(l => <option key={l.id} value={l.id}>{l.title}{l.scheduled_date ? ` (${l.scheduled_date})` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Disponível a partir de</Label><Input type="datetime-local" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} /></div>
            <div><Label>Encerra em</Label><Input type="datetime-local" value={availableUntil} onChange={e => setAvailableUntil(e.target.value)} /></div>
          </div>
          <Button onClick={createQuiz}><Plus className="w-4 h-4 mr-1" /> Criar</Button>
        </CardContent>
      </Card>

      {/* Adicionar pergunta */}
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
          <div><Label>Pergunta</Label><Textarea value={qForm.text} onChange={e => setQForm(p => ({ ...p, text: e.target.value }))} /></div>
          <div>
            <Label>Tipo de Pergunta</Label>
            <select value={qForm.type} onChange={e => setQForm(p => ({ ...p, type: e.target.value as QuestionType }))} className="w-full border rounded-md p-2 bg-background text-foreground">
              <option value="objetiva">Objetiva</option>
              <option value="dissertativa">Dissertativa</option>
              <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
              <option value="ligar_colunas">Ligar Colunas</option>
            </select>
          </div>

          <QuestionFormFields form={qForm} setForm={setQForm} />

          <Button onClick={addQuestion}><Plus className="w-4 h-4 mr-1" /> Adicionar Pergunta</Button>
        </CardContent>
      </Card>

      {/* Listagem de questionários com perguntas expansíveis */}
      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Questionários Existentes</h3>
        {quizzes.map(q => (
          <Collapsible key={q.id} open={expandedQuiz === q.id} onOpenChange={() => toggleExpand(q.id)}>
            <div className="bg-card p-3 rounded-md border">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-body font-medium">{q.title}</span>
                  <p className="text-sm text-muted-foreground">
                    {q.quiz_questions?.length || 0} perguntas · De {formatDate(q.available_from)} até {formatDate(q.available_until)}
                    {q.lessons?.title && <span className="ml-1">· Aula: {q.lessons.title}</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon">
                      {expandedQuiz === q.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(q)}>
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeQuiz(q.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="mt-3 space-y-2">
                {(quizQuestions[q.id] || []).map((question, idx) => (
                  <div key={question.id} className="flex items-start justify-between bg-muted/50 p-2 rounded text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{idx + 1}. {question.question}</p>
                      <p className="text-xs text-muted-foreground">{typeLabel(question.question_type)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditQuestion(question)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeQuestion(question.id, q.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(quizQuestions[q.id] || []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Nenhuma pergunta cadastrada.</p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Dialog editar questionário */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Questionário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div>
              <Label>Aula vinculada</Label>
              <select value={editLessonId} onChange={e => setEditLessonId(e.target.value)} className="w-full border rounded-md p-2 bg-background text-foreground">
                <option value="">Nenhuma (sem vínculo)</option>
                {allLessons.map(l => <option key={l.id} value={l.id}>{l.title}{l.scheduled_date ? ` (${l.scheduled_date})` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Disponível a partir de</Label><Input type="datetime-local" value={editFrom} onChange={e => setEditFrom(e.target.value)} /></div>
              <div><Label>Encerra em</Label><Input type="datetime-local" value={editUntil} onChange={e => setEditUntil(e.target.value)} /></div>
            </div>
            <Button onClick={updateQuiz}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog editar pergunta */}
      <Dialog open={!!editingQuestion} onOpenChange={open => !open && setEditingQuestion(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Pergunta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Pergunta</Label><Textarea value={eqForm.text} onChange={e => setEqForm(p => ({ ...p, text: e.target.value }))} /></div>
            <div>
              <Label>Tipo de Pergunta</Label>
              <select value={eqForm.type} onChange={e => setEqForm(p => ({ ...p, type: e.target.value as QuestionType }))} className="w-full border rounded-md p-2 bg-background text-foreground">
                <option value="objetiva">Objetiva</option>
                <option value="dissertativa">Dissertativa</option>
                <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
                <option value="ligar_colunas">Ligar Colunas</option>
              </select>
            </div>
            <QuestionFormFields form={eqForm} setForm={setEqForm} />
            <Button onClick={saveEditQuestion}>Salvar Pergunta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Shared form fields for creating/editing questions */
function QuestionFormFields({
  form,
  setForm,
}: {
  form: ReturnType<typeof defaultQuestionState>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof defaultQuestionState>>>;
}) {
  if (form.type === 'objetiva') {
    return (
      <>
        {form.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <Label>Opção {i + 1} {i === form.correctOption ? '(correta)' : ''}</Label>
              <Input value={opt} onChange={e => {
                const n = [...form.options]; n[i] = e.target.value; setForm(p => ({ ...p, options: n }));
              }} />
            </div>
            {form.options.length > 2 && (
              <Button variant="ghost" size="icon" className="mt-5" onClick={() => {
                const n = form.options.filter((_, idx) => idx !== i);
                const newCorrect = form.correctOption >= n.length ? n.length - 1 : form.correctOption > i ? form.correctOption - 1 : form.correctOption;
                setForm(p => ({ ...p, options: n, correctOption: newCorrect }));
              }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            )}
          </div>
        ))}
        {form.options.length < 5 && (
          <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, options: [...p.options, ''] }))}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar Opção
          </Button>
        )}
        <div>
          <Label>Opção correta</Label>
          <select value={form.correctOption} onChange={e => setForm(p => ({ ...p, correctOption: Number(e.target.value) }))} className="w-full border rounded-md p-2 bg-background text-foreground">
            {form.options.map((_, i) => <option key={i} value={i}>Opção {i + 1}</option>)}
          </select>
        </div>
      </>
    );
  }

  if (form.type === 'verdadeiro_falso') {
    return (
      <>
        <p className="text-sm text-muted-foreground">Adicione frases e marque se cada uma é Verdadeira ou Falsa.</p>
        {form.vfPhrases.map((phrase, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1">
              <Label>Frase {i + 1}</Label>
              <Input value={phrase.text} onChange={e => {
                const n = [...form.vfPhrases]; n[i] = { ...n[i], text: e.target.value }; setForm(p => ({ ...p, vfPhrases: n }));
              }} />
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Label className="text-xs whitespace-nowrap">{phrase.answer ? 'V' : 'F'}</Label>
              <Switch checked={phrase.answer} onCheckedChange={v => {
                const n = [...form.vfPhrases]; n[i] = { ...n[i], answer: v }; setForm(p => ({ ...p, vfPhrases: n }));
              }} />
            </div>
            {form.vfPhrases.length > 1 && (
              <Button variant="ghost" size="icon" className="mt-5" onClick={() => {
                setForm(p => ({ ...p, vfPhrases: p.vfPhrases.filter((_, idx) => idx !== i) }));
              }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, vfPhrases: [...p.vfPhrases, { text: '', answer: true }] }))}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar Frase
        </Button>
      </>
    );
  }

  if (form.type === 'ligar_colunas') {
    return (
      <>
        <p className="text-sm text-muted-foreground">Defina os pares (Coluna A → Coluna B).</p>
        {form.matchPairs.map((pair, i) => (
          <div key={i} className="grid grid-cols-[1fr,auto,1fr,auto] items-end gap-2">
            <div>
              <Label>Coluna A ({i + 1})</Label>
              <Input value={pair.left} onChange={e => {
                const n = [...form.matchPairs]; n[i] = { ...n[i], left: e.target.value }; setForm(p => ({ ...p, matchPairs: n }));
              }} />
            </div>
            <span className="pb-2 text-muted-foreground">→</span>
            <div>
              <Label>Coluna B ({i + 1})</Label>
              <Input value={pair.right} onChange={e => {
                const n = [...form.matchPairs]; n[i] = { ...n[i], right: e.target.value }; setForm(p => ({ ...p, matchPairs: n }));
              }} />
            </div>
            {form.matchPairs.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => {
                setForm(p => ({ ...p, matchPairs: p.matchPairs.filter((_, idx) => idx !== i) }));
              }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, matchPairs: [...p.matchPairs, { left: '', right: '' }] }))}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar Par
        </Button>
      </>
    );
  }

  // Dissertativa
  return (
    <div>
      <Label>Texto esperado (referência para correção)</Label>
      <Textarea value={form.expectedText} onChange={e => setForm(p => ({ ...p, expectedText: e.target.value }))} placeholder="Resposta esperada do aluno..." />
    </div>
  );
}
