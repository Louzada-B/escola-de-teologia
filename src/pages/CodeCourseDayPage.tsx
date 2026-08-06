import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2, FileText, ExternalLink } from "lucide-react";
import jsPDF from "jspdf";

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

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  order_index: number;
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

  const [materials, setMaterials] = useState<Material[]>([]);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
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
          setLessonTitle(todayLessons[0].title);
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

      const { data: existingResponse } = await supabase
        .from("quiz_responses")
        .select("id")
        .eq("quiz_id", quiz.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingResponse) {
        setQuizAnswered(true);
        setLoadingQuiz(false);
        return;
      }

      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("id, question, options, order_index")
        .eq("quiz_id", quiz.id)
        .order("order_index");

      setQuestions((qs || []) as QuizQuestion[]);
      setLoadingQuiz(false);
    })();
  }, [lessonId, info, user]);

  const submitQuiz = async () => {
    if (!quizId || !user) return;
    if (Object.keys(answers).length < questions.length) {
      toast.error("Responda todas as perguntas antes de enviar.");
      return;
    }
    setQuizLoading(true);
    const { error } = await supabase.from("quiz_responses").insert({
      quiz_id: quizId,
      user_id: user.id,
      answers,
    });
    setQuizLoading(false);
    if (error) {
      toast.error("Erro ao enviar respostas: " + error.message);
      return;
    }
    setQuizAnswered(true);
    toast.success("Respostas enviadas!");
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

        {info.has_quizzes && lessonId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Questionário</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingQuiz ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </p>
              ) : !quizId ? (
                <p className="text-sm text-muted-foreground">Sem questionário pra essa aula.</p>
              ) : quizAnswered ? (
                <p className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Respostas enviadas — obrigado!
                </p>
              ) : (
                <div className="space-y-5">
                  <p className="text-sm font-medium">{quizTitle}</p>
                  {questions.map((q, i) => (
                    <div key={q.id} className="space-y-2">
                      <p className="text-sm">{i + 1}. {q.question}</p>
                      <RadioGroup
                        value={answers[q.id]?.toString() ?? ""}
                        onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                      >
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <RadioGroupItem value={oi.toString()} id={`${q.id}-${oi}`} />
                            <Label htmlFor={`${q.id}-${oi}`} className="text-sm font-normal">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                  <Button onClick={submitQuiz} disabled={quizLoading} className="w-full">
                    {quizLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar respostas"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {info.has_materials && materials.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Materiais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {materials.map((m) => (
                <a
                  key={m.id}
                  href={materialUrl(m)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm p-2 rounded-md border hover:bg-muted transition-colors"
                >
                  {m.material_type === "link" ? <ExternalLink className="w-4 h-4 shrink-0" /> : <FileText className="w-4 h-4 shrink-0" />}
                  <span>{m.title}</span>
                </a>
              ))}
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
