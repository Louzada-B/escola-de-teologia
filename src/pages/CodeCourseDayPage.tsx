import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";

interface JoinInfo {
  cohort_id: string;
  cohort_name: string;
  course_id: string;
  course_name: string;
  has_attendance: boolean;
  has_certificates: boolean;
}

function buildParticipationCertificatePdf(name: string, courseName: string, cohortName: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;
  const navy: [number, number, number] = [26, 46, 82];
  const gold: [number, number, number] = [201, 168, 76];
  const cream: [number, number, number] = [250, 248, 244];

  doc.setFillColor(...cream);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.7);
  doc.rect(8, 6, W - 16, H - 12);
  doc.setLineWidth(0.25);
  doc.rect(12, 9, W - 24, H - 18);

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...navy);
  doc.text("ESCOLA DE TEOLOGIA BRASA CHURCH", W / 2, 40, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.text("Certificado de Participação", W / 2, 55, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.text(name, W / 2, 95, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text(`participou do curso "${courseName}"`, W / 2, 115, { align: "center" });
  doc.text(`Turma: ${cohortName}`, W / 2, 128, { align: "center" });

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text(today, W / 2, 160, { align: "center" });

  return doc;
}

export default function CodeCourseDayPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<string>("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("codeAccessInfo");
    if (!raw) {
      navigate("/acesso");
      return;
    }
    setInfo(JSON.parse(raw));
  }, [navigate]);

  useEffect(() => {
    if (!info) return;
    (async () => {
      setLoadingLesson(true);
      const { data: modules } = await supabase.from("modules").select("id").eq("course_id", info.course_id);
      const moduleIds = (modules || []).map((m) => m.id);
      const today = new Date().toISOString().slice(0, 10);

      if (moduleIds.length > 0) {
        const { data: todayLessons } = await supabase
          .from("lessons")
          .select("id, title")
          .in("module_id", moduleIds)
          .eq("scheduled_date", today)
          .limit(1);

        if (todayLessons && todayLessons.length > 0) {
          setLessonId(todayLessons[0].id);
          setLessonTitle(todayLessons[0].title);
        }
      }
      setLoadingLesson(false);
    })();
  }, [info]);

  useEffect(() => {
    if (!lessonId || !user) return;
    supabase
      .from("attendance_records")
      .select("id")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setCheckedIn(true);
      });
  }, [lessonId, user]);

  const confirmPresence = async () => {
    if (!lessonId || !user) return;
    setLoading(true);
    const { error } = await supabase.from("attendance_records").insert({
      user_id: user.id,
      lesson_id: lessonId,
      latitude: 0,
      longitude: 0,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao registrar presença: " + error.message);
      return;
    }
    setCheckedIn(true);
    toast.success("Presença registrada!");
  };

  const downloadCertificate = () => {
    if (!info || !profile) return;
    const doc = buildParticipationCertificatePdf(profile.full_name || "Participante", info.course_name, info.cohort_name);
    doc.save(`certificado-${info.course_name}.pdf`);
  };

  if (!info) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-heading font-bold">{info.course_name}</h1>
          <p className="text-sm text-muted-foreground">{info.cohort_name}</p>
        </div>

        {info.has_attendance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Presença</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLesson ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </p>
              ) : !lessonId ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma aula encontrada pra hoje nesse curso. Fale com a coordenação.
                </p>
              ) : checkedIn ? (
                <p className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Presença confirmada — {lessonTitle}
                </p>
              ) : (
                <Button onClick={confirmPresence} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar presença"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {info.has_certificates && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Certificado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Baixe agora — o certificado não é enviado por e-mail.
              </p>
              <Button variant="outline" onClick={downloadCertificate} className="w-full gap-2">
                <Download className="w-4 h-4" /> Baixar certificado
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
