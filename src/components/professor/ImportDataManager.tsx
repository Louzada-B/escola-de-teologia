import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type EntityType = 'modules' | 'lessons' | 'calendar_events' | 'quizzes' | 'quiz_questions' | 'cohorts' | 'cohort_students';

interface EntityConfig {
  label: string;
  table: string;
  columns: { key: string; label: string; required: boolean; example: string }[];
  transform?: (row: Record<string, any>, userId: string) => Record<string, any>;
}

const convertTimeFromExcel = (val: any): string | null => {
  if (!val && val !== 0) return null;
  const s = String(val).trim();
  // Já está no formato HH:MM
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  // Número fracionário do Excel (ex: 0.9166... = 22:00)
  const n = Number(val);
  if (!Number.isNaN(n) && n >= 0 && n < 1) {
    const totalMinutes = Math.round(n * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return s;
};

const excelSerialToDateStr = (serial: number): string => {
  // Usa 12h (meio-dia) UTC para evitar problema de timezone: meia-noite UTC
  // seria dia anterior em fusos negativos (Brasil, etc.)
  const d = new Date((serial - 25569) * 86400000 + 12 * 3600000);
  return d.toISOString().slice(0, 10);
};

const formatDateBRPreview = (val: any): string => {
  if (!val) return '';
  const s = String(val).trim();
  // Serial de data Excel (> 30000)
  if (!Number.isNaN(Number(val)) && Number(val) > 30000) {
    const iso = excelSerialToDateStr(Number(val));
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  // Fração de horário Excel (0 a 1)
  const n = Number(val);
  if (!Number.isNaN(n) && n > 0 && n < 1) {
    return convertTimeFromExcel(val) || s;
  }
  return s;
};

const convertDate = (val: any): string | null => {
  if (!val) return null;
  const s = String(val).trim();
  const ddmm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Número serial do Excel — usa meio-dia UTC para evitar problema de timezone
  if (!Number.isNaN(Number(val)) && Number(val) > 30000) {
    return excelSerialToDateStr(Number(val));
  }
  return s;
};

const convertDateTime = (val: any): string | null => {
  if (!val) return null;
  const dateStr = convertDate(val);
  if (!dateStr) return null;
  return `${dateStr}T00:00:00-03:00`;
};

const ENTITIES: Record<EntityType, EntityConfig> = {
  modules: {
    label: 'Módulos',
    table: 'modules',
    columns: [
      { key: 'title', label: 'Título', required: true, example: 'Módulo 1 - Introdução' },
      { key: 'description', label: 'Descrição', required: false, example: 'Descrição do módulo' },
      { key: 'order_index', label: 'Ordem', required: false, example: '1' },
    ],
    transform: (row, userId) => ({
      title: String(row.title || '').trim(),
      description: row.description ? String(row.description).trim() : null,
      order_index: row.order_index ? Number(row.order_index) : 0,
      created_by: userId,
    }),
  },
  lessons: {
    label: 'Aulas',
    table: 'lessons',
    columns: [
      { key: 'title', label: 'Título', required: true, example: 'Aula 1 - Tema' },
      { key: 'module_title', label: 'Título do Módulo', required: true, example: 'Módulo 1 - Introdução' },
      { key: 'description', label: 'Descrição', required: false, example: 'Descrição da aula' },
      { key: 'scheduled_date', label: 'Data (DD/MM/YYYY)', required: false, example: '15/03/2026' },
      { key: 'video_url', label: 'URL do Vídeo', required: false, example: 'https://youtube.com/...' },
      { key: 'professor_name', label: 'Professor', required: false, example: 'Prof. João' },
      { key: 'event_type', label: 'Tipo (aula/aula_especial/aula_sincrona/evento)', required: false, example: 'aula' },
      { key: 'mandatory_attendance', label: 'Presença Obrigatória (sim/não)', required: false, example: 'sim' },
      { key: 'order_index', label: 'Ordem', required: false, example: '1' },
    ],
  },
  calendar_events: {
    label: 'Eventos do Calendário',
    table: 'calendar_events',
    columns: [
      { key: 'title', label: 'Título', required: true, example: 'Prova Final' },
      { key: 'event_date', label: 'Data (DD/MM/YYYY)', required: true, example: '20/06/2026' },
      { key: 'description', label: 'Descrição', required: false, example: 'Prova final do semestre' },
      { key: 'event_type', label: 'Tipo (aula/aula_especial/aula_sincrona/prova/evento)', required: false, example: 'prova' },
    ],
    transform: (row, userId) => ({
      title: String(row.title || '').trim(),
      event_date: convertDate(row.event_date)!,
      description: row.description ? String(row.description).trim() : null,
      event_type: row.event_type ? String(row.event_type).trim() : 'evento',
      created_by: userId,
    }),
  },
  quizzes: {
    label: 'Questionários',
    table: 'quizzes',
    columns: [
      { key: 'title', label: 'Título', required: true, example: 'Quiz - Módulo 1' },
      { key: 'lesson_title', label: 'Título da Aula (opcional)', required: false, example: 'Aula 1 - Tema' },
      { key: 'available_from', label: 'Disponível De (DD/MM/YYYY)', required: false, example: '01/03/2026' },
      { key: 'available_from_time', label: 'Horário De (HH:MM)', required: false, example: '08:00' },
      { key: 'available_until', label: 'Disponível Até (DD/MM/YYYY)', required: false, example: '30/06/2026' },
      { key: 'available_until_time', label: 'Horário Até (HH:MM)', required: false, example: '23:59' },
    ],
  },
  quiz_questions: {
    label: 'Questões de Questionários',
    table: 'quiz_questions',
    columns: [
      { key: 'quiz_title', label: 'Título do Questionário', required: true, example: 'Quiz - Módulo 1' },
      { key: 'question', label: 'Pergunta', required: true, example: 'Qual a capital do Brasil?' },
      { key: 'complement', label: 'Complemento (texto de contexto)', required: false, example: 'Contexto adicional exibido recuado abaixo do enunciado.' },
      { key: 'question_type', label: 'Tipo (objetiva/dissertativa/verdadeiro_falso/ligar_colunas)', required: false, example: 'objetiva' },
      { key: 'options', label: 'Opções (separadas por ;)', required: false, example: 'Brasília;São Paulo;Rio de Janeiro;Salvador' },
      { key: 'correct_option', label: 'Opção Correta (número, começando em 0)', required: false, example: '0' },
      { key: 'expected_text', label: 'Resposta Esperada (dissertativa)', required: false, example: 'Texto de referência para correção.' },
      { key: 'order_index', label: 'Ordem', required: false, example: '1' },
    ],
  },
  cohorts: {
    label: 'Turmas',
    table: 'cohorts',
    columns: [
      { key: 'name', label: 'Nome', required: true, example: 'Turma 2026/1' },
      { key: 'year', label: 'Ano', required: true, example: '2026' },
      { key: 'semester', label: 'Semestre', required: true, example: '1' },
      { key: 'start_date', label: 'Data Início (DD/MM/YYYY)', required: true, example: '01/02/2026' },
      { key: 'end_date', label: 'Data Fim (DD/MM/YYYY)', required: true, example: '30/06/2026' },
      { key: 'is_active', label: 'Ativa (sim/não)', required: false, example: 'sim' },
    ],
    transform: (row) => ({
      name: String(row.name || '').trim(),
      year: Number(row.year),
      semester: Number(row.semester),
      start_date: convertDate(row.start_date)!,
      end_date: convertDate(row.end_date)!,
      is_active: row.is_active ? String(row.is_active).toLowerCase().startsWith('s') || String(row.is_active).toLowerCase() === 'true' : true,
    }),
  },
  cohort_students: {
    label: 'Alunos nas Turmas',
    table: 'cohort_students',
    columns: [
      { key: 'cohort_name', label: 'Nome da Turma', required: true, example: 'Turma 2026/1' },
      { key: 'student_email', label: 'Email do Aluno', required: true, example: 'aluno@email.com' },
    ],
  },
};

interface PreviewRow {
  data: Record<string, any>;
  errors: string[];
  index: number;
}

export default function ImportDataManager({ userId }: { userId: string }) {
  const [entity, setEntity] = useState<EntityType | ''>('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: { row: number; msg: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const config = entity ? ENTITIES[entity] : null;

  const downloadTemplate = useCallback(() => {
    if (!config || !entity) return;
    const headers = config.columns.map(c => c.label);
    let exampleRows: any[][];

    if (entity === 'quiz_questions') {
      exampleRows = [
        // quiz_title | question | complement | question_type | options | correct_option | expected_text | order_index
        ['Quiz - Módulo 1', 'Qual a capital do Brasil?', '', 'objetiva', 'Brasília;São Paulo;Rio de Janeiro;Salvador', '0', '', '1'],
        ['Quiz - Módulo 1', 'Explique o conceito de cidadania.', '', 'dissertativa', '', '', 'Cidadania é o exercício dos direitos e deveres civis, políticos e sociais.', '2'],
        ['Quiz - Módulo 1', 'Marque V ou F para cada afirmação:', 'Considere o contexto do Brasil atual.', 'verdadeiro_falso', 'O Brasil é uma república;A capital é São Paulo;O país tem 26 estados', '', '{"0":"verdadeiro","1":"falso","2":"verdadeiro"}', '3'],
        ['Quiz - Módulo 1', 'Ligue cada país à sua capital:', '', 'ligar_colunas', '[{"left":"Brasil","right":"Brasília"},{"left":"Argentina","right":"Buenos Aires"}]', '', '', '4'],
      ];
    } else {
      exampleRows = [config.columns.map(c => c.example)];
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    const maxWidths = config.columns.map((c, i) => {
      let max = Math.max(c.label.length, 15);
      exampleRows.forEach(row => {
        const cellLen = String(row[i] || '').length;
        if (cellLen > max) max = cellLen;
      });
      return { wch: Math.min(max, 50) };
    });
    ws['!cols'] = maxWidths;
    XLSX.writeFile(wb, `modelo_${entity}.xlsx`);
  }, [config, entity]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !config) return;
    setResult(null);

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Map header labels to keys
    const labelToKey: Record<string, string> = {};
    config.columns.forEach(c => {
      labelToKey[c.label.toLowerCase().trim()] = c.key;
      labelToKey[c.key.toLowerCase().trim()] = c.key;
    });

    const mapped: PreviewRow[] = jsonRows.map((raw, idx) => {
      const row: Record<string, any> = {};
      Object.entries(raw).forEach(([header, val]) => {
        const key = labelToKey[header.toLowerCase().trim()];
        if (key) row[key] = val;
      });
      const errors: string[] = [];
      config.columns.filter(c => c.required).forEach(c => {
        if (!row[c.key] && row[c.key] !== 0) errors.push(`"${c.label}" é obrigatório`);
      });
      return { data: row, errors, index: idx + 2 };
    });

    setPreviewRows(mapped);
    if (fileRef.current) fileRef.current.value = '';
  }, [config]);

  const doImport = useCallback(async () => {
    if (!config || !entity || previewRows.length === 0) return;
    setImporting(true);
    const successes: number[] = [];
    const errors: { row: number; msg: string }[] = [];

    // Pre-fetch lookup data for entities that need reference resolution
    let modulesMap: Record<string, string> = {};
    let lessonsMap: Record<string, string> = {};
    let cohortsMap: Record<string, string> = {};
    let quizzesMap: Record<string, string> = {};
    let profilesMap: Record<string, string> = {};

    try {
      if (entity === 'lessons') {
        const { data } = await supabase.from('modules').select('id, title');
        (data || []).forEach(m => { modulesMap[m.title.toLowerCase().trim()] = m.id; });
      }
      if (entity === 'quizzes') {
        const { data } = await supabase.from('lessons').select('id, title');
        (data || []).forEach(l => { lessonsMap[l.title.toLowerCase().trim()] = l.id; });
      }
      if (entity === 'quiz_questions') {
        const { data } = await supabase.from('quizzes').select('id, title');
        (data || []).forEach(q => { quizzesMap[q.title.toLowerCase().trim()] = q.id; });
      }
      if (entity === 'cohort_students') {
        const { data: cData } = await supabase.from('cohorts').select('id, name');
        (cData || []).forEach(c => { cohortsMap[c.name.toLowerCase().trim()] = c.id; });
        const { data: pData } = await supabase.from('profiles').select('id, email');
        (pData || []).forEach(p => { profilesMap[p.email.toLowerCase().trim()] = p.id; });
      }
    } catch {
      // continue
    }

    for (const pr of previewRows) {
      if (pr.errors.length > 0) {
        errors.push({ row: pr.index, msg: pr.errors.join('; ') });
        continue;
      }
      try {
        let record: Record<string, any>;

        if (entity === 'lessons') {
          const moduleKey = String(pr.data.module_title || '').toLowerCase().trim();
          const moduleId = modulesMap[moduleKey];
          if (!moduleId) { errors.push({ row: pr.index, msg: `Módulo "${pr.data.module_title}" não encontrado` }); continue; }
          const att = pr.data.mandatory_attendance;
          record = {
            title: String(pr.data.title || '').trim(),
            module_id: moduleId,
            description: pr.data.description ? String(pr.data.description).trim() : null,
            scheduled_date: pr.data.scheduled_date ? convertDate(pr.data.scheduled_date) : null,
            video_url: pr.data.video_url ? String(pr.data.video_url).trim() : null,
            professor_name: pr.data.professor_name ? String(pr.data.professor_name).trim() : null,
            event_type: pr.data.event_type ? String(pr.data.event_type).trim() : 'aula',
            mandatory_attendance: att ? (String(att).toLowerCase().startsWith('s') || String(att).toLowerCase() === 'true') : true,
            complement: pr.data.complement ? String(pr.data.complement).trim() : null,
            order_index: pr.data.order_index ? Number(pr.data.order_index) : 0,
          };
        } else if (entity === 'quizzes') {
          let lessonId: string | null = null;
          if (pr.data.lesson_title) {
            const key = String(pr.data.lesson_title).toLowerCase().trim();
            lessonId = lessonsMap[key] || null;
            if (!lessonId) { errors.push({ row: pr.index, msg: `Aula "${pr.data.lesson_title}" não encontrada` }); continue; }
          }
          record = {
            title: String(pr.data.title || '').trim(),
            lesson_id: lessonId,
            available_from: pr.data.available_from
              ? `${convertDate(pr.data.available_from)}T${convertTimeFromExcel(pr.data.available_from_time) || '00:00'}:00-03:00`
              : null,
            available_until: pr.data.available_until
              ? `${convertDate(pr.data.available_until)}T${convertTimeFromExcel(pr.data.available_until_time) || '23:59'}:00-03:00`
              : null,
            created_by: userId,
          };
        } else if (entity === 'quiz_questions') {
          const quizKey = String(pr.data.quiz_title || '').toLowerCase().trim();
          const quizId = quizzesMap[quizKey];
          if (!quizId) { errors.push({ row: pr.index, msg: `Questionário "${pr.data.quiz_title}" não encontrado` }); continue; }
          const qType = pr.data.question_type ? String(pr.data.question_type).trim() : 'objetiva';
          const optionsStr = pr.data.options ? String(pr.data.options).trim() : '';

          // Para ligar_colunas o campo options é um JSON de pares [{left,right}]
          // Para os demais tipos é uma lista separada por ;
          let optionsVal: any;
          if (qType === 'ligar_colunas') {
            try { optionsVal = JSON.parse(optionsStr); } catch { optionsVal = []; }
          } else {
            optionsVal = optionsStr ? optionsStr.split(';').map((o: string) => o.trim()) : [];
          }

          // Para verdadeiro_falso: options são as frases, expected_text é o mapa V/F
          // O formato do xlsx usa options separado por ; e correct_option como índices "0,1" para V
          let expectedText = pr.data.expected_text ? String(pr.data.expected_text).trim() : null;
          if (qType === 'verdadeiro_falso' && !expectedText && optionsVal.length > 0) {
            // Tenta derivar o mapa V/F do correct_option (ex: "0,2" = índices verdadeiros)
            const trueIndices = new Set(
              String(pr.data.correct_option || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            );
            const vfMap: Record<string, string> = {};
            optionsVal.forEach((_: any, i: number) => {
              vfMap[String(i)] = trueIndices.has(String(i)) ? 'V' : 'F';
            });
            expectedText = JSON.stringify(vfMap);
          }

          record = {
            quiz_id: quizId,
            question: String(pr.data.question || '').trim(),
            question_type: qType,
            options: optionsVal,
            correct_option: (qType === 'objetiva' && pr.data.correct_option !== '' && pr.data.correct_option != null)
              ? Number(pr.data.correct_option) : null,
            expected_text: expectedText,
            complement: pr.data.complement ? String(pr.data.complement).trim() : null,
            order_index: pr.data.order_index ? Number(pr.data.order_index) : 0,
          };
        } else if (entity === 'cohort_students') {
          const cohortKey = String(pr.data.cohort_name || '').toLowerCase().trim();
          const emailKey = String(pr.data.student_email || '').toLowerCase().trim();
          const cohortId = cohortsMap[cohortKey];
          const studentId = profilesMap[emailKey];
          if (!cohortId) { errors.push({ row: pr.index, msg: `Turma "${pr.data.cohort_name}" não encontrada` }); continue; }
          if (!studentId) { errors.push({ row: pr.index, msg: `Aluno "${pr.data.student_email}" não encontrado` }); continue; }
          record = { cohort_id: cohortId, user_id: studentId };
        } else if (config.transform) {
          record = config.transform(pr.data, userId);
        } else {
          record = { ...pr.data };
        }

        const { error } = await supabase.from(config.table as any).insert(record as any);
        if (error) throw error;
        successes.push(pr.index);
      } catch (err: any) {
        errors.push({ row: pr.index, msg: err.message || 'Erro desconhecido' });
      }
    }

    setResult({ success: successes.length, errors });
    setImporting(false);
    if (errors.length === 0) {
      toast({ title: 'Importação concluída', description: `${successes.length} registro(s) inserido(s) com sucesso.` });
    } else {
      toast({ title: 'Importação parcial', description: `${successes.length} sucesso(s), ${errors.length} erro(s).`, variant: 'destructive' });
    }
  }, [config, entity, previewRows, userId]);

  const validCount = previewRows.filter(r => r.errors.length === 0).length;
  const errorCount = previewRows.filter(r => r.errors.length > 0).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Dados via Planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entity selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Selecione a entidade</p>
            <Select value={entity} onValueChange={(v) => { setEntity(v as EntityType); setPreviewRows([]); setResult(null); }}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Escolha o tipo de dado..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ENTITIES) as [EntityType, EntityConfig][]).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config && (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" /> Baixar Planilha Modelo
              </Button>
              <div>
                <input type="file" accept=".xlsx,.xls" ref={fileRef} className="hidden" onChange={handleFile} />
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Upload Planilha
                </Button>
              </div>
            </div>
          )}

          {/* Columns info */}
          {config && previewRows.length === 0 && !result && (
            <div className="rounded-md border p-3 bg-muted/50 text-sm space-y-1">
              <p className="font-medium">Colunas esperadas:</p>
              <div className="flex flex-wrap gap-2">
                {config.columns.map(c => (
                  <Badge key={c.key} variant={c.required ? 'default' : 'secondary'}>
                    {c.label} {c.required && '*'}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {previewRows.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Prévia da Importação — {previewRows.length} linha(s)
              {errorCount > 0 && <Badge variant="destructive" className="ml-2">{errorCount} com erro</Badge>}
              {validCount > 0 && <Badge className="ml-2">{validCount} válida(s)</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    {config!.columns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map(pr => (
                    <TableRow key={pr.index} className={pr.errors.length > 0 ? 'bg-destructive/10' : ''}>
                      <TableCell>{pr.index}</TableCell>
                      <TableCell>
                        {pr.errors.length > 0
                          ? <span className="text-destructive text-xs" title={pr.errors.join('\n')}><AlertCircle className="h-4 w-4 inline" /> Erro</span>
                          : <span className="text-xs"><CheckCircle className="h-4 w-4 inline text-primary" /> OK</span>
                        }
                      </TableCell>
                      {config!.columns.map(c => (
                        <TableCell key={c.key} className="text-xs max-w-[200px] truncate">
                          {pr.data[c.key] != null ? (c.key.includes('date') || c.key.includes('from') || c.key.includes('until') || c.key.includes('time') ? formatDateBRPreview(pr.data[c.key]) : String(pr.data[c.key])) : '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex gap-3 mt-4">
              <Button onClick={doImport} disabled={importing || validCount === 0}>
                {importing ? 'Importando...' : `Confirmar Importação (${validCount} registro(s))`}
              </Button>
              <Button variant="outline" onClick={() => { setPreviewRows([]); setResult(null); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <Badge>{result.success}</Badge> registro(s) inserido(s) com sucesso.
            </p>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">{result.errors.length} erro(s):</p>
                <ScrollArea className="max-h-[200px]">
                  <ul className="text-xs space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-destructive">Linha {e.row}: {e.msg}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => { setPreviewRows([]); setResult(null); }}>
              Nova Importação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
