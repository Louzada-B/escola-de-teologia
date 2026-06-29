import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCohort } from '@/contexts/CohortContext';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationItem {
  id: string;
  type: 'announcement' | 'event';
  title: string;
  date: string;
  read: boolean;
}

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const { selectedCohort } = useCohort();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter(i => !i.read).length;

  useEffect(() => {
    if (user) load();
  }, [user, selectedCohort]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function load() {
    if (!user) return;
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch recent announcements (published, visible to this user)
    const { data: announcements } = await supabase
      .from('announcements')
      .select('id, title, scheduled_at, cohort_id')
      .lte('scheduled_at', now)
      .gte('scheduled_at', thirtyDaysAgo)
      .order('scheduled_at', { ascending: false })
      .limit(20) as any;

    // Fetch recent events
    const { data: events } = await supabase
      .from('calendar_events')
      .select('id, title, event_date')
      .gte('event_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('event_date', { ascending: false })
      .limit(10);

    // Fetch reads
    const { data: reads } = await (supabase as any)
      .from('notification_reads')
      .select('source_type, source_id')
      .eq('user_id', user.id) as any;

    const readSet = new Set(
      (reads || []).map(r => `${r.source_type}:${r.source_id}`)
    );

    const isStaff = profile?.role === 'admin' || profile?.role === 'professor';

    const annItems: NotificationItem[] = (announcements || [])
      .filter(a => {
        // Filter by cohort visibility
        if (!a.cohort_id) return true;
        if (isStaff) return true;
        return selectedCohort ? a.cohort_id === selectedCohort.id : false;
      })
      .map(a => ({
        id: a.id,
        type: 'announcement' as const,
        title: a.title,
        date: a.scheduled_at,
        read: readSet.has(`announcement:${a.id}`),
      }));

    const evtItems: NotificationItem[] = (events || []).map(e => ({
      id: e.id,
      type: 'event' as const,
      title: e.title,
      date: e.event_date,
      read: readSet.has(`event:${e.id}`),
    }));

    // Merge and sort by date desc
    const all = [...annItems, ...evtItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);

    setItems(all);
  }

  async function markAllRead() {
    if (!user) return;
    const unread = items.filter(i => !i.read);
    if (!unread.length) return;

    await (supabase as any).from('notification_reads').upsert(
      unread.map(i => ({
        user_id: user.id,
        source_type: i.type,
        source_id: i.id,
      })),
      { onConflict: 'user_id,source_type,source_id' }
    );

    setItems(prev => prev.map(i => ({ ...i, read: true })));
  }

  async function handleClick(item: NotificationItem) {
    if (!user) return;

    // Mark as read
    if (!item.read) {
      await (supabase as any).from('notification_reads').upsert(
        [{ user_id: user.id, source_type: item.type, source_id: item.id }],
        { onConflict: 'user_id,source_type,source_id' }
      );
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, read: true } : i));
    }

    setOpen(false);
    navigate(item.type === 'announcement' ? '/dashboard/avisos' : '/dashboard/calendario');
  }

  function handleOpen() {
    setOpen(prev => !prev);
  }

  const fmtDate = (d: string) => {
    try {
      return format(new Date(d), "dd 'de' MMM", { locale: ptBR });
    } catch { return d; }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-md hover:bg-accent/10 transition-colors text-foreground/70 hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-heading font-semibold text-sm">Notificações</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Items */}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação recente.
              </div>
            ) : (
              items.map(item => (
                <button
                  key={`${item.type}:${item.id}`}
                  onClick={() => handleClick(item)}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors flex items-start gap-3 ${!item.read ? 'bg-primary/5' : ''}`}
                >
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!item.read ? 'bg-primary' : 'bg-transparent'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug font-body ${!item.read ? 'font-medium text-foreground' : 'text-foreground/80'}`}>
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span className="capitalize">{item.type === 'announcement' ? 'Aviso' : 'Evento'}</span>
                      <span>·</span>
                      <span>{fmtDate(item.date)}</span>
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
