import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, Lock, Clock } from 'lucide-react';
import QuizGabarito from '@/components/quiz/QuizGabarito';

interface MatchPair { left: string; right: string }

export default function QuizzesPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Record<string, any[]>>({});
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, Record<string, string>>>({});
  const [vfAnswers, setVfAnswers] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [matchAnswers, setMatchAnswers] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Shuffled right-column options per question (so the student doesn't see them in order)
  const [shuffledRights, setShuffledRights] = useState<Record<string, string[]>>({});

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
        const shuffled: Record<string, string[]> = {};
        qData.forEach((q) => {
          if (!grouped[q.quiz_id]) grouped[q.quiz_id] = [];
          grouped[q.quiz_id].push(q);
          // Shuffle right column for ligar_colunas
          if (q.question_type === 'ligar_colunas' && Array.isArray(q.options)) {
            const rights = (q.options as unknown as MatchPair[]).map(p => p.right);
            shuffled[q.id] = [...rights].sort(() => Math.random() - 0.5);
          }
        });
        setQuestions(grouped);
        setShuffledRights(shuffled);
      }
      if (responses) {
        setSubmitted(new Set(responses.map((r) => r.quiz_id)));
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const handleAnswer = (quizId: string, questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [quizId]: { ...prev[quizId], [questionId]: value } }));
  };

  const handleTextAnswer = (quizId: string, questionId: string, value: string) => {
    setTextAnswers((prev) => ({ ...prev, [quizId]: { ...prev[quizId], [questionId]: value } }));
  };

  const handleVfAnswer = (quizId: string, questionId: string, phraseIdx: string, value: string) => {
    setVfAnswers((prev) => ({
      ...prev,
      [quizId]: {
        ...prev[quizId],
        [questionId]: { ...prev[quizId]?.[questionId], [phraseIdx]: value },
      },
    }));
  };

  const handleMatchAnswer = (quizId: string, questionId: string, leftIdx: string, rightValue: string) => {
    setMatchAnswers((prev) => ({
      ...prev,
      [quizId]: {
        ...prev[quizId],
        [questionId]: { ...prev[quizId]?.[questionId], [leftIdx]: rightValue },
      },
    }));
  };

  const handleSubmit = async (quizId: string) => {
    const quizQuestions = questions[quizId] || [];
    const mergedAnswers: Record<string, any> = {};
    let score = 0;

    quizQuestions.forEach((q) => {
      const qType = q.question_type || 'objetiva';

      if (qType === 'dissertativa') {
        mergedAnswers[q.id] = textAnswers[quizId]?.[q.id] || '';
      } else if (qType === 'objetiva') {
        mergedAnswers[q.id] = answers[quizId]?.[q.id] || '';
        if (q.correct_option !== null && answers[quizId]?.[q.id] === String(q.correct_option)) {
          score++;
        }
      } else if (qType === 'verdadeiro_falso') {
        const studentVf = vfAnswers[quizId]?.[q.id] || {};
        mergedAnswers[q.id] = studentVf;
        // Score: compare each phrase
        try {
          const correctVf: Record<string, string> = q.expected_text ? JSON.parse(q.expected_text) : {};
          const phrases = Array.isArray(q.options) ? q.options : [];
          let allCorrect = true;
          phrases.forEach((_: any, i: number) => {
            if ((studentVf[String(i)] || '') !== (correctVf[String(i)] || '')) allCorrect = false;
          });
          if (allCorrect && phrases.length > 0) score++;
        } catch {}
      } else if (qType === 'ligar_colunas') {
        const studentMatch = matchAnswers[quizId]?.[q.id] || {};
        mergedAnswers[q.id] = studentMatch;
        // Score: all pairs must match
        if (Array.isArray(q.options)) {
          const pairs = q.options as MatchPair[];
          let allCorrect = true;
          pairs.forEach((pair, i) => {
            if (studentMatch[String(i)] !== pair.right) allCorrect = false;
          });
          if (allCorrect && pairs.length > 0) score++;
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
          ? `Você acertou ${score} de ${totalGraded} questões.`
          : 'Suas respostas foram registradas.',
      });
    }
  };

  const getQuizStatus = (quiz: any) => {
    const now = new Date();
    if (quiz.available_from && new Date(quiz.available_from) > now) {
      return { status: 'pending' as const, label: `Disponível a partir de ${new Date(quiz.available_from).toLocaleDateString('pt-BR')} às ${new Date(quiz.available_from).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` };
    }
    if (quiz.available_until && new Date(quiz.available_until) < now) {
      return { status: 'closed' as const, label: 'Prazo encerrado' };
    }
    return { status: 'open' as const, label: '' };
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
                {(() => {
                  const { status, label } = getQuizStatus(quiz);
                  if (status === 'pending') return <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-4 h-4" /> {label}</p>;
                  if (status === 'closed') return <p className="text-sm text-destructive flex items-center gap-1"><Lock className="w-4 h-4" /> {label}</p>;
                  return null;
                })()}
              </CardHeader>
              <CardContent>
                {submitted.has(quiz.id) ? (
                  <div className="flex items-center gap-2 text-accent">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-body font-medium">Questionário já respondido</span>
                  </div>
                ) : getQuizStatus(quiz).status !== 'open' ? (
                  <p className="text-muted-foreground font-body">Este questionário não está disponível no momento.</p>
                ) : (
                  <div className="space-y-6">
                    {(questions[quiz.id] || []).map((q, idx) => {
                      const qType = q.question_type || 'objetiva';
                      return (
                        <div key={q.id} className="space-y-2">
                          <p className="font-body font-medium">
                            {idx + 1}. {q.question}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({qType === 'objetiva' ? 'Objetiva' : qType === 'verdadeiro_falso' ? 'V ou F' : qType === 'ligar_colunas' ? 'Ligar Colunas' : 'Dissertativa'})
                            </span>
                          </p>

                          {/* Objetiva */}
                          {qType === 'objetiva' && (
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

                          {/* Verdadeiro ou Falso — múltiplas frases */}
                          {qType === 'verdadeiro_falso' && Array.isArray(q.options) && (
                            <div className="space-y-3 pl-2">
                              {(q.options as string[]).map((phrase: string, i: number) => (
                                <div key={i} className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-md">
                                  <span className="font-body text-sm flex-1">{phrase}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {vfAnswers[quiz.id]?.[q.id]?.[String(i)] === 'verdadeiro' ? 'V' : vfAnswers[quiz.id]?.[q.id]?.[String(i)] === 'falso' ? 'F' : '—'}
                                    </span>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant={vfAnswers[quiz.id]?.[q.id]?.[String(i)] === 'verdadeiro' ? 'default' : 'outline'}
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleVfAnswer(quiz.id, q.id, String(i), 'verdadeiro')}
                                      >V</Button>
                                      <Button
                                        size="sm"
                                        variant={vfAnswers[quiz.id]?.[q.id]?.[String(i)] === 'falso' ? 'default' : 'outline'}
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleVfAnswer(quiz.id, q.id, String(i), 'falso')}
                                      >F</Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Ligar Colunas */}
                          {qType === 'ligar_colunas' && Array.isArray(q.options) && (
                            <div className="space-y-3 pl-2">
                              {(q.options as MatchPair[]).map((pair, i) => (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="font-body text-sm flex-1 bg-muted/30 p-2 rounded">{pair.left}</span>
                                  <span className="text-muted-foreground">→</span>
                                  <select
                                    value={matchAnswers[quiz.id]?.[q.id]?.[String(i)] || ''}
                                    onChange={e => handleMatchAnswer(quiz.id, q.id, String(i), e.target.value)}
                                    className="flex-1 border rounded-md p-2 bg-background text-foreground text-sm"
                                  >
                                    <option value="">Selecione</option>
                                    {(shuffledRights[q.id] || []).map((right, ri) => (
                                      <option key={ri} value={right}>{right}</option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Dissertativa */}
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
