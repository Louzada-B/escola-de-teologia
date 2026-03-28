import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  MessageSquare,
  CalendarDays,
  ClipboardList,
  UserCheck,
  TrendingUp,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { ChartTooltip } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = {
  present: "hsl(142, 60%, 45%)",
  absent: "hsl(0, 65%, 50%)",
  available: "hsl(220, 45%, 50%)",
  answered: "hsl(38, 55%, 55%)",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border border-border p-3 rounded-lg shadow-lg text-sm font-body">
        <p className="font-bold mb-1 font-heading">{data.name}</p>
        <p className="text-muted-foreground">
          Quantidade: <span className="text-foreground font-medium">{data.qty}</span>
        </p>
        <p className="text-muted-foreground">
          Proporção: <span className="text-foreground font-medium">{data.value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardHome() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ modules: 0, announcements: 0, events: 0, quizzes: 0 });
  // Novo estado para armazenar múltiplas categorias de presença
  const [attendanceCategories, setAttendanceCategories] = useState<any[]>([]);
  const [quizData, setQuizData] = useState<{ name: string; value: number; qty: number }[]>([]);
  const [mainQuizPerc, setMainQuizPerc] = useState(0);
  const [pendingLesson, setPendingLesson] = useState<any>(null);
  const [isWithinTime, setIsWithinTime] = useState(false);

  useEffect(() => {
    const now = new Date();
    setIsWithinTime(now.getHours() >= 7 && now.getHours() <= 23);

    async function loadDashboardData() {
      if (!user) return;
      const today = new Date().toISOString().split("T")[0];

      const [m, a, e, q] = await Promise.all([
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id", { count: "exact", head: true }),
        supabase.from("calendar_events").select("id", { count: "exact", head: true }),
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        modules: m.count || 0,
        announcements: a.count || 0,
        events: e.count || 0,
        quizzes: q.count || 0,
      });

      const { data: todayLessons } = await supabase.from("lessons").select("*").eq("scheduled_date", today);
      const { data: userRecords } = await supabase
        .from("attendance_records")
        .select("lesson_id")
        .eq("user_id", user.id);

      if (todayLessons?.length) {
        const checkedInIds = new Set(userRecords?.map((r) => r.lesson_id));
        const pending = todayLessons.find((l) => !checkedInIds.has(l.id));
        if (pending) setPendingLesson(pending);
      }

      // --- LÓGICA DE GRÁFICOS POR CATEGORIA ---
      const { data: allLessons } = await supabase.from("lessons").select("id, scheduled_date, type");
      if (allLessons && userRecords) {
        const checkedInIds = new Set(userRecords.map((r) => r.lesson_id));
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Agrupando aulas passadas por tipo
        const groups: Record<string, { present: number; absent: number }> = {};

        allLessons.forEach((lesson) => {
          const lDate = new Date(lesson.scheduled_date);
          if (lDate <= todayDate) {
            const type = lesson.type || "Aula";
            if (!groups[type]) groups[type] = { present: 0, absent: 0 };

            if (checkedInIds.has(lesson.id)) groups[type].present++;
            else groups[type].absent++;
          }
        });

        // Formatando para o componente de gráfico
        const formatted = Object.entries(groups).map(([type, counts]) => {
          const total = counts.present + counts.absent;
          const pPerc = total > 0 ? Math.round((counts.present / total) * 100) : 0;
          return {
            type,
            percent: pPerc,
            chartData: [
              { name: "Presenças", value: pPerc, qty: counts.present },
              { name: "Faltas", value: 100 - pPerc, qty: counts.absent },
            ],
          };
        });
        setAttendanceCategories(formatted);
      }

      // --- LÓGICA DE QUIZZES ---
      const { data: allQuizzes } = await supabase.from("quizzes").select("id");
      const { data: quizResponses } = await supabase.from("quiz_responses").select("quiz_id").eq("user_id", user.id);
      if (allQuizzes) {
        const answeredIds = new Set((quizResponses || []).map((r) => r.quiz_id));
        const answered = allQuizzes.filter((q) => answeredIds.has(q.id)).length;
        const ansPerc = allQuizzes.length > 0 ? Math.round((answered / allQuizzes.length) * 100) : 0;
        setMainQuizPerc(ansPerc);
        setQuizData([
          { name: "Respondidos", value: ansPerc, qty: answered },
          { name: "Disponíveis", value: 100 - ansPerc, qty: allQuizzes.length - answered },
        ]);
      }
    }

    loadDashboardData();
  }, [user]);

  const summaryCards = [
    { label: "Módulos", value: stats.modules, icon: BookOpen },
    { label: "Avisos", value: stats.announcements, icon: MessageSquare },
    { label: "Eventos", value: stats.events, icon: CalendarDays },
    { label: "Questionários", value: stats.quizzes, icon: ClipboardList },
  ];

  return (
    <div className="page-container pb-10">
      {/* ALERTA DE PRESENÇA PENDENTE (Mantido igual) */}
      {isWithinTime && pendingLesson && (
        <Card className="mb-8 border-accent/40 bg-accent/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="bg-accent/20 p-3 rounded-full hidden sm:block">
                <MapPin className="w-6 h-6 text-accent animate-bounce" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground">Registro Aberto!</h3>
                <p className="text-sm text-muted-foreground font-body">Aula: {pendingLesson.title}</p>
              </div>
            </div>
            <Button onClick={() => navigate("/dashboard/presenca")}>
              Registrar Agora <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Título e Cards de Resumo (Mantidos) */}
      <div className="mb-8">
        <h1 className="section-title text-3xl font-heading text-primary">
          Bem-vindo, {profile?.full_name || "estudante"}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 font-body">
        {summaryCards.map((c) => (
          <Card key={c.label} className="card-academic">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SEÇÃO DE GRÁFICOS DINÂMICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MAPEANDO CADA CATEGORIA DE PRESENÇA EM UMA ROSCA */}
        {attendanceCategories.map((cat) => (
          <Card key={cat.type} className="card-academic overflow-hidden relative">
            <CardHeader className="flex flex-row items-center gap-2">
              <UserCheck className="w-5 h-5 text-accent" />
              <CardTitle className="font-heading text-lg">Presença: {cat.type}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="h-[250px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip content={<CustomTooltip />} />
                      <Pie
                        data={cat.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={68}
                        outerRadius={88}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {cat.chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.name === "Presenças" ? COLORS.present : COLORS.absent} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-bold font-heading text-foreground">{cat.percent}%</span>
                  </div>
                </div>
                <div className="flex gap-6 mt-4">
                  {cat.chartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm font-body">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: d.name === "Presenças" ? COLORS.present : COLORS.absent }}
                      />
                      <span className="text-muted-foreground">
                        {d.name}: <strong className="text-foreground">{d.value}%</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* GRÁFICO DE QUIZZES (Mantido no final) */}
        <Card className="card-academic overflow-hidden relative">
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <CardTitle className="font-heading text-lg">Status dos Questionários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip content={<CustomTooltip />} />
                    <Pie
                      data={quizData}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={88}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {quizData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.name === "Respondidos" ? COLORS.answered : COLORS.available} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl font-bold font-heading text-foreground">{mainQuizPerc}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
