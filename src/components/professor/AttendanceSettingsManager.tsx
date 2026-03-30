import { useEffect, useState, useMemo, useCallback } from 'react';
import { useCohort } from '@/contexts/CohortContext';
import { supabase } from '@/integrations/supabase/client';
import { getLocalToday } from '@/lib/cohortDateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { MapPin, Save, Eye, Search, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface Props {
  userId: string;
}

interface StudentStats {
  id: string;
  name: string;
  aulaTotal: number;
  aulaPresent: number;
  especialTotal: number;
  especialPresent: number;
}

export default function AttendanceSettingsManager({ userId }: Props) {
  const { selectedCohortId, selectedCohortStudentIds, selectedCohort, effectiveCutoffDate } = useCohort();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('200');
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [records, setRecords] = useState<{ user_id: string; lesson_id: string; id: string }[]>([]);

  // Modal state
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [savingAttendance, setSavingAttendance] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [effectiveCutoffDate, selectedCohortId]);

  async function load() {
    const today = getLocalToday();

    const [settingsRes, lessonsRes, recordsRes, profilesRes] = await Promise.all([
      supabase.from('attendance_settings').select('*').limit(1).maybeSingle(),
      supabase.from('lessons').select('id, title, scheduled_date, event_type, mandatory_attendance').lte('scheduled_date', effectiveCutoffDate).order('scheduled_date', { ascending: false }),
      supabase.from('attendance_records').select('id, user_id, lesson_id'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'aluno'),
    ]);

    if (settingsRes.data) {
      setLatitude(String(settingsRes.data.latitude));
      setLongitude(String(settingsRes.data.longitude));
      setRadius(String(settingsRes.data.radius_meters));
      setExistingId(settingsRes.data.id);
    }
    if (lessonsRes.data) {
      // Filter by cohort start_date if applicable
      const startDate = selectedCohort?.start_date;
      const filtered = startDate
        ? lessonsRes.data.filter((l: any) => l.scheduled_date >= startDate)
        : lessonsRes.data;
      setLessons(filtered);
    }
    if (recordsRes.data) setRecords(recordsRes.data);
    if (profilesRes.data) {
      // Filter students by cohort
      const filteredProfiles = selectedCohortId && selectedCohortStudentIds.length > 0
        ? profilesRes.data.filter((p: any) => selectedCohortStudentIds.includes(p.id))
        : selectedCohortId
        ? []
        : profilesRes.data;
      setStudents(filteredProfiles.map((p: any) => ({ id: p.id, name: p.full_name || p.email })));
    }
    setLoading(false);
  }

  const handleSave = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseInt(radius);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast({ title: 'Erro', description: 'Coordenadas inválidas.', variant: 'destructive' });
      return;
    }
    if (isNaN(rad) || rad < 10 || rad > 5000) {
      toast({ title: 'Erro', description: 'Raio deve ser entre 10 e 5000 metros.', variant: 'destructive' });
      return;
    }

    if (existingId) {
      const { error } = await supabase.from('attendance_settings').update({
        latitude: lat, longitude: lng, radius_meters: rad, updated_by: userId, updated_at: new Date().toISOString(),
      }).eq('id', existingId);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { data, error } = await supabase.from('attendance_settings').insert({
        latitude: lat, longitude: lng, radius_meters: rad, updated_by: userId,
      }).select().single();
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      if (data) setExistingId(data.id);
    }
    toast({ title: 'Salvo!', description: 'Localização da aula atualizada.' });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Erro', description: 'Geolocalização não suportada.', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        toast({ title: 'Localização obtida', description: 'Coordenadas preenchidas automaticamente.' });
      },
      () => toast({ title: 'Erro', description: 'Não foi possível obter localização.', variant: 'destructive' }),
      { enableHighAccuracy: true }
    );
  };

  // Compute stats
  const aulaLessons = useMemo(() => lessons.filter(l => l.event_type?.toLowerCase() === 'aula'), [lessons]);
  const especialLessons = useMemo(() => lessons.filter(l => l.event_type?.toLowerCase() === 'aula_especial'), [lessons]);

  const recordSet = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => set.add(`${r.user_id}::${r.lesson_id}`));
    return set;
  }, [records]);

  const studentStats: StudentStats[] = useMemo(() => {
    return students.map(s => {
      const aulaPresent = aulaLessons.filter(l => recordSet.has(`${s.id}::${l.id}`)).length;
      const especialPresent = especialLessons.filter(l => recordSet.has(`${s.id}::${l.id}`)).length;
      return {
        id: s.id,
        name: s.name,
        aulaTotal: aulaLessons.length,
        aulaPresent,
        especialTotal: especialLessons.length,
        especialPresent,
      };
    });
  }, [students, aulaLessons, especialLessons, recordSet]);

  // Modal lessons for selected student
  const modalLessons = useMemo(() => {
    if (!selectedStudent) return [];
    return lessons.map(l => ({
      ...l,
      present: recordSet.has(`${selectedStudent.id}::${l.id}`),
    }));
  }, [selectedStudent, lessons, recordSet]);

  const toggleAttendance = async (lessonId: string, currentlyPresent: boolean) => {
    if (!selectedStudent) return;
    setSavingAttendance(lessonId);

    if (currentlyPresent) {
      // Delete the record
      const record = records.find(r => r.user_id === selectedStudent.id && r.lesson_id === lessonId);
      if (record) {
        const { error } = await supabase.from('attendance_records').delete().eq('id', record.id);
        if (error) {
          toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          setSavingAttendance(null);
          return;
        }
        setRecords(prev => prev.filter(r => r.id !== record.id));
      }
    } else {
      // Insert a record (professor manual — use 0,0 coords)
      const { data, error } = await supabase.from('attendance_records').insert({
        user_id: selectedStudent.id,
        lesson_id: lessonId,
        latitude: 0,
        longitude: 0,
      }).select('id, user_id, lesson_id').single();
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        setSavingAttendance(null);
        return;
      }
      if (data) setRecords(prev => [...prev, data]);
    }
    setSavingAttendance(null);
  };

  const pct = (n: number, total: number) => total === 0 ? '—' : `${Math.round((n / total) * 100)}%`;

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Local da Aula</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Latitude</Label>
              <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-23.5505" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-46.6333" />
            </div>
            <div>
              <Label>Raio (metros)</Label>
              <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} min="10" max="5000" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleUseMyLocation}>
              <MapPin className="w-4 h-4 mr-2" /> Usar minha localização
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" /> Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Resumo de Presença por Aluno</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-muted-foreground font-body">Nenhum aluno cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Aluno</TableHead>
                  <TableHead className="text-center">% Aulas</TableHead>
                  <TableHead className="text-center">% Especiais</TableHead>
                  <TableHead className="text-center">Presenças (Aulas)</TableHead>
                  <TableHead className="text-center">Presenças (Especiais)</TableHead>
                  <TableHead className="text-center">Faltas (Aulas)</TableHead>
                  <TableHead className="text-center">Faltas (Especiais)</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentStats.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center">{pct(s.aulaPresent, s.aulaTotal)}</TableCell>
                    <TableCell className="text-center">{pct(s.especialPresent, s.especialTotal)}</TableCell>
                    <TableCell className="text-center">{s.aulaPresent}/{s.aulaTotal}</TableCell>
                    <TableCell className="text-center">{s.especialPresent}/{s.especialTotal}</TableCell>
                    <TableCell className="text-center">{s.aulaTotal - s.aulaPresent}</TableCell>
                    <TableCell className="text-center">{s.especialTotal - s.especialPresent}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => setSelectedStudent({ id: s.id, name: s.name })}>
                        <Eye className="w-4 h-4 mr-1" /> Ver Aulas
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Student Detail Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Aulas — {selectedStudent?.name}</DialogTitle>
          </DialogHeader>
          {modalLessons.length === 0 ? (
            <p className="text-muted-foreground font-body">Nenhuma aula disponível.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aula</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Presença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalLessons.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell>
                      <Badge variant={l.event_type === 'Aula' ? 'default' : 'secondary'}>
                        {l.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(l.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-center">
                      {l.present ? (
                        <Badge className="bg-green-600 text-white">Presente</Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/50 text-destructive">Ausente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={l.present}
                        disabled={savingAttendance === l.id}
                        onCheckedChange={() => toggleAttendance(l.id, l.present)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
