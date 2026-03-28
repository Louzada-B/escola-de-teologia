import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { CheckCircle } from 'lucide-react';

export default function QuizzesPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Record<string, any[]>>({});
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, Record<string, string>>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: quizData } = await supabase.from('quizzes').select('*').order('created_at');
      const { data: qData } = await supabase.from('quiz_questions').select('*').order('order_index');
      const { data: responses } = await supabase
        .from('quiz_responses')
        .select('quiz_id')
        .eq('user_id', user?.id || '');

      if (quizData) setQuizzes(quizData);
      if (qData) {
        const grouped: Record<string, any[]> = {};
        qData.forEach((q) => {
          if (!grouped[q.quiz_id]) grouped[q.quiz_id] = [];
          grouped[q.quiz_id].push(q);
        });
        setQuestions(grouped);
      }
      if (responses) {
        setSubmitted(new Set(responses.map((r) => r.quiz_id)));
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const handleAnswer = (quizId: string, questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [quizId]: { ...prev[quizId], [questionId]: value },
    }));
  };

  const handleTextAnswer = (quizId: string, questionId: string, value: string) => {
    setTextAnswers((prev) => ({
      ...prev,
      [quizId]: { ...prev[quizId], [questionId]: value },
    }));
  };

  const handleSubmit = async (quizId: string) => {
    const quizAnswers = answers[quizId] || {};
    const quizTextAnswers = textAnswers[quizId] || {};
    const quizQuestions = questions[quizId] || [];

    const mergedAnswers: Record<string, string> = {};
    let score = 0;

    quizQuestions.forEach((q) => {
      const qType = q.question_type || 'objetiva';
      if (qType === 'dissertativa') {
        mergedAnswers[q.id] = quizTextAnswers[q.id] || '';
      } else {
        mergedAnswers[q.id] = quizAnswers[q.id] || '';
        if (q.correct_option !== null && quizAnswers[q.id] === String(q.correct_option)) {
          score++;
        }
      }
    });

    const { error } = await supabase.from('quiz_responses').insert({
      quiz_id: quizId,
      user_id: user!.id,
      answers: mergedAnswers,
      score,
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setSubmitted((prev) => new Set(prev).add(quizId));
      const totalGraded = quizQuestions.filter((q) => (q.question_type || 'objetiva') !== 'dissertativa').length;
      toast({
        title: 'Respostas enviadas!',
        description: totalGraded > 0
          ? `Você acertou ${score} de ${totalGraded} questões objetivas.`
          : 'Suas respostas dissertativas foram registradas.',
      });
    }
  };

  if (loading) return <div className="page-container"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Questionários</h1>

      {quizzes.length === 0 ? (
        <p className="text-muted-foreground">Nenhum questionário disponível.</p>
      ) : (
        <div className="space-y-6">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="card-academic">
              <CardHeader>
                <CardTitle className="font-heading text-xl">{quiz.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {submitted.has(quiz.id) ? (
                  <div className="flex items-center gap-2 text-accent">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-body font-medium">Questionário já respondido</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(questions[quiz.id] || []).map((q, idx) => {
                      const qType = q.question_type || 'objetiva';
                      return (
                        <div key={q.id} className="space-y-2">
                          <p className="font-body font-medium">
                            {idx + 1}. {q.question}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({qType === 'objetiva' ? 'Objetiva' : qType === 'verdadeiro_falso' ? 'V ou F' : 'Dissertativa'})
                            </span>
                          </p>

                          {(qType === 'objetiva' || qType === 'verdadeiro_falso') && (
                            <RadioGroup
                              value={answers[quiz.id]?.[q.id] || ''}
                              onValueChange={(v) => handleAnswer(quiz.id, q.id, v)}
                            >
                              {(q.options as string[]).map((opt: string, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <RadioGroupItem value={String(i)} id={`${q.id}-${i}`} />
                                  <Label htmlFor={`${q.id}-${i}`} className="font-body">{opt}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          )}

                          {qType === 'dissertativa' && (
                            <Textarea
                              value={textAnswers[quiz.id]?.[q.id] || ''}
                              onChange={(e) => handleTextAnswer(quiz.id, q.id, e.target.value)}
                              placeholder="Digite sua resposta..."
                              rows={4}
                            />
                          )}
                        </div>
                      );
                    })}
                    <Button onClick={() => handleSubmit(quiz.id)}>Enviar Respostas</Button>
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
