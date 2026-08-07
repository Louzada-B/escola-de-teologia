import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isDateWithinCohortPeriod } from '@/lib/cohortDateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, BookOpen, UserCheck, ClipboardList, AlertTriangle, Star, FileCheck, LogIn, Clock } from 'lucide-react';
import { useCohort } from '@/contexts/CohortContext';

const RISK_CRITERIA = [
  { key: 'aula', icon: UserCheck, label: 'Aula' },
  { key: 'especial', icon: Star, label: 'Especial' },
  { key: 'quiz', icon: ClipboardList, label: 'Questionário' },
] as const;

export default function AnalyticsPage() {
  const { selectedCohortId, selectedCohortStudentIds, selectedCohort, effectiveCutoffDate, isLoading: cohortLoading } = useCohort();
  const cohortStart = selectedCohort?.start_date;
  const cohortEnd = selectedCohort?.end_date;

  const { data: allStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['analytics-students'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'aluno');
      return data || [];
    },
  });

  const students = useMemo(() => {
    if (!selectedCohortId) return allStudents;
    return allStudents.filter(s => selectedCohortStudentIds.includes(s.id));
  }, [allStudents, selectedCohortId, selectedCohortStudentIds]);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['analytics-lessons'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('*');
      return data || [];
    },
  });

  const { data: allAttendanceRecords = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['analytics-attendance'],
    queryFn: async () => {
      const { data } = await supabase.from('attendance_records').select('*');
      return data || [];
    },
  });

  const { data: allQuizzes = [] } = useQuery({
    queryKey: ['analytics-quizzes'],
    queryFn: async () => {
      const { data } = await supabase.from('quizzes').select('*');
      return data || [];
    },
  });

  const { data: allQuizResponses = [] } = useQuery({
    queryKey: ['analytics-quiz-responses'],
    queryFn: async () => {
      const { data } = await supabase.from('quiz_responses').select('*');
      return data || [];
    },
  });

  const { data: allTccSubmissions = [] } = useQuery({
    queryKey: ['analytics-tcc'],
    queryFn: async () => {
      const { data } = await supabase.from('tcc_submissions').select('user_id, cohort_id, status');
      return data || [];
    },
  });

  // Status de confirmação (já acessou / nunca acessou) -- via service role,
  // igual a tela de Alunos já usa pra "Reenviar Convites Pendentes"
  const { data: accessStatuses = {} } = useQuery({
    queryKey: ['analytics-access-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('students-status');
      if (error) throw error;
      return (data?.statuses || {}) as Record<string, { confirmed_at: string | null; last_sign_in_at: string | null }>;
    },
  });

  // Filter quizzes by cohort period
  const quizzes = useMemo(() => {
    if (!cohortStart || !cohortEnd) return allQuizzes;
    return allQuizzes.filter(q => {
      const qDate = q.available_from ? q.available_from.split('T')[0] : null;
      if (!qDate) return true;
      return qDate >= cohortStart && qDate <= cohortEnd;
    });
  }, [allQuizzes, cohortStart, cohortEnd]);

  const studentIds = useMemo(() => new Set(students.map(s => s.id)), [students]);
  const attendanceRecords = useMemo(() => {
    if (!selectedCohortId) return allAttendanceRecords;
    return allAttendanceRecords.filter(a => studentIds.has(a.user_id));
  }, [allAttendanceRecords, selectedCohortId, studentIds]);
  const quizResponses = useMemo(() => {
    if (!selectedCohortId) return allQuizResponses;
    return allQuizResponses.filter(r => studentIds.has(r.user_id));
  }, [allQuizResponses, selectedCohortId, studentIds]);
  const tccSubmissions = useMemo(() => {
    if (!selectedCohortId) return allTccSubmissions.filter(t => studentIds.has(t.user_id));
    return allTccSubmissions.filter(t => t.cohort_id === selectedCohortId);
  }, [allTccSubmissions, selectedCohortId, studentIds]);

  // Quizzes já abertos (available_from <= now ou sem data) e que contam pra conclusão — denominador correto
  const now = new Date().toISOString();
  const openedQuizzes = useMemo(() =>
    quizzes.filter((q: any) => (!q.available_from || q.available_from <= now) && q.counts_for_completion !== false),
    [quizzes]
  );
  const openedQuizIds = useMemo(() => new Set(openedQuizzes.map((q: any) => q.id)), [openedQuizzes]);
  const filteredQuizResponses = useMemo(() => {
    return quizResponses.filter(r => openedQuizIds.has(r.quiz_id));
  }, [quizResponses, openedQuizIds]);

  // Questionários encerrados vs cadastrados (visão geral)
  const closedQuizzesCount = useMemo(
    () => quizzes.filter((q: any) => q.available_until && q.available_until < now).length,
    [quizzes]
  );

  const pastLessons = useMemo(() => {
    return lessons.filter((l) => {
      return isDateWithinCohortPeriod(l.scheduled_date, cohortStart, effectiveCutoffDate);
    });
  }, [lessons, effectiveCutoffDate, cohortStart]);

  const totalStudents = students.length;
  const totalPastLessons = pastLessons.length;
  const totalLessons = cohortStart && cohortEnd
    ? lessons.filter(l => l.scheduled_date && l.scheduled_date >= cohortStart && l.scheduled_date <= cohortEnd).length
    : lessons.length;

  const pastAulas = useMemo(() => pastLessons.filter(l => l.event_type !== 'aula_especial'), [pastLessons]);
  const pastEspeciais = useMemo(() => pastLessons.filter(l => l.event_type === 'aula_especial'), [pastLessons]);

  // Risco combinado (presença aula + presença especial + questionário) — visão geral
  const combinedRiskStudents = useMemo(() => {
    return students
      .map((s) => {
        const presAula = pastAulas.filter((l) =>
          attendanceRecords.some((a) => a.lesson_id === l.id && a.user_id === s.id)
        ).length;
        const presEsp = pastEspeciais.filter((l) =>
          attendanceRecords.some((a) => a.lesson_id === l.id && a.user_id === s.id)
        ).length;
        const pctAula = pastAulas.length ? Math.round((presAula / pastAulas.length) * 100) : 100;
        const pctEsp = pastEspeciais.length ? Math.round((presEsp / pastEspeciais.length) * 100) : 100;
        const answeredQuiz = openedQuizzes.filter((q: any) =>
          filteredQuizResponses.some((r) => r.quiz_id === q.id && r.user_id === s.id)
        ).length;
        const pctQuiz = openedQuizzes.length ? Math.round((answeredQuiz / openedQuizzes.length) * 100) : 100;

        const risco = {
          aula: pctAula < 75,
          especial: pctEsp < 20,
          quiz: pctQuiz < 75,
        };
        return { name: s.full_name || s.email, pctAula, pctEsp, pctQuiz, risco };
      })
      .filter((s) => s.risco.aula || s.risco.especial || s.risco.quiz)
      .sort((a, b) => a.pctAula - b.pctAula);
  }, [students, pastAulas, pastEspeciais, attendanceRecords, openedQuizzes, filteredQuizResponses]);

  // Confirmação de acesso (já logou ao menos uma vez) — exclui nomes de teste
  const accessConfirmation = useMemo(() => {
    const relevant = students.filter((s) => !(s.full_name || '').toLowerCase().includes('teste'));
    const confirmed = relevant.filter((s) => accessStatuses[s.id]?.last_sign_in_at).length;
    const pending = relevant.length - confirmed;
    const total = relevant.length;
    return {
      confirmed,
      pending,
      confirmedPct: total ? Math.round((confirmed / total) * 100) : 0,
      pendingPct: total ? Math.round((pending / total) * 100) : 0,
    };
  }, [students, accessStatuses]);

  const progressPct = totalLessons ? Math.round((totalPastLessons / totalLessons) * 100) : 0;
  const tccPct = totalStudents ? Math.round((tccSubmissions.length / totalStudents) * 100) : 0;

  const isDataLoading = cohortLoading || studentsLoading || lessonsLoading || attendanceLoading;

  if (isDataLoading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Análises</h1>
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-heading font-bold text-foreground">Análises</h1>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="presenca">Presença</TabsTrigger>
          <TabsTrigger value="questionarios">Questionários</TabsTrigger>
          <TabsTrigger value="tcc">TCC & Certificados</TabsTrigger>
        </TabsList>

        {/* ═══════════════════ VISÃO GERAL ═══════════════════ */}
        <TabsContent value="geral" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Alunos Vinculados</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{totalStudents}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aulas</CardTitle>
                <BookOpen className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {totalPastLessons}<span className="text-lg text-muted-foreground"> / {totalLessons}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{progressPct}% realizadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Questionários</CardTitle>
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {closedQuizzesCount}<span className="text-lg text-muted-foreground"> / {quizzes.length}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">encerrados / cadastrados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">TCC</CardTitle>
                <FileCheck className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {tccSubmissions.length}<span className="text-lg text-muted-foreground"> / {totalStudents}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{tccPct}% entregues</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Alunos em Risco
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Aula: abaixo de 75% · Especial: abaixo de 20% · Questionário: abaixo de 75%
                </p>
              </CardHeader>
              <CardContent>
                {combinedRiskStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aluno em risco.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {combinedRiskStudents.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                        <span className="text-sm">{s.name}</span>
                        <div className="flex gap-1.5 shrink-0">
                          {RISK_CRITERIA.filter((c) => s.risco[c.key]).map((c) => (
                            <Badge
                              key={c.key}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0.5 gap-1 border-destructive/50 text-destructive"
                              title={c.label}
                            >
                              <c.icon className="w-3 h-3" /> {c.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-muted-foreground" />
                  Confirmação de Acesso
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Já entrou no portal ao menos uma vez, ou nunca acessou</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm">Confirmado</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {accessConfirmation.confirmed} <span className="text-muted-foreground font-normal">({accessConfirmation.confirmedPct}%)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-sm">Pendente</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {accessConfirmation.pending} <span className="text-muted-foreground font-normal">({accessConfirmation.pendingPct}%)</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ PRESENÇA ═══════════════════ */}
        <TabsContent value="presenca" className="space-y-6 mt-6">
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </TabsContent>

        {/* ═══════════════════ QUESTIONÁRIOS ═══════════════════ */}
        <TabsContent value="questionarios" className="space-y-6 mt-6">
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </TabsContent>


        {/* ═══════════════════ TCC & CERTIFICADOS ═══════════════════ */}
        <TabsContent value="tcc" className="space-y-6 mt-6">
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
