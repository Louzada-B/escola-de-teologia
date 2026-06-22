import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCohort } from '@/contexts/CohortContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AnnouncementsPage() {
  const { selectedCohort } = useCohort();
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isStaff = profile?.role === 'admin' || profile?.role === 'professor';

  useEffect(() => {
    const now = new Date().toISOString();

    let query = supabase
      .from('announcements')
      .select('*, cohorts(name)')
      .order('scheduled_at', { ascending: false });

    // Alunos só veem avisos já publicados
    if (!isStaff) {
      query = query.lte('scheduled_at', now);
    }

    query.then(({ data }) => {
      const all: any[] = data || [];

      const filtered = all.filter(a => {
        // Aviso sem turma: todo mundo vê
        if (!a.cohort_id) return true;
        // Staff vê tudo
        if (isStaff) return true;
        // Aluno: só vê se a turma selecionada bate com a turma do aviso
        return selectedCohort ? a.cohort_id === selectedCohort.id : false;
      });

      setAnnouncements(filtered);
      setLoading(false);
    });
  }, [selectedCohort, isStaff]);

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">Carregando avisos...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Mural de Avisos</h1>

      {announcements.length === 0 ? (
        <p className="text-muted-foreground">Nenhum aviso publicado.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const isScheduled = new Date(a.scheduled_at) > new Date();
            return (
              <Card key={a.id} className={`card-academic ${isScheduled ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-heading">{a.title}</CardTitle>
                      {a.cohort_id
                        ? <Badge variant="outline" className="text-xs">{a.cohorts?.name}</Badge>
                        : <Badge variant="secondary" className="text-xs">Geral</Badge>
                      }
                      {isStaff && isScheduled && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Agendado</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-body whitespace-nowrap">
                      {format(new Date(a.scheduled_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="text-sm text-foreground/80 whitespace-pre-wrap prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: a.content }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
