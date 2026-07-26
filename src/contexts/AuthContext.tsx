import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  hasActiveCohort: boolean | null; // null = still checking, true/false for students
  hasCompletedCohort: boolean; // true se tem turma inativa (curso encerrado)
  hasEligibleCompletion: boolean; // true se completou com critérios mínimos
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  hasActiveCohort: null,
  hasCompletedCohort: false,
  hasEligibleCompletion: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveCohort, setHasActiveCohort] = useState<boolean | null>(null);
  const [hasCompletedCohort, setHasCompletedCohort] = useState<boolean>(false);
  const [hasEligibleCompletion, setHasEligibleCompletion] = useState<boolean>(false);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar perfil:', error.message);
      return null;
    }
    return data;
  };

  const checkCohortAccess = async (userId: string, role: string) => {
    // Admin and professor always have access
    if (role === 'admin' || role === 'professor') {
      setHasActiveCohort(true);
      return;
    }

    const { data, error } = await supabase
      .from('cohort_students')
      .select('cohort_id, cohorts!inner(is_active)')
      .eq('user_id', userId)
      .eq('cohorts.is_active', true);

    if (error) {
      console.error('Erro ao verificar turma:', error.message);
      setHasActiveCohort(true);
      return;
    }

    const active = data && data.length > 0;
    setHasActiveCohort(active);

    // Se não tem turma ativa, verifica se tem turma inativa (curso encerrado)
    if (!active) {
      const { data: inactiveData } = await supabase
        .from('cohort_students')
        .select('cohort_id, cohorts!inner(is_active)')
        .eq('user_id', userId)
        .eq('cohorts.is_active', false);
      const hasInactive = !!(inactiveData && inactiveData.length > 0);
      setHasCompletedCohort(hasInactive);

      if (hasInactive) {
        // Verifica critérios mínimos de formação
        const cohortId = (inactiveData![0] as any).cohort_id;
        const { data: cohortInfo } = await supabase
          .from('cohorts').select('start_date, end_date').eq('id', cohortId).single();

        if (cohortInfo) {
          const { data: lessons } = await supabase
            .from('lessons')
            .select('id, event_type')
            .gte('scheduled_date', cohortInfo.start_date)
            .lte('scheduled_date', cohortInfo.end_date)
            .eq('mandatory_attendance', true);

          const regular = (lessons || []).filter((l: any) => l.event_type === 'aula');
          const { data: att } = await supabase
            .from('attendance_records').select('lesson_id').eq('user_id', userId);
          const attIds = new Set((att || []).map((a: any) => a.lesson_id));
          const attDone = regular.filter((l: any) => attIds.has(l.id)).length;
          const attReg = regular.length > 0 ? (attDone / regular.length) * 100 : 100;

          const nowIso = new Date().toISOString();
          const { data: quizzes } = await supabase
            .from('quizzes').select('id').lte('available_from', nowIso);
          const totalQuiz = (quizzes || []).length;
          const { data: responses } = await supabase
            .from('quiz_responses').select('quiz_id').eq('user_id', userId);
          const answeredIds = new Set((responses || []).map((r: any) => r.quiz_id));
          const quizPct = totalQuiz > 0 ? (answeredIds.size / totalQuiz) * 100 : 100;

          setHasEligibleCompletion(attReg >= 75 && quizPct >= 75);
        }
      } else {
        setHasEligibleCompletion(false);
      }
    } else {
      setHasCompletedCohort(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setHasActiveCohort(null);
        setLoading(false);
        return;
      }

      const nextProfile = await loadProfile(nextSession.user.id);
      if (!isMounted) return;
      setProfile(nextProfile);

      if (nextProfile) {
        await checkCohortAccess(nextSession.user.id, nextProfile.role);
        // Log portal access (one record per session init)
        const today = new Date().toISOString().split('T')[0];
        supabase.from('access_logs').insert({ user_id: nextSession.user.id, access_date: today } as any).then();
      }

      if (!isMounted) return;
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      void syncAuthState(currentSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setHasActiveCohort(null);
  };

  const refreshProfile = async () => {
    if (session?.user) {
      const p = await loadProfile(session.user.id);
      setProfile(p);
      if (p) {
        await checkCohortAccess(session.user.id, p.role);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, hasActiveCohort, hasCompletedCohort, hasEligibleCompletion, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
