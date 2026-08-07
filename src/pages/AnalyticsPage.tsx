import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isDateWithinCohortPeriod } from '@/lib/cohortDateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Cell, Tooltip,
} from 'recharts';
import { Users, BookOpen, UserCheck, ClipboardList, AlertTriangle, Star, FileCheck, LogIn, Clock } from 'lucide-react';
import AccessChart from '@/components/analytics/AccessChart';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

  const avgAttendance = useMemo(() => {
    if (!totalStudents || !pastLessons.length) return 0;
    const totalPossible = totalStudents * pastLessons.length;
    const totalPresent = pastLessons.reduce((sum, l) => {
      return sum + attendanceRecords.filter((a) => a.lesson_id === l.id).length;
    }, 0);
    return Math.round((totalPresent / totalPossible) * 100);
  }, [totalStudents, pastLessons, attendanceRecords]);

  const attendanceEvolution = useMemo(() => {
    return pastLessons
      .sort((a, b) => (a.scheduled_date! > b.scheduled_date! ? 1 : -1))
      .map((l) => ({
        name: format(parseISO(l.scheduled_date!), 'dd/MM', { locale: ptBR }),
        title: l.title,
        presentes: attendanceRecords.filter((a) => a.lesson_id === l.id).length,
      }));
  }, [pastLessons, attendanceRecords]);

  const studentRanking = useMemo(() => {
    return students
      .map((s) => {
        const presencas = pastLessons.filter((l) =>
          attendanceRecords.some((a) => a.lesson_id === l.id && a.user_id === s.id)
        ).length;
        const pct = pastLessons.length ? Math.round((presencas / pastLessons.length) * 100) : 0;
        return { name: s.full_name || s.email, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [students, pastLessons, attendanceRecords]);

  const lessonAttendance = useMemo(() => {
    return pastLessons.map((l) => ({
      name: l.title.length > 15 ? l.title.slice(0, 15) + '…' : l.title,
      presentes: attendanceRecords.filter((a) => a.lesson_id === l.id).length,
      id: l.id,
    }));
  }, [pastLessons, attendanceRecords]);

  const minAttendance = useMemo(
    () => Math.min(...lessonAttendance.map((l) => l.presentes), Infinity),
    [lessonAttendance]
  );
  const maxAttendance = useMemo(
    () => Math.max(...lessonAttendance.map((l) => l.presentes), -Infinity),
    [lessonAttendance]
  );

  const pastAulas = useMemo(() => pastLessons.filter(l => l.event_type !== 'aula_especial'), [pastLessons]);
  const pastEspeciais = useMemo(() => pastLessons.filter(l => l.event_type === 'aula_especial'), [pastLessons]);

  // Risco por presença (detalhe — aba Presença)
  const atRiskStudents = useMemo(() => {
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
        const faltasAula = pastAulas.length - presAula;
        const faltasEsp = pastEspeciais.length - presEsp;
        const riscoAula = pctAula < 75;
        const riscoEsp = pctEsp < 20;
        return { name: s.full_name || s.email, pctAula, pctEsp, faltasAula, faltasEsp, riscoAula, riscoEsp };
      })
      .filter((s) => s.riscoAula || s.riscoEsp)
      .sort((a, b) => a.pctAula - b.pctAula);
  }, [students, pastAulas, pastEspeciais, attendanceRecords]);

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

  const zeroAttendanceStudents = useMemo(() => {
    const pastLessonIds = new Set(pastLessons.map(l => l.id));
    const studentIdsWithAttendance = new Set(
      attendanceRecords.filter(a => pastLessonIds.has(a.lesson_id)).map(a => a.user_id)
    );
    return students.filter((s) => !studentIdsWithAttendance.has(s.id));
  }, [students, attendanceRecords, pastLessons]);

  const zeroQuizStudents = useMemo(() => {
    const studentIdsWithResponse = new Set(filteredQuizResponses.map((r) => r.user_id));
    return students.filter((s) => !studentIdsWithResponse.has(s.id));
  }, [students, filteredQuizResponses]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Média de Presença</CardTitle>
                <UserCheck className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{avgAttendance}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Progresso do Curso — {totalPastLessons} de {totalLessons} aulas ({progressPct}%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progressPct} className="h-3" />
              </CardContent>
            </Card>
          </div>

          {attendanceEvolution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução da Presença</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attendanceEvolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                      <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [`${value} alunos`, 'Presentes']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.title || label}
                      />
                      <Line type="monotone" dataKey="presentes" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {studentRanking.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ranking de Presença por Aluno</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: Math.max(300, studentRanking.length * 32) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={studentRanking} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={110} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [`${value}%`, 'Presença']}
                      />
                      <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                        {studentRanking.map((_, i) => (
                          <Cell key={i} fill="hsl(var(--primary))" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {lessonAttendance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Presença por Aula</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lessonAttendance}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [`${value} alunos`, 'Presentes']}
                      />
                      <Bar dataKey="presentes" radius={[4, 4, 0, 0]}>
                        {lessonAttendance.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.presentes === minAttendance && lessonAttendance.length > 1
                                ? 'hsl(0, 72%, 51%)'
                                : entry.presentes === maxAttendance && lessonAttendance.length > 1
                                ? 'hsl(142, 71%, 45%)'
                                : 'hsl(var(--primary))'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <AccessChart />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Risco — Presença
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Aula: abaixo de 75% · Aula Especial: abaixo de 20%</p>
              </CardHeader>
              <CardContent>
                {atRiskStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aluno em risco.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">Nome</th>
                          <th className="text-center py-2 text-muted-foreground font-medium">% Aula</th>
                          <th className="text-center py-2 text-muted-foreground font-medium">Faltas Aula</th>
                          <th className="text-center py-2 text-muted-foreground font-medium">% Especial</th>
                          <th className="text-center py-2 text-muted-foreground font-medium">Faltas Esp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atRiskStudents.map((s, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2 flex items-center gap-2">
                              {s.riscoAula && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">A</Badge>}
                              {s.riscoEsp && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive text-destructive">E</Badge>}
                              {s.name}
                            </td>
                            <td className={`text-center py-2 ${s.riscoAula ? 'text-destructive font-semibold' : ''}`}>{s.pctAula}%</td>
                            <td className="text-center py-2">{s.faltasAula}</td>
                            <td className={`text-center py-2 ${s.riscoEsp ? 'text-destructive font-semibold' : ''}`}>{s.pctEsp}%</td>
                            <td className="text-center py-2">{s.faltasEsp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nunca Registraram Presença</CardTitle>
              </CardHeader>
              <CardContent>
                {zeroAttendanceStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todos os alunos registraram presença ao menos uma vez.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {zeroAttendanceStudents.map((s) => (
                      <Badge key={s.id} variant="outline" className="text-sm">
                        {s.full_name || s.email}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ QUESTIONÁRIOS ═══════════════════ */}
        <TabsContent value="questionarios" className="space-y-6 mt-6">
          <Card className="max-w-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Respostas</CardTitle>
              <ClipboardList className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {filteredQuizResponses.length} <span className="text-lg text-muted-foreground">/ {openedQuizzes.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">respostas / questionários abertos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Não Responderam Nenhum Questionário</CardTitle>
            </CardHeader>
            <CardContent>
              {zeroQuizStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todos os alunos responderam ao menos um questionário.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {zeroQuizStudents.map((s) => (
                    <Badge key={s.id} variant="outline" className="text-sm">
                      {s.full_name || s.email}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">Mais análises de questionários (desempenho, ranking, perguntas mais erradas) chegam numa próxima etapa.</p>
        </TabsContent>

        {/* ═══════════════════ TCC & CERTIFICADOS ═══════════════════ */}
        <TabsContent value="tcc" className="space-y-6 mt-6">
          <p className="text-sm text-muted-foreground">Em breve.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
