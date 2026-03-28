import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setAnnouncements(data || []));
  }, []);

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Mural de Avisos</h1>

      {announcements.length === 0 ? (
        <p className="text-muted-foreground">Nenhum aviso publicado.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
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
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
