import { useCohort } from '@/contexts/CohortContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

export default function CohortSelector() {
  const { profile } = useAuth();
  const { cohorts, selectedCohortId, setSelectedCohortId } = useCohort();
  const isAdminOrProfessor = profile?.role === 'admin' || profile?.role === 'professor';

  if (!isAdminOrProfessor || cohorts.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Turma:</span>
      <Select value={selectedCohortId || ''} onValueChange={(v) => setSelectedCohortId(v || null)}>
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue placeholder="Todas as turmas" />
        </SelectTrigger>
        <SelectContent>
          {cohorts.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} {c.is_active ? '●' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
