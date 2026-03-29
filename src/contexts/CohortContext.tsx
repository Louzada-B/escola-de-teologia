import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Cohort {
  id: string;
  name: string;
  year: number;
  semester: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface CohortContextType {
  cohorts: Cohort[];
  selectedCohortId: string | null;
  setSelectedCohortId: (id: string | null) => void;
  selectedCohortStudentIds: string[];
  selectedCohort: Cohort | null;
  /** The effective cutoff date for "past lessons": MIN(today, cohort.end_date) */
  effectiveCutoffDate: string;
  isLoading: boolean;
}

const CohortContext = createContext<CohortContextType>({
  cohorts: [],
  selectedCohortId: null,
  setSelectedCohortId: () => {},
  selectedCohortStudentIds: [],
  selectedCohort: null,
  effectiveCutoffDate: new Date().toISOString().split('T')[0],
  isLoading: false,
});

export const useCohort = () => useContext(CohortContext);

export function CohortProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const isAdminOrProfessor = profile?.role === 'admin' || profile?.role === 'professor';

  const [selectedCohortId, setSelectedCohortIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedCohortId');
    }
    return null;
  });

  const setSelectedCohortId = (id: string | null) => {
    setSelectedCohortIdState(id);
    if (id) {
      localStorage.setItem('selectedCohortId', id);
    } else {
      localStorage.removeItem('selectedCohortId');
    }
  };

  const { data: cohorts = [], isLoading: cohortsLoading } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cohorts')
        .select('*')
        .order('year', { ascending: false })
        .order('semester', { ascending: false });
      if (error) throw error;
      return data as Cohort[];
    },
    enabled: isAdminOrProfessor,
  });

  // Auto-select first active cohort if none selected
  useEffect(() => {
    if (cohorts.length > 0 && !selectedCohortId) {
      const activeCohort = cohorts.find(c => c.is_active);
      if (activeCohort) {
        setSelectedCohortId(activeCohort.id);
      }
    }
  }, [cohorts, selectedCohortId]);

  const { data: selectedCohortStudentIds = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['cohort-students', selectedCohortId],
    queryFn: async () => {
      if (!selectedCohortId) return [];
      const { data, error } = await supabase
        .from('cohort_students')
        .select('user_id')
        .eq('cohort_id', selectedCohortId);
      if (error) throw error;
      return data.map(d => d.user_id);
    },
    enabled: !!selectedCohortId && isAdminOrProfessor,
  });

  const selectedCohort = cohorts.find(c => c.id === selectedCohortId) || null;

  const effectiveCutoffDate = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    if (!selectedCohort) return today;
    return selectedCohort.end_date < today ? selectedCohort.end_date : today;
  }, [selectedCohort]);

  return (
    <CohortContext.Provider value={{
      cohorts,
      selectedCohortId,
      setSelectedCohortId,
      selectedCohortStudentIds,
      selectedCohort,
      effectiveCutoffDate,
      isLoading: cohortsLoading || studentsLoading,
    }}>
      {children}
    </CohortContext.Provider>
  );
}
