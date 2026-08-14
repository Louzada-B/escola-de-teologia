import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface MatchPair { left: string; right: string }

interface QuizAnswerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quiz: any;
  questions: any[];
  onSubmitted: (quizId: string, questions: any[], mergedAnswers: Record<string, any>) => void;
}

export default function QuizAnswerDialog({ open, onOpenChange, quiz, questions, onSubmitted }: QuizAnswerDialogProps) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [vfAnswers, setVfAnswers] = useState<Record<string, Record<string, string>>>({});
  const [matchAnswers, setMatchAnswers] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showBlankConfirm, setShowBlankConfirm] = useState(false);
  const [blankCount, setBlankCount] = useState(0);

  const isQuestionBlank = (q: any): boolean => {
    const qType = q.question_type || 'objetiva';
    if (qType === 'dissertativa') {
      return !textAnswers[q.id]?.trim();
    }
    if (qType === 'objetiva') {
      return !answers[q.id];
    }
    if (qType === 'verdadeiro_falso') {
      const phrases = Array.isArray(q.options) ? q.options : [];
      const studentVf = vfAnswers[q.id] || {};
      return phrases.length === 0 || !phrases.every((_: any, i: number) => !!studentVf[String(i)]);
    }
    if (qType === 'ligar_colunas') {
      const pairs = Array.isArray(q.options) ? q.options : [];
      const studentMatch = matchAnswers[q.id] || {};
      return pairs.length === 0 || !pairs.every((_: any, i: number) => !!studentMatch[String(i)]);
    }
    return true;
  };

  const countBlankQuestions = () => questions.filter(isQuestionBlank).length;

  // Usado tanto pro aviso de sair sem salvar quanto pra descrição desse
  // aviso -- checa os quatro tipos de pergunta, não só objetiva (o aviso
  // de sair já existia, mas só olhava "answers", perdendo progresso em
  // dissertativa/V-F/ligar colunas).
  const hasAnyProgress = () =>
    Object.keys(answers).length > 0 ||
    Object.values(textAnswers).some((v) => v?.trim()) ||
    Object.keys(vfAnswers).length > 0 ||
    Object.keys(matchAnswers).length > 0;

  const shuffledRights = useMemo(() => {
    const map: Record<string, string[]> = {};
    questions.forEach((q) => {
      if (q.question_type === 'ligar_colunas' && Array.isArray(q.options)) {
        const rights = (q.options as unknown as MatchPair[]).map(p => p.right);
        map[q.id] = [...rights].sort(() => Math.random() - 0.5);
      }
    });
    return map;
  }, [questions]);

  const handleSubmitClick = () => {
    const blank = countBlankQuestions();
    if (blank > 0) {
      setBlankCount(blank);
      setShowBlankConfirm(true);
    } else {
      doSubmit();
    }
  };

  const doSubmit = async () => {
    setShowBlankConfirm(false);
    setSubmitting(true);
    const mergedAnswers: Record<string, any> = {};
    let score = 0;

    questions.forEach((q) => {
      const qType = q.question_type || 'objetiva';

      if (qType === 'dissertativa') {
        mergedAnswers[q.id] = textAnswers[q.id] || '';
      } else if (qType === 'objetiva') {
        mergedAnswers[q.id] = answers[q.id] || '';
        if (q.correct_option !== null && answers[q.id] === String(q.correct_option)) {
          score++;
        }
      } else if (qType === 'verdadeiro_falso') {
        const studentVf = vfAnswers[q.id] || {};
        mergedAnswers[q.id] = studentVf;
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
        const studentMatch = matchAnswers[q.id] || {};
        mergedAnswers[q.id] = studentMatch;
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
      quiz_id: quiz.id,
      user_id: user!.id,
      answers: mergedAnswers,
      score,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Respostas enviadas!', description: 'Confira o gabarito abaixo.' });
      onSubmitted(quiz.id, questions, mergedAnswers);
      onOpenChange(false);
    }
  };

  return (
    <>
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do questionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Você respondeu {questions.length - countBlankQuestions()} de {questions.length} {questions.length === 1 ? "pergunta" : "perguntas"}. Suas respostas não serão salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction onClick={() => { setShowExitConfirm(false); onOpenChange(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sair sem salvar</AlertDialogAction>
            <AlertDialogCancel onClick={() => setShowExitConfirm(false)}>Continuar respondendo</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showBlankConfirm} onOpenChange={setShowBlankConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar com perguntas em branco?</AlertDialogTitle>
            <AlertDialogDescription>
              Você deixou {blankCount} {blankCount === 1 ? "pergunta" : "perguntas"} sem resposta. Depois de enviado, não será possível voltar e responder essas perguntas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction onClick={doSubmit}>Enviar mesmo assim</AlertDialogAction>
            <AlertDialogCancel onClick={() => setShowBlankConfirm(false)}>Voltar e responder</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={open} onOpenChange={(val) => { if (!val && hasAnyProgress() && !submitting) { setShowExitConfirm(true); } else { onOpenChange(val); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{quiz.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {questions.map((q, idx) => {
            const qType = q.question_type || 'objetiva';
            return (
              <div key={q.id} className="space-y-2">
                <p className="font-body font-medium">
                  {idx + 1}. {q.question}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({qType === 'objetiva' ? 'Objetiva' : qType === 'verdadeiro_falso' ? 'V ou F' : qType === 'ligar_colunas' ? 'Ligar Colunas' : 'Dissertativa'})
                  </span>
                </p>

                {qType === 'objetiva' && (
                  <RadioGroup
                    value={answers[q.id] || ''}
                    onValueChange={(v) => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                  >
                    {(q.options as string[]).map((opt: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <RadioGroupItem value={String(i)} id={`dlg-${q.id}-${i}`} />
                        <Label htmlFor={`dlg-${q.id}-${i}`} className="font-body">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {qType === 'verdadeiro_falso' && Array.isArray(q.options) && (
                  <div className="space-y-3 pl-2">
                    {(q.options as string[]).map((phrase: string, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-md">
                        <span className="font-body text-sm flex-1">{phrase}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium text-muted-foreground">
                            {vfAnswers[q.id]?.[String(i)] === 'verdadeiro' ? 'V' : vfAnswers[q.id]?.[String(i)] === 'falso' ? 'F' : '—'}
                          </span>
                          <div className="flex gap-1">
                            <Button size="sm" variant={vfAnswers[q.id]?.[String(i)] === 'verdadeiro' ? 'default' : 'outline'} className="h-7 px-2 text-xs"
                              onClick={() => setVfAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], [String(i)]: 'verdadeiro' } }))}>V</Button>
                            <Button size="sm" variant={vfAnswers[q.id]?.[String(i)] === 'falso' ? 'default' : 'outline'} className="h-7 px-2 text-xs"
                              onClick={() => setVfAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], [String(i)]: 'falso' } }))}>F</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {qType === 'ligar_colunas' && Array.isArray(q.options) && (
                  <div className="space-y-3 pl-2">
                    {(q.options as MatchPair[]).map((pair, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="font-body text-sm flex-1 bg-muted/30 p-2 rounded">{pair.left}</span>
                        <span className="text-muted-foreground">→</span>
                        <select
                          value={matchAnswers[q.id]?.[String(i)] || ''}
                          onChange={e => setMatchAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], [String(i)]: e.target.value } }))}
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

                {qType === 'dissertativa' && (
                  <Textarea
                    value={textAnswers[q.id] || ''}
                    onChange={(e) => setTextAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Digite sua resposta..."
                    rows={4}
                  />
                )}
              </div>
            );
          })}

          <Button onClick={handleSubmitClick} disabled={submitting} className="w-full">
            {submitting ? 'Enviando...' : 'Enviar Respostas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
