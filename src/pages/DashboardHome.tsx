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
  present: "#22c55e", // Verde vibrante
  absent: "#ef4444", // Vermelho vibrante
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

      // 1. Stats básicos
      const [m, a, e, q] = await Promise.all([
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id", { count: "exact", head: true }),
        supabase.from("calendar_events").select("id", { count: "exact", head: true }),
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
      ]);
      setStats({ modules: m.count || 0, announcements: a.count || 0, events: e.count || 0, quizzes: q.count || 0 });

      // 2. Pendência de hoje
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

      // 3. Lógica por Categoria (Rosca Separada)
      const { data: allLessons } = await supabase.from("lessons").select("id, scheduled_date, type");
      if (allLessons && userRecords) {
        const checkedInIds = new Set(userRecords.map((r) => r.lesson_id));
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const categoriesMap: Record<string, any> = {};

        allLessons.forEach((lesson) => {
          const lDate = new Date(lesson.scheduled_date);
          lDate.setHours(0, 0, 0, 0);
          if (lDate <= todayDate) {
            const type = lesson.type || "Aula";
            if (!categoriesMap[type]) categoriesMap[type] = { present: 0, absent: 0 };
            checkedInIds.has(lesson.id) ? categoriesMap[type].present++ : categoriesMap[type].absent++;
          }
        });

        const formattedCategories = Object.keys(categoriesMap).map((key) => {
          const total = categoriesMap[key].present + categoriesMap[key].absent;
          const pPerc = total > 0 ? Math.round((categoriesMap[key].present / total) * 100) : 0;
          return {
            title: key,
            percentage: pPerc,
            data: [
              { name: "Presenças", value: pPerc, qty: categoriesMap[key].present },
              { name: "Faltas", value: 100 - pPerc, qty: categoriesMap[key].absent },
            ],
          };
        });
        setAttendanceCategories(formattedCategories);
      }

      // 4. Quizzes
      const { data: allQuizzes } = await supabase.from("quizzes").select("id");
      const { data: qResp } = await supabase.from("quiz_responses").select("quiz_id").eq("user_id", user.id);
      if (allQuizzes?.length) {
        const answered = allQuizzes.filter((q) => new Set(qResp?.map((r) => r.quiz_id)).has(q.id)).length;
        const ansPerc = Math.round((answered / allQuizzes.length) * 100);
        setMainQuizPerc(ansPerc);
        setQuizData([
          { name: "Respondidos", value: ansPerc, qty: answered },
          { name: "Disponíveis", value: 100 - ansPerc, qty: allQuizzes.length - answered },
        ]);
      }
    }
    loadDashboardData();
  }, [user]);

  return (
    <div className="page-container pb-10">
      {isWithinTime && pendingLesson && (
        <Card className="mb-8 border-accent/40 bg-accent/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-4">
              <MapPin className="w-6 h-6 text-accent animate-bounce" />
              <div>
                <h3 className="font-heading font-bold text-lg">Registro Aberto!</h3>
                <p className="text-sm text-muted-foreground">Aula: {pendingLesson.title}</p>
              </div>
            </div>
            <Button onClick={() => navigate("/dashboard/presenca")}>
              Registrar Agora <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mb-8">
        <h1 className="section-title text-3xl font-heading text-primary">
          Bem-vindo, {profile?.full_name || "estudante"}
        </h1>
      </div>

      {/* Grid de Roscas de Presença por Categoria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {attendanceCategories.map((cat, i) => (
          <Card key={i} className="card-academic relative">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <UserCheck className="w-5 h-5 text-accent" />
              <CardTitle className="font-heading text-lg">Presença: {cat.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="h-[220px] w-full relative">
                <ResponsiveContainer>
                  <PieChart>
                    <ChartTooltip content={<CustomTooltip />} />
                    <Pie
                      data={cat.data}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      cx="50%"
                      cy="50%"
                    >
                      {cat.data.map((_, idx) => (
                        <Cell key={idx} fill={idx === 0 ? COLORS.present : COLORS.absent} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold font-heading">{cat.percentage}%</span>
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                {cat.data.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs font-medium">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: idx === 0 ? COLORS.present : COLORS.absent }}
                    />
                    {d.name}: {d.value}%
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico de Quizzes */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="card-academic relative">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <CardTitle className="font-heading text-lg">Status dos Questionários</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[220px] w-full relative">
              <ResponsiveContainer>
                <PieChart>
                  <ChartTooltip content={<CustomTooltip />} />
                  <Pie
                    data={quizData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                    cx="50%"
                    cy="50%"
                  >
                    {quizData.map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? COLORS.answered : COLORS.available} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold font-heading">{mainQuizPerc}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
