import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { UserPlus, Upload, Download, CheckCircle, AlertCircle, Loader2, Send, Search } from "lucide-react";

export default function StudentsManager() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [bulkCohortId, setBulkCohortId] = useState("");
  const [previewRows, setPreviewRows] = useState<{ email: string; full_name: string; error?: string }[]>([]);
  const [bulkResult, setBulkResult] = useState<{ successCount: number; errorCount: number; results: any[] } | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [resendCohortId, setResendCohortId] = useState("");
  const [pendingList, setPendingList] = useState<{ id: string; email: string; full_name: string }[] | null>(null);
  const [pendingSearch, setPendingSearch] = useState("");
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<{ successCount: number; errorCount: number; results: any[] } | null>(null);

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cohorts")
        .select("*")
        .order("year", { ascending: false })
        .order("semester", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["all-students-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("role", "aluno")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: cohortStudents = [] } = useQuery({
    queryKey: ["all-cohort-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cohort_students").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: statusMap = {} } = useQuery({
    queryKey: ["students-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("students-status");
      if (error) throw error;
      return data.statuses as Record<string, { confirmed_at: string | null; last_sign_in_at: string | null }>;
    },
  });

  const inviteStudent = async () => {
    if (!email.trim() || !cohortId) {
      toast.error("Preencha e-mail e selecione uma turma.");
      return;
    }
    setInviting(true);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || 'https://formacaoteologica.brasachurch.com';
      const { data, error } = await supabase.functions.invoke("invite-student", {
        body: {
          students: [{ email: email.trim(), full_name: fullName.trim(), cohort_id: cohortId }],
          redirectTo: `${appUrl}/definir-senha`,
        },
      });
      if (error) throw error;
      if (data.errorCount > 0) {
        toast.error(`Erro: ${data.results[0]?.error || "Falha ao convidar"}`);
      } else {
        toast.success(`Convite enviado para ${email}`);
        setEmail("");
        setFullName("");
        queryClient.invalidateQueries({ queryKey: ["all-students-profiles"] });
        queryClient.invalidateQueries({ queryKey: ["all-cohort-students"] });
      }
    } catch (err: any) {
      toast.error("Erro ao convidar: " + err.message);
    } finally {
      setInviting(false);
    }
  };

  const downloadTemplate = useCallback(() => {
    const headers = ["Nome Completo", "E-mail"];
    const example = [["João da Silva", "joao@email.com"]];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
    ws["!cols"] = [{ wch: 30 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alunos");
    XLSX.writeFile(wb, "modelo_alunos.xlsx");
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkResult(null);
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const mapped = rows.map((row) => {
      const email = String(row["E-mail"] || row["email"] || row["Email"] || "").trim();
      const full_name = String(row["Nome Completo"] || row["nome_completo"] || row["full_name"] || row["Nome"] || "").trim();
      return {
        email,
        full_name,
        error: !email ? "E-mail é obrigatório" : undefined,
      };
    });
    setPreviewRows(mapped);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const doBulkImport = async () => {
    if (!bulkCohortId) {
      toast.error("Selecione uma turma para a importação em lote.");
      return;
    }
    const validRows = previewRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast.error("Nenhum aluno válido para importar.");
      return;
    }
    setBulkImporting(true);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || 'https://formacaoteologica.brasachurch.com';
      const { data, error } = await supabase.functions.invoke("invite-student", {
        body: {
          students: validRows.map((r) => ({ email: r.email, full_name: r.full_name, cohort_id: bulkCohortId })),
          redirectTo: `${appUrl}/definir-senha`,
        },
      });
      if (error) throw error;
      setBulkResult(data);
      queryClient.invalidateQueries({ queryKey: ["all-students-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-cohort-students"] });
      if (data.errorCount === 0) {
        toast.success(`${data.successCount} aluno(s) convidado(s) com sucesso!`);
      } else {
        toast.warning(`${data.successCount} sucesso(s), ${data.errorCount} erro(s).`);
      }
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setBulkImporting(false);
    }
  };

  const getCohortName = (cId: string) => cohorts.find((c) => c.id === cId)?.name || "";

  const getStudentCohorts = (userId: string) => {
    return cohortStudents
      .filter((cs) => cs.user_id === userId)
      .map((cs) => getCohortName(cs.cohort_id))
      .filter(Boolean);
  };

  const hasStudentAccessed = (userId: string) => Boolean(statusMap[userId]?.last_sign_in_at);

  const listPending = () => {
    if (!resendCohortId) {
      toast.error("Selecione uma turma.");
      return;
    }
    const memberIds = new Set(
      cohortStudents.filter((cs) => cs.cohort_id === resendCohortId).map((cs) => cs.user_id)
    );
    const pending = students
      .filter((s) => memberIds.has(s.id) && !hasStudentAccessed(s.id))
      .map((s) => ({ id: s.id, email: s.email, full_name: s.full_name || "" }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
    setPendingList(pending);
    setPendingSearch("");
    setSelectedPending(new Set(pending.map((p) => p.id)));
    setResendResult(null);
  };

  const filteredPendingList = (pendingList || []).filter((p) => {
    const q = pendingSearch.trim().toLowerCase();
    if (!q) return true;
    return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  const togglePending = (id: string) => {
    setSelectedPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPending = () => {
    const visibleIds = filteredPendingList.map((p) => p.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedPending.has(id));
    setSelectedPending((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => (allVisibleSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const doResendPending = async () => {
    if (!pendingList || selectedPending.size === 0) {
      toast.error("Selecione ao menos um aluno.");
      return;
    }
    setResending(true);
    setResendResult(null);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || "https://formacaoteologica.brasachurch.com";
      const toResend = pendingList.filter((p) => selectedPending.has(p.id));
      const { data, error } = await supabase.functions.invoke("invite-student", {
        body: {
          students: toResend.map((p) => ({ email: p.email, full_name: p.full_name, cohort_id: resendCohortId })),
          redirectTo: `${appUrl}/definir-senha`,
        },
      });
      if (error) throw error;
      setResendResult(data);
      queryClient.invalidateQueries({ queryKey: ["students-status"] });
      if (data.errorCount === 0) {
        toast.success(`${data.successCount} convite(s) reenviado(s)!`);
      } else {
        toast.warning(`${data.successCount} sucesso(s), ${data.errorCount} erro(s).`);
      }
      setPendingList(null);
      setSelectedPending(new Set());
    } catch (err: any) {
      toast.error("Erro ao reenviar: " + (err?.message || "Erro desconhecido"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Individual invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-5 h-5" />
            Cadastrar Aluno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input placeholder="Nome do aluno" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" placeholder="aluno@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Turma</Label>
            <Select value={cohortId} onValueChange={setCohortId}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Selecione a turma..." />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.is_active ? "" : "(Inativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={inviteStudent} disabled={inviting} className="gap-2">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {inviting ? "Enviando convite..." : "Cadastrar e Enviar Convite"}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-5 h-5" />
            Importar Alunos via Planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Turma para importação</Label>
            <Select value={bulkCohortId} onValueChange={setBulkCohortId}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Selecione a turma..." />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.is_active ? "" : "(Inativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
              <Download className="w-4 h-4" /> Baixar Modelo
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
              <Upload className="w-4 h-4" /> Selecionar Arquivo
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>

          {previewRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {previewRows.filter((r) => !r.error).length} válido(s)
                </Badge>
                {previewRows.some((r) => r.error) && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {previewRows.filter((r) => r.error).length} com erro
                  </Badge>
                )}
              </div>
              <ScrollArea className="max-h-60 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{row.full_name || "-"}</TableCell>
                        <TableCell className="text-sm">{row.email || "-"}</TableCell>
                        <TableCell>
                          {row.error ? (
                            <span className="text-xs text-destructive">{row.error}</span>
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <Button onClick={doBulkImport} disabled={bulkImporting || !bulkCohortId} className="gap-2">
                {bulkImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {bulkImporting ? "Importando..." : "Importar e Enviar Convites"}
              </Button>
            </div>
          )}

          {bulkResult && (
            <div className="p-3 rounded-md bg-muted text-sm space-y-1">
              <p className="font-medium">
                Resultado: {bulkResult.successCount} sucesso(s), {bulkResult.errorCount} erro(s)
              </p>
              {bulkResult.results
                .filter((r: any) => !r.success)
                .map((r: any, i: number) => (
                  <p key={i} className="text-destructive text-xs">
                    {r.email}: {r.error}
                  </p>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resend pending invites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="w-5 h-5" />
            Reenviar Convites Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Turma</Label>
              <Select value={resendCohortId} onValueChange={(v) => { setResendCohortId(v); setPendingList(null); }}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione a turma..." />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.is_active ? "" : "(Inativa)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={listPending} disabled={!resendCohortId}>
              Listar pendentes
            </Button>
          </div>

          {pendingList && (
            <div className="space-y-3">
              {pendingList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguém pendente nessa turma — todo mundo já confirmou o acesso.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou e-mail..."
                      value={pendingSearch}
                      onChange={(e) => setPendingSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={toggleAllPending}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {filteredPendingList.length > 0 && filteredPendingList.every((p) => selectedPending.has(p.id))
                        ? "Desmarcar todos"
                        : "Selecionar todos"}
                    </button>
                    <Badge variant="outline">{selectedPending.size} de {pendingList.length} selecionado(s)</Badge>
                  </div>
                  <div className="max-h-96 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPendingList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                              Nenhum aluno pendente bate com essa busca.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredPendingList.map((p) => (
                            <TableRow key={p.id} className="cursor-pointer" onClick={() => togglePending(p.id)}>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedPending.has(p.id)}
                                  onCheckedChange={() => togglePending(p.id)}
                                />
                              </TableCell>
                              <TableCell className="text-sm whitespace-nowrap">{p.full_name || "-"}</TableCell>
                              <TableCell className="text-sm whitespace-nowrap">{p.email}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={doResendPending} disabled={resending || selectedPending.size === 0} className="gap-2">
                    {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {resending ? "Reenviando..." : `Reenviar convite (${selectedPending.size})`}
                  </Button>
                </>
              )}
            </div>
          )}

          {resendResult && (
            <div className="p-3 rounded-md bg-muted text-sm space-y-1">
              <p className="font-medium">
                Resultado: {resendResult.successCount} sucesso(s), {resendResult.errorCount} erro(s)
              </p>
              {resendResult.results
                .filter((r: any) => !r.success)
                .map((r: any, i: number) => (
                  <p key={i} className="text-destructive text-xs">
                    {r.email}: {r.error}
                  </p>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alunos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {studentsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno cadastrado.</p>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="min-w-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Turma(s)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm whitespace-nowrap">{s.full_name || "-"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{s.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getStudentCohorts(s.id).map((name, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
