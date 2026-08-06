import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Users, ChevronDown, ChevronUp, Search, Copy } from "lucide-react";

interface Cohort {
  id: string;
  name: string;
  year: number;
  semester: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export default function CohortsManager({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    semester: 1,
    start_date: "",
    end_date: "",
    course_id: "",
    access_code: "",
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, name, access_model").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedCourse = courses.find((c) => c.id === form.course_id);

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ["cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("*")
        .order("year", { ascending: false })
        .order("semester", { ascending: false });
      if (error) throw error;
      return data as Cohort[];
    },
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "aluno")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: cohortStudents = [] } = useQuery({
    queryKey: ["all-cohort-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cohort_students").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createCohort = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cohorts").insert({
        name: form.name,
        year: form.year,
        semester: form.semester,
        start_date: form.start_date,
        end_date: form.end_date,
        course_id: form.course_id,
        access_code: selectedCourse?.access_model === "code" ? form.access_code.trim().toUpperCase() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      toast.success("Turma criada com sucesso");
      setShowForm(false);
      setForm({ name: "", year: new Date().getFullYear(), semester: 1, start_date: "", end_date: "", course_id: "", access_code: "" });
    },
    onError: (e: any) => toast.error("Erro ao criar turma: " + e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("cohorts").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cohorts"] }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteCohort = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cohorts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      toast.success("Turma removida");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const toggleStudent = useMutation({
    mutationFn: async ({ cohortId, studentId, add }: { cohortId: string; studentId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("cohort_students").insert({ cohort_id: cohortId, user_id: studentId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cohort_students")
          .delete()
          .eq("cohort_id", cohortId)
          .eq("user_id", studentId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-cohort-students"] });
      queryClient.invalidateQueries({ queryKey: ["cohort-students"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const getStudentsForCohort = (cohortId: string) => {
    return cohortStudents.filter((cs) => cs.cohort_id === cohortId).map((cs) => cs.user_id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Turmas</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
          <Plus className="w-4 h-4" /> Nova Turma
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Curso</Label>
                <select
                  value={form.course_id}
                  onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione um curso...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Turma 2026/1"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: Number.parseInt(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Semestre</Label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm((f) => ({ ...f, semester: Number.parseInt(e.target.value) }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value={1}>1º Semestre</option>
                    <option value={2}>2º Semestre</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
              {selectedCourse?.access_model === "code" && (
                <div>
                  <Label>Código de acesso (sem conta)</Label>
                  <Input
                    placeholder="Ex: CRESC1AGO"
                    value={form.access_code}
                    onChange={(e) => setForm((f) => ({ ...f, access_code: e.target.value.toUpperCase() }))}
                    className="uppercase font-mono"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createCohort.mutate()}
                disabled={
                  !form.name || !form.start_date || !form.end_date || !form.course_id ||
                  (selectedCourse?.access_model === "code" && !form.access_code.trim())
                }
              >
                Criar Turma
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : cohorts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {cohorts.map((cohort) => {
            const studentIds = getStudentsForCohort(cohort.id);
            const isExpanded = expandedCohort === cohort.id;

            return (
              <Card key={cohort.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{cohort.name}</CardTitle>
                      <Badge variant={cohort.is_active ? "default" : "secondary"} className="text-[10px]">
                        {cohort.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Users className="w-3 h-3" /> {studentIds.length}
                      </Badge>
                      {cohort.access_code && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(cohort.access_code);
                            toast.success("Código copiado: " + cohort.access_code);
                          }}
                          title="Copiar código de acesso"
                        >
                          <Badge variant="outline" className="text-[10px] gap-1 font-mono hover:bg-muted cursor-pointer">
                            <Copy className="w-3 h-3" /> {cohort.access_code}
                          </Badge>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Ativa</Label>
                        <Switch
                          checked={cohort.is_active}
                          onCheckedChange={(checked) => toggleActive.mutate({ id: cohort.id, is_active: checked })}
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setExpandedCohort(isExpanded ? null : cohort.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Excluir esta turma?")) deleteCohort.mutate(cohort.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(cohort.start_date + "T12:00:00").toLocaleDateString("pt-BR")} até{" "}
                    {new Date(cohort.end_date + "T12:00:00").toLocaleDateString("pt-BR")} • {cohort.year}/
                    {cohort.semester}º sem.
                  </p>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Alunos da turma:</p>
                    {allStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum aluno cadastrado.</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Buscar aluno por nome ou e-mail..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {allStudents
                            .filter((s) => {
                              if (!studentSearch) return true;
                              const q = studentSearch.toLowerCase();
                              return s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
                            })
                            .map((student) => {
                              const isInCohort = studentIds.includes(student.id);
                              return (
                                <label
                                  key={student.id}
                                  className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                                >
                                  <Checkbox
                                    checked={isInCohort}
                                    onCheckedChange={(checked) => {
                                      toggleStudent.mutate({
                                        cohortId: cohort.id,
                                        studentId: student.id,
                                        add: !!checked,
                                      });
                                    }}
                                  />
                                  <span>{student.email}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
