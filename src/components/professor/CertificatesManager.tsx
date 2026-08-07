import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCohort } from "@/contexts/CohortContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Download, Award, CheckCircle, XCircle, Eye, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";

interface StudentEligibility {
  userId: string;
  fullName: string;
  email: string;
  attendanceRegular: number;
  attendanceSpecial: number;
  quizCompletion: number;
  tccApproved: boolean;
  eligible: boolean;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function parseDateLocal(dateStr: string) {
  return new Date(dateStr + "T12:00:00");
}

function fmtDateBR(dateStr: string) {
  return parseDateLocal(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function todayBR() {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

// ─── PDF generation ─────────────────────────────────────────────────────────

async function generateCertificatePdf(
  student: StudentEligibility,
  cohort: any
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;

  const navy  = [26,  46,  82]  as [number,number,number];
  const gold  = [201, 168, 76]  as [number,number,number];
  const dark  = [44,  44,  44]  as [number,number,number];
  const mid   = [136, 136, 136] as [number,number,number];
  const light = [187, 187, 187] as [number,number,number];
  const cream = [250, 248, 244] as [number,number,number];

  // Cream background
  doc.setFillColor(...cream);
  doc.rect(0, 0, W, H, "F");

  // Outer gold border
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.7);
  doc.rect(8, 6, W - 16, H - 12);

  // Inner gold border (thinner)
  doc.setLineWidth(0.25);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.rect(12, 9, W - 24, H - 18);

  // Corner navy accents (L-shapes)
  const cSize = 8;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.8);
  // TL
  doc.line(7, 6 + cSize, 7, 6); doc.line(7, 6, 7 + cSize, 6);
  // TR
  doc.line(W - 7 - cSize, 6, W - 7, 6); doc.line(W - 7, 6, W - 7, 6 + cSize);
  // BL
  doc.line(7, H - 6 - cSize, 7, H - 6); doc.line(7, H - 6, 7 + cSize, H - 6);
  // BR
  doc.line(W - 7 - cSize, H - 6, W - 7, H - 6); doc.line(W - 7, H - 6, W - 7, H - 6 - cSize);

  // Ornament (dots)
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 30, 20, W / 2 + 30, 20);
  doc.setFillColor(...gold);
  doc.circle(W / 2, 20, 0.8, "F");
  doc.circle(W / 2 - 8, 20, 0.5, "F");
  doc.circle(W / 2 + 8, 20, 0.5, "F");

  // Institution name
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...navy);
  doc.text("ESCOLA DE TEOLOGIA BRASA CHURCH", W / 2, 33, { align: "center" });

  // Subtitle
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...gold);
  doc.text("F O R M A Ç Ã O   T E O L Ó G I C A", W / 2, 40, { align: "center" });

  // Gold divider 1
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 55, 44, W / 2 + 55, 44);

  // Certificate title
  doc.setFont("times", "normal");
  doc.setFontSize(18);
  doc.setTextColor(...dark);
  doc.text("CERTIFICADO DE CONCLUSÃO", W / 2, 57, { align: "center" });

  // "Certificamos que"
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...mid);
  doc.text("Certificamos que", W / 2, 71, { align: "center" });

  // Student name
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...navy);
  doc.text(student.fullName, W / 2, 85, { align: "center" });

  // Name ornament
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 30, 92, W / 2 + 30, 92);

  // Body
  const cohortName = cohort.name;
  const startDate  = fmtDateBR(cohort.start_date);
  const endDate    = fmtDateBR(cohort.end_date);

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...dark);
  doc.text(
    `concluiu com êxito o curso de formação teológica — ${cohortName}`,
    W / 2, 103, { align: "center" }
  );
  doc.text(
    `no período de ${startDate} a ${endDate}`,
    W / 2, 112, { align: "center" }
  );

  doc.setFontSize(9);
  doc.setFont("times", "italic");
  doc.setTextColor(...light);
  doc.text(
    "tendo cumprido todos os requisitos estabelecidos pela instituição.",
    W / 2, 121, { align: "center" }
  );

  // Gold divider 2
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.25);
  doc.line(W / 2 - 70, 131, W / 2 + 70, 131);

  // Date
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...mid);
  doc.text(`Porto Alegre, ${todayBR()}`, W / 2, 141, { align: "center" });

  // Signature
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 38, 158, W / 2 + 38, 158);

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...navy);
  doc.text("ESCOLA DE TEOLOGIA BRASA CHURCH", W / 2, 164, { align: "center" });

  return doc;
}

