import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function QuizzesManager({ userId }: { userId: string }) {
  const [title, setTitle] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'objetiva' | 'dissertativa' | 'verdadeiro_falso'>('objetiva');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [expectedText, setExpectedText] = useState('');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState('');

  // Edit state
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFrom, setEditFrom] = useState('');
  const [editUntil, setEditUntil] = useState('');

  const load = async () => {
    const { data } = await supabase.from('quizzes').select('*, quiz_questions(id)').order('created_at');
    setQuizzes(data || []);
  };

  useEffect(() => { load(); }, []);

  const createQuiz = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from('quizzes').insert({
      title, created_by: userId,
      available_from: availableFrom || null,
      available_until: availableUntil || null,
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setTitle(''); setAvailableFrom(''); setAvailableUntil('');
    load();
    toast({ title: 'Questionário criado!' });
  };

  const updateQuiz = async () => {
    if (!editing || !editTitle.trim()) return;
    const { error } = await supabase.from('quizzes').update({
      title: editTitle,
      available_from: editFrom || null,
      available_until: editUntil || null,
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
    setEditing(q);
  };

  const resetQuestionForm = () => {
    setQuestionText(''); setQuestionType('objetiva');
    setOptions(['', '', '', '']); setCorrectOption(0); setExpectedText('');
  };

  const addQuestion = async () => {
    if (!selectedQuiz || !questionText.trim()) return;
    const insertData: any = {
      quiz_id: selectedQuiz, question: questionText, question_type: questionType, order_index: 0,
    };
    if (questionType === 'objetiva') {
      insertData.options = options.filter(o => o.trim());
      insertData.correct_option = correctOption;
    } else if (questionType === 'verdadeiro_falso') {
      insertData.options = ['Verdadeiro', 'Falso'];
      insertData.correct_option = correctOption;
    } else {
      insertData.options = []; insertData.correct_option = null;
      insertData.expected_text = expectedText || null;
    }
    const { error } = await supabase.from('quiz_questions').insert(insertData);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    resetQuestionForm();
    load();
    toast({ title: 'Pergunta adicionada!' });
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR') : '—';

  return (
    <div className="space-y-6">
      <Card className="card-academic">
        <CardHeader><CardTitle className="font-heading text-lg">Novo Questionário</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Quiz Aula 1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Disponível a partir de</Label><Input type="datetime-local" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} /></div>
            <div><Label>Encerra em</Label><Input type="datetime-local" value={availableUntil} onChange={e => setAvailableUntil(e.target.value)} /></div>
          </div>
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

      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Questionários Existentes</h3>
        {quizzes.map(q => (
          <div key={q.id} className="flex items-center justify-between bg-card p-3 rounded-md border">
            <div>
              <span className="font-body font-medium">{q.title}</span>
              <p className="text-sm text-muted-foreground">
                {q.quiz_questions?.length || 0} perguntas · De {formatDate(q.available_from)} até {formatDate(q.available_until)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(q)}>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => removeQuiz(q.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Questionário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Disponível a partir de</Label><Input type="datetime-local" value={editFrom} onChange={e => setEditFrom(e.target.value)} /></div>
              <div><Label>Encerra em</Label><Input type="datetime-local" value={editUntil} onChange={e => setEditUntil(e.target.value)} /></div>
            </div>
            <Button onClick={updateQuiz}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
