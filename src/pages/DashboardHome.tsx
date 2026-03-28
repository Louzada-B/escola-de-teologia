import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, MessageSquare, CalendarDays, ClipboardList } from 'lucide-react';

export default function DashboardHome() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ modules: 0, announcements: 0, events: 0, quizzes: 0 });

  useEffect(() => {
    async function load() {
      const [m, a, e, q] = await Promise.all([
        supabase.from('modules').select('id', { count: 'exact', head: true }),
        supabase.from('announcements').select('id', { count: 'exact', head: true }),
        supabase.from('calendar_events').select('id', { count: 'exact', head: true }),
        supabase.from('quizzes').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        modules: m.count || 0,
        announcements: a.count || 0,
        events: e.count || 0,
        quizzes: q.count || 0,
      });
    }
    load();
  }, []);

  const cards = [
    { label: 'Módulos', value: stats.modules, icon: BookOpen },
    { label: 'Avisos', value: stats.announcements, icon: MessageSquare },
    { label: 'Eventos', value: stats.events, icon: CalendarDays },
    { label: 'Questionários', value: stats.quizzes, icon: ClipboardList },
  ];

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="section-title text-3xl">
          Bem-vindo, {profile?.full_name || 'estudante'}
        </h1>
        <p className="text-muted-foreground mt-1 font-body">
          Seu painel de estudos teológicos
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="card-academic">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-body font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
