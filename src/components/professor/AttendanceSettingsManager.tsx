import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { MapPin, Save } from 'lucide-react';

interface Props {
  userId: string;
}

export default function AttendanceSettingsManager({ userId }: Props) {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('200');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const [settingsRes, recordsRes, lessonsRes, profilesRes] = await Promise.all([
        supabase.from('attendance_settings').select('*').limit(1).maybeSingle(),
        supabase.from('attendance_records').select('*').order('checked_in_at', { ascending: false }).limit(100),
        supabase.from('lessons').select('id, title, scheduled_date'),
        supabase.from('profiles').select('id, full_name, email'),
      ]);

      if (settingsRes.data) {
        setLatitude(String(settingsRes.data.latitude));
        setLongitude(String(settingsRes.data.longitude));
        setRadius(String(settingsRes.data.radius_meters));
        setExistingId(settingsRes.data.id);
      }
      if (recordsRes.data) setRecords(recordsRes.data);
      if (lessonsRes.data) setLessons(lessonsRes.data);
      if (profilesRes.data) {
        const map: Record<string, string> = {};
        profilesRes.data.forEach((p: any) => { map[p.id] = p.full_name || p.email; });
        setProfiles(map);
      }
      setLoading(false);
    }
    load();
  }, []);

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

  const getLessonTitle = (id: string) => lessons.find((l) => l.id === id)?.title || 'Aula desconhecida';

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
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

      <Card className="card-academic">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Registros de Presença</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-muted-foreground font-body">Nenhum registro de presença encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Aluno</th>
                    <th className="text-left py-2 font-medium">Aula</th>
                    <th className="text-left py-2 font-medium">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2">{profiles[r.user_id] || r.user_id}</td>
                      <td className="py-2">{getLessonTitle(r.lesson_id)}</td>
                      <td className="py-2">{new Date(r.checked_in_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
