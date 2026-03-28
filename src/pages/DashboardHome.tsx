import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, MessageSquare, CalendarDays, ClipboardList, UserCheck, TrendingUp } from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = {
  present: "hsl(142, 60%, 45%)",
  absent: "hsl(0, 65%, 50%)",
  available: "hsl(220, 45%, 50%)",
  answered: "hsl(38, 55%, 55%)",
};

// Componente de Tooltip Customizado para mostrar Quantidade e Percentual
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border border-border p-3 rounded-lg shadow-lg text-sm">
        <p className="font-bold mb-1 font-heading">{data.name}</p>
        <p className="text-muted-foreground font-body">
          Quantidade: <span className="text-foreground font-medium">{data.qty}</span>
        </p>
        <p className="text-muted-foreground font-body">
          Proporção: <span className="text-foreground font-medium">{data.value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

// Função para renderizar o rótulo central customizado (SVG)
const renderCustomizedLabel = ({ cx, cy, label, value }: any) => {
  return (
    <g>
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-muted-foreground text-xs font-medium font-body"
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + 15}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground text-4xl font-bold font-heading"
      >
        {value}%
      </text>
    </g>
  );
};

export default function DashboardHome() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState({ modules: 0, announcements: 0, events: 0, quizzes: 0 });
  const [attendanceData, setAttendanceData] = useState<{ name: string; value: number; qty: number }[]>([]);
  const [quizData, setQuizData] = useState<{ name: string; value: number; qty: number }[]>([]);

  // Estados para armazenar os percentuais principais (para o centro do gráfico)
  const [mainAttendancePerc, setMainAttendancePerc] = useState(0);
  const [mainQuizPerc, setMainQuizPerc] = useState(0);

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function loadCharts() {
      // --- Lógica de Presença ---
      const { data: records } = await supabase.from("attendance_records").select("lesson_id").eq("user_id", user!.id);
      const { data: lessons } = await supabase.from("lessons").select("id, scheduled_date");

      if (lessons && records) {
        const attendedLessonIds = new Set(records.map((r) => r.lesson_id));
        const pastLessons = lessons.filter((l) => l.scheduled_date && new Date(l.scheduled_date) < new Date());

        const totalLessons = pastLessons.length;
        const totalPresent = pastLessons.filter((l) => attendedLessonIds.has(l.id)).length;
        const totalAbsent = totalLessons - totalPresent;

        const pPerc = totalLessons > 0 ? Math.round((totalPresent / totalLessons) * 100) : 0;
        const aPerc = totalLessons > 0 ? 100 - pPerc : 0;

        // Define o percentual principal para o centro
        setMainAttendancePerc(pPerc);

        setAttendanceData([
          { name: "Presenças", value: pPerc, qty: totalPresent },
          { name: "Faltas", value: aPerc, qty: totalAbsent },
        ]);
      }

      // --- Lógica de Quizzes ---
      const { data: allQuizzes } = await supabase.from("quizzes").select("id");
      const { data: responses } = await supabase.from("quiz_responses").select("quiz_id").eq("user_id", user!.id);

      if (allQuizzes) {
        const answeredIds = new Set((responses || []).map((r) => r.quiz_id));
        const answered = allQuizzes.filter((q) => answeredIds.has(q.id)).length;
        const available = allQuizzes.length - answered;
        const totalQ = allQuizzes.length;

        const ansPerc = totalQ > 0 ? Math.round((answered / totalQ) * 100) : 0;
        const availPerc = totalQ > 0 ? 100 - ansPerc : 0;

        // Define o percentual principal para o centro
        setMainQuizPerc(ansPerc);

        setQuizData([
          { name: "Respondidos", value: ansPerc, qty: answered },
          { name: "Disponíveis", value: availPerc, qty: available },
        ]);
      }
    }
    loadCharts();
  }, [user]);

  const summaryCards = [
    { label: "Módulos", value: stats.modules, icon: BookOpen },
    { label: "Avisos", value: stats.announcements, icon: MessageSquare },
    { label: "Eventos", value: stats.events, icon: CalendarDays },
    { label: "Questionários", value: stats.quizzes, icon: ClipboardList },
  ];

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="section-title text-3xl font-heading">Bem-vindo, {profile?.full_name || "estudante"}</h1>
        <p className="text-muted-foreground mt-1 font-body">Seu painel de estudos teológicos</p>
      </div>

      {/* Cards de Resumo */}
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

      {/* Seção de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-body">
        {/* Gráfico de Presença (Rosca com Número Central) */}
        <Card className="card-academic">
          <CardHeader className="flex flex-row items-center gap-2">
            <UserCheck className="w-5 h-5 text-accent" />
            <CardTitle className="font-heading text-lg">Aproveitamento de Presença</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceData.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">Sem dados disponíveis.</p>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip content={<CustomTooltip />} />
                      {/* Rótulo Central Customizado */}
                      {renderCustomizedLabel({
                        cx: "50%",
                        cy: "50%",
                        label: "PRESENÇA GERAL",
                        value: mainAttendancePerc,
                      })}
                      <Pie
                        data={attendanceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65} // Aumentado ligeiramente para dar espaço ao texto
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {attendanceData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.name === "Presenças" ? COLORS.present : COLORS.absent}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-2">
                  {attendanceData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: d.name === "Presenças" ? COLORS.present : COLORS.absent }}
                      />
                      <span className="text-muted-foreground">
                        {d.name}: <strong>{d.value}%</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Quizzes (Rosca com Número Central) */}
        <Card className="card-academic">
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <CardTitle className="font-heading text-lg">Status dos Questionários</CardTitle>
          </CardHeader>
          <CardContent>
            {quizData.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">Sem dados disponíveis.</p>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip content={<CustomTooltip />} />
                      {/* Rótulo Central Customizado */}
                      {renderCustomizedLabel({ cx: "50%", cy: "50%", label: "RESPONDIDOS", value: mainQuizPerc })}
                      <Pie
                        data={quizData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65} // Aumentado ligeiramente para dar espaço ao texto
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {quizData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.name === "Respondidos" ? COLORS.answered : COLORS.available}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-2">
                  {quizData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: d.name === "Respondidos" ? COLORS.answered : COLORS.available }}
                      />
                      <span className="text-muted-foreground">
                        {d.name}: <strong>{d.value}%</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
