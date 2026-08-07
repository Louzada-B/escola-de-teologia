import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Download, Award } from 'lucide-react';

interface CompletionStats {
  cohortName: string;
  attendanceRegular: number;
  quizCompletion: number;
  tccSubmitted: boolean;
  certificateIssued: boolean;
  eligible: boolean;
}

export default function CourseCompletionPage() {
  const { user, profile, signOut } = useAuth();
  const [stats, setStats] = useState<CompletionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'aluno(a)';

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    if (!user) return;

    // Busca turma inativa mais recente do aluno
    const { data: cs } = await supabase
      .from('cohort_students')
      .select('cohort_id, cohorts!inner(name, is_active, start_date, end_date)')
      .eq('user_id', user.id)
      .eq('cohorts.is_active', false)
      .order('cohort_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cs) { setLoading(false); return; }

    const cohortId = cs.cohort_id;
    const cohort = (cs as any).cohorts;

    // Presença em aulas
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, event_type, scheduled_date, mandatory_attendance')
      .gte('scheduled_date', cohort.start_date)
      .lte('scheduled_date', cohort.end_date)
      .eq('mandatory_attendance', true);

    // Só aulas já realizadas como denominador
    const todayStr = new Date().toISOString().slice(0, 10);
    const regular = (lessons || []).filter(
      (l: any) => l.event_type === 'aula' && l.scheduled_date <= todayStr
    );
    const { data: att } = await supabase
      .from('attendance_records')
      .select('lesson_id')
      .eq('user_id', user.id);

    const attIds = new Set((att || []).map((a: any) => a.lesson_id));
    const attDone = regular.filter((l: any) => attIds.has(l.id)).length;
    const attReg = regular.length > 0 ? Math.round((attDone / regular.length) * 100) : 100;

    // Questionários
    const now = new Date().toISOString();
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('id, available_from, counts_for_completion')
      .lte('available_from', now);
    const countingQuizzes = (quizzes || []).filter((q: any) => q.counts_for_completion !== false);
    const totalQuiz = countingQuizzes.length;
    const { data: responses } = await supabase
      .from('quiz_responses')
      .select('quiz_id')
      .eq('user_id', user.id);
    const countingQuizIds = new Set(countingQuizzes.map((q: any) => q.id));
    const answeredIds = new Set((responses || []).map((r: any) => r.quiz_id).filter((id: string) => countingQuizIds.has(id)));
    const quizPct = totalQuiz > 0 ? Math.round((answeredIds.size / totalQuiz) * 100) : 100;

    // TCC
    const { data: tcc } = await supabase
      .from('tcc_submissions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('cohort_id', cohortId)
      .maybeSingle();

    // Certificado
    const { data: cert } = await supabase
      .from('issued_certificates')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('cohort_id', cohortId)
      .maybeSingle();

    // Verifica se atingiu os critérios mínimos
    const eligible = attReg >= 75 && quizPct >= 75;

    setStats({
      cohortName: cohort.name,
      attendanceRegular: attReg,
      quizCompletion: quizPct,
      tccSubmitted: !!(tcc && (tcc as any).status === 'approved'),
      certificateIssued: !!cert,
      eligible,
    });
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Selo */}
        <div className="mx-auto w-24 h-24 rounded-full bg-[#1a2e52] flex items-center justify-center">
          <Award className="w-12 h-12 text-[#c9a84c]" />
        </div>

        {/* Saudação */}
        {loading ? (
          <div className="animate-pulse h-8 bg-muted rounded w-48 mx-auto" />
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
                {stats?.cohortName ?? 'Formação Teológica'}
              </p>
              <h1 className="text-2xl font-heading font-semibold">
                Parabéns, {firstName}!
              </h1>
              <p className="text-muted-foreground mt-1 text-sm font-body">
                Você concluiu o curso de Formação Teológica.
              </p>
            </div>

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-3">
                  <p className={`text-xl font-semibold ${stats.attendanceRegular >= 75 ? 'text-green-600' : 'text-destructive'}`}>
                    {stats.attendanceRegular}%
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Presença</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <p className={`text-xl font-semibold ${stats.quizCompletion >= 75 ? 'text-green-600' : 'text-destructive'}`}>
                    {stats.quizCompletion}%
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Questionários</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <p className={`text-xl font-semibold ${stats.tccSubmitted ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {stats.tccSubmitted ? '✓' : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">TCC</p>
                </div>
              </div>
            )}

            {/* Mensagem */}
            <p className="text-sm text-muted-foreground italic font-body leading-relaxed border-t border-border pt-4">
              "Que o conhecimento adquirido aqui floresça em cada área da sua vida, do seu ministério e da sua comunidade."
            </p>

            {/* Ações */}
            <div className="flex flex-col gap-2 pt-2">
              {stats?.certificateIssued && (
                <Button className="gap-2 w-full bg-[#1a2e52] hover:bg-[#243d6b] text-white">
                  <Download className="w-4 h-4" />
                  Baixar meu certificado
                </Button>
              )}
              <Button variant="outline" onClick={signOut} className="gap-2 w-full">
                <LogOut className="w-4 h-4" />
                Sair do portal
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
