import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCohort } from '@/contexts/CohortContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';

interface NextReading {
  lessonId: string;
  title: string;
  scheduledDate: string | null;
  requiredReading: string;
}

export default function ReadingPage() {
  const { user } = useAuth();
  const { selectedCohort } = useCohort();
  const [next, setNext] = useState<NextReading | null>(null);
  const [confirmed, setConfirmed] = useState(false);
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
    const upcoming = (lessons || [])
      .filter((l: any) => {
        if (selectedCohort && l.scheduled_date) {
          if (l.scheduled_date < selectedCohort.start_date || l.scheduled_date > selectedCohort.end_date) return false;
        }
        if (!l.scheduled_date) return false;
        const lessonDateTime = new Date(`${l.scheduled_date}T${l.start_time || '23:59'}`);
        return lessonDateTime >= now;
      })
      .sort((a: any, b: any) => (a.scheduled_date + (a.start_time || '')) > (b.scheduled_date + (b.start_time || '')) ? 1 : -1);

    if (!upcoming.length) {
      setNext(null);
      setLoading(false);
      return;
    }

    const lesson = upcoming[0];
    setNext({
      lessonId: lesson.id,
      title: lesson.title,
      scheduledDate: lesson.scheduled_date,
      requiredReading: lesson.required_reading,
    });

    const { data: existing } = await supabase
      .from('reading_confirmations')
      .select('id')
      .eq('lesson_id', lesson.id)
      .eq('user_id', user.id)
      .maybeSingle();

    setConfirmed(!!existing);
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
    <div className="page-container max-w-lg">
      <h1 className="section-title mb-6">Leitura</h1>

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
              {next.scheduledDate && (
                <p className="text-xs text-muted-foreground">
                  {new Date(next.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                  })}
                </p>
              )}
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
    </div>
  );
}
