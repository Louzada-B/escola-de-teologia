import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCohort } from '@/contexts/CohortContext';
import { isDateWithinCohortFullPeriod } from '@/lib/cohortDateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, Check, X, BookOpen } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  scheduled_date: string | null;
  required_reading: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  confirmed: boolean;
  byProfessor: boolean;
}

export default function ReadingsManager() {
  const { selectedCohort } = useCohort();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, StudentRow[]>>({});

  useEffect(() => {
    load();
    setConfirmations({});
    setExpandedId(null);
  }, [selectedCohort?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('lessons')
      .select('id, title, scheduled_date, required_reading')
      .order('scheduled_date');
    const filtered = (data || []).filter((l) =>
      isDateWithinCohortFullPeriod(l.scheduled_date, selectedCohort?.start_date, selectedCohort?.end_date)
    );
    setLessons(filtered as Lesson[]);
    setLoading(false);
  };

  const startEdit = (lesson: Lesson) => {
    setEditingId(lesson.id);
    setDraftText(lesson.required_reading || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftText('');
  };

  const saveReading = async (lessonId: string) => {
    const { error } = await supabase
      .from('lessons')
      .update({ required_reading: draftText.trim() || null })
      .eq('id', lessonId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    setEditingId(null);
    await load();
    toast({ title: 'Leitura salva!' });
  };

  const loadConfirmations = async (lessonId: string) => {
    if (!selectedCohort) return;
    const { data: cohortStudents } = await supabase
      .from('cohort_students')
      .select('user_id')
      .eq('cohort_id', selectedCohort.id);
    const studentIds = (cohortStudents || []).map((cs: any) => cs.user_id);
    if (!studentIds.length) {
      setConfirmations((prev) => ({ ...prev, [lessonId]: [] }));
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds);
    const { data: confs } = await supabase
      .from('reading_confirmations')
      .select('user_id, confirmed_by_professor')
      .eq('lesson_id', lessonId);
    const confMap = new Map((confs || []).map((c: any) => [c.user_id, c]));
    const rows: StudentRow[] = (profiles || [])
      .map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email,
        confirmed: confMap.has(p.id),
        byProfessor: confMap.get(p.id)?.confirmed_by_professor || false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    setConfirmations((prev) => ({ ...prev, [lessonId]: rows }));
  };

  const toggleExpand = (lessonId: string) => {
    if (expandedId === lessonId) {
      setExpandedId(null);
    } else {
      setExpandedId(lessonId);
      if (!confirmations[lessonId]) loadConfirmations(lessonId);
    }
  };

  const toggleManualConfirmation = async (lessonId: string, studentId: string, currentlyConfirmed: boolean) => {
    if (currentlyConfirmed) {
      await supabase.from('reading_confirmations').delete().eq('lesson_id', lessonId).eq('user_id', studentId);
    } else {
      await supabase
        .from('reading_confirmations')
        .insert({ lesson_id: lessonId, user_id: studentId, confirmed_by_professor: true });
    }
    setConfirmations((prev) => {
      const { [lessonId]: _removed, ...rest } = prev;
      return rest;
    });
    loadConfirmations(lessonId);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Leituras Obrigatórias</h2>
        <p className="text-sm text-muted-foreground">
          Defina o que o aluno deve ler antes de cada aula. Aula sem texto aqui não tem leitura obrigatória.
        </p>
      </div>

      {lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma aula cadastrada nessa turma ainda.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const isExpanded = expandedId === lesson.id;
            const rows = confirmations[lesson.id] || [];
            const confirmedCount = rows.filter((r) => r.confirmed).length;
            return (
              <Card key={lesson.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-sm">{lesson.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lesson.scheduled_date
                          ? new Date(lesson.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                            })
                          : 'sem data'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lesson.required_reading && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <BookOpen className="w-3 h-3" /> Tem leitura
                        </Badge>
                      )}
                      <Button size="sm" variant="outline" onClick={() => toggleExpand(lesson.id)}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingId === lesson.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        placeholder="Ex: Capítulo 3 - A Trindade"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveReading(lesson.id)}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-muted-foreground flex-1">
                        {lesson.required_reading || 'Nenhuma leitura definida.'}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => startEdit(lesson)}>
                        {lesson.required_reading ? 'Editar' : 'Definir'}
                      </Button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        {confirmedCount} de {rows.length} alunos confirmaram
                      </p>
                      {rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum aluno vinculado a essa turma.</p>
                      ) : (
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {rows.map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-sm py-1">
                              <span className="flex items-center gap-2">
                                {r.name}
                                {r.confirmed && r.byProfessor && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">manual</Badge>
                                )}
                              </span>
                              <Button
                                size="sm"
                                variant={r.confirmed ? 'outline' : 'ghost'}
                                className="h-7 text-xs gap-1"
                                onClick={() => toggleManualConfirmation(lesson.id, r.id, r.confirmed)}
                              >
                                {r.confirmed ? (
                                  <>
                                    <Check className="w-3 h-3 text-green-600" /> Confirmado
                                  </>
                                ) : (
                                  <>
                                    <X className="w-3 h-3 text-muted-foreground" /> Não confirmou
                                  </>
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
