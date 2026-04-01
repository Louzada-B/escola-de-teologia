import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalToday } from '@/lib/cohortDateUtils';

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
  /** MIN(today, cohort.end_date) */
  effectiveCutoffDate: string;
  isLoading: boolean;
}

const CohortContext = createContext<CohortContextType>({
  cohorts: [],
  selectedCohortId: null,
  setSelectedCohortId: () => {},
  selectedCohortStudentIds: [],
  selectedCohort: null,
  effectiveCutoffDate: getLocalToday(),
  isLoading: false,
});

export const useCohort = () => useContext(CohortContext);

export function CohortProvider({ children }: { children: ReactNode }) {
  const { profile, user, loading: authLoading } = useAuth();
  const isAdminOrProfessor = profile?.role === 'admin' || profile?.role === 'professor';
  const isStudent = profile?.role === 'aluno';

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

  // Admin/professor: load all cohorts
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

  // Student: load their cohort via cohort_students
  const { data: studentCohort, isLoading: studentCohortLoading } = useQuery({
    queryKey: ['student-cohort', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: membership } = await supabase
        .from('cohort_students')
        .select('cohort_id')
        .eq('user_id', user.id);
      if (!membership || membership.length === 0) return null;
      const cohortIds = membership.map(m => m.cohort_id);
      const { data: cohortData } = await supabase
        .from('cohorts')
        .select('*')
        .in('id', cohortIds)
        .eq('is_active', true)
        .order('year', { ascending: false })
        .order('semester', { ascending: false })
        .limit(1);
      return (cohortData && cohortData.length > 0 ? cohortData[0] : null) as Cohort | null;
    },
    enabled: isStudent && !!user?.id,
  });

  // Auto-select for admin/professor
  useEffect(() => {
    if (isAdminOrProfessor && cohorts.length > 0 && !selectedCohortId) {
      const activeCohort = cohorts.find(c => c.is_active);
      if (activeCohort) {
        setSelectedCohortId(activeCohort.id);
      }
    }
  }, [cohorts, selectedCohortId, isAdminOrProfessor]);

  // Auto-set for student – always sync to their actual cohort
  useEffect(() => {
    if (isStudent && studentCohort && selectedCohortId !== studentCohort.id) {
      setSelectedCohortId(studentCohort.id);
    }
  }, [isStudent, studentCohort, selectedCohortId]);

  const { data: selectedCohortStudentIds = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['cohort-students', selectedCohortId, user?.id],
    queryFn: async () => {
      if (!selectedCohortId || !user?.id) return [];
      const { data, error } = await supabase
        .from('cohort_students')
        .select('user_id')
        .eq('cohort_id', selectedCohortId);
      if (error) throw error;
      return data.map(d => d.user_id);
    },
    enabled: !!selectedCohortId && !authLoading && !!user?.id,
  });

  // Resolve selected cohort object
  const selectedCohort = useMemo(() => {
    if (isAdminOrProfessor) {
      return cohorts.find(c => c.id === selectedCohortId) || null;
    }
    if (isStudent && studentCohort && studentCohort.id === selectedCohortId) {
      return studentCohort;
    }
    return null;
  }, [cohorts, selectedCohortId, isAdminOrProfessor, isStudent, studentCohort]);

  const effectiveCutoffDate = useMemo(() => {
    const today = getLocalToday();
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
      isLoading: authLoading || cohortsLoading || studentsLoading || studentCohortLoading,
    }}>
      {children}
    </CohortContext.Provider>
  );
}
