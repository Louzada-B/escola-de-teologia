import { useEffect, useState } from 'react';
import { QuizzesSkeleton } from '@/components/SkeletonLoaders';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCohort } from '@/contexts/CohortContext';
import { isDateWithinCohortPeriod } from '@/lib/cohortDateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, Lock, Clock, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QuizGabarito from '@/components/quiz/QuizGabarito';
import QuizAnswerDialog from '@/components/quiz/QuizAnswerDialog';

export default function QuizzesPage() {
  const { user, profile } = useAuth();
  const { selectedCohort, effectiveCutoffDate } = useCohort();
  const isStudent = profile?.role === 'aluno';
  const isAdminOrProfessor = profile?.role === 'admin' || profile?.role === 'professor';
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Record<string, any[]>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [gabaritoData, setGabaritoData] = useState<Record<string, { questions: any[]; studentAnswers: Record<string, any> }>>({});
  const [loading, setLoading] = useState(true);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [showGabaritoId, setShowGabaritoId] = useState<string | null>(null);
  const [gabaritoDialogId, setGabaritoDialogId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*, lessons(scheduled_date, title)')
        .order('created_at');
      const { data: qData } = await supabase.from('quiz_questions').select('*').order('order_index');
      const { data: responses } = await supabase
        .from('quiz_responses')
        .select('quiz_id, answers')
        .eq('user_id', user?.id || '');

      if (quizData) {
        const now = new Date();

        const filtered = (selectedCohort
          ? quizData.filter((q: any) => {
              const lessonDate = q.lessons?.scheduled_date;
              if (!lessonDate) return true;
              return lessonDate >= selectedCohort.start_date && lessonDate <= selectedCohort.end_date;
            })
          : quizData
        ).filter((q: any) => {
          // Remove questionários que ainda não abriram (futuros)
          if (q.available_from && new Date(q.available_from) > now) return false;
          return true;
        }).sort((a: any, b: any) => {
          // Ordena do mais recente para o mais antigo (por available_from ou created_at)
          const dateA = new Date(a.available_from || a.created_at).getTime();
          const dateB = new Date(b.available_from || b.created_at).getTime();
          return dateB - dateA;
        });

        setQuizzes(filtered);
      }
      if (qData) {
        const grouped: Record<string, any[]> = {};
        qData.forEach((q) => {
          if (!grouped[q.quiz_id]) grouped[q.quiz_id] = [];
          grouped[q.quiz_id].push(q);
        });
        setQuestions(grouped);
      }
      if (responses) {
        setSubmitted(new Set(responses.map((r: any) => r.quiz_id)));

        // Monta gabaritoData — uma linha por quiz, answers é JSONB {question_id: answer}
        if (qData) {
          const questionsByQuiz: Record<string, any[]> = {};
          qData.forEach((q: any) => {
            if (!questionsByQuiz[q.quiz_id]) questionsByQuiz[q.quiz_id] = [];
            questionsByQuiz[q.quiz_id].push(q);
          });

          const gabarito: Record<string, { questions: any[]; studentAnswers: Record<string, any> }> = {};
          responses.forEach((r: any) => {
            gabarito[r.quiz_id] = {
              questions: questionsByQuiz[r.quiz_id] || [],
              studentAnswers: (r.answers as Record<string, any>) || {},
            };
          });
          setGabaritoData(gabarito);
        }
      }
      setLoading(false);
    }
    load();
  }, [user, selectedCohort, isStudent, effectiveCutoffDate]);

  const getQuizStatus = (quiz: any) => {
    if (submitted.has(quiz.id)) {
      return { status: 'answered' as const, label: 'Respondido', variant: 'secondary' as const };
    }
    const now = new Date();
    if (quiz.available_from && new Date(quiz.available_from) > now) {
      return { status: 'pending' as const, label: 'Indisponível', variant: 'outline' as const };
    }
    if (quiz.available_until && new Date(quiz.available_until) < now) {
      return { status: 'closed' as const, label: 'Indisponível', variant: 'destructive' as const };
    }
    return { status: 'open' as const, label: 'Disponível', variant: 'default' as const };
  };

  const handleSubmitted = (quizId: string, qs: any[], mergedAnswers: Record<string, any>) => {
    setSubmitted((prev) => new Set(prev).add(quizId));
    setGabaritoData((prev) => ({ ...prev, [quizId]: { questions: qs, studentAnswers: mergedAnswers } }));
    setShowGabaritoId(quizId);
  };

  if (loading) return <QuizzesSkeleton />;

  const activeQuiz = quizzes.find(q => q.id === activeQuizId);

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Questionários</h1>

      {quizzes.length === 0 ? (
        <p className="text-muted-foreground">Nenhum questionário disponível.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const { status, label, variant } = getQuizStatus(quiz);
            const lessonTitle = quiz.lessons?.title;
            const questionCount = (questions[quiz.id] || []).length;

            return (
              <Card key={quiz.id} className="card-academic flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-heading text-lg leading-tight">{quiz.title}</CardTitle>
                    <Badge variant={variant} className="shrink-0">
                      {status === 'answered' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {status === 'closed' && <Lock className="w-3 h-3 mr-1" />}
                      {label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-3">
                  <div className="space-y-1 text-sm text-muted-foreground flex-1">
                    {lessonTitle && (
                      <p className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Aula: {lessonTitle}
                      </p>
                    )}
                    <p>{questionCount} {questionCount === 1 ? 'questão' : 'questões'}</p>
                    {quiz.available_from && status === 'pending' && (
                      <p className="text-xs">
                        Disponível a partir de {new Date(quiz.available_from).toLocaleDateString('pt-BR')} às {new Date(quiz.available_from).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {quiz.available_until && status === 'open' && (
                      <p className="text-xs">
                        Até {new Date(quiz.available_until).toLocaleDateString('pt-BR')} às {new Date(quiz.available_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {status === 'open' && (
                    <Button onClick={() => setActiveQuizId(quiz.id)} className="w-full">
                      Responder
                    </Button>
                  )}

                  {status === 'answered' && (
                    <Button
                      variant="outline"
                      onClick={() => setGabaritoDialogId(quiz.id)}
                      className="w-full"
                    >
                      Ver Gabarito
                    </Button>
                  )}
                </CardContent>


              </Card>
            );
          })}
        </div>
      )}

      {gabaritoDialogId && (
        <Dialog open={!!gabaritoDialogId} onOpenChange={(open) => { if (!open) setGabaritoDialogId(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {quizzes.find(q => q.id === gabaritoDialogId)?.title}
              </DialogTitle>
            </DialogHeader>
            <QuizGabarito
              questions={gabaritoData[gabaritoDialogId]?.questions || []}
              studentAnswers={gabaritoData[gabaritoDialogId]?.studentAnswers || {}}
            />
          </DialogContent>
        </Dialog>
      )}

      {activeQuiz && (
        <QuizAnswerDialog
          open={!!activeQuizId}
          onOpenChange={(open) => { if (!open) setActiveQuizId(null); }}
          quiz={activeQuiz}
          questions={questions[activeQuiz.id] || []}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  );
}
