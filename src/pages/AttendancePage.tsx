import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCohort } from "@/contexts/CohortContext";
import { isDateWithinCohortPeriod } from "@/lib/cohortDateUtils";
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
  const [isWithinTime, setIsWithinTime] = useState(false);

  const cohortStart = selectedCohort?.start_date;

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setIsWithinTime(hour >= 19 && hour <= 23);

    async function load() {
      const today = new Date().toISOString().split("T")[0];

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
          lessonsRes.data.filter(
            (l) =>
              l.scheduled_date && l.scheduled_date < today && inCohort(l.scheduled_date),
          ),
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

  const handleCheckIn = async (lessonId: string) => {
    if (!settings) {
      toast({ title: "Erro", description: "Local da aula não configurado pelo professor.", variant: "destructive" });
      return;
    }

    if (!isWithinTime) {
      toast({
        title: "Fora do horário",
        description: "O registro de presença está disponível apenas das 19:00 às 23:59.",
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
          toast({ title: "Presença registrada!", description: "Sua presença foi confirmada com sucesso." });
        }
        setGpsLoading(null);
      },
      () => {
        toast({
          title: "Erro de GPS",
          description: "Não foi possível obter sua localização. Verifique as permissões do navegador.",
          variant: "destructive",
        });
        setGpsLoading(null);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

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
        Registre sua presença nas aulas do dia. Disponível das 19:00 às 23:59.
      </p>

      {!isWithinTime && (
        <Card className="card-academic mb-6 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="w-5 h-5 text-yellow-600" />
            <p className="text-sm font-body text-yellow-700 dark:text-yellow-400">
              O registro de presença está disponível apenas das 19:00 às 23:59.
            </p>
          </CardContent>
        </Card>
      )}

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
                    onClick={() => handleCheckIn(lesson.id)}
                    disabled={!isWithinTime || !settings || gpsLoading === lesson.id}
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
