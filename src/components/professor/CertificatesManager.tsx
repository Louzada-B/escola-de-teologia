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
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text("✦  ✦  ✦", W / 2, 22, { align: "center" });

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
  doc.text("CERTIFICADO DE CONCLUSÃO", W / 2, 57, { align: "center", charSpace: 1.5 });

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
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text("—  ✦  —", W / 2, 92, { align: "center" });

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
  doc.text("ESCOLA DE TEOLOGIA BRASA CHURCH", W / 2, 164, { align: "center", charSpace: 0.5 });

  return doc;
}

// ─── HTML preview component ─────────────────────────────────────────────────

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
  const f: React.CSSProperties = { fontFamily: "Georgia,'Times New Roman',serif", textAlign: "center" };

  return (
    <div style={{ width:"100%", position:"relative", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,.15)", borderRadius:4 }}>
      {/* Native size container scaled to fit */}
      <div id="cert-preview-outer" style={{ width:"100%", overflow:"hidden" }}>
        <div
          id="cert-preview-native"
          style={{
            width: 960, height: 679,
            background: "#faf8f4",
            position: "relative",
            transformOrigin: "top left",
          }}
        >
          {/* Outer gold border */}
          <div style={{ position:"absolute", inset:"2.8%", border:"2px solid #c9a84c" }} />
          {/* Inner gold border */}
          <div style={{ position:"absolute", inset:"4.2%", border:"0.5px solid #c9a84c", opacity:.4 }} />
          {/* Corner navy accents */}
          {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
            <div key={v+h} style={{
              position:"absolute",
              [v]: 23, [h]: 23,
              width:36, height:36,
              borderTop: v==="top" ? "2.5px solid #1a2e52" : undefined,
              borderBottom: v==="bottom" ? "2.5px solid #1a2e52" : undefined,
              borderLeft: h==="left" ? "2.5px solid #1a2e52" : undefined,
              borderRight: h==="right" ? "2.5px solid #1a2e52" : undefined,
            }} />
          ))}
          {/* Content */}
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <div style={{ ...f, fontSize:22, color:"#c9a84c", letterSpacing:14, marginBottom:8 }}>✦ &nbsp; ✦ &nbsp; ✦</div>
            <div style={{ ...f, fontSize:28, fontWeight:"bold", color:"#1a2e52", letterSpacing:5, textTransform:"uppercase" }}>Escola de Teologia Brasa Church</div>
            <div style={{ ...f, fontSize:14, color:"#c9a84c", letterSpacing:9, margin:"5px 0 8px" }}>FORMAÇÃO &nbsp; TEOLÓGICA</div>
            <div style={{ width:300, height:1, background:"linear-gradient(90deg,transparent,#c9a84c,transparent)", margin:"6px 0" }} />
            <div style={{ ...f, fontSize:32, fontWeight:500, color:"#2c2c2c", letterSpacing:7, margin:"8px 0 18px", textTransform:"uppercase" }}>Certificado de Conclusão</div>
            <div style={{ ...f, fontSize:20, fontStyle:"italic", color:"#888", marginBottom:10 }}>Certificamos que</div>
            <div style={{ ...f, fontSize:42, fontWeight:"bold", color:"#1a2e52", lineHeight:1.1 }}>{student.fullName}</div>
            <div style={{ ...f, fontSize:18, color:"#c9a84c", margin:"4px 0 10px", letterSpacing:8 }}>— ✦ —</div>
            <div style={{ ...f, fontSize:18, color:"#555" }}>concluiu com êxito o curso de formação teológica — {cohort.name}</div>
            <div style={{ ...f, fontSize:18, color:"#666", marginTop:3 }}>no período de {startDate} a {endDate}</div>
            <div style={{ ...f, fontSize:14, fontStyle:"italic", color:"#bbb", margin:"5px 0 14px" }}>tendo cumprido todos os requisitos estabelecidos pela instituição.</div>
            <div style={{ ...f, fontSize:14, fontStyle:"italic", color:"#999", marginBottom:18 }}>Porto Alegre, {today}</div>
            <div style={{ width:220, height:1, background:"#1a2e52", opacity:.4, marginBottom:5 }} />
            <div style={{ ...f, fontSize:13, letterSpacing:2.5, color:"#1a2e52", textTransform:"uppercase" }}>Escola de Teologia Brasa Church</div>
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

    const { data: quizzes }   = await supabase.from("quizzes").select("id");
    const totalQuiz = (quizzes || []).length;
    const { data: responses } = await supabase
      .from("quiz_responses").select("user_id, quiz_id").in("user_id", ids);

    const result: StudentEligibility[] = ids.map((uid: string) => {
      const p = pMap[uid] || {};
      const att = (attendance || []).filter((a: any) => a.user_id === uid);

      const regDone = att.filter((a: any) => regular.some((l: any) => l.id === a.lesson_id)).length;
      const speDone = att.filter((a: any) => special.some((l: any) => l.id === a.lesson_id)).length;
      const attReg  = regular.length  > 0 ? (regDone / regular.length)  * 100 : 100;
      const attSpe  = special.length  > 0 ? (speDone / special.length)  * 100 : 100;
      const quizSet = new Set((responses || []).filter((r: any) => r.user_id === uid).map((r: any) => r.quiz_id));
      const quizPct = totalQuiz > 0 ? (quizSet.size / totalQuiz) * 100 : 100;
      const eligible = attReg >= 75 && attSpe >= 20 && quizPct >= 75;

      return {
        userId: uid,
        fullName: p.full_name || "Sem nome",
        email:    p.email     || "",
        attendanceRegular: Math.round(attReg),
        attendanceSpecial: Math.round(attSpe),
        quizCompletion:    Math.round(quizPct),
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
              disabled={processing || pending.length === 0}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {processing ? (progress || "Processando…") : `Emitir e Enviar (${pending.length})`}
            </Button>
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
                        {s.eligible ? (
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
