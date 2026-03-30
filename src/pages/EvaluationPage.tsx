import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCohort } from "@/contexts/CohortContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, CheckCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "w-8 h-8 transition-colors",
                (hover || value) >= star
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const { user } = useAuth();
  const { selectedCohort } = useCohort();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isNearEnd, setIsNearEnd] = useState(false);

  const [overallRating, setOverallRating] = useState(0);
  const [likedMost, setLikedMost] = useState("");
  const [improvements, setImprovements] = useState("");
  const [professorsRating, setProfessorsRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<string>("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedCohort || !user?.id) {
      setLoading(false);
      return;
    }

    // Check if near end of course (30 days before end_date)
    const endDate = new Date(selectedCohort.end_date);
    const now = new Date();
    const daysUntilEnd = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    setIsNearEnd(daysUntilEnd <= 30);

    // Check if already submitted
    supabase
      .from("course_evaluations")
      .select("id")
      .eq("user_id", user.id)
      .eq("cohort_id", selectedCohort.id)
      .maybeSingle()
      .then(({ data }) => {
        setSubmitted(!!data);
        setLoading(false);
      });
  }, [selectedCohort, user?.id]);

  const handleSubmit = async () => {
    if (!user?.id || !selectedCohort) return;
    if (overallRating === 0 || professorsRating === 0 || !likedMost.trim() || !improvements.trim() || !wouldRecommend) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("course_evaluations").insert({
      user_id: user.id,
      cohort_id: selectedCohort.id,
      overall_rating: overallRating,
      liked_most: likedMost.trim(),
      improvements: improvements.trim(),
      professors_rating: professorsRating,
      would_recommend: wouldRecommend === "sim",
      additional_comments: additionalComments.trim() || null,
    });

    setSubmitting(false);
    if (error) {
      toast.error("Erro ao enviar avaliação.");
      console.error(error);
    } else {
      toast.success("Avaliação enviada com sucesso!");
      setSubmitted(true);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isNearEnd) {
    return (
      <div className="page-container">
        <div className="max-w-lg mx-auto text-center space-y-4 py-16">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-heading font-bold text-foreground">Avaliação do Curso</h1>
          <p className="text-muted-foreground">
            A avaliação do curso estará disponível nos últimos 30 dias antes do encerramento da sua turma.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page-container">
        <div className="max-w-lg mx-auto text-center space-y-4 py-16">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-2xl font-heading font-bold text-foreground">Avaliação Enviada!</h1>
          <p className="text-muted-foreground">
            Obrigado por compartilhar sua opinião. Sua avaliação já foi registrada.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="section-title">Avaliação do Curso</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sua opinião é muito importante para melhorarmos continuamente.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Formulário de Avaliação</CardTitle>
            <CardDescription>Turma: {selectedCohort?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <StarRating label="Avaliação geral do curso *" value={overallRating} onChange={setOverallRating} />

            <div className="space-y-2">
              <Label htmlFor="liked">O que você mais gostou? *</Label>
              <Textarea
                id="liked"
                value={likedMost}
                onChange={(e) => setLikedMost(e.target.value)}
                placeholder="Conte o que mais te marcou no curso..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="improve">O que poderia melhorar? *</Label>
              <Textarea
                id="improve"
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="Compartilhe sugestões de melhoria..."
                rows={3}
              />
            </div>

            <StarRating label="Como você avalia os professores? *" value={professorsRating} onChange={setProfessorsRating} />

            <div className="space-y-2">
              <Label>Você recomendaria o curso? *</Label>
              <RadioGroup value={wouldRecommend} onValueChange={setWouldRecommend} className="flex gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="rec-sim" />
                  <Label htmlFor="rec-sim" className="cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="rec-nao" />
                  <Label htmlFor="rec-nao" className="cursor-pointer">Não</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Comentários adicionais (opcional)</Label>
              <Textarea
                id="comments"
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                placeholder="Algo mais que queira compartilhar..."
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
