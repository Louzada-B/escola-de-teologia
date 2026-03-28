import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, MessageSquare, CalendarDays, ClipboardList, UserCheck, TrendingUp } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = {
  present: 'hsl(142, 60%, 45%)',
  absent: 'hsl(0, 65%, 50%)',
  available: 'hsl(220, 45%, 50%)',
  answered: 'hsl(38, 55%, 55%)',
};

export default function DashboardHome() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState({ modules: 0, announcements: 0, events: 0, quizzes: 0 });
  const [attendanceData, setAttendanceData] = useState<{ type: string; presencas: number; faltas: number }[]>([]);
  const [quizData, setQuizData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    async function load() {
      const [m, a, e, q] = await Promise.all([
        supabase.from('modules').select('id', { count: 'exact', head: true }),
        supabase.from('announcements').select('id', { count: 'exact', head: true }),
        supabase.from('calendar_events').select('id', { count: 'exact', head: true }),
        supabase.from('quizzes').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        modules: m.count || 0,
        announcements: a.count || 0,
        events: e.count || 0,
        quizzes: q.count || 0,
      });
    }
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function loadCharts() {
      // Attendance: get all lessons with their calendar event types
      const { data: calEvents } = await supabase
        .from('calendar_events')
        .select('title, event_type, event_date');

      const { data: records } = await supabase
        .from('attendance_records')
        .select('lesson_id')
        .eq('user_id', user!.id);

      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, title, scheduled_date');

      if (lessons && calEvents && records) {
        const attendedLessonIds = new Set(records.map((r) => r.lesson_id));

        // Map lesson dates to calendar event types
        const dateTypeMap = new Map<string, string>();
        calEvents.forEach((ev) => {
          dateTypeMap.set(ev.event_date, ev.event_type);
        });

        const pastLessons = lessons.filter(
          (l) => l.scheduled_date && new Date(l.scheduled_date) < new Date()
        );

        const typeCount: Record<string, { present: number; total: number }> = {};

        pastLessons.forEach((lesson) => {
          const evType = lesson.scheduled_date ? dateTypeMap.get(lesson.scheduled_date) || 'aula' : 'aula';
          const label = evType === 'aula_especial' ? 'Aula Especial' : 'Aula';
          if (!typeCount[label]) typeCount[label] = { present: 0, total: 0 };
          typeCount[label].total++;
          if (attendedLessonIds.has(lesson.id)) typeCount[label].present++;
        });

        setAttendanceData(
          Object.entries(typeCount).map(([type, c]) => ({
            type,
            presencas: c.present,
            faltas: c.total - c.present,
          }))
        );
      }

      // Quiz status
      const { data: allQuizzes } = await supabase.from('quizzes').select('id');
      const { data: responses } = await supabase
        .from('quiz_responses')
        .select('quiz_id')
        .eq('user_id', user!.id);

      if (allQuizzes) {
        const answeredIds = new Set((responses || []).map((r) => r.quiz_id));
        const answered = allQuizzes.filter((q) => answeredIds.has(q.id)).length;
        const available = allQuizzes.length - answered;
        setQuizData([
          { name: 'Respondidos', value: answered },
          { name: 'Disponíveis', value: available },
        ]);
      }
    }
    loadCharts();
  }, [user]);

  const summaryCards = [
    { label: 'Módulos', value: stats.modules, icon: BookOpen },
    { label: 'Avisos', value: stats.announcements, icon: MessageSquare },
    { label: 'Eventos', value: stats.events, icon: CalendarDays },
    { label: 'Questionários', value: stats.quizzes, icon: ClipboardList },
  ];

  const chartConfig = {
    presencas: { label: 'Presenças', color: COLORS.present },
    faltas: { label: 'Faltas', color: COLORS.absent },
  };

  const pieConfig = {
    Respondidos: { label: 'Respondidos', color: COLORS.answered },
    Disponíveis: { label: 'Disponíveis', color: COLORS.available },
  };

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="section-title text-3xl">
          Bem-vindo, {profile?.full_name || 'estudante'}
        </h1>
        <p className="text-muted-foreground mt-1 font-body">
          Seu painel de estudos teológicos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((c) => (
          <Card key={c.label} className="card-academic">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-body font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance chart */}
        <Card className="card-academic">
          <CardHeader className="flex flex-row items-center gap-2">
            <UserCheck className="w-5 h-5 text-accent" />
            <CardTitle className="font-heading text-lg">Aproveitamento de Presença</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum dado de presença disponível.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={attendanceData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="type" type="category" width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="presencas" fill={COLORS.present} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="faltas" fill={COLORS.absent} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Quiz chart */}
        <Card className="card-academic">
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <CardTitle className="font-heading text-lg">Status dos Questionários</CardTitle>
          </CardHeader>
          <CardContent>
            {quizData.length === 0 || quizData.every((d) => d.value === 0) ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum questionário disponível.</p>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <ChartContainer config={pieConfig} className="h-[250px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={quizData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {quizData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === 'Respondidos' ? COLORS.answered : COLORS.available}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
            )}
            {quizData.length > 0 && !quizData.every((d) => d.value === 0) && (
              <div className="flex justify-center gap-6 mt-2">
                {quizData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: d.name === 'Respondidos' ? COLORS.answered : COLORS.available }}
                    />
                    <span className="text-muted-foreground">
                      {d.name}: <strong className="text-foreground">{d.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
