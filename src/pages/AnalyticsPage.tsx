import { useMemo, useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isDateWithinCohortPeriod, lessonHasPassed } from '@/lib/cohortDateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Cell, Tooltip,
} from 'recharts';
import { Users, BookOpen, ClipboardList, AlertTriangle, FileCheck, BookOpenCheck, Download } from 'lucide-react';
import { useCohort } from '@/contexts/CohortContext';

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

  // TCC só entra no painel depois que o período de entrega abriu -- mesma
  // regra usada no DashboardHome (tcc_settings.accept_from).
  const { data: tccSettings } = useQuery({
    queryKey: ['analytics-tcc-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('tcc_settings').select('accept_from').limit(1).maybeSingle();
      return data as { accept_from: string | null } | null;
    },
  });
  const tccOpen = Boolean(tccSettings?.accept_from && new Date(tccSettings.accept_from) <= new Date());

  const { data: allReadingConfirmations = [] } = useQuery({
    queryKey: ['analytics-reading-confirmations'],
    queryFn: async () => {
      const { data } = await supabase.from('reading_confirmations').select('user_id, lesson_id');
      return data || [];
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
  const readingConfirmations = useMemo(() => {
    if (!selectedCohortId) return allReadingConfirmations;
    return allReadingConfirmations.filter(r => studentIds.has(r.user_id));
  }, [allReadingConfirmations, selectedCohortId, studentIds]);

  // Quizzes já vencidos (available_until já passou) e que contam pra conclusão
  // -- denominador do % de questionários. Um questionário ainda dentro do
  // prazo NÃO entra na conta, mesmo já aberto e sem resposta ainda (mesma
  // regra da Leitura: só pesa depois que o prazo passou). Sem available_until
  // definido, o questionário nunca "vence" sozinho, então nunca entra aqui.
  const now = new Date().toISOString();
  const dueQuizzes = useMemo(() =>
    quizzes.filter((q: any) => q.available_until && q.available_until < now && q.counts_for_completion !== false),
    [quizzes]
  );
  const dueQuizIds = useMemo(() => new Set(dueQuizzes.map((q: any) => q.id)), [dueQuizzes]);
  const dueQuizResponses = useMemo(() => {
    return quizResponses.filter(r => dueQuizIds.has(r.quiz_id));
  }, [quizResponses, dueQuizIds]);

  // Questionários encerrados vs cadastrados (visão geral)
  const closedQuizzesCount = useMemo(
    () => quizzes.filter((q: any) => q.available_until && q.available_until < now).length,
    [quizzes]
  );

  // Aulas com leitura obrigatória cadastrada, dentro do período da turma
  // (denominador do card "Leituras" -- quantas leituras existem, não quantas
  // confirmações de aluno existem).
  const readingLessons = useMemo(() => {
    return lessons.filter((l: any) => {
      if (!l.required_reading || !l.scheduled_date) return false;
      if (cohortStart && l.scheduled_date < cohortStart) return false;
      if (cohortEnd && l.scheduled_date > cohortEnd) return false;
      return true;
    });
  }, [lessons, cohortStart, cohortEnd]);

  // Das leituras cadastradas, quais já venceram o prazo (aula com leitura
  // cujo horário de início já passou).
  const pastReadingLessons = useMemo(() => {
    const nowDate = new Date();
    return readingLessons.filter((l: any) => {
      const dt = new Date(`${l.scheduled_date}T${l.start_time || '23:59'}`);
      return dt <= nowDate;
    });
  }, [readingLessons]);

  // "Realizada" = dentro do período da turma E o horário da aula já passou
  // (isDateWithinCohortPeriod sozinho deixava passar aulas de HOJE que ainda
  // nem começaram, contando como "realizadas" antes da hora).
  const pastLessons = useMemo(() => {
    return lessons.filter((l) => {
      return isDateWithinCohortPeriod(l.scheduled_date, cohortStart, effectiveCutoffDate) && lessonHasPassed(l);
    });
  }, [lessons, effectiveCutoffDate, cohortStart]);

  const totalStudents = students.length;
  const totalPastLessons = pastLessons.length;
  const totalLessons = cohortStart && cohortEnd
    ? lessons.filter(l => l.scheduled_date && l.scheduled_date >= cohortStart && l.scheduled_date <= cohortEnd).length
    : lessons.length;

  const pastAulas = useMemo(() => pastLessons.filter(l => l.event_type !== 'aula_especial'), [pastLessons]);
  const pastEspeciais = useMemo(() => pastLessons.filter(l => l.event_type === 'aula_especial'), [pastLessons]);

  // ── Aba Presença ──
  // Cada quadro tem seu próprio toggle aula regular / aula especial,
  // independente um do outro.
  const [presencaTipoGrafico, setPresencaTipoGrafico] = useState<'aula' | 'especial'>('aula');
  const [presencaTipoDistribuicao, setPresencaTipoDistribuicao] = useState<'aula' | 'especial'>('aula');
  const presencaLessonsGrafico = presencaTipoGrafico === 'aula' ? pastAulas : pastEspeciais;

  const lessonAttendance = useMemo(() => {
    return [...presencaLessonsGrafico]
      .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
      .map((l) => ({
        name: l.title.length > 15 ? l.title.slice(0, 15) + '…' : l.title,
        presentes: attendanceRecords.filter((a) => a.lesson_id === l.id).length,
        id: l.id,
      }));
  }, [presencaLessonsGrafico, attendanceRecords]);

  const minAttendance = useMemo(
    () => Math.min(...lessonAttendance.map((l) => l.presentes), Infinity),
    [lessonAttendance]
  );
  const maxAttendance = useMemo(
    () => Math.max(...lessonAttendance.map((l) => l.presentes), -Infinity),
    [lessonAttendance]
  );

  // Presença por aluno (base pra risco detalhado e distribuição)
  const studentAttendanceStats = useMemo(() => {
    return students.map((s) => {
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
      return {
        name: (s.full_name || s.email).toUpperCase(),
        pctAula, pctEsp, faltasAula, faltasEsp,
        riscoAula: pctAula < 75,
        riscoEsp: pctEsp < 20,
      };
    });
  }, [students, pastAulas, pastEspeciais, attendanceRecords]);

  const atRiskStudents = useMemo(() => {
    return studentAttendanceStats
      .filter((s) => s.riscoAula || s.riscoEsp)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [studentAttendanceStats]);

  // Distribuição da turma por faixa de presença -- tem seu próprio toggle,
  // independente do gráfico de barras acima.
  const attendanceDistribution = useMemo(() => {
    const buckets = [
      { label: '≥ 90%', min: 90, max: 101, color: 'hsl(142, 71%, 45%)' },
      { label: '75% – 89%', min: 75, max: 90, color: 'hsl(var(--primary))' },
      { label: '50% – 74%', min: 50, max: 75, color: 'hsl(38, 92%, 50%)' },
      { label: '< 50%', min: -1, max: 50, color: 'hsl(0, 72%, 51%)' },
    ];
    const pctKey = presencaTipoDistribuicao === 'aula' ? 'pctAula' : 'pctEsp';
    return buckets.map((b) => ({
      ...b,
      count: studentAttendanceStats.filter((s) => s[pctKey] >= b.min && s[pctKey] < b.max).length,
    }));
  }, [studentAttendanceStats, presencaTipoDistribuicao]);

  const zeroAttendanceStudents = useMemo(() => {
    const pastLessonIds = new Set(pastLessons.map(l => l.id));
    const studentIdsWithAttendance = new Set(
      attendanceRecords.filter(a => pastLessonIds.has(a.lesson_id)).map(a => a.user_id)
    );
    return students
      .filter((s) => !studentIdsWithAttendance.has(s.id))
      .map((s) => ({ id: s.id, name: (s.full_name || s.email).toUpperCase() }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [students, attendanceRecords, pastLessons]);

  // Percentuais por aluno (aula + aula especial + questionário + leitura) —
  // visão geral, ordem alfabética, todos os alunos (não só quem está em risco).
  const studentPercentages = useMemo(() => {
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
        const answeredQuiz = dueQuizzes.filter((q: any) =>
          dueQuizResponses.some((r) => r.quiz_id === q.id && r.user_id === s.id)
        ).length;
        const pctQuiz = dueQuizzes.length ? Math.round((answeredQuiz / dueQuizzes.length) * 100) : 100;
        const confirmedReadings = pastReadingLessons.filter((l: any) =>
          readingConfirmations.some((r) => r.lesson_id === l.id && r.user_id === s.id)
        ).length;
        const pctLeitura = pastReadingLessons.length ? Math.round((confirmedReadings / pastReadingLessons.length) * 100) : 100;

        return { id: s.id, name: (s.full_name || s.email).toUpperCase(), pctAula, pctEsp, pctQuiz, pctLeitura };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [students, pastAulas, pastEspeciais, attendanceRecords, dueQuizzes, dueQuizResponses, pastReadingLessons, readingConfirmations]);

  const exportStudentPercentagesXlsx = useCallback(() => {
    const headers = ['Nome', '% Aulas', '% Aulas Especiais', '% Questionários', '% Leitura'];
    const rows = studentPercentages.map((s) => [s.name, s.pctAula, s.pctEsp, s.pctQuiz, s.pctLeitura]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indicadores');
    const cohortLabel = selectedCohort?.name ? `_${selectedCohort.name.replace(/\s+/g, '_')}` : '';
    XLSX.writeFile(wb, `indicadores_por_aluno${cohortLabel}.xlsx`);
  }, [studentPercentages, selectedCohort]);

  const progressPct = totalLessons ? Math.round((totalPastLessons / totalLessons) * 100) : 0;
  const tccPct = totalStudents ? Math.round((tccSubmissions.length / totalStudents) * 100) : 0;
  // Card "Leituras": quantas leituras cadastradas já venceram o prazo, não
  // confirmações de aluno (isso é outra coisa e já entra no risco combinado).
  const readingVencidasPct = readingLessons.length ? Math.round((pastReadingLessons.length / readingLessons.length) * 100) : 0;

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
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${tccOpen ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Leituras</CardTitle>
                <BookOpenCheck className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {pastReadingLessons.length}<span className="text-lg text-muted-foreground"> / {readingLessons.length}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{readingVencidasPct}% vencidas / cadastradas</p>
              </CardContent>
            </Card>

            {tccOpen && (
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
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Indicadores por Aluno
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Em vermelho, o que está abaixo de 75%
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={exportStudentPercentagesXlsx}>
                <Download className="w-4 h-4" />
                Baixar Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Nome</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">% Aulas</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">% Aulas Especiais</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">% Questionários</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">% Leitura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPercentages.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-2">{s.name}</td>
                        <td className={`text-center py-2 ${s.pctAula < 75 ? 'text-destructive font-semibold' : ''}`}>{s.pctAula}%</td>
                        <td className={`text-center py-2 ${s.pctEsp < 75 ? 'text-destructive font-semibold' : ''}`}>{s.pctEsp}%</td>
                        <td className={`text-center py-2 ${s.pctQuiz < 75 ? 'text-destructive font-semibold' : ''}`}>{s.pctQuiz}%</td>
                        <td className={`text-center py-2 ${s.pctLeitura < 75 ? 'text-destructive font-semibold' : ''}`}>{s.pctLeitura}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ PRESENÇA ═══════════════════ */}
        <TabsContent value="presenca" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">Presença por Aula</CardTitle>
              <ToggleGroup
                type="single"
                value={presencaTipoGrafico}
                onValueChange={(v) => v && setPresencaTipoGrafico(v as 'aula' | 'especial')}
                className="justify-start sm:justify-end"
              >
                <ToggleGroupItem value="aula" className="text-xs px-3 h-8">Aula Regular</ToggleGroupItem>
                <ToggleGroupItem value="especial" className="text-xs px-3 h-8">Aula Especial</ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              {lessonAttendance.length > 0 ? (
                <>
                  <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
                      Maior presença
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(0, 72%, 51%)' }} />
                      Menor presença
                    </span>
                  </div>
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">
                  Nenhuma {presencaTipoGrafico === 'aula' ? 'aula regular' : 'aula especial'} realizada ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base">Distribuição da Turma</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Por faixa de presença em {presencaTipoDistribuicao === 'aula' ? 'aula regular' : 'aula especial'}
                </p>
              </div>
              <ToggleGroup
                type="single"
                value={presencaTipoDistribuicao}
                onValueChange={(v) => v && setPresencaTipoDistribuicao(v as 'aula' | 'especial')}
                className="justify-start sm:justify-end"
              >
                <ToggleGroupItem value="aula" className="text-xs px-3 h-8">Aula Regular</ToggleGroupItem>
                <ToggleGroupItem value="especial" className="text-xs px-3 h-8">Aula Especial</ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {attendanceDistribution.map((b) => (
                  <div key={b.label} className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold" style={{ color: b.color }}>{b.count}</p>
                    <p className="text-xs text-muted-foreground mt-1">{b.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Detalhamento — Alunos em Risco (Presença)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Aula: abaixo de 75% · Aula Especial: abaixo de 20%</p>
              </CardHeader>
              <CardContent>
                {atRiskStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aluno em risco.</p>
                ) : (
                  <div className="overflow-y-auto overflow-x-auto max-h-[420px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border sticky top-0 bg-card">
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
                        {s.name}
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
