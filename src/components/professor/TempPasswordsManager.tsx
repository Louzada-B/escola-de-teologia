import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Eye, EyeOff, Copy, Check, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TempPasswordItem {
  user_id: string;
  full_name: string;
  email: string;
  last_sign_in_at: string | null;
  pass_temp: string;
}

export default function TempPasswordsManager() {
  const [items, setItems] = useState<TempPasswordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("list-temp-passwords");
    if (error) {
      toast.error("Erro ao carregar senhas temporárias: " + (error.message || "erro desconhecido"));
    } else {
      setItems(data?.items || []);
    }
    setLoading(false);
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyPassword = async (id: string, password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const filtered = [...items]
    .filter((i) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return i.full_name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q);
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Senhas Temporárias</CardTitle>
        <p className="text-sm text-muted-foreground">
          Alunos que ainda não trocaram a senha gerada no convite.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma senha temporária pendente — todo mundo já trocou a própria senha.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 bg-card z-10">
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead>Senha temporária</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                        Ninguém bate com essa busca.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.user_id}>
                        <TableCell className="text-sm whitespace-nowrap">{item.full_name || "-"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{item.email}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {item.last_sign_in_at
                            ? new Date(item.last_sign_in_at).toLocaleString("pt-BR")
                            : "Nunca acessou"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="min-w-[70px] inline-block">
                              {revealed.has(item.user_id) ? item.pass_temp : "••••••"}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => toggleReveal(item.user_id)}
                              title={revealed.has(item.user_id) ? "Ocultar" : "Revelar"}
                            >
                              {revealed.has(item.user_id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => copyPassword(item.user_id, item.pass_temp)}
                              title="Copiar"
                            >
                              {copiedId === item.user_id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
