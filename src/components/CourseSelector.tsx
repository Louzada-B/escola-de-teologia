import { useCourse } from '@/contexts/CourseContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen } from 'lucide-react';

export default function CourseSelector() {
  const { profile } = useAuth();
  const { courses, selectedCourseId, setSelectedCourseId } = useCourse();

  if (courses.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">Curso:</span>
      <Select value={selectedCourseId || ''} onValueChange={(v) => setSelectedCourseId(v || null)}>
        <SelectTrigger className="h-8 w-52 text-xs">
          <SelectValue placeholder="Selecionar curso" />
        </SelectTrigger>
        <SelectContent>
          {courses.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
