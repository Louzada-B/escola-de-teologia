import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LogIn, Search } from 'lucide-react';

interface AccessLog {
  id: string;
  user_id: string;
  accessed_at: string;
  access_date: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  professor: 'Professor',
  aluno: 'Aluno',
};

export default function AccessChart() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: accessLogs = [], isLoading } = useQuery({
    queryKey: ['access-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('access_logs')
        .select('*')
        .gte('access_date', subDays(new Date(), 30).toISOString().split('T')[0])
        .order('access_date', { ascending: true });
      return (data || []) as AccessLog[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['access-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, role');
      return (data || []) as Profile[];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach(p => map.set(p.id, p));
    return map;
  }, [profiles]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();
    accessLogs.forEach(log => {
      grouped.set(log.access_date, (grouped.get(log.access_date) || 0) + 1);
    });
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date,
        label: format(parseISO(date), 'dd/MM', { locale: ptBR }),
        acessos: count,
      }));
  }, [accessLogs]);

  const modalData = useMemo(() => {
    if (!selectedDate) return [];
    const logsForDate = accessLogs.filter(l => l.access_date === selectedDate);
    const userCounts = new Map<string, number>();
    logsForDate.forEach(l => {
      userCounts.set(l.user_id, (userCounts.get(l.user_id) || 0) + 1);
    });
    return Array.from(userCounts.entries())
      .map(([userId, count]) => {
        const p = profileMap.get(userId);
        return {
          userId,
          name: p?.full_name || p?.email || userId,
          role: p?.role || 'aluno',
          count,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [selectedDate, accessLogs, profileMap]);

  const filteredModalData = useMemo(() => {
    if (!search.trim()) return modalData;
    const q = search.toLowerCase();
    return modalData.filter(u =>
      u.name.toLowerCase().includes(q) ||
      ROLE_LABELS[u.role]?.toLowerCase().includes(q)
    );
  }, [modalData, search]);

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.date) {
      setSelectedDate(data.activePayload[0].payload.date);
      setSearch('');
    }
  };

  if (isLoading) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LogIn className="w-4 h-4 text-muted-foreground" />
            Acessos ao Portal (últimos 30 dias)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Clique em uma barra para ver os usuários do dia</p>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum acesso registrado ainda.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} onClick={handleBarClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`${value}`, 'Acessos']}
                  />
                  <Bar dataKey="acessos" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.date === selectedDate ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.6)'}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDate} onOpenChange={(open) => { if (!open) setSelectedDate(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Acessos em {selectedDate ? format(parseISO(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Acessos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModalData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModalData.map(u => (
                    <TableRow key={u.userId}>
                      <TableCell className="text-sm">{u.name}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : u.role === 'professor' ? 'secondary' : 'outline'} className="text-xs">
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{u.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
