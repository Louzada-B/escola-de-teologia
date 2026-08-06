import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCohort } from "@/contexts/CohortContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type QuestionType = "objetiva" | "dissertativa" | "verdadeiro_falso" | "ligar_colunas";

interface VFPhrase {
  text: string;
  answer: boolean;
}
interface MatchPair {
  left: string;
  right: string;
}

function defaultQuestionState() {
  return {
    text: "",
    type: "objetiva" as QuestionType,
    options: ["", "", "", ""],
    correctOption: 0,
    expectedText: "",
    complement: "",
    orderIndex: 0,
    vfPhrases: [{ text: "", answer: true }] as VFPhrase[],
    matchPairs: [{ left: "", right: "" }] as MatchPair[],
  };
}

export default function QuizzesManager({ userId }: { userId: string }) {
  const { selectedCohort, selectedCohortId, selectedCohortStudentIds, effectiveCutoffDate } = useCohort();
  const [title, setTitle] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");

  // New question form
  const [qForm, setQForm] = useState(defaultQuestionState());

  // Edit quiz dialog
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFrom, setEditFrom] = useState("");
  const [editUntil, setEditUntil] = useState("");
  const [editLessonId, setEditLessonId] = useState("");

  // Questions listing & editing
  const [quizQuestions, setQuizQuestions] = useState<Record<string, any[]>>({});
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<any | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [eqForm, setEqForm] = useState(defaultQuestionState());

  // Student quiz stats
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [quizResponses, setQuizResponses] = useState<{ quiz_id: string; user_id: string; score: number | null }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  const load = async () => {
    let moduleIds: string[] = [];
    if (selectedCohort?.course_id) {
      const { data: mods } = await supabase.from("modules").select("id").eq("course_id", selectedCohort.course_id);
      moduleIds = (mods || []).map((m) => m.id);
    }

    const [quizzesRes, lessonsRes, responsesRes, profilesRes] = await Promise.all([
      supabase.from("quizzes").select("*, quiz_questions(id), lessons(title, scheduled_date)").order("created_at"),
      moduleIds.length > 0
        ? supabase.from("lessons").select("id, title, scheduled_date, module_id").in("module_id", moduleIds).order("scheduled_date")
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("quiz_responses").select("quiz_id, user_id, score"),
      supabase.from("profiles").select("id, full_name, email").eq("role", "aluno"),
    ]);
    let quizData = quizzesRes.data || [];
    setAllLessons(lessonsRes.data || []);

    // Filtra por curso da turma selecionada (via aula -> módulo -> curso), não
    // mais só por data -- data sozinha deixava passar aula de outro curso se
    // as janelas coincidissem.
    if (selectedCohort) {
      const lessonIdsInCourse = new Set((lessonsRes.data || []).map((l: any) => l.id));
      quizData = quizData.filter((q: any) => {
        if (!q.lesson_id) return true; // questionário sem aula vinculada continua visível em qualquer turma
        return lessonIdsInCourse.has(q.lesson_id);
      });
    }
    setQuizzes(quizData);

    if (responsesRes.data) setQuizResponses(responsesRes.data);
    if (profilesRes.data) {
      const filteredProfiles =
        selectedCohortId && selectedCohortStudentIds.length > 0
          ? profilesRes.data.filter((p: any) => selectedCohortStudentIds.includes(p.id))
          : selectedCohortId
            ? []
            : profilesRes.data;
      setStudents(filteredProfiles.map((p: any) => ({ id: p.id, name: p.full_name || p.email })));
    }
  };

  const loadQuestions = async (quizId: string) => {
    const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("order_index");
    setQuizQuestions((prev) => ({ ...prev, [quizId]: data || [] }));
  };

  useEffect(() => {
    load();
  }, [selectedCohort, effectiveCutoffDate, selectedCohortId, selectedCohortStudentIds]);

  // Quiz response stats
  const responseSet = useMemo(() => {
    const set = new Set<string>();
    quizResponses.forEach((r) => set.add(`${r.user_id}::${r.quiz_id}`));
    return set;
  }, [quizResponses]);

  const studentQuizStats = useMemo(() => {
    return students.map((s) => {
      const answered = quizzes.filter((q) => responseSet.has(`${s.id}::${q.id}`)).length;
      return { id: s.id, name: s.name, total: quizzes.length, answered, pending: quizzes.length - answered };
    });
  }, [students, quizzes, responseSet]);

  const modalQuizDetails = useMemo(() => {
    if (!selectedStudent) return [];
    return quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      lessonTitle: q.lessons?.title || null,
      answered: responseSet.has(`${selectedStudent.id}::${q.id}`),
    }));
  }, [selectedStudent, quizzes, responseSet]);

  const pct = (n: number, total: number) => (total === 0 ? "—" : `${Math.round((n / total) * 100)}%`);

  // Convert datetime-local value to ISO string with local timezone offset
  const toLocalISO = (dtLocal: string) => {
    if (!dtLocal) return null;
    const d = new Date(dtLocal);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const createQuiz = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("quizzes").insert({
      title,
      created_by: userId,
      available_from: toLocalISO(availableFrom),
      available_until: toLocalISO(availableUntil),
      lesson_id: lessonId || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setTitle("");
    setAvailableFrom("");
    setAvailableUntil("");
    setLessonId("");
    load();
    toast({ title: "Questionário criado!" });
  };

  const updateQuiz = async () => {
    if (!editing || !editTitle.trim()) return;
    const { error } = await supabase
      .from("quizzes")
      .update({
        title: editTitle,
        available_from: toLocalISO(editFrom),
        available_until: toLocalISO(editUntil),
        lesson_id: editLessonId || null,
      })
      .eq("id", editing.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setEditing(null);
    load();
    toast({ title: "Questionário atualizado!" });
  };

  const removeQuiz = async (id: string) => {
    await supabase.from("quizzes").delete().eq("id", id);
    load();
  };

  // Convert ISO/UTC date to datetime-local string in local timezone
  const toDatetimeLocal = (isoStr: string | null) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEdit = (q: any) => {
    setEditTitle(q.title);
    setEditFrom(toDatetimeLocal(q.available_from));
    setEditUntil(toDatetimeLocal(q.available_until));
    setEditLessonId(q.lesson_id || "");
    setEditing(q);
  };

  // Build insert data from form state
  function buildInsertData(form: ReturnType<typeof defaultQuestionState>) {
    const insertData: any = {
      question: form.text,
      question_type: form.type,
      order_index: form.orderIndex ?? 0,
    };
    if (form.type === "objetiva") {
      insertData.options = form.options.filter((o) => o.trim());
      insertData.correct_option = form.correctOption;
      insertData.expected_text = null;
    } else if (form.type === "verdadeiro_falso") {
      // Store phrases as options, correct V/F mapping in expected_text
      const phrases = form.vfPhrases.filter((p) => p.text.trim());
      insertData.options = phrases.map((p) => p.text);
      insertData.correct_option = null;
      const vfAnswers: Record<string, string> = {};
      phrases.forEach((p, i) => {
        vfAnswers[String(i)] = p.answer ? "verdadeiro" : "falso";
      });
      insertData.expected_text = JSON.stringify(vfAnswers);
    } else if (form.type === "ligar_colunas") {
      const pairs = form.matchPairs.filter((p) => p.left.trim() && p.right.trim());
      insertData.options = pairs;
      insertData.correct_option = null;
      insertData.expected_text = null;
    } else {
      insertData.options = [];
      insertData.correct_option = null;
      insertData.expected_text = form.expectedText || null;
    }
    insertData.complement = form.complement?.trimEnd() || null;
    return insertData;
  }

  const addQuestion = async () => {
    if (!selectedQuiz || !qForm.text.trim()) return;
    const insertData = { ...buildInsertData(qForm), quiz_id: selectedQuiz };
    const { error } = await supabase.from("quiz_questions").insert(insertData);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setQForm(defaultQuestionState());
    load();
    if (expandedQuiz === selectedQuiz) loadQuestions(selectedQuiz);
    toast({ title: "Pergunta adicionada!" });
  };

  const removeQuestion = async (id: string, quizId: string) => {
    await supabase.from("quiz_questions").delete().eq("id", id);
    loadQuestions(quizId);
    load();
  };

  const openEditQuestion = (q: any) => {
    const form = defaultQuestionState();
    form.text = q.question;
    form.type = q.question_type || "objetiva";
    form.orderIndex = q.order_index ?? 0;

    if (form.type === "objetiva") {
      form.options = Array.isArray(q.options) ? [...(q.options as string[])] : ["", "", "", ""];
      while (form.options.length < 2) form.options.push("");
      form.correctOption = q.correct_option ?? 0;
    } else if (form.type === "verdadeiro_falso") {
      const phrases = Array.isArray(q.options) ? (q.options as string[]) : [];
      let vfAnswers: Record<string, string> = {};
      try {
        vfAnswers = q.expected_text ? JSON.parse(q.expected_text) : {};
      } catch {}
      form.vfPhrases = phrases.map((text, i) => ({
        text,
        answer: vfAnswers[String(i)] === "verdadeiro",
      }));
      if (form.vfPhrases.length === 0) form.vfPhrases = [{ text: "", answer: true }];
    } else if (form.type === "ligar_colunas") {
      form.matchPairs = Array.isArray(q.options) ? (q.options as MatchPair[]) : [{ left: "", right: "" }];
    } else {
      form.expectedText = q.expected_text || "";
      form.complement = (q.complement || "").replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    setEqForm(form);
    setEditingQuestion(q);
  };

  const saveEditQuestion = async () => {
    if (!editingQuestion || !eqForm.text.trim()) return;
    const updateData = buildInsertData(eqForm);
    const { error } = await supabase.from("quiz_questions").update(updateData).eq("id", editingQuestion.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setEditingQuestion(null);
    loadQuestions(editingQuestion.quiz_id);
    toast({ title: "Pergunta atualizada!" });
  };

  const toggleExpand = (quizId: string) => {
    if (expandedQuiz === quizId) {
      setExpandedQuiz(null);
    } else {
      setExpandedQuiz(quizId);
      if (!quizQuestions[quizId]) loadQuestions(quizId);
    }
  };

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      objetiva: "Objetiva",
      dissertativa: "Dissertativa",
      verdadeiro_falso: "V ou F",
      ligar_colunas: "Ligar Colunas",
    };
    return map[t] || t;
  };

  return (
    <div className="space-y-6">
      {/* Criar questionário */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Novo Questionário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Quiz Aula 1" />
          </div>
          <div>
            <Label>Aula vinculada</Label>
            <select
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className="w-full border rounded-md p-2 bg-background text-foreground"
            >
              <option value="">Nenhuma (sem vínculo)</option>
              {allLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                  {l.scheduled_date ? ` (${l.scheduled_date})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Disponível a partir de</Label>
              <Input type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
            </div>
            <div>
              <Label>Encerra em</Label>
              <Input type="datetime-local" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} />
            </div>
          </div>
          <Button onClick={createQuiz}>
            <Plus className="w-4 h-4 mr-1" /> Criar
          </Button>
        </CardContent>
      </Card>

      {/* Adicionar pergunta */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Adicionar Pergunta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Questionário</Label>
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="w-full border rounded-md p-2 bg-background text-foreground"
            >
              <option value="">Selecione</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Pergunta</Label>
            <Textarea value={qForm.text} onChange={(e) => setQForm((p) => ({ ...p, text: e.target.value }))} />
          </div>
          <div>
            <Label>Complemento <span className="text-xs text-muted-foreground">(opcional — texto de contexto exibido recuado abaixo do enunciado)</span></Label>
            <Textarea value={qForm.complement || ""} onChange={(e) => setQForm((p) => ({ ...p, complement: e.target.value }))} placeholder="Ex: definição, trecho bíblico, citação..." rows={2} />
          </div>
          <div>
            <Label>Tipo de Pergunta</Label>
            <select
              value={qForm.type}
              onChange={(e) => setQForm((p) => ({ ...p, type: e.target.value as QuestionType }))}
              className="w-full border rounded-md p-2 bg-background text-foreground"
            >
              <option value="objetiva">Objetiva</option>
              <option value="dissertativa">Dissertativa</option>
              <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
              <option value="ligar_colunas">Ligar Colunas</option>
            </select>
          </div>

          <QuestionFormFields form={qForm} setForm={setQForm} />

          <Button onClick={addQuestion}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Pergunta
          </Button>
        </CardContent>
      </Card>

      {/* Listagem de questionários com perguntas expansíveis */}
      <div className="space-y-2">
        <h3 className="font-heading font-semibold">Questionários Existentes</h3>
        {quizzes.map((q) => (
          <Collapsible key={q.id} open={expandedQuiz === q.id} onOpenChange={() => toggleExpand(q.id)}>
            <div className="bg-card p-3 rounded-md border">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-body font-medium">{q.title}</span>
                  <p className="text-sm text-muted-foreground">
                    {q.quiz_questions?.length || 0} perguntas · De {formatDate(q.available_from)} até{" "}
                    {formatDate(q.available_until)}
                    {q.lessons?.title && <span className="ml-1">· Aula: {q.lessons.title}</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon">
                      {expandedQuiz === q.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <Button variant="ghost" size="icon" onClick={() => { loadQuestions(q.id); setPreviewQuiz(q); }}>
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(q)}>
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeQuiz(q.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="mt-3 space-y-2">
                {(quizQuestions[q.id] || []).map((question, idx) => (
                  <div key={question.id} className="flex items-start justify-between bg-muted/50 p-2 rounded text-sm">
                    <div className="flex-1">
                      <p className="font-medium">
                        {idx + 1}. {question.question}
                      </p>
                      <p className="text-xs text-muted-foreground">{typeLabel(question.question_type)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditQuestion(question)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeQuestion(question.id, q.id)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(quizQuestions[q.id] || []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Nenhuma pergunta cadastrada.</p>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Dialog editar questionário */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Questionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label>Aula vinculada</Label>
              <select
                value={editLessonId}
                onChange={(e) => setEditLessonId(e.target.value)}
                className="w-full border rounded-md p-2 bg-background text-foreground"
              >
                <option value="">Nenhuma (sem vínculo)</option>
                {allLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                    {l.scheduled_date ? ` (${l.scheduled_date})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Disponível a partir de</Label>
                <Input type="datetime-local" value={editFrom} onChange={(e) => setEditFrom(e.target.value)} />
              </div>
              <div>
                <Label>Encerra em</Label>
                <Input type="datetime-local" value={editUntil} onChange={(e) => setEditUntil(e.target.value)} />
              </div>
            </div>
            <Button onClick={updateQuiz}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog editar pergunta */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pergunta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Pergunta</Label>
              <Textarea value={eqForm.text} onChange={(e) => setEqForm((p) => ({ ...p, text: e.target.value }))} />
            </div>
            <div>
              <Label>Complemento <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Textarea value={eqForm.complement || ""} onChange={(e) => setEqForm((p) => ({ ...p, complement: e.target.value }))} placeholder="Texto de contexto recuado abaixo do enunciado" rows={2} />
            </div>
            <div>
              <Label>Tipo de Pergunta</Label>
              <select
                value={eqForm.type}
                onChange={(e) => setEqForm((p) => ({ ...p, type: e.target.value as QuestionType }))}
                className="w-full border rounded-md p-2 bg-background text-foreground"
              >
                <option value="objetiva">Objetiva</option>
                <option value="dissertativa">Dissertativa</option>
                <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
                <option value="ligar_colunas">Ligar Colunas</option>
              </select>
            </div>
            <QuestionFormFields form={eqForm} setForm={setEqForm} />
            <Button onClick={saveEditQuestion}>Salvar Pergunta</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo de Respostas por Aluno */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Resumo de Respostas por Aluno</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-muted-foreground font-body">
              Nenhum aluno cadastrado{selectedCohortId ? " nesta turma" : ""}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Aluno</TableHead>
                  <TableHead className="text-center">% Respondidos</TableHead>
                  <TableHead className="text-center">Respondidos</TableHead>
                  <TableHead className="text-center">Pendentes</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentQuizStats.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center">{pct(s.answered, s.total)}</TableCell>
                    <TableCell className="text-center">
                      {s.answered}/{s.total}
                    </TableCell>
                    <TableCell className="text-center">{s.pending}</TableCell>
                    <TableCell className="text-center">{s.total}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudent({ id: s.id, name: s.name })}
                      >
                        <Eye className="w-4 h-4 mr-1" /> Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal detalhes do aluno */}
      <Dialog
        open={!!selectedStudent}
        onOpenChange={(open) => {
          if (!open) setSelectedStudent(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Questionários — {selectedStudent?.name}</DialogTitle>
          </DialogHeader>
          {modalQuizDetails.length === 0 ? (
            <p className="text-muted-foreground font-body">Nenhum questionário disponível.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Questionário</TableHead>
                  <TableHead>Aula Vinculada</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalQuizDetails.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.title}</TableCell>
                    <TableCell>{q.lessonTitle || "—"}</TableCell>
                    <TableCell className="text-center">
                      {q.answered ? (
                        <Badge className="bg-green-600 text-white">Respondido</Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/50 text-destructive">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Preview */}
      {previewQuiz && (
        <Dialog open={!!previewQuiz} onOpenChange={() => setPreviewQuiz(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Pré-visualização: {previewQuiz.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-2">
              {(quizQuestions[previewQuiz.id] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma questão cadastrada.</p>
              ) : (
                (quizQuestions[previewQuiz.id] || []).map((q: any, idx: number) => (
                  <div key={q.id} className="space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      <span className="text-primary font-semibold mr-1">{idx + 1}.</span>
                      {q.question}
                    </p>
                    {q.complement && (
                      <blockquote className="border-l-2 border-primary/40 pl-3 py-1 bg-muted/30 rounded-r text-sm text-muted-foreground italic">
                        {q.complement}
                      </blockquote>
                    )}
                    {q.question_type === "ligar_colunas" ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {(() => {
                          try {
                            const pairs = Array.isArray(q.options) ? q.options
                              : typeof q.options === "string" ? JSON.parse(q.options) : [];
                            return pairs.map((pair: any, i: number) => (
                              <div key={i} className="contents">
                                <div className="bg-muted/50 rounded px-3 py-1.5 text-foreground">{pair.left}</div>
                                <div className="bg-muted/50 rounded px-3 py-1.5 text-muted-foreground">{pair.right}</div>
                              </div>
                            ));
                          } catch { return null; }
                        })()}
                      </div>
                    ) : q.question_type === "dissertativa" ? (
                      <div className="space-y-1.5">
                        <textarea
                          disabled
                          className="w-full text-sm bg-muted/30 border border-border rounded-md px-3 py-2 text-muted-foreground resize-none h-20"
                          placeholder="Campo de resposta dissertativa"
                        />
                        {q.expected_text && (
                          <div className="text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2 whitespace-pre-line">
                            <span className="font-medium text-amber-700">Resposta esperada: </span>
                            {q.expected_text}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {q.question_type === "verdadeiro_falso" ? (() => {
                            let vfMap: Record<string, string> = {};
                            try { vfMap = JSON.parse(q.expected_text || "{}"); } catch {}
                            return (q.options || []).map((opt: string, i: number) => {
                              const answer = vfMap[String(i)] || "";
                              const isTrue = answer === "V";
                              return (
                                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md border text-sm ${isTrue ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${isTrue ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                                    {answer || "?"}
                                  </span>
                                  <span className="text-foreground">{opt}</span>
                                </div>
                              );
                            });
                          })() : (q.options || []).map((opt: string, i: number) => (
                          <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md border text-sm ${i === q.correct_option ? "border-green-500/40 bg-green-500/5 text-green-700" : "border-border bg-muted/30 text-foreground"}`}>
                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs flex-shrink-0 ${i === q.correct_option ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground"}`}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            {opt}
                            {i === q.correct_option && <span className="ml-auto text-xs text-green-600 font-medium">✓ Correta</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {idx < (quizQuestions[previewQuiz.id] || []).length - 1 && (
                      <div className="border-t border-border pt-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Shared form fields for creating/editing questions */
function QuestionFormFields({
  form,
  setForm,
}: {
  form: ReturnType<typeof defaultQuestionState>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof defaultQuestionState>>>;
}) {
  if (form.type === "objetiva") {
    return (
      <>
        {form.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <Label>
                Opção {i + 1} {i === form.correctOption ? "(correta)" : ""}
              </Label>
              <Input
                value={opt}
                onChange={(e) => {
                  const n = [...form.options];
                  n[i] = e.target.value;
                  setForm((p) => ({ ...p, options: n }));
                }}
              />
            </div>
            {form.options.length > 2 && (
              <Button
                variant="ghost"
                size="icon"
                className="mt-5"
                onClick={() => {
                  const n = form.options.filter((_, idx) => idx !== i);
                  const newCorrect =
                    form.correctOption >= n.length
                      ? n.length - 1
                      : form.correctOption > i
                        ? form.correctOption - 1
                        : form.correctOption;
                  setForm((p) => ({ ...p, options: n, correctOption: newCorrect }));
                }}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        {form.options.length < 5 && (
          <Button variant="outline" size="sm" onClick={() => setForm((p) => ({ ...p, options: [...p.options, ""] }))}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar Opção
          </Button>
        )}
        <div>
          <Label>Opção correta</Label>
          <select
            value={form.correctOption}
            onChange={(e) => setForm((p) => ({ ...p, correctOption: Number(e.target.value) }))}
            className="w-full border rounded-md p-2 bg-background text-foreground"
          >
            {form.options.map((_, i) => (
              <option key={i} value={i}>
                Opção {i + 1}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }

  if (form.type === "verdadeiro_falso") {
    return (
      <>
        <p className="text-sm text-muted-foreground">Adicione frases e marque se cada uma é Verdadeira ou Falsa.</p>
        {form.vfPhrases.map((phrase, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1">
              <Label>Frase {i + 1}</Label>
              <Input
                value={phrase.text}
                onChange={(e) => {
                  const n = [...form.vfPhrases];
                  n[i] = { ...n[i], text: e.target.value };
                  setForm((p) => ({ ...p, vfPhrases: n }));
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Label className="text-xs whitespace-nowrap">{phrase.answer ? "V" : "F"}</Label>
              <Switch
                checked={phrase.answer}
                onCheckedChange={(v) => {
                  const n = [...form.vfPhrases];
                  n[i] = { ...n[i], answer: v };
                  setForm((p) => ({ ...p, vfPhrases: n }));
                }}
              />
            </div>
            {form.vfPhrases.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="mt-5"
                onClick={() => {
                  setForm((p) => ({ ...p, vfPhrases: p.vfPhrases.filter((_, idx) => idx !== i) }));
                }}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForm((p) => ({ ...p, vfPhrases: [...p.vfPhrases, { text: "", answer: true }] }))}
        >
          <Plus className="w-3 h-3 mr-1" /> Adicionar Frase
        </Button>
      </>
    );
  }

  if (form.type === "ligar_colunas") {
    return (
      <>
        <p className="text-sm text-muted-foreground">Defina os pares (Coluna A → Coluna B).</p>
        {form.matchPairs.map((pair, i) => (
          <div key={i} className="grid grid-cols-[1fr,auto,1fr,auto] items-end gap-2">
            <div>
              <Label>Coluna A ({i + 1})</Label>
              <Input
                value={pair.left}
                onChange={(e) => {
                  const n = [...form.matchPairs];
                  n[i] = { ...n[i], left: e.target.value };
                  setForm((p) => ({ ...p, matchPairs: n }));
                }}
              />
            </div>
            <span className="pb-2 text-muted-foreground">→</span>
            <div>
              <Label>Coluna B ({i + 1})</Label>
              <Input
                value={pair.right}
                onChange={(e) => {
                  const n = [...form.matchPairs];
                  n[i] = { ...n[i], right: e.target.value };
                  setForm((p) => ({ ...p, matchPairs: n }));
                }}
              />
            </div>
            {form.matchPairs.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setForm((p) => ({ ...p, matchPairs: p.matchPairs.filter((_, idx) => idx !== i) }));
                }}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForm((p) => ({ ...p, matchPairs: [...p.matchPairs, { left: "", right: "" }] }))}
        >
          <Plus className="w-3 h-3 mr-1" /> Adicionar Par
        </Button>
      </>
    );
  }

  // Dissertativa
  return (
    <div>
      <Label>Texto esperado (referência para correção)</Label>
      <Textarea
        value={form.expectedText}
        onChange={(e) => setForm((p) => ({ ...p, expectedText: e.target.value }))}
        placeholder="Resposta esperada do aluno..."
      />
    </div>
  );
}
