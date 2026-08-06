import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCheck, Award, FileText, ClipboardCheck, Download, Loader2, ExternalLink, BookOpen, CheckCircle } from "lucide-react";
import jsPDF from "jspdf";
import QuizAnswerDialog from "@/components/quiz/QuizAnswerDialog";
import QuizGabarito from "@/components/quiz/QuizGabarito";

interface JoinInfo {
  cohort_id: string;
  cohort_name: string;
  course_id: string;
  course_name: string;
  has_attendance: boolean;
  has_quizzes: boolean;
  has_materials: boolean;
  has_certificates: boolean;
}

interface Material {
  id: string;
  title: string;
  description: string | null;
  material_type: string;
  file_path: string | null;
  external_url: string | null;
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

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="card-academic">
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Icon className="w-5 h-5 text-accent" />
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function CodeCourseDayPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(true);

  const [materials, setMaterials] = useState<Material[]>([]);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});
  const [gabaritoOpen, setGabaritoOpen] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(true);

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
        }
      }
      setLoadingLesson(false);
    })();
  }, [info]);

  useEffect(() => {
    if (!info || !info.has_materials) return;
    supabase
      .from("extra_materials")
      .select("id, title, description, material_type, file_path, external_url")
      .eq("course_id", info.course_id)
      .then(({ data }) => setMaterials(data || []));
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

  useEffect(() => {
    if (!lessonId || !info?.has_quizzes || !user) {
      setLoadingQuiz(false);
      return;
    }
    (async () => {
      setLoadingQuiz(true);
      const { data: quiz } = await supabase
        .from("quizzes")
        .select("id, title")
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (!quiz) {
        setLoadingQuiz(false);
        return;
      }
      setQuizId(quiz.id);
      setQuizTitle(quiz.title);

      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("order_index");

      setQuizQuestions(qs || []);

      const { data: existingResponse } = await supabase
        .from("quiz_responses")
        .select("answers")
        .eq("quiz_id", quiz.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingResponse) {
        setQuizAnswered(true);
        setStudentAnswers((existingResponse.answers as Record<string, any>) || {});
      }

      setLoadingQuiz(false);
    })();
  }, [lessonId, info, user]);

  const handleQuizSubmitted = (_quizId: string, _qs: any[], mergedAnswers: Record<string, any>) => {
    setQuizAnswered(true);
    setStudentAnswers(mergedAnswers);
    setQuizDialogOpen(false);
    setGabaritoOpen(true);
  };

  const materialUrl = (m: Material) => {
    if (m.external_url) return m.external_url;
    if (m.file_path) return supabase.storage.from("course-files").getPublicUrl(m.file_path).data.publicUrl;
    return "#";
  };

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
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6 font-body">
        {/* Cabeçalho */}
        <div className="text-center space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="mx-auto w-14 h-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{info.course_name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{info.cohort_name}</p>
          </div>
        </div>

        {/* Presença */}
        {info.has_attendance && (
          <SectionCard icon={UserCheck} title="Presença">
            {loadingLesson ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </p>
            ) : !lessonId ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma aula encontrada pra hoje nesse curso. Fale com a coordenação.
              </p>
            ) : checkedIn ? (
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-green-700">Presença confirmada</p>
              </div>
            ) : (
              <Button onClick={confirmPresence} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar presença"}
              </Button>
            )}
          </SectionCard>
        )}

        {/* Questionário */}
        {info.has_quizzes && lessonId && !loadingQuiz && quizId && (
          <SectionCard icon={ClipboardCheck} title="Questionário">
            {quizAnswered ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-green-700">Respostas enviadas — obrigado!</p>
                </div>
                <Button variant="outline" onClick={() => setGabaritoOpen(true)} className="w-full">
                  Ver gabarito
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{quizTitle}</p>
                <Button onClick={() => setQuizDialogOpen(true)} className="w-full">
                  Responder
                </Button>
              </div>
            )}
          </SectionCard>
        )}

        {/* Materiais */}
        {info.has_materials && materials.length > 0 && (
          <SectionCard icon={FileText} title="Materiais">
            <div className="grid gap-2">
              {materials.map((m) => (
                <a
                  key={m.id}
                  href={materialUrl(m)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-sm rounded-lg border border-border px-4 py-3 hover:bg-muted/60 hover:border-accent/40 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                    {m.material_type === "link" ? (
                      <ExternalLink className="w-4 h-4 text-accent" />
                    ) : (
                      <FileText className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <span className="font-medium text-foreground">{m.title}</span>
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Certificado */}
        {info.has_certificates && (
          <Card className="card-academic border-accent/40 bg-accent/5">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Award className="w-5 h-5 text-accent" />
              <CardTitle className="font-heading text-lg">Certificado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Baixe agora — o certificado não é enviado por e-mail, só fica disponível aqui.
              </p>
              <Button
                onClick={downloadCertificate}
                className="w-full gap-2 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20"
              >
                <Download className="w-4 h-4" /> Baixar certificado
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {quizId && (
        <QuizAnswerDialog
          open={quizDialogOpen}
          onOpenChange={setQuizDialogOpen}
          quiz={{ id: quizId, title: quizTitle }}
          questions={quizQuestions}
          onSubmitted={handleQuizSubmitted}
        />
      )}

      {gabaritoOpen && (
        <Dialog open={gabaritoOpen} onOpenChange={setGabaritoOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">{quizTitle}</DialogTitle>
            </DialogHeader>
            <QuizGabarito questions={quizQuestions} studentAnswers={studentAnswers} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