// ─── HTML preview component ─────────────────────────────────────────────────
// Fiel ao PDF gerado: mesmas proporções, fontes e layout

function CertificatePreview({
  student,
  cohort,
}: {
  student: StudentEligibility;
  cohort: any;
}) {
  const startDate = fmtDateBR(cohort.start_date);
  const endDate   = fmtDateBR(cohort.end_date);
  const today     = todayBR();

  // Escala: 960px representa 297mm → 1mm = 3.23px
  // Fontes em pt → px: 1pt = 0.353mm × 3.23 = 1.14px
  const s = (mm: number) => mm * 3.23;
  const pt = (p: number) => Math.round(p * 1.14);
  const f: React.CSSProperties = { fontFamily: "Georgia,'Times New Roman',serif", textAlign: "center", lineHeight: 1.2 };

  useEffect(() => {
    const outer = document.getElementById("cert-preview-outer2");
    const native = document.getElementById("cert-preview-native2");
    if (!outer || !native) return;
    const apply = () => {
      const w = outer.offsetWidth;
      const sc = w / 960;
      (native as HTMLElement).style.transform = `scale(${sc})`;
      (outer as HTMLElement).style.height = `${679 * sc}px`;
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return (
    <div style={{ width:"100%", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,.15)", borderRadius:4 }}>
      <div id="cert-preview-outer2" style={{ width:"100%", overflow:"hidden" }}>
        <div
          id="cert-preview-native2"
          style={{ width:960, height:679, background:"#faf8f4", position:"relative", transformOrigin:"top left" }}
        >
          {/* Outer gold border */}
          <div style={{ position:"absolute", top:s(6), left:s(8), right:s(8), bottom:s(6), border:"2px solid #c9a84c", pointerEvents:"none" }} />
          {/* Inner gold border */}
          <div style={{ position:"absolute", top:s(9), left:s(12), right:s(12), bottom:s(9), border:"0.5px solid #c9a84c", opacity:.4, pointerEvents:"none" }} />
          {/* Corner navy L-shapes */}
          {([["top","left"],["top","right"],["bottom","left"],["bottom","right"]] as const).map(([v,h]) => (
            <div key={v+h} style={{
              position:"absolute", [v]:s(6)-1, [h]:s(8)-1,
              width:s(8), height:s(8),
              borderTop:    v==="top"    ? "2.5px solid #1a2e52" : undefined,
              borderBottom: v==="bottom" ? "2.5px solid #1a2e52" : undefined,
              borderLeft:   h==="left"   ? "2.5px solid #1a2e52" : undefined,
              borderRight:  h==="right"  ? "2.5px solid #1a2e52" : undefined,
              pointerEvents:"none",
            }} />
          ))}

          {/* Content — posições fiéis ao PDF (y em mm × 3.23) */}
          {/* Ornamento topo: linha gold com pontos em y=20mm */}
          <div style={{ position:"absolute", top:s(20)-1, left:"50%", transform:"translateX(-50%)", width:s(60), height:1, background:"linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />
          <div style={{ position:"absolute", top:s(20)-3, left:"50%", transform:"translateX(-50%)", width:6, height:6, borderRadius:"50%", background:"#c9a84c" }} />
          <div style={{ position:"absolute", top:s(20)-2, left:`calc(50% - ${s(8)}px)`, width:4, height:4, borderRadius:"50%", background:"#c9a84c" }} />
          <div style={{ position:"absolute", top:s(20)-2, left:`calc(50% + ${s(8)-4}px)`, width:4, height:4, borderRadius:"50%", background:"#c9a84c" }} />

          {/* Instituição: baseline y=33mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(33)-pt(16), fontSize:pt(16), fontWeight:"bold", color:"#1a2e52", letterSpacing:5, textTransform:"uppercase" }}>
            ESCOLA DE TEOLOGIA BRASA CHURCH
          </div>

          {/* Subtítulo: baseline y=40mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(40)-pt(8), fontSize:pt(8)+2, color:"#c9a84c", letterSpacing:8 }}>
            F O R M A Ç Ã O &nbsp; T E O L Ó G I C A
          </div>

          {/* Divisor 1: y=44mm */}
          <div style={{ position:"absolute", top:s(44), left:"50%", transform:"translateX(-50%)", width:s(110), height:0.5, background:"linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />

          {/* Título: baseline y=57mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(57)-pt(18), fontSize:pt(18), fontWeight:500, color:"#2c2c2c", letterSpacing:4 }}>
            CERTIFICADO DE CONCLUSÃO
          </div>

          {/* "Certificamos que": baseline y=71mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(71)-pt(12), fontSize:pt(12), fontStyle:"italic", color:"#888" }}>
            Certificamos que
          </div>

          {/* Nome: baseline y=85mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(85)-pt(26), fontSize:pt(26), fontWeight:"bold", color:"#1a2e52" }}>
            {student.fullName}
          </div>

          {/* Linha gold abaixo do nome: y=92mm */}
          <div style={{ position:"absolute", top:s(92), left:"50%", transform:"translateX(-50%)", width:s(60), height:1, background:"#c9a84c" }} />

          {/* Corpo 1: baseline y=103mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(103)-pt(12), fontSize:pt(12), color:"#444" }}>
            concluiu com êxito o curso de formação teológica — {cohort.name}
          </div>

          {/* Corpo 2: baseline y=112mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(112)-pt(12), fontSize:pt(12), color:"#555" }}>
            no período de {startDate} a {endDate}
          </div>

          {/* Requisitos: baseline y=121mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(121)-pt(9), fontSize:pt(9), fontStyle:"italic", color:"#bbb" }}>
            tendo cumprido todos os requisitos estabelecidos pela instituição.
          </div>

          {/* Divisor 2: y=131mm */}
          <div style={{ position:"absolute", top:s(131), left:"50%", transform:"translateX(-50%)", width:s(140), height:0.5, background:"linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />

          {/* Data: baseline y=141mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(141)-pt(9), fontSize:pt(9), fontStyle:"italic", color:"#999" }}>
            Porto Alegre, {today}
          </div>

          {/* Linha assinatura: y=158mm */}
          <div style={{ position:"absolute", top:s(158), left:"50%", transform:"translateX(-50%)", width:s(76), height:0.5, background:"#1a2e52", opacity:.4 }} />

          {/* Assinatura: baseline y=164mm */}
          <div style={{ ...f, position:"absolute", width:"100%", top:s(164)-pt(8), fontSize:pt(8)+1, color:"#1a2e52", letterSpacing:2, textTransform:"uppercase" }}>
            Escola de Teologia Brasa Church
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CertificatesManager() {
  const { selectedCohort } = useCohort();
  const { user } = useAuth();
  const [students, setStudents]       = useState<StudentEligibility[]>([]);
  const [loading, setLoading]         = useState(false);
  const [processing, setProcessing]   = useState(false);
  const [previewStudent, setPreviewStudent] = useState<StudentEligibility | null>(null);
  const [issuedMap, setIssuedMap]     = useState<Record<string, boolean>>({});
  const [emailSentMap, setEmailSentMap] = useState<Record<string, boolean>>({});
  const [progress, setProgress]       = useState("");
  const [courseEndDate, setCourseEndDate] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCohort) { fetchEligibility(); fetchIssued(); }
  }, [selectedCohort]);

  async function fetchIssued() {
    if (!selectedCohort) return;
    const { data } = await supabase
      .from("issued_certificates")
      .select("user_id, email_sent")
      .eq("cohort_id", selectedCohort.id);
    const issued: Record<string, boolean> = {};
    const emails: Record<string, boolean> = {};
    (data || []).forEach((r: any) => {
      issued[r.user_id] = true;
      emails[r.user_id] = r.email_sent ?? false;
    });
    setIssuedMap(issued);
    setEmailSentMap(emails);
  }

  async function fetchEligibility() {
    if (!selectedCohort) return;
    setLoading(true);

    const { data: cs } = await supabase
      .from("cohort_students").select("user_id").eq("cohort_id", selectedCohort.id);
    const ids = (cs || []).map((r: any) => r.user_id);
    if (!ids.length) { setStudents([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name, email").in("id", ids);
    const pMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { pMap[p.id] = p; });

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, event_type, mandatory_attendance")
      .gte("scheduled_date", selectedCohort.start_date)
      .lte("scheduled_date", selectedCohort.end_date)
      .eq("mandatory_attendance", true);

    const regular  = (lessons || []).filter((l: any) => l.event_type === "aula");
    const special  = (lessons || []).filter((l: any) => l.event_type === "aula_especial");
    const allIds   = (lessons || []).map((l: any) => l.id);

    const { data: attendance } = await supabase
      .from("attendance_records").select("user_id, lesson_id")
      .in("user_id", ids)
      .in("lesson_id", allIds.length ? allIds : ["none"]);

    const now = new Date().toISOString();

    // Última data cadastrada de cada categoria (independente de ter ocorrido ou não)
    const lastRegularDate = regular.length > 0
      ? regular.map((l: any) => l.scheduled_date).filter(Boolean).sort().pop() ?? null
      : null;
    const lastSpecialDate = special.length > 0
      ? special.map((l: any) => l.scheduled_date).filter(Boolean).sort().pop() ?? null
      : null;

    const { data: quizzes }   = await supabase
      .from("quizzes")
      .select("id, available_from, available_until, counts_for_completion")
      .gte("available_from", "1900-01-01"); // busca todos

    // Último available_until entre os questionários da turma
    const cohortQuizIds = new Set((quizzes || []).map((q: any) => q.id));
    const lastQuizDate = (quizzes || [])
      .filter((q: any) => q.available_until)
      .map((q: any) => q.available_until)
      .sort().pop() ?? null;

    // Curso completo quando hoje passou das três últimas datas cadastradas
    const today = now.slice(0, 10);
    const courseComplete =
      (!lastRegularDate || today >= lastRegularDate) &&
      (!lastSpecialDate || today >= lastSpecialDate) &&
      (!lastQuizDate    || today >= lastQuizDate.slice(0, 10));

    // Data mais tardia para exibir ao professor
    const latestDate = [lastRegularDate, lastSpecialDate, lastQuizDate?.slice(0, 10)]
      .filter(Boolean).sort().pop() ?? null;
    setCourseEndDate(latestDate);
    // Denominador: só quizzes já abertos E que contam pra conclusão (mesma lógica do dashboard e analytics)
    const openedQuizzes = (quizzes || []).filter(
      (q: any) => (!q.available_from || q.available_from <= now) && q.counts_for_completion !== false
    );
    const totalQuiz = openedQuizzes.length;
    const openedQuizIds = new Set(openedQuizzes.map((q: any) => q.id));
    const { data: responses } = await supabase
      .from("quiz_responses").select("user_id, quiz_id").in("user_id", ids);

    // TCC aprovados por aluno
    const { data: tccSubs } = await supabase
      .from("tcc_submissions")
      .select("user_id, status")
      .in("user_id", ids)
      .eq("cohort_id", selectedCohort.id)
      .eq("status", "approved");
    const approvedTccIds = new Set((tccSubs || []).map((t: any) => t.user_id));

    // Só aulas já realizadas como denominador (igual ao dashboard)
    const todayStr = now.slice(0, 10);
    const pastRegular = regular.filter((l: any) => l.scheduled_date && l.scheduled_date <= todayStr);
    const pastSpecial = special.filter((l: any) => l.scheduled_date && l.scheduled_date <= todayStr);

    const result: StudentEligibility[] = ids.map((uid: string) => {
      const p = pMap[uid] || {};
      const att = (attendance || []).filter((a: any) => a.user_id === uid);

      const regDone = att.filter((a: any) => pastRegular.some((l: any) => l.id === a.lesson_id)).length;
      const speDone = att.filter((a: any) => pastSpecial.some((l: any) => l.id === a.lesson_id)).length;
      const attReg  = pastRegular.length > 0 ? (regDone / pastRegular.length) * 100 : 100;
      const attSpe  = pastSpecial.length > 0 ? (speDone / pastSpecial.length) * 100 : 100;
      const quizSet = new Set(
        (responses || [])
          .filter((r: any) => r.user_id === uid && openedQuizIds.has(r.quiz_id))
          .map((r: any) => r.quiz_id)
      );
      const quizPct = totalQuiz > 0 ? (quizSet.size / totalQuiz) * 100 : 100;
      const tccApproved = approvedTccIds.has(uid);
      const eligible = courseComplete && attReg >= 75 && attSpe >= 20 && quizPct >= 75 && tccApproved;

      return {
        userId: uid,
        fullName: p.full_name || "Sem nome",
        email:    p.email     || "",
        attendanceRegular: Math.round(attReg),
        attendanceSpecial: Math.round(attSpe),
        quizCompletion:    Math.round(quizPct),
        tccApproved,
        eligible,
      };
    });

    result.sort((a, b) => (a.eligible === b.eligible ? a.fullName.localeCompare(b.fullName) : a.eligible ? -1 : 1));
    setStudents(result);
    setLoading(false);
  }

  async function downloadSingle(student: StudentEligibility) {
    if (!selectedCohort) return;
    const doc = await generateCertificatePdf(student, selectedCohort);
    doc.save(`Certificado_${student.fullName.replace(/\s+/g, "_")}.pdf`);
  }

  async function handleIssueAll() {
    if (!selectedCohort || !user) return;

    const pending = students.filter(s => s.eligible && !issuedMap[s.userId]);
    if (!pending.length) {
      toast({ title: "Nenhum aluno pendente", description: "Todos os alunos aptos já foram contemplados." });
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let errorCount   = 0;

    for (let i = 0; i < pending.length; i++) {
      const s = pending[i];
      setProgress(`Processando ${i + 1}/${pending.length}: ${s.fullName}…`);

      try {
        // Generate PDF
        const doc     = await generateCertificatePdf(s, selectedCohort);
        const pdfB64  = doc.output("datauristring").split(",")[1];

        // Send email
        const { error: fnError } = await supabase.functions.invoke("send-certificate", {
          body: {
            studentEmail: s.email,
            studentName:  s.fullName,
            cohortName:   selectedCohort.name,
            issuedDate:   todayBR(),
            pdfBase64:    pdfB64,
          },
        });

        const emailOk = !fnError;

        // Record in DB
        await supabase.from("issued_certificates").insert({
          user_id:    s.userId,
          cohort_id:  selectedCohort.id,
          template_id: null,
          issued_by:  user.id,
          email_sent: emailOk,
        } as any);

        if (emailOk) successCount++;
        else { errorCount++; console.warn("Email error for", s.email, fnError); }
      } catch (err: any) {
        errorCount++;
        console.error("Certificate error for", s.fullName, err);
      }
    }

    setProgress("");
    setProcessing(false);
    fetchIssued();

    toast({
      title: `${successCount} certificado(s) enviado(s)!`,
      description: errorCount > 0 ? `${errorCount} envio(s) falharam — verifique os secrets SMTP.` : undefined,
    });
  }

  async function handleResendEmail(student: StudentEligibility) {
    if (!selectedCohort) return;
    setProcessing(true);
    try {
      const doc    = await generateCertificatePdf(student, selectedCohort);
      const pdfB64 = doc.output("datauristring").split(",")[1];

      const { error } = await supabase.functions.invoke("send-certificate", {
        body: {
          studentEmail: student.email,
          studentName:  student.fullName,
          cohortName:   selectedCohort.name,
          issuedDate:   todayBR(),
          pdfBase64:    pdfB64,
        },
      });

      if (error) throw error;

      await supabase.from("issued_certificates")
        .update({ email_sent: true } as any)
        .eq("user_id", student.userId)
        .eq("cohort_id", selectedCohort.id);

      toast({ title: "E-mail reenviado com sucesso!" });
      fetchIssued();
    } catch (err: any) {
      toast({ title: "Erro ao reenviar", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  function downloadCSV() {
    const eligible = students.filter(s => s.eligible);
    if (!eligible.length) return;
    const rows = eligible.map(s =>
      `"${s.fullName}","${s.email}",${s.attendanceRegular},${s.attendanceSpecial},${s.quizCompletion}`
    );
    const csv  = ["Nome,Email,Presença Aulas (%),Presença Especiais (%),Questionários (%)", ...rows].join("\n");
    const url  = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `alunos-aptos-${selectedCohort?.name || "turma"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const eligible  = students.filter(s => s.eligible);
  const pending   = eligible.filter(s => !issuedMap[s.userId]);

  if (!selectedCohort) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma turma para gerenciar certificados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* Summary card */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Award className="w-5 h-5" />
            Certificados — {selectedCohort.name}
          </CardTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{students.length} alunos</Badge>
            <Badge className="bg-green-500/10 text-green-700 border-green-200">{eligible.length} aptos</Badge>
            <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">{pending.length} pendentes</Badge>
            <Badge className="bg-blue-500/10 text-blue-700 border-blue-200">
              {eligible.length - pending.length} emitidos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleIssueAll}
              disabled={processing || pending.length === 0 || !courseEndDate || new Date().toISOString().slice(0,10) < courseEndDate}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {processing ? (progress || "Processando…") : `Emitir e Enviar (${pending.length})`}
            </Button>
            {courseEndDate && new Date().toISOString().slice(0,10) < courseEndDate && (
              <p className="text-xs text-muted-foreground mt-2">
                Emissão disponível após {new Date(courseEndDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.
              </p>
            )}
            {eligible.length > 0 && (
              <Button variant="outline" onClick={downloadCSV} className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            )}
          </div>
          {processing && progress && (
            <p className="text-xs text-muted-foreground mt-3 animate-pulse">{progress}</p>
          )}
        </CardContent>
      </Card>

      {/* Students table */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-base">Elegibilidade por Aluno</CardTitle>
          <p className="text-xs text-muted-foreground">
            Critérios: ≥ 75% presença em aulas · ≥ 20% presença em aulas especiais · ≥ 75% questionários
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando…</p>
          ) : students.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum aluno encontrado nesta turma.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Aluno</th>
                    <th className="text-center p-3 font-medium">Aulas</th>
                    <th className="text-center p-3 font-medium">Especiais</th>
                    <th className="text-center p-3 font-medium">Quiz</th>
                    <th className="text-center p-3 font-medium">TCC</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.userId} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium font-body">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant={s.attendanceRegular >= 75 ? "default" : "destructive"}>
                          {s.attendanceRegular}%
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant={s.attendanceSpecial >= 20 ? "default" : "destructive"}>
                          {s.attendanceSpecial}%
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant={s.quizCompletion >= 75 ? "default" : "destructive"}>
                          {s.quizCompletion}%
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant={s.tccApproved ? "default" : "destructive"}>
                          {s.tccApproved ? "Aprovado" : "Pendente"}
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        {!courseEndDate || new Date().toISOString().slice(0,10) < courseEndDate ? (
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <span className="text-xs">Em andamento</span>
                          </div>
                        ) : s.eligible ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs">
                                {issuedMap[s.userId]
                                  ? emailSentMap[s.userId] ? "Enviado" : "Emitido"
                                  : "Apto"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-red-500">
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">Não apto</span>
                          </div>
                        )}
                      </td>
                      <td className="text-center p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pré-visualizar"
                            onClick={() => setPreviewStudent(s)}
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Baixar PDF"
                            onClick={() => downloadSingle(s)}
                          >
                            <Download className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          {issuedMap[s.userId] && !emailSentMap[s.userId] && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Reenviar e-mail"
                              onClick={() => handleResendEmail(s)}
                              disabled={processing}
                            >
                              <Send className="w-4 h-4 text-amber-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={!!previewStudent} onOpenChange={open => !open && setPreviewStudent(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Pré-visualização — {previewStudent?.fullName}
            </DialogTitle>
          </DialogHeader>
          {previewStudent && selectedCohort && (
            <div className="space-y-4">
              <CertificatePreview student={previewStudent} cohort={selectedCohort} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPreviewStudent(null)}>Fechar</Button>
                <Button onClick={() => { downloadSingle(previewStudent); setPreviewStudent(null); }} className="gap-2">
                  <Download className="w-4 h-4" /> Baixar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
