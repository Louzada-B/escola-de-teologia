import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquareHeart, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Testimonial {
  id: string;
  user_id: string;
  content: string;
  status: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

export default function TestimonialsPage() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState<Testimonial[]>([]);
  const [myPending, setMyPending] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTestimonials = async () => {
    setLoading(true);

    // Fetch approved testimonials (visible to all)
    const { data: approvedData } = await supabase
      .from('testimonials')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    // Fetch profile info for approved testimonials
    if (approvedData && approvedData.length > 0) {
      const userIds = [...new Set(approvedData.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setApproved(approvedData.map(t => ({
        ...t,
        profile: profileMap.get(t.user_id) || { full_name: null, avatar_url: null }
      })));
    } else {
      setApproved([]);
    }

    // Fetch user's own pending testimonials
    if (user) {
      const { data: pendingData } = await supabase
        .from('testimonials')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setMyPending(pendingData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTestimonials();
  }, [user]);

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('testimonials').insert({
      user_id: user.id,
      content: content.trim(),
    });
    if (error) {
      toast.error('Erro ao enviar testemunho.');
    } else {
      toast.success('Testemunho enviado! Aguardando aprovação.');
      setContent('');
      fetchTestimonials();
    }
    setSubmitting(false);
  };

  const getInitials = (name: string | null) =>
    (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="page-container space-y-8">
      <h1 className="section-title">Testemunhos</h1>

      {/* Submit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquareHeart className="w-5 h-5 text-primary" />
            Compartilhe seu testemunho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Escreva seu testemunho aqui..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{content.length}/2000</span>
            <Button onClick={handleSubmit} disabled={submitting || !content.trim()}>
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User's pending testimonials */}
      {myPending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Seus testemunhos pendentes
          </h2>
          {myPending.map(t => (
            <Card key={t.id} className="border-dashed opacity-75">
              <CardContent className="pt-4">
                <p className="text-sm whitespace-pre-wrap">{t.content}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary">Pendente</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approved testimonials */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Testemunhos aprovados</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum testemunho aprovado ainda.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {approved.map(t => (
              <Card key={t.id}>
                <CardContent className="pt-6">
                  <p className="text-sm whitespace-pre-wrap mb-4">"{t.content}"</p>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 text-xs">
                      <AvatarImage src={t.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(t.profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{t.profile?.full_name || 'Anônimo'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
