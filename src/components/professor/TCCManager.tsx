import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCohort } from "@/contexts/CohortContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Download, CheckCircle, XCircle, Clock, Upload, Save, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TCCSettings {
  id?: string;
  accept_from: string;
  accept_from_time: string;
  deadline: string;
  deadline_time: string;
  template_path: string | null;
  template_name: string | null;
  instructions: string;
}

interface Submission {
  id: string;
  user_id: string;
  cohort_id: string;
  file_path: string;
  file_name: string;
  status: string;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string };
  cohorts?: { name: string };
}

export default function TCCManager({ userId }: { userId: string }) {
  const { selectedCohort } = useCohort();
  const [settings, setSettings] = useState<TCCSettings>({ accept_from: "", accept_from_time: "00:00", deadline: "", deadline_time: "23:59", template_path: null, template_name: null, instructions: "" });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, [selectedCohort]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: s } = await supabase.from("tcc_settings").select("*").limit(1).maybeSingle();
      if (s) {
        setSettingsId(s.id);
        setSettings({
          accept_from: (s as any).accept_from ? (s as any).accept_from.slice(0, 10) : "",
          accept_from_time: (s as any).accept_from ? new Date((s as any).accept_from).toTimeString().slice(0, 5) : "00:00",
          deadline: (s as any).deadline ? (s as any).deadline.slice(0, 10) : "",
          deadline_time: (s as any).deadline ? new Date((s as any).deadline).toTimeString().slice(0, 5) : "23:59",
          template_path: (s as any).template_path,
          template_name: (s as any).template_name,
          instructions: (s as any).instructions || "",
        });
      }

      let query = supabase.from("tcc_submissions").select("*");
      if (selectedCohort) query = query.eq("cohort_id", selectedCohort.id);
      const { data: subs } = await query.order("created_at", { ascending: false });
      
      // Fetch profiles and cohorts separately
      const userIds = [...new Set((subs || []).map((s: any) => s.user_id))];
      const cohortIds = [...new Set((subs || []).map((s: any) => s.cohort_id))];
      
      const { data: profiles } = userIds.length > 0 
        ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [] };
      const { data: cohorts } = cohortIds.length > 0
        ? await supabase.from("cohorts").select("id, name").in("id", cohortIds)
        : { data: [] };
      
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      const cohortMap = Object.fromEntries((cohorts || []).map(c => [c.id, c]));
      
      const enriched = (subs || []).map((s: any) => ({
        ...s,
        profiles: profileMap[s.user_id] || null,
        cohorts: cohortMap[s.cohort_id] || null,
      }));
      
      setSubmissions(enriched);
      const fbMap: Record<string, string> = {};
      enriched.forEach((s: any) => { fbMap[s.id] = s.feedback || ""; });
      setFeedbackMap(fbMap);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        accept_from: settings.accept_from
          ? `${settings.accept_from}T${settings.accept_from_time || "00:00"}:00-03:00`
          : null,
        deadline: settings.deadline
          ? `${settings.deadline}T${settings.deadline_time || "23:59"}:00-03:00`
          : null,
        template_path: settings.template_path,
        template_name: settings.template_name,
        instructions: settings.instructions || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      if (settingsId) {
        const { error } = await supabase.from("tcc_settings").update(payload).eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("tcc_settings").insert(payload).select().single();
        if (error) throw error;
        setSettingsId(data.id);
      }
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTemplate(true);
    try {
      const sanitized = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `tcc/templates/${crypto.randomUUID()}_${sanitized}`;
      if (settings.template_path) {
        await supabase.storage.from("course-files").remove([settings.template_path]);
      }
      const { error } = await supabase.storage.from("course-files").upload(path, file);
      if (error) throw error;
      setSettings(prev => ({ ...prev, template_path: path, template_name: file.name }));
      toast({ title: "Modelo enviado! Salve as configurações para aplicar." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar modelo", description: err.message, variant: "destructive" });
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase.from("tcc_submissions").update({
        status,
        feedback: feedbackMap[id] || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast({ title: status === "approved" ? "TCC aprovado!" : "TCC reprovado." });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (sub: Submission) => {
    if (!confirm("Tem certeza que deseja excluir este TCC?")) return;
    try {
      await supabase.storage.from("course-files").remove([sub.file_path]);
      const { error } = await supabase.from("tcc_submissions").delete().eq("id", sub.id);
      if (error) throw error;
      toast({ title: "TCC excluído." });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const downloadFile = (filePath: string) => {
    const { data } = supabase.storage.from("course-files").getPublicUrl(filePath);
    window.open(data.publicUrl, "_blank");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Reprovado</Badge>;
      default: return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações do TCC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Aceitar a partir de</Label>
              <div className="flex gap-2">
                <Input type="date" value={settings.accept_from} onChange={e => setSettings(p => ({ ...p, accept_from: e.target.value }))} className="flex-1" />
                <Input type="time" value={settings.accept_from_time} onChange={e => setSettings(p => ({ ...p, accept_from_time: e.target.value }))} className="w-28" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data limite de entrega</Label>
              <div className="flex gap-2">
                <Input type="date" value={settings.deadline} onChange={e => setSettings(p => ({ ...p, deadline: e.target.value }))} className="flex-1" />
                <Input type="time" value={settings.deadline_time} onChange={e => setSettings(p => ({ ...p, deadline_time: e.target.value }))} className="w-28" />
              </div>
            </div>
          </div>

          <div>
            <Label>Orientações para os alunos</Label>
            <Textarea
              rows={5}
              value={settings.instructions}
              onChange={e => setSettings(p => ({ ...p, instructions: e.target.value }))}
              placeholder="Escreva aqui as orientações sobre o TCC..."
            />
          </div>

          <div>
            <Label>Modelo de TCC</Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1 min-w-0">
              <Input type="file" onChange={handleTemplateUpload} disabled={uploadingTemplate} className="max-w-full sm:max-w-sm" />
              {settings.template_name && (
                <span className="text-sm text-muted-foreground flex items-center gap-1 min-w-0">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="truncate">{settings.template_name}</span>
                </span>
              )}
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            TCCs Enviados {selectedCohort && `— ${selectedCohort.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum TCC enviado ainda.</p>
          ) : (
            <div className="space-y-4">
              {submissions.map(sub => (
                <div key={sub.id} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {(sub as any).profiles?.full_name || (sub as any).profiles?.email || "Aluno desconhecido"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Turma: {(sub as any).cohorts?.name || "—"} · Enviado em {format(new Date(sub.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(sub.status)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => downloadFile(sub.file_path)} className="gap-1">
                      <Download className="w-3 h-3" /> {sub.file_name}
                    </Button>
                    <Button size="sm" variant="default" onClick={() => handleReview(sub.id, "approved")} className="gap-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-3 h-3" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReview(sub.id, "rejected")} className="gap-1">
                      <XCircle className="w-3 h-3" /> Reprovar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(sub)} className="text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs">Feedback (opcional)</Label>
                    <Textarea
                      rows={2}
                      value={feedbackMap[sub.id] || ""}
                      onChange={e => setFeedbackMap(prev => ({ ...prev, [sub.id]: e.target.value }))}
                      placeholder="Escreva um feedback para o aluno..."
                      className="mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
