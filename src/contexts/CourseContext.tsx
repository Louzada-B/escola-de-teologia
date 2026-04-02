import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Course {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface CourseContextType {
  courses: Course[];
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
  selectedCourse: Course | null;
  isLoading: boolean;
}

const CourseContext = createContext<CourseContextType>({
  courses: [],
  selectedCourseId: null,
  setSelectedCourseId: () => {},
  selectedCourse: null,
  isLoading: false,
});

export const useCourse = () => useContext(CourseContext);

export function CourseProvider({ children }: { children: ReactNode }) {
  const { profile, user, loading: authLoading } = useAuth();
  const isAdminOrProfessor = profile?.role === 'admin' || profile?.role === 'professor';
  const isAdmin = profile?.role === 'admin';
  const isStudent = profile?.role === 'aluno';

  const [selectedCourseId, setSelectedCourseIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedCourseId');
    }
    return null;
  });

  const setSelectedCourseId = (id: string | null) => {
    setSelectedCourseIdState(id);
    if (id) {
      localStorage.setItem('selectedCourseId', id);
    } else {
      localStorage.removeItem('selectedCourseId');
    }
  };

  // Load all courses (for admin) or professor's courses
  const { data: allCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Course[];
    },
    enabled: !authLoading && !!user?.id,
  });

  // For professors: filter to only their assigned courses
  const { data: professorCourseIds = [] } = useQuery({
    queryKey: ['professor-courses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('course_professors')
        .select('course_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(d => d.course_id);
    },
    enabled: profile?.role === 'professor' && !!user?.id,
  });

  // For students: find courses via their cohorts
  const { data: studentCourseIds = [] } = useQuery({
    queryKey: ['student-courses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase
        .from('cohort_students')
        .select('cohort_id, cohorts!inner(course_id, is_active)')
        .eq('user_id', user.id)
        .eq('cohorts.is_active', true);
      if (!memberships) return [];
      return [...new Set(memberships.map((m: any) => m.cohorts.course_id).filter(Boolean))];
    },
    enabled: isStudent && !!user?.id,
  });

  // Compute visible courses based on role
  const courses = isAdmin
    ? allCourses
    : isStudent
      ? allCourses.filter(c => studentCourseIds.includes(c.id))
      : allCourses.filter(c => professorCourseIds.includes(c.id)); // professor

  // Auto-select first course if none selected
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
    // If selected course is not in the list, reset
    if (selectedCourseId && courses.length > 0 && !courses.find(c => c.id === selectedCourseId)) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || null;

  return (
    <CourseContext.Provider value={{
      courses,
      selectedCourseId,
      setSelectedCourseId,
      selectedCourse,
      isLoading: authLoading || coursesLoading,
    }}>
      {children}
    </CourseContext.Provider>
  );
}
