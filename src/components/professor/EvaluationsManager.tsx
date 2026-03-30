import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCohort } from "@/contexts/CohortContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Evaluation {
  id: string;
  user_id: string;
  cohort_id: string;
  overall_rating: number;
  liked_most: string;
  improvements: string;
  professors_rating: number;
  would_recommend: boolean;
  additional_comments: string | null;
  created_at: string;
  // joined
  student_name: string;
  cohort_name: string;
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn("w-4 h-4", s <= count ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")}
        />
      ))}
    </div>
  );
}

export default function EvaluationsManager() {
  const { cohorts } = useCohort();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCohort, setFilterCohort] = useState<string>("all");

  const loadEvaluations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_evaluations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error(error);
      setLoading(false);
      return;
    }

    // Get profiles and cohort names
    const userIds = [...new Set(data.map((e: any) => e.user_id))];
    const cohortIds = [...new Set(data.map((e: any) => e.cohort_id))];

    const [profilesRes, cohortsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [] },
      cohortIds.length > 0
        ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
        : { data: [] },
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name || p.email]));
    const cohortMap = new Map((cohortsRes.data || []).map((c: any) => [c.id, c.name]));

    const mapped: Evaluation[] = data.map((e: any) => ({
      ...e,
      student_name: profileMap.get(e.user_id) || "Desconhecido",
      cohort_name: cohortMap.get(e.cohort_id) || "—",
    }));

    setEvaluations(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadEvaluations();
  }, []);

  const filtered = filterCohort === "all" ? evaluations : evaluations.filter((e) => e.cohort_id === filterCohort);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground py-8 text-center">Carregando avaliações...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          Avaliações do Curso ({filtered.length})
        </h2>
        <Select value={filterCohort} onValueChange={setFilterCohort}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por turma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma avaliação encontrada.</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((ev) => (
            <Card key={ev.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">{ev.student_name}</CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{ev.cohort_name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(ev.created_at).toLocaleDateString("pt-BR")}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground min-w-[140px]">Avaliação geral:</span>
                  <Stars count={ev.overall_rating} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground min-w-[140px]">Professores:</span>
                  <Stars count={ev.professors_rating} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground min-w-[140px]">Recomendaria:</span>
                  <span className={cn("font-medium", ev.would_recommend ? "text-green-600" : "text-destructive")}>
                    {ev.would_recommend ? "Sim" : "Não"}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">O que mais gostou:</p>
                  <p className="text-foreground bg-muted/50 p-2 rounded">{ev.liked_most}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">O que poderia melhorar:</p>
                  <p className="text-foreground bg-muted/50 p-2 rounded">{ev.improvements}</p>
                </div>
                {ev.additional_comments && (
                  <div>
                    <p className="text-muted-foreground mb-1">Comentários adicionais:</p>
                    <p className="text-foreground bg-muted/50 p-2 rounded">{ev.additional_comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
