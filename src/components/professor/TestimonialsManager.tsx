import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Testimonial {
  id: string;
  user_id: string;
  content: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  profile?: { full_name: string | null; email: string };
}

export default function TestimonialsManager({ userId }: { userId: string }) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setTestimonials(data.map(t => ({
        ...t,
        profile: profileMap.get(t.user_id) || { full_name: null, email: '' }
      })));
    } else {
      setTestimonials([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from('testimonials')
      .update({ status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error('Erro ao aprovar.');
    else { toast.success('Testemunho aprovado!'); fetchAll(); }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('testimonials')
      .update({ status: 'rejected', approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error('Erro ao rejeitar.');
    else { toast.success('Testemunho rejeitado.'); fetchAll(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('testimonials').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir.');
    else { toast.success('Testemunho excluído.'); fetchAll(); }
  };

  const pending = testimonials.filter(t => t.status === 'pending');
  const approved = testimonials.filter(t => t.status === 'approved');
  const rejected = testimonials.filter(t => t.status === 'rejected');

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-600">Aprovado</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejeitado</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const renderList = (list: Testimonial[], showActions: boolean) => {
    if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
    if (list.length === 0) return <p className="text-sm text-muted-foreground">Nenhum testemunho.</p>;

    return (
      <div className="space-y-3">
        {list.map(t => (
          <Card key={t.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.profile?.full_name || t.profile?.email || 'Desconhecido'}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {statusBadge(t.status)}
              </div>
              <p className="text-sm whitespace-pre-wrap">{t.content}</p>
              <div className="flex gap-2 justify-end">
                {showActions && (
                  <>
                    <Button size="sm" onClick={() => handleApprove(t.id)}>
                      <Check className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReject(t.id)}>
                      <X className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Gerenciar Testemunhos</h2>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Aprovados ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{renderList(pending, true)}</TabsContent>
        <TabsContent value="approved">{renderList(approved, false)}</TabsContent>
        <TabsContent value="rejected">{renderList(rejected, false)}</TabsContent>
      </Tabs>
    </div>
  );
}
