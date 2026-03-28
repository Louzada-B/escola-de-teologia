import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, Minus } from 'lucide-react';

interface MatchPair { left: string; right: string }

interface GabaritoData {
  questions: any[];
  studentAnswers: Record<string, any>;
}

export default function QuizGabarito({ questions, studentAnswers }: GabaritoData) {
  return (
    <div className="space-y-4">
      <h3 className="font-heading text-lg font-semibold text-primary">Gabarito</h3>
      {questions.map((q, idx) => {
        const qType = q.question_type || 'objetiva';
        const studentAnswer = studentAnswers[q.id];

        return (
          <div key={q.id} className="border rounded-lg p-4 space-y-2">
            <p className="font-body font-medium">
              {idx + 1}. {q.question}
              <span className="ml-2 text-xs text-muted-foreground">
                ({qType === 'objetiva' ? 'Objetiva' : qType === 'verdadeiro_falso' ? 'V ou F' : qType === 'ligar_colunas' ? 'Ligar Colunas' : 'Dissertativa'})
              </span>
            </p>

            {/* Objetiva */}
            {qType === 'objetiva' && (() => {
              const options = q.options as string[];
              const correctIdx = q.correct_option;
              const studentIdx = studentAnswer !== undefined && studentAnswer !== '' ? Number(studentAnswer) : null;
              const isCorrect = studentIdx === correctIdx;

              return (
                <div className="space-y-1 pl-2">
                  {options.map((opt: string, i: number) => {
                    const isStudentChoice = studentIdx === i;
                    const isCorrectOption = correctIdx === i;
                    let bg = '';
                    if (isCorrectOption && isStudentChoice) bg = 'bg-green-100 dark:bg-green-900/30';
                    else if (isCorrectOption) bg = 'bg-green-50 dark:bg-green-900/20';
                    else if (isStudentChoice) bg = 'bg-red-100 dark:bg-red-900/30';

                    return (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded ${bg}`}>
                        {isCorrectOption && isStudentChoice && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                        {isCorrectOption && !isStudentChoice && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                        {!isCorrectOption && isStudentChoice && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        {!isCorrectOption && !isStudentChoice && <span className="w-4 h-4 shrink-0" />}
                        <span className="font-body text-sm">{opt}</span>
                        {isStudentChoice && <span className="text-xs text-muted-foreground ml-auto">(sua resposta)</span>}
                        {isCorrectOption && !isStudentChoice && <span className="text-xs text-green-600 ml-auto">(correta)</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Verdadeiro ou Falso */}
            {qType === 'verdadeiro_falso' && (() => {
              const phrases = Array.isArray(q.options) ? (q.options as string[]) : [];
              let correctVf: Record<string, string> = {};
              try { correctVf = q.expected_text ? JSON.parse(q.expected_text) : {}; } catch {}
              const studentVf = (studentAnswer as Record<string, string>) || {};

              return (
                <div className="space-y-2 pl-2">
                  {phrases.map((phrase: string, i: number) => {
                    const correct = correctVf[String(i)] || '';
                    const student = studentVf[String(i)] || '';
                    const isCorrect = correct === student;

                    return (
                      <div key={i} className={`p-3 rounded-md flex items-start gap-3 ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        {isCorrect ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                        <div className="flex-1">
                          <p className="font-body text-sm">{phrase}</p>
                          <div className="flex gap-4 mt-1 text-xs">
                            <span>Sua resposta: <strong>{student === 'verdadeiro' ? 'V' : student === 'falso' ? 'F' : '—'}</strong></span>
                            <span className="text-green-600">Correta: <strong>{correct === 'verdadeiro' ? 'V' : correct === 'falso' ? 'F' : '—'}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Ligar Colunas */}
            {qType === 'ligar_colunas' && (() => {
              const pairs = Array.isArray(q.options) ? (q.options as MatchPair[]) : [];
              const studentMatch = (studentAnswer as Record<string, string>) || {};

              return (
                <div className="space-y-2 pl-2">
                  {pairs.map((pair, i) => {
                    const student = studentMatch[String(i)] || '';
                    const isCorrect = student === pair.right;

                    return (
                      <div key={i} className={`p-3 rounded-md ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        <div className="flex items-center gap-2">
                          {isCorrect ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                          <span className="font-body text-sm font-medium">{pair.left}</span>
                        </div>
                        <div className="pl-6 mt-1 text-xs space-y-0.5">
                          <p>Sua resposta: <strong>{student || '—'}</strong></p>
                          {!isCorrect && <p className="text-green-600">Correta: <strong>{pair.right}</strong></p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Dissertativa */}
            {qType === 'dissertativa' && (
              <div className="pl-2 space-y-2">
                <div className="p-3 rounded-md bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Sua resposta:</p>
                  <p className="font-body text-sm">{studentAnswer || '(em branco)'}</p>
                </div>
                {q.expected_text && (
                  <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Texto de referência do professor:</p>
                    <p className="font-body text-sm">{q.expected_text}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
