import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCohort } from "@/contexts/CohortContext";
import { getLocalToday } from "@/lib/cohortDateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { MapPin, CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { selectedCohort, effectiveCutoffDate } = useCohort();
  const [todayLessons, setTodayLessons] = useState<any[]>([]);
  const [pastLessons, setPastLessons] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState<string | null>(null);
  const [successLesson, setSuccessLesson] = useState<{title: string; date: string} | null>(null);
  const [isWithinTime, setIsWithinTime] = useState(false);

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    // isWithinTime agora é calculado por aula (ver lógica abaixo)
    setIsWithinTime(true); // estado global desativado — cada aula tem sua própria janela

    async function load() {
      const today = getLocalToday();

      const [lessonsRes, settingsRes, recordsRes] = await Promise.all([
        supabase.from("lessons").select("*, modules(title)").order("scheduled_date", { ascending: false }),
        supabase.from("attendance_settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("attendance_records")
          .select("lesson_id")
          .eq("user_id", user?.id || ""),
      ]);

      if (lessonsRes.data) {
        const inCohort = (date: string | null) => {
          if (!date) return false;
          if (!selectedCohort) return true;
          return date >= selectedCohort.start_date && date <= selectedCohort.end_date;
        };
        // Today's lessons filtered by selected cohort
        setTodayLessons(lessonsRes.data.filter((l) => l.scheduled_date === today && inCohort(l.scheduled_date)));
        // Past lessons filtered by cohort period
        setPastLessons(
          lessonsRes.data.filter((l) => l.scheduled_date && l.scheduled_date < today && inCohort(l.scheduled_date)),
        );
      }
      if (settingsRes.data) setSettings(settingsRes.data);
      if (recordsRes.data) {
        setCheckedIn(new Set(recordsRes.data.map((r: any) => r.lesson_id)));
      }
      setLoading(false);
    }
    load();
  }, [user, selectedCohort, effectiveCutoffDate]);


  // Verifica se o horário atual está na janela de presença de uma aula
  // 30min antes do início até 2h após o encerramento
  const isLessonOpen = (lesson: any): boolean => {
    const st = lesson.start_time;
    const et = lesson.end_time;
    if (!st || !et) {
      // Sem horário definido: disponível o dia todo
      return true;
    }
    const now = new Date();
    const [sh, sm] = st.split(':').map(Number);
    const [eh, em] = et.split(':').map(Number);
    const openMins  = sh * 60 + sm - 30;       // 30min antes
    const closeMins = eh * 60 + em + 120;       // 2h depois
    const nowMins   = now.getHours() * 60 + now.getMinutes();
    return nowMins >= openMins && nowMins <= closeMins;
  };

  const handleCheckIn = async (lessonId: string, lesson?: any) => {
    if (!settings) {
      toast({ title: "Erro", description: "Local da aula não configurado pelo professor.", variant: "destructive" });
      return;
    }

    if (lesson && !isLessonOpen(lesson)) {
      const st = lesson.start_time ? lesson.start_time.slice(0, 5) : null;
      const et = lesson.end_time   ? lesson.end_time.slice(0, 5)   : null;
      toast({
        title: "Fora do horário",
        description: st && et
          ? `Presença disponível das ${st} (30min antes) até 2h após ${et}.`
          : "O registro de presença não está disponível agora.",
        variant: "destructive",
      });
      return;
    }

    if (!navigator.geolocation) {
      toast({ title: "Erro", description: "Seu navegador não suporta geolocalização.", variant: "destructive" });
      return;
    }

    setGpsLoading(lessonId);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distance = getDistanceMeters(latitude, longitude, settings.latitude, settings.longitude);

        if (distance > settings.radius_meters) {
          toast({
            title: "Fora do local",
            description: `Você está a ${Math.round(distance)}m do local da aula. Máximo permitido: ${settings.radius_meters}m.`,
            variant: "destructive",
          });
          setGpsLoading(null);
          return;
        }

        const { error } = await supabase.from("attendance_records").insert({
          user_id: user!.id,
          lesson_id: lessonId,
          latitude,
          longitude,
        });

        if (error) {
          if (error.code === "23505") {
            toast({ title: "Aviso", description: "Presença já registrada para esta aula." });
          } else {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
          }
        } else {
          setCheckedIn((prev) => new Set(prev).add(lessonId));
          const allLessons = [...(todayLessons || []), ...(pastLessons || [])];
          const lesson = allLessons.find((l: any) => l.id === lessonId);
          setSuccessLesson({
            title: lesson?.title || "Aula",
            date: lesson?.scheduled_date ? new Date(lesson.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "",
          });
          setTimeout(() => setSuccessLesson(null), 4000);
        }
        setGpsLoading(null);
      },
      (err) => {
        const isPermissionDenied = err.code === 1;
        const isPositionUnavailable = err.code === 2;
        toast({
          title: "Localização indisponível",
          description: isPermissionDenied
            ? "Permissão de localização negada. Acesse as configurações do navegador e permita o acesso à localização para esta página."
            : isPositionUnavailable
            ? "GPS desligado ou sinal indisponível. Ative a localização do seu celular e tente novamente."
            : "Não foi possível obter sua localização. Ative o GPS e tente novamente.",
          variant: "destructive",
        });
        setGpsLoading(null);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (successLesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-heading font-semibold text-foreground">Presença registrada!</h2>
            <p className="text-muted-foreground mt-1 text-sm font-body">{successLesson.title}</p>
          </div>
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-sm text-green-700 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {successLesson.date}
          </div>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="page-container">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );

  return (
    <div className="page-container">
      <h1 className="section-title mb-2">Registro de Presença</h1>
      <p className="text-muted-foreground font-body mb-6">
        Registre sua presença nas aulas do dia dentro do horário definido pelo professor.
      </p>


      {!settings && (
        <Card className="card-academic mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm font-body text-destructive">Local da aula ainda não configurado pelo professor.</p>
          </CardContent>
        </Card>
      )}

      {/* ── AULA DE HOJE ── */}
      <h2 className="font-heading text-base font-semibold mb-3 text-foreground">Aula de Hoje</h2>
      {todayLessons.length === 0 ? (
        <Card className="card-academic mb-8">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground font-body">Nenhuma aula presencial agendada para hoje.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 mb-8">
          {todayLessons.map((lesson) => (
            <Card key={lesson.id} className="card-academic">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-lg">{lesson.title}</CardTitle>
                  {checkedIn.has(lesson.id) && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" /> Presente
                    </Badge>
                  )}
                </div>
                {lesson.modules?.title && (
                  <p className="text-sm text-muted-foreground font-body">{lesson.modules.title}</p>
                )}
              </CardHeader>
              <CardContent>
                {checkedIn.has(lesson.id) ? (
                  <p className="text-sm text-muted-foreground font-body">Presença já registrada para esta aula.</p>
                ) : (
                  <Button
                    onClick={() => handleCheckIn(lesson.id, lesson)}
                    disabled={!isLessonOpen(lesson) || !settings || gpsLoading === lesson.id}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    {gpsLoading === lesson.id ? "Verificando localização..." : "Registrar Presença"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {pastLessons.length > 0 && (
        <>
          <h2 className="font-heading text-base font-semibold mb-3 text-foreground">Histórico de Presenças</h2>
          <div className="space-y-2">
            {pastLessons.map((lesson) => {
              const present = checkedIn.has(lesson.id);
              return (
                <Card key={lesson.id} className="card-academic">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-heading text-sm font-medium">{lesson.title}</p>
                      <p className="text-xs text-muted-foreground font-body mt-0.5">
                        {new Date(lesson.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}
                        {lesson.professor_name && ` · ${lesson.professor_name}`}
                      </p>
                    </div>
                    {present ? (
                      <Badge variant="default" className="bg-green-600 shrink-0">
                        <CheckCircle className="w-3 h-3 mr-1" /> Presente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/50 text-destructive shrink-0">
                        <XCircle className="w-3 h-3 mr-1" /> Ausente
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
