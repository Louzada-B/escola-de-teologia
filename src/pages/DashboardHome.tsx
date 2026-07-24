import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCohort } from "@/contexts/CohortContext";
import { isDateWithinCohortPeriod, getLocalToday } from "@/lib/cohortDateUtils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
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
  Star,
} from "lucide-react";
import { ChartTooltip } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = {
  present: "hsl(142, 60%, 45%)",
  absent: "hsl(0, 65%, 50%)",
  available: "hsl(220, 45%, 50%)",
  answered: "hsl(38, 55%, 55%)",
};

type ChartEntry = { name: string; value: number; qty: number };

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

function DonutChart({
  data,
  centerLabel,
  centerValue,
  colorFn,
}: {
  data: ChartEntry[];
  centerLabel: string;
  centerValue: string;
  colorFn: (name: string) => string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-[220px] w-full" style={{ display: "grid" }}>
        <ResponsiveContainer width="100%" height="100%" style={{ gridArea: "1 / 1" }}>
          <PieChart>
            <ChartTooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={colorFn(entry.name)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col items-center justify-center pointer-events-none" style={{ gridArea: "1 / 1" }}>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">{centerLabel}</span>
          <span className="text-3xl font-bold font-heading text-foreground leading-none">{centerValue}</span>
        </div>
      </div>
      <div className="flex gap-6 mt-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm font-body">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorFn(d.name) }} />
            <span className="text-muted-foreground">
              {d.name}: <strong className="text-foreground">{d.value}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { profile, user } = useAuth();
  const { selectedCohort, effectiveCutoffDate } = useCohort();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ modules: 0, announcements: 0, events: 0, quizzes: 0 });
  const [aulaData, setAulaData] = useState<ChartEntry[]>([]);
  const [aulaEspecialData, setAulaEspecialData] = useState<ChartEntry[]>([]);
  const [aulaPerc, setAulaPerc] = useState(0);
  const [aulaEspecialPerc, setAulaEspecialPerc] = useState(0);
  const [quizData, setQuizData] = useState<ChartEntry[]>([]);
  const [mainQuizPerc, setMainQuizPerc] = useState(0);
  const [pendingLesson, setPendingLesson] = useState<any>(null);
  const [pendingQuizCount, setPendingQuizCount] = useState(0);
  const [isWithinTime, setIsWithinTime] = useState(true);

  const cohortStart = selectedCohort?.start_date;
  const cohortEnd = selectedCohort?.end_date;

  useEffect(() => {
    // isWithinTime será calculado por aula individualmente abaixo
    setIsWithinTime(true); // sempre permitir — filtragem ocorre por aula

    async function loadDashboardData() {
      if (!user) return;
      const today = getLocalToday();

      // Fetch all raw data
      const [mRes, aRes, eRes, qRes] = await Promise.all([
        supabase.from("modules").select("id"),
        supabase.from("announcements").select("id, scheduled_at, cohort_id"),
        supabase.from("calendar_events").select("id, event_date"),
        supabase.from("quizzes").select("id, available_from, available_until, lessons(scheduled_date)"),
      ]);

      const allEvents = eRes.data || [];
      const allQuizzes = qRes.data || [];

      // Filter events and quizzes by cohort full period
      const filteredEvents =
        cohortStart && cohortEnd
          ? allEvents.filter((e) => e.event_date >= cohortStart && e.event_date <= cohortEnd)
          : allEvents;
      const nowIso = new Date().toISOString();
      const filteredAnnouncements = (aRes.data || []).filter((a: any) => {
        // Só conta avisos já publicados
        if (a.scheduled_at > nowIso) return false;
        // Filtra por turma: nulo = geral (todos veem), específico = só a turma
        if (a.cohort_id && selectedCohort && a.cohort_id !== selectedCohort.id) return false;
        if (a.cohort_id && !selectedCohort) return false;
        // Filtra por período da turma
        if (cohortStart && cohortEnd) {
          const date = a.scheduled_at.split("T")[0];
          return date >= cohortStart && date <= cohortEnd;
        }
        return true;
      });
      const filteredQuizzes =
        cohortStart && cohortEnd
          ? allQuizzes.filter((q: any) => {
              // Prioriza a data da aula vinculada (igual QuizzesPage)
              const lessonDate = q.lessons?.scheduled_date;
              if (lessonDate) return lessonDate >= cohortStart && lessonDate <= cohortEnd;
              // Fallback: available_from
              const qDate = q.available_from ? q.available_from.split("T")[0] : null;
              if (!qDate) return true;
              return qDate >= cohortStart && qDate <= cohortEnd;
            })
          : allQuizzes;

      setStats({
        modules: mRes.data?.length || 0,
        announcements: filteredAnnouncements.length || 0,
        events: filteredEvents.length,
        quizzes: filteredQuizzes.length,
      });

      // Today's lessons for attendance alert
      const { data: todayLessons } = await supabase.from("lessons").select("*, start_time, end_time").eq("scheduled_date", today);
      const { data: userRecords } = await supabase
        .from("attendance_records")
        .select("lesson_id")
        .eq("user_id", user.id);

      if (todayLessons && todayLessons.length > 0) {
        const checkedInIds = new Set(userRecords?.map((r) => r.lesson_id));
        const nowTime = new Date();
        const nowStr = nowTime.toTimeString().slice(0,5); // "HH:MM"
        const pending = todayLessons.find((l: any) => {
          if (checkedInIds.has(l.id)) return false;
          // Se a aula tem horário definido, só mostra dentro da janela (start - 15min até end + 30min)
          if (l.start_time && l.end_time) {
            const [sh, sm] = l.start_time.split(':').map(Number);
            const [eh, em] = l.end_time.split(':').map(Number);
            const startMins = sh * 60 + sm - 30;
            const endMins = eh * 60 + em + 120;
            const [ch, cm] = nowStr.split(':').map(Number);
            const nowMins = ch * 60 + cm;
            return nowMins >= startMins && nowMins <= endMins;
          }
          // Sem horário definido: mostra o dia todo
          return true;
        });
        if (pending) setPendingLesson(pending);
      }

      // Attendance by type — filtered by cohort period
      const { data: allLessons } = await supabase
        .from("lessons")
        .select("id, scheduled_date, event_type, mandatory_attendance");

      if (allLessons && userRecords) {
        const checkedInIds = new Set(userRecords.map((r) => r.lesson_id));

        const calcForType = (type: string) => {
          const past = allLessons.filter(
            (l) =>
              l.event_type === type &&
              l.mandatory_attendance &&
              isDateWithinCohortPeriod(l.scheduled_date, cohortStart, effectiveCutoffDate),
          );
          const total = past.length;
          const present = past.filter((l) => checkedInIds.has(l.id)).length;
          const absent = total - present;
          const pPerc = total > 0 ? Math.round((present / total) * 100) : 0;
          const aPerc = total > 0 ? 100 - pPerc : 0;
          return {
            perc: pPerc,
            data: [
              { name: "Presenças", value: pPerc, qty: present },
              { name: "Faltas", value: aPerc, qty: absent },
            ] as ChartEntry[],
          };
        };

        const aula = calcForType("aula");
        setAulaPerc(aula.perc);
        setAulaData(aula.data);

        const especial = calcForType("aula_especial");
        setAulaEspecialPerc(especial.perc);
        setAulaEspecialData(especial.data);
      }

      // Quizzes — filtered by cohort
      const now = new Date().toISOString();
      const { data: quizResponses } = await supabase.from("quiz_responses").select("quiz_id").eq("user_id", user.id);
      const answeredIds = new Set((quizResponses || []).map((r) => r.quiz_id));
      // Denominador: só quizzes já abertos (available_from <= now ou sem data)
      const openedQuizzes = filteredQuizzes.filter((q: any) =>
        !q.available_from || q.available_from <= now
      );
      const answered = openedQuizzes.filter((q: any) => answeredIds.has(q.id)).length;
      const available = openedQuizzes.length - answered;

      // Pending open quizzes (abertos, não respondidos, dentro do prazo)
      const openUnanswered = openedQuizzes.filter((q: any) => {
        if (answeredIds.has(q.id)) return false;
        if (q.available_until && q.available_until < now) return false;
        return true;
      });
      setPendingQuizCount(openUnanswered.length);
      const ansPerc = openedQuizzes.length > 0 ? Math.round((answered / openedQuizzes.length) * 100) : 0;
      const availPerc = openedQuizzes.length > 0 ? 100 - ansPerc : 0;
      setMainQuizPerc(ansPerc);
      setQuizData([
        { name: "Respondidos", value: ansPerc, qty: answered },
        { name: "Disponíveis", value: availPerc, qty: available },
      ]);
    }

    loadDashboardData();
  }, [user, selectedCohort, effectiveCutoffDate]);

  const summaryCards = [
    { label: "Módulos", value: stats.modules, icon: BookOpen },
    { label: "Avisos", value: stats.announcements, icon: MessageSquare },
    { label: "Eventos", value: stats.events, icon: CalendarDays },
    { label: "Questionários", value: stats.quizzes, icon: ClipboardList },
  ];

  const attendanceColorFn = (name: string) => (name === "Presenças" ? COLORS.present : COLORS.absent);
  const quizColorFn = (name: string) => (name === "Respondidos" ? COLORS.answered : COLORS.available);

  return (
    <div className="page-container pb-10">
      {/* ALERTA DE PRESENÇA PENDENTE */}
      {pendingLesson && profile?.role === "aluno" && (
        <Card className="mb-8 border-accent/40 bg-accent/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="bg-accent/20 p-3 rounded-full hidden sm:block">
                <MapPin className="w-6 h-6 text-accent animate-bounce" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground">Registro de Presença Aberto!</h3>
                <p className="text-sm text-muted-foreground font-body">
                  Não esqueça de registrar sua presença na aula:{" "}
                  <span className="text-foreground font-medium">{pendingLesson.title}</span>.
                </p>
              </div>
            </div>
            <Button
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-body px-6 shadow-lg shadow-accent/20"
              onClick={() => navigate("/dashboard/presenca")}
            >
              Registrar Agora <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ALERTA DE QUESTIONÁRIOS PENDENTES */}
      {pendingQuizCount > 0 && profile?.role === "aluno" && (
        <Card className="mb-8 border-primary/40 bg-primary/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="bg-primary/20 p-3 rounded-full hidden sm:block">
                <ClipboardList className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground">
                  {pendingQuizCount === 1
                    ? "Você tem 1 questionário pendente!"
                    : `Você tem ${pendingQuizCount} questionários pendentes!`}
                </h3>
                <p className="text-sm text-muted-foreground font-body">Responda antes que o prazo encerre.</p>
              </div>
            </div>
            <Button className="w-full sm:w-auto font-body px-6" onClick={() => navigate("/dashboard/questionarios")}>
              Responder Agora <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* BOAS-VINDAS */}
      <div className="mb-8">
        <h1 className="section-title text-3xl font-heading">Bem-vindo, {profile?.full_name || "estudante"}</h1>
        <p className="text-muted-foreground mt-1 font-body">Seu painel de estudos teológicos</p>
      </div>

      {/* CARDS DE RESUMO */}
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

      {/* GRÁFICOS */}
      {profile?.role === "aluno" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="card-academic">
            <CardHeader className="flex flex-row items-center gap-2">
              <UserCheck className="w-5 h-5 text-accent" />
              <CardTitle className="font-heading text-lg">Presença — Aula</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help ml-auto" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Percentual de aulas obrigatórias em que você registrou presença, em relação ao total de aulas já realizadas no período.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              {aulaData.length === 0 || (aulaData[0].qty === 0 && aulaData[1].qty === 0) ? (
                <p className="text-center py-10 text-muted-foreground font-body">Sem dados de aulas regulares.</p>
              ) : (
                <DonutChart
                  data={aulaData}
                  centerLabel="Aula"
                  centerValue={`${aulaPerc}%`}
                  colorFn={attendanceColorFn}
                />
              )}
            </CardContent>
          </Card>

          <Card className="card-academic">
            <CardHeader className="flex flex-row items-center gap-2">
              <Star className="w-5 h-5 text-accent" />
              <CardTitle className="font-heading text-lg">Presença — Aula Especial</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help ml-auto" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Percentual de aulas especiais obrigatórias em que você registrou presença, em relação ao total de aulas especiais já realizadas no período.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              {aulaEspecialData.length === 0 || (aulaEspecialData[0].qty === 0 && aulaEspecialData[1].qty === 0) ? (
                <p className="text-center py-10 text-muted-foreground font-body">Sem dados de aulas especiais.</p>
              ) : (
                <DonutChart
                  data={aulaEspecialData}
                  centerLabel="Especial"
                  centerValue={`${aulaEspecialPerc}%`}
                  colorFn={attendanceColorFn}
                />
              )}
            </CardContent>
          </Card>

          <Card className="card-academic">
            <CardHeader className="flex flex-row items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              <CardTitle className="font-heading text-lg">Status dos Questionários</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help ml-auto" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Percentual de questionários respondidos em relação aos já disponíveis (abertos ou encerrados). Questionários futuros não são contabilizados.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              {quizData.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground font-body">Nenhum questionário encontrado.</p>
              ) : (
                <DonutChart
                  data={quizData}
                  centerLabel="Total"
                  centerValue={`${mainQuizPerc}%`}
                  colorFn={quizColorFn}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
