import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCohort } from "@/contexts/CohortContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Download, Clock, CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TCCSettings {
  id: string;
  accept_from: string | null;
  deadline: string | null;
  template_path: string | null;
  template_name: string | null;
  instructions: string | null;
}

interface TCCSubmission {
  id: string;
  file_path: string;
  file_name: string;
  status: string;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export default function TCCPage() {
  const { user } = useAuth();
  const { selectedCohort } = useCohort();
  const [studentCohortId, setStudentCohortId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TCCSettings | null>(null);
  const [submission, setSubmission] = useState<TCCSubmission | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedCohort]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: settingsData } = await supabase
        .from("tcc_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      setSettings(settingsData as TCCSettings | null);

      if (user) {
        // Resolve o cohort_id: para alunos busca direto em cohort_students
        // para admin/professor usa selectedCohort do contexto
        let cohortId = selectedCohort?.id ?? null;
        if (!cohortId) {
          const { data: cs } = await supabase
            .from("cohort_students")
            .select("cohort_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();
          cohortId = (cs as any)?.cohort_id ?? null;
        }
        setStudentCohortId(cohortId);

        if (cohortId) {
          const { data: subData } = await supabase
            .from("tcc_submissions")
            .select("*")
            .eq("user_id", user.id)
            .eq("cohort_id", cohortId)
            .maybeSingle();
          setSubmission(subData as TCCSubmission | null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const acceptFrom = settings?.accept_from ? new Date(settings.accept_from) : null;
  const deadline = settings?.deadline ? new Date(settings.deadline) : null;
  const isOpen = acceptFrom && deadline && now >= acceptFrom && now <= deadline;
  const isBeforeOpen = acceptFrom && now < acceptFrom;
  const isAfterDeadline = deadline && now > deadline;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCohort) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Apenas arquivos PDF são aceitos", variant: "destructive" });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx. 20MB)", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const sanitized = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `tcc/${user.id}/${crypto.randomUUID()}_${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from("course-files")
        .upload(path, file);
      if (uploadError) throw uploadError;

      if (submission) {
        // Delete old file
        await supabase.storage.from("course-files").remove([submission.file_path]);
        const { error } = await supabase
          .from("tcc_submissions")
          .update({ file_path: path, file_name: file.name, status: "pending", feedback: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() })
          .eq("id", submission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tcc_submissions")
          .insert({ user_id: user.id, cohort_id: studentCohortId!, file_path: path, file_name: file.name });
        if (error) throw error;
      }

      toast({ title: "TCC enviado com sucesso!" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao enviar TCC", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    if (!settings?.template_path) return;
    const { data } = supabase.storage.from("course-files").getPublicUrl(settings.template_path);
    window.open(`${data.publicUrl}?download`, "_blank");
  };

  const downloadMyTcc = async () => {
    if (!submission?.file_path) return;
    const { data } = supabase.storage.from("course-files").getPublicUrl(submission.file_path);
    window.open(`${data.publicUrl}?download`, "_blank");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Reprovado</Badge>;
      default: return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  if (loading) return <div className="page-container"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="page-container space-y-4 sm:space-y-6 px-3 sm:px-6">
      <h1 className="section-title text-xl sm:text-2xl">Trabalho de Conclusão de Curso (TCC)</h1>

      {/* Instructions & Template */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="w-5 h-5 text-primary" />
              Orientações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {settings?.instructions ? (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {settings.instructions}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma orientação disponível ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              Modelo de TCC
            </CardTitle>
            <CardDescription>Baixe o modelo para formatar seu trabalho</CardDescription>
          </CardHeader>
          <CardContent>
            {settings?.template_path ? (
              <Button onClick={downloadTemplate} variant="outline" className="gap-2 max-w-full">
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">{settings.template_name || "Baixar modelo"}</span>
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum modelo disponível ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deadline info */}
      {settings && (acceptFrom || deadline) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 text-sm">
              {acceptFrom && (
                <div>
                  <span className="text-muted-foreground">Aceita a partir de: </span>
                  <span className="font-medium">{format(acceptFrom, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              )}
              {deadline && (
                <div>
                  <span className="text-muted-foreground">Data limite: </span>
                  <span className="font-medium">{format(deadline, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              )}
              <div>
                {isOpen && <Badge className="bg-green-600">Entregas abertas</Badge>}
                {isBeforeOpen && <Badge variant="secondary">Entregas ainda não começaram</Badge>}
                {isAfterDeadline && <Badge variant="destructive">Prazo encerrado</Badge>}
                {!acceptFrom && !deadline && <Badge variant="secondary">Datas não definidas</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submission area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="w-5 h-5 text-primary" />
            Enviar TCC
          </CardTitle>
          <CardDescription>Envie seu trabalho em formato PDF (máx. 20MB)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submission && (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{submission.file_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(submission.status)}
                  <Button size="sm" variant="ghost" onClick={downloadMyTcc}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enviado em {format(new Date(submission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              {submission.feedback && (
                <div className="p-3 rounded-md bg-background border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Feedback do avaliador:</p>
                  <p className="text-sm">{submission.feedback}</p>
                </div>
              )}
            </div>
          )}

          {isOpen && (!submission || submission.status === "pending" || submission.status === "rejected") && (
            <div>
              <Input
                type="file"
                accept="application/pdf"
                onChange={handleUpload}
                disabled={uploading}
                className="max-w-full sm:max-w-md"
              />
              {uploading && <p className="text-sm text-muted-foreground mt-2">Enviando...</p>}
              {submission && (
                <p className="text-xs text-muted-foreground mt-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Enviar novamente substituirá o arquivo anterior e voltará o status para pendente.
                </p>
              )}
            </div>
          )}

          {!isOpen && !submission && (
            <p className="text-sm text-muted-foreground">
              {isBeforeOpen ? "As entregas ainda não estão abertas." : isAfterDeadline ? "O prazo de entrega já encerrou." : "Datas de entrega ainda não foram definidas."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
