import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { BookOpen, Download } from 'lucide-react';

export default function AuthPage() {
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setInstallPrompt(null);
  }

  useEffect(() => {
    if (!authLoading && session) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, navigate, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: 'Informe seu e-mail',
        description: 'Digite o e-mail cadastrado para receber o link de recuperação.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/definir-senha`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="font-heading text-2xl">
            {forgotMode ? 'Recuperar senha' : 'Entrar'}
          </CardTitle>
          <CardDescription>
            {forgotMode
              ? 'Informe seu e-mail para receber um link de redefinição de senha.'
              : 'Portal de Teologia — Acesse sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forgotMode ? (
            resetSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Se houver uma conta com o e-mail <strong>{email}</strong>, você vai receber um link
                  para redefinir sua senha.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setForgotMode(false);
                    setResetSent(false);
                  }}
                >
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
                <button
                 type="button"
                  className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
                  onClick={() => setForgotMode(false)}
                >
                  Voltar para o login
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Carregando...' : 'Entrar'}
              </Button>
              <button
               type="button"
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
                onClick={() => setForgotMode(true)}
              >
                Esqueci minha senha
              </button>
            </form>
          )}
        </CardContent>

        {/* Botão de instalação PWA */}
        {!isInstalled && isMobile && (
          <div className="mt-4 text-center">
            {installPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Instalar app na tela inicial
              </button>
            )}
            {isIOS && !installPrompt && (
              <p className="text-xs text-muted-foreground px-4">
                Para instalar: toque em{' '}
                <span className="font-medium">Compartilhar</span>{' '}
                e depois em{' '}
                <span className="font-medium">"Adicionar à Tela de Início"</span>
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
