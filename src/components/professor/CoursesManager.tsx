import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Users, ChevronDown, ChevronUp, Search, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Course {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export default function CoursesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [professorSearch, setProfessorSearch] = useState("");
  const [form, setForm] = useState({ name: "", description: "", slug: "" });
  const [editing, setEditing] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", slug: "" });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Course[];
    },
  });

  const { data: allProfessors = [] } = useQuery({
    queryKey: ["all-professors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("role", ["professor", "admin"])
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: courseProfessors = [] } = useQuery({
    queryKey: ["course-professors-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_professors")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const createCourse = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome obrigatório");
      const slug = form.slug.trim() || generateSlug(form.name);
      const { error } = await supabase.from("courses").insert({
        name: form.name,
        description: form.description || null,
        slug,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setForm({ name: "", description: "", slug: "" });
      setShowForm(false);
      toast.success("Curso criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("courses").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Curso removido!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCourse = useMutation({
    mutationFn: async () => {
      if (!editing || !editForm.name.trim()) throw new Error("Nome obrigatório");
      const slug = editForm.slug.trim() || generateSlug(editForm.name);
      const { error } = await supabase.from("courses").update({
        name: editForm.name,
        description: editForm.description || null,
        slug,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setEditing(null);
      toast.success("Curso atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleProfessor = useMutation({
    mutationFn: async ({ courseId, userId, add }: { courseId: string; userId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("course_professors").insert({ course_id: courseId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_professors").delete()
          .eq("course_id", courseId).eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-professors-all"] });
    },
  });

  const getProfessorsForCourse = (courseId: string) =>
    courseProfessors.filter(cp => cp.course_id === courseId).map(cp => cp.user_id);

  const filteredProfessors = allProfessors.filter(p => {
    if (!professorSearch.trim()) return true;
    const q = professorSearch.toLowerCase();
    return (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q);
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cursos</h2>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo Curso
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label>Nome do Curso</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Formação Teológica" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição do curso" />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder={generateSlug(form.name) || "auto-gerado"} />
            </div>
            <Button onClick={() => createCourse.mutate()} disabled={createCourse.isPending}>
              Criar Curso
            </Button>
          </CardContent>
        </Card>
      )}

      {courses.map(course => {
        const isExpanded = expandedCourse === course.id;
        const assignedProfessorIds = getProfessorsForCourse(course.id);

        return (
          <Card key={course.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{course.name}</CardTitle>
                  <Badge variant={course.is_active ? "default" : "secondary"}>
                    {course.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={course.is_active}
                    onCheckedChange={v => toggleActive.mutate({ id: course.id, active: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditing(course);
                    setEditForm({ name: course.name, description: course.description || "", slug: course.slug });
                  }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setExpandedCourse(isExpanded ? null : course.id)}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm("Remover este curso?")) deleteCourse.mutate(course.id);
                  }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
              <p className="text-xs text-muted-foreground">Slug: {course.slug}</p>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Professores vinculados ({assignedProfessorIds.length})</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar professor..."
                      className="pl-9 h-9"
                      value={professorSearch}
                      onChange={e => setProfessorSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredProfessors.map(prof => {
                      const isAssigned = assignedProfessorIds.includes(prof.id);
                      return (
                        <label key={prof.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleProfessor.mutate({
                              courseId: course.id,
                              userId: prof.id,
                              add: !isAssigned,
                            })}
                            className="rounded"
                          />
                          <span className="text-sm">{prof.full_name || prof.email}</span>
                          <span className="text-xs text-muted-foreground">{prof.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {courses.length === 0 && (
        <p className="text-muted-foreground text-sm">Nenhum curso cadastrado ainda.</p>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Curso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={editForm.slug} onChange={e => setEditForm({ ...editForm, slug: e.target.value })} />
            </div>
            <Button onClick={() => updateCourse.mutate()} disabled={updateCourse.isPending}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
