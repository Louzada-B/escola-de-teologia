import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCohort } from '@/contexts/CohortContext';
import { useCourse } from '@/contexts/CourseContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AnnouncementsPage() {
  const { selectedCohort } = useCohort();
  const { selectedCourseId } = useCourse();
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (selectedCourseId) query = query.eq('course_id', selectedCourseId);
    query.then(({ data }) => setAnnouncements(data || []));
  }, [selectedCourseId]);

  const filtered = useMemo(() => {
    if (!selectedCohort) return announcements;
    return announcements.filter(a => {
      const date = a.created_at?.split('T')[0];
      if (!date) return true;
      return date >= selectedCohort.start_date && date <= selectedCohort.end_date;
    });
  }, [announcements, selectedCohort]);

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Mural de Avisos</h1>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum aviso publicado.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <Card key={a.id} className="card-academic">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-heading">{a.title}</CardTitle>
                  <span className="text-xs text-muted-foreground font-body">
                    {format(new Date(a.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground/80 whitespace-pre-wrap prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: a.content }} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
