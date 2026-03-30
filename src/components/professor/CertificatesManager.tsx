import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCohort } from "@/contexts/CohortContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Download, Award, CheckCircle, XCircle, Plus, Trash2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StudentEligibility {
  userId: string;
  fullName: string;
  email: string;
  attendanceRegular: number;
  attendanceSpecial: number;
  quizCompletion: number;
  eligible: boolean;
}

interface CertTemplate {
  id: string;
  name: string;
  body_text: string;
  background_url: string | null;
  created_at: string;
}

export default function CertificatesManager() {
  const { selectedCohort } = useCohort();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentEligibility[]>([]);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [newTemplate, setNewTemplate] = useState({ name: "", body_text: "Certificamos que {{NOME_ALUNO}} concluiu com êxito o curso de Teologia, turma {{TURMA}}, no período de {{DATA_INICIO}} a {{DATA_FIM}}." });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [issuedMap, setIssuedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedCohort) {
      fetchEligibility();
      fetchIssued();
    }
  }, [selectedCohort]);

  async function fetchTemplates() {
    const { data } = await supabase.from("certificate_templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data as CertTemplate[]);
  }

  async function fetchIssued() {
    if (!selectedCohort) return;
    const { data } = await supabase.from("issued_certificates").select("user_id").eq("cohort_id", selectedCohort.id);
    const map: Record<string, boolean> = {};
    (data || []).forEach((r: any) => { map[r.user_id] = true; });
    setIssuedMap(map);
  }

  async function fetchEligibility() {
    if (!selectedCohort) return;
    setLoading(true);

    // Get students in cohort
    const { data: cohortStudents } = await supabase
      .from("cohort_students").select("user_id").eq("cohort_id", selectedCohort.id);
    const studentIds = (cohortStudents || []).map((cs: any) => cs.user_id);
    if (!studentIds.length) { setStudents([]); setLoading(false); return; }

    // Get profiles
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", studentIds);
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    // Get lessons within cohort date range
    const { data: allLessons } = await supabase
      .from("lessons").select("id, event_type, mandatory_attendance, scheduled_date")
      .gte("scheduled_date", selectedCohort.start_date)
      .lte("scheduled_date", selectedCohort.end_date)
      .eq("mandatory_attendance", true);

    const regularLessons = (allLessons || []).filter(l => l.event_type === "aula");
    const specialLessons = (allLessons || []).filter(l => l.event_type === "aula_especial");
    const allLessonIds = (allLessons || []).map(l => l.id);

    // Get attendance records
    const { data: attendance } = await supabase
      .from("attendance_records").select("user_id, lesson_id")
      .in("user_id", studentIds)
      .in("lesson_id", allLessonIds.length ? allLessonIds : ["none"]);

    // Get quizzes
    const { data: quizzes } = await supabase.from("quizzes").select("id");
    const totalQuizzes = (quizzes || []).length;

    // Get quiz responses
    const { data: responses } = await supabase
      .from("quiz_responses").select("user_id, quiz_id").in("user_id", studentIds);

    // Calculate per student
    const result: StudentEligibility[] = studentIds.map(uid => {
      const profile = profileMap[uid] || {};
      const studentAttendance = (attendance || []).filter(a => a.user_id === uid);

      const regularAttended = studentAttendance.filter(a => regularLessons.some(l => l.id === a.lesson_id)).length;
      const specialAttended = studentAttendance.filter(a => specialLessons.some(l => l.id === a.lesson_id)).length;

      const attRegular = regularLessons.length > 0 ? (regularAttended / regularLessons.length) * 100 : 100;
      const attSpecial = specialLessons.length > 0 ? (specialAttended / specialLessons.length) * 100 : 100;

      const uniqueQuizzes = new Set((responses || []).filter(r => r.user_id === uid).map(r => r.quiz_id));
      const quizPct = totalQuizzes > 0 ? (uniqueQuizzes.size / totalQuizzes) * 100 : 100;

      const eligible = attRegular >= 75 && attSpecial >= 20 && quizPct >= 75;

      return {
        userId: uid,
        fullName: profile.full_name || "Sem nome",
        email: profile.email || "",
        attendanceRegular: Math.round(attRegular),
        attendanceSpecial: Math.round(attSpecial),
        quizCompletion: Math.round(quizPct),
        eligible,
      };
    });

    result.sort((a, b) => (a.eligible === b.eligible ? a.fullName.localeCompare(b.fullName) : a.eligible ? -1 : 1));
    setStudents(result);
    setLoading(false);
  }

  async function handleCreateTemplate() {
    if (!newTemplate.name.trim() || !user) return;
    const { error } = await supabase.from("certificate_templates").insert({
      name: newTemplate.name,
      body_text: newTemplate.body_text,
      created_by: user.id,
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Modelo criado!" });
    setNewTemplate({ name: "", body_text: "Certificamos que {{NOME_ALUNO}} concluiu com êxito o curso de Teologia, turma {{TURMA}}, no período de {{DATA_INICIO}} a {{DATA_FIM}}." });
    setDialogOpen(false);
    fetchTemplates();
  }

  async function handleDeleteTemplate(id: string) {
    await supabase.from("certificate_templates").delete().eq("id", id);
    fetchTemplates();
    if (selectedTemplateId === id) setSelectedTemplateId("");
  }

  function generateCertificateText(student: StudentEligibility, template: CertTemplate): string {
    if (!selectedCohort) return "";
    return template.body_text
      .replace(/\{\{NOME_ALUNO\}\}/g, student.fullName)
      .replace(/\{\{TURMA\}\}/g, selectedCohort.name)
      .replace(/\{\{DATA_INICIO\}\}/g, new Date(selectedCohort.start_date).toLocaleDateString("pt-BR"))
      .replace(/\{\{DATA_FIM\}\}/g, new Date(selectedCohort.end_date).toLocaleDateString("pt-BR"));
  }

  async function handleIssueCertificates() {
    if (!selectedTemplateId || !selectedCohort || !user) {
      toast({ title: "Selecione um modelo de certificado", variant: "destructive" });
      return;
    }

    const eligible = students.filter(s => s.eligible && !issuedMap[s.userId]);
    if (!eligible.length) {
      toast({ title: "Nenhum aluno elegível pendente" });
      return;
    }

    const records = eligible.map(s => ({
      user_id: s.userId,
      cohort_id: selectedCohort.id,
      template_id: selectedTemplateId,
      issued_by: user.id,
    }));

    const { error } = await supabase.from("issued_certificates").insert(records as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${eligible.length} certificado(s) emitido(s)!` });
    fetchIssued();
  }

  function downloadCSV() {
    const eligible = students.filter(s => s.eligible);
    if (!eligible.length) return;
    const header = "Nome,Email,Presença Aulas (%),Presença Especiais (%),Questionários (%)";
    const rows = eligible.map(s => `"${s.fullName}","${s.email}",${s.attendanceRegular},${s.attendanceSpecial},${s.quizCompletion}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alunos-aptos-${selectedCohort?.name || "turma"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const eligibleCount = students.filter(s => s.eligible).length;
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (!selectedCohort) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione uma turma para ver os alunos aptos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Modelos de Certificado
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Modelo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Modelo de Certificado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do modelo</Label>
                  <Input value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Certificado Padrão 2026" />
                </div>
                <div>
                  <Label>Texto do certificado</Label>
                  <Textarea
                    rows={5}
                    value={newTemplate.body_text}
                    onChange={e => setNewTemplate(p => ({ ...p, body_text: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variáveis: {"{{NOME_ALUNO}}"}, {"{{TURMA}}"}, {"{{DATA_INICIO}}"}, {"{{DATA_FIM}}"}
                  </p>
                </div>
                <Button onClick={handleCreateTemplate} disabled={!newTemplate.name.trim()}>Criar Modelo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum modelo criado ainda.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{t.body_text}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(t.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eligibility Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Alunos Aptos — {selectedCohort.name}
          </CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary">{students.length} alunos</Badge>
            <Badge className="bg-green-500/10 text-green-700 border-green-200">{eligibleCount} aptos</Badge>
            <Badge className="bg-red-500/10 text-red-700 border-red-200">{students.length - eligibleCount} não aptos</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Modelo para emissão</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleIssueCertificates} disabled={!selectedTemplateId || eligibleCount === 0}>
              <Award className="w-4 h-4 mr-1" /> Emitir Certificados
            </Button>
            <Button variant="outline" onClick={downloadCSV} disabled={eligibleCount === 0}>
              <Download className="w-4 h-4 mr-1" /> Baixar CSV
            </Button>
          </div>

          {/* Preview */}
          {selectedTemplate && students.filter(s => s.eligible).length > 0 && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Prévia do texto:</p>
                <p className="text-sm italic">
                  {generateCertificateText(students.find(s => s.eligible)!, selectedTemplate)}
                </p>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Aluno</th>
                    <th className="text-center p-3 font-medium">Presença Aulas</th>
                    <th className="text-center p-3 font-medium">Presença Especiais</th>
                    <th className="text-center p-3 font-medium">Questionários</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.userId} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{s.fullName}</p>
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
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            {issuedMap[s.userId] ? <span className="text-xs">Emitido</span> : <span className="text-xs">Apto</span>}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-red-500">
                            <XCircle className="w-4 h-4" />
                            <span className="text-xs">Não apto</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum aluno encontrado nesta turma.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
