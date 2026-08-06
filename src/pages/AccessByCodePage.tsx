import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, BookOpen } from "lucide-react";

export default function AccessByCodePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
        return;
      }
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        toast.error("Não foi possível iniciar o acesso. Recarregue a página e tente de novo.");
        return;
      }
      setSessionReady(true);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !fullName.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("join-by-code", {
        body: { code: code.trim(), full_name: fullName.trim() },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Código inválido. Confira com quem te passou o código.");
        setLoading(false);
        return;
      }
      sessionStorage.setItem("codeAccessInfo", JSON.stringify(data));
      navigate("/acesso/turma");
    } catch (err: any) {
      toast.error("Erro ao entrar: " + (err?.message || "tente novamente"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 font-body">
      <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-accent" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-accent font-semibold">Escola de Teologia</p>
            <h1 className="font-heading text-2xl font-semibold text-foreground mt-1">Entrar no curso</h1>
            <p className="text-sm text-muted-foreground mt-1">Digite seu nome e o código que você recebeu</p>
          </div>
        </div>

        <Card className="card-academic">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Seu nome</Label>
                <Input
                  placeholder="Nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Código de acesso</Label>
                <Input
                  placeholder="Ex: ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="uppercase tracking-widest text-center font-mono text-lg"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
