import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Course {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  access_model: "account" | "code";
  has_attendance: boolean;
  has_quizzes: boolean;
  has_tcc: boolean;
  has_materials: boolean;
  has_testimonials: boolean;
  has_certificates: boolean;
  certificate_min_attendance_pct: number;
  created_at: string;
}

type FeatureKey = "has_attendance" | "has_quizzes" | "has_tcc" | "has_materials" | "has_testimonials" | "has_certificates";

const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "has_attendance", label: "Presença" },
  { key: "has_quizzes", label: "Questionários" },
  { key: "has_tcc", label: "TCC" },
  { key: "has_materials", label: "Materiais Extras" },
  { key: "has_testimonials", label: "Testemunhos" },
  { key: "has_certificates", label: "Certificados" },
];

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  access_model: "account" as "account" | "code",
  has_attendance: true,
  has_quizzes: true,
  has_tcc: false,
  has_materials: true,
  has_testimonials: false,
  has_certificates: true,
  certificate_min_attendance_pct: 100,
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CoursesManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("name");
      if (error) throw error;
      return data as Course[];
    },
  });

  const saveCourse = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("courses").update(form).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success(editingId ? "Curso atualizado" : "Curso criado");
      cancelForm();
    },
    onError: (e: any) => toast.error("Erro ao salvar curso: " + e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("courses").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Curso removido");
    },
    onError: (e: any) =>
      toast.error("Não foi possível remover — provavelmente há turmas vinculadas a esse curso. (" + e.message + ")"),
  });

  const startEdit = (course: Course) => {
    setForm({
      name: course.name,
      slug: course.slug,
      description: course.description || "",
      access_model: course.access_model,
      has_attendance: course.has_attendance,
      has_quizzes: course.has_quizzes,
      has_tcc: course.has_tcc,
      has_materials: course.has_materials,
      has_testimonials: course.has_testimonials,
      has_certificates: course.has_certificates,
      certificate_min_attendance_pct: course.certificate_min_attendance_pct,
    });
    setEditingId(course.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cursos</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Novo Curso
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Trilha do Crescimento - Passo 1"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: editingId ? f.slug : slugify(name) }));
                  }}
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  placeholder="trilha-crescimento-1"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                placeholder="Breve descrição do curso"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <Label>Modelo de acesso</Label>
              <select
                value={form.access_model}
                onChange={(e) => setForm((f) => ({ ...f, access_model: e.target.value as "account" | "code" }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="account">Com conta (convite por e-mail + senha)</option>
                <option value="code">Sem conta (código de acesso da turma)</option>
              </select>
            </div>

            <div>
              <Label className="mb-2 block">Funcionalidades</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FEATURES.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form[key]}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, [key]: checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {form.has_certificates && (
              <div className="max-w-xs">
                <Label>% mínimo de presença pro certificado</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.certificate_min_attendance_pct}
                  onChange={(e) => setForm((f) => ({ ...f, certificate_min_attendance_pct: Number(e.target.value) }))}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveCourse.mutate()} disabled={!form.name || !form.slug}>
                {editingId ? "Salvar Alterações" : "Criar Curso"}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelForm}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum curso cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const isExpanded = expanded === course.id;
            const activeFeatures = FEATURES.filter(({ key }) => course[key]);
            return (
              <Card key={course.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{course.name}</CardTitle>
                      <Badge variant={course.is_active ? "default" : "secondary"} className="text-[10px]">
                        {course.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {course.access_model === "account" ? "Com conta" : "Sem conta (código)"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Ativo</Label>
                        <Switch
                          checked={course.is_active}
                          onCheckedChange={(checked) => toggleActive.mutate({ id: course.id, is_active: checked })}
                        />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => startEdit(course)}>
                        Editar
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setExpanded(isExpanded ? null : course.id)}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Excluir o curso "${course.name}"? Só funciona se não houver turma vinculada a ele.`)) {
                            deleteCourse.mutate(course.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">/{course.slug}</p>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0 space-y-2">
                    {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {activeFeatures.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nenhuma funcionalidade ativada.</span>
                      ) : (
                        activeFeatures.map(({ key, label }) => (
                          <Badge key={key} variant="outline" className="text-[10px]">
                            {label}
                          </Badge>
                        ))
                      )}
                    </div>
                    {course.has_certificates && (
                      <p className="text-xs text-muted-foreground">
                        Certificado exige {course.certificate_min_attendance_pct}% de presença.
                      </p>
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
