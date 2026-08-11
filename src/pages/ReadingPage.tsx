import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCohort } from '@/contexts/CohortContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { BookOpen, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface NextReading {
  lessonId: string;
  title: string;
  scheduledDate: string | null;
  requiredReading: string;
}

interface HistoryReading {
  lessonId: string;
  title: string;
  scheduledDate: string | null;
  requiredReading: string;
  confirmed: boolean;
  byProfessor: boolean;
}

export default function ReadingPage() {
  const { user } = useAuth();
  const { selectedCohort } = useCohort();
  const [next, setNext] = useState<NextReading | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState<HistoryReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [selectedCohort?.id, user?.id]);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, title, scheduled_date, start_time, required_reading')
      .not('required_reading', 'is', null)
      .order('scheduled_date')
      .order('start_time');

    const now = new Date();
    const cohortFiltered = (lessons || []).filter((l: any) => {
      if (!l.scheduled_date) return false;
      if (selectedCohort) {
        if (l.scheduled_date < selectedCohort.start_date || l.scheduled_date > selectedCohort.end_date) return false;
      }
      return true;
    });

    const withDateTime = cohortFiltered.map((l: any) => ({
      ...l,
      dateTime: new Date(`${l.scheduled_date}T${l.start_time || '23:59'}`),
    }));

    const upcoming = withDateTime
      .filter((l) => l.dateTime >= now)
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
    const past = withDateTime
      .filter((l) => l.dateTime < now)
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()); // mais recente primeiro

    const allLessonIds = withDateTime.map((l: any) => l.id);
    const { data: confs } = allLessonIds.length
      ? await supabase
          .from('reading_confirmations')
          .select('lesson_id, confirmed_by_professor')
          .eq('user_id', user.id)
          .in('lesson_id', allLessonIds)
      : { data: [] as any[] };
    const confMap = new Map((confs || []).map((c: any) => [c.lesson_id, c]));

    if (upcoming.length) {
      const lesson = upcoming[0];
      setNext({
        lessonId: lesson.id,
        title: lesson.title,
        scheduledDate: lesson.scheduled_date,
        requiredReading: lesson.required_reading,
      });
      setConfirmed(confMap.has(lesson.id));
    } else {
      setNext(null);
      setConfirmed(false);
    }

    setHistory(
      past.map((l: any) => ({
        lessonId: l.id,
        title: l.title,
        scheduledDate: l.scheduled_date,
        requiredReading: l.required_reading,
        confirmed: confMap.has(l.id),
        byProfessor: confMap.get(l.id)?.confirmed_by_professor || false,
      }))
    );

    setLoading(false);
  };

  const toggleConfirm = async () => {
    if (!next || !user) return;
    setSaving(true);
    if (confirmed) {
      const { error } = await supabase
        .from('reading_confirmations')
        .delete()
        .eq('lesson_id', next.lessonId)
        .eq('user_id', user.id);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        setConfirmed(false);
      }
    } else {
      const { error } = await supabase
        .from('reading_confirmations')
        .insert({ lesson_id: next.lessonId, user_id: user.id });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        setConfirmed(true);
        toast({ title: 'Leitura confirmada!' });
      }
    }
    setSaving(false);
  };

  const formatDate = (d: string | null) =>
    d
      ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
      : '';

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
        </p>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg space-y-6">
      <h1 className="section-title">Leitura</h1>

      {!next ? (
        <Card className="card-academic">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Nenhuma leitura obrigatória pendente no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="card-academic">
          <CardHeader className="flex flex-row items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            <div>
              <CardTitle className="font-heading text-lg">{next.title}</CardTitle>
              {next.scheduledDate && <p className="text-xs text-muted-foreground">{formatDate(next.scheduledDate)}</p>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">{next.requiredReading}</p>

            {confirmed ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-green-700">Leitura confirmada</p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleConfirm} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Desmarcar'}
                </Button>
              </div>
            ) : (
              <Button onClick={toggleConfirm} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmo que li'}
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              Prazo: até o início dessa aula. Depois disso, não é mais possível confirmar.
            </p>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <Card key={h.lessonId} className="card-academic">
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{h.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(h.scheduledDate)}</p>
                  </div>
                  {h.confirmed ? (
                    <Badge variant="outline" className="text-[10px] gap-1 border-green-500/40 text-green-700 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Confirmada{h.byProfessor ? ' (manual)' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive shrink-0">
                      <XCircle className="w-3 h-3" /> Não confirmada
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
