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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  hasActiveCohort: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveCohort, setHasActiveCohort] = useState<boolean | null>(null);

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
      // On error, allow access to avoid blocking
      setHasActiveCohort(true);
      return;
    }

    setHasActiveCohort(data && data.length > 0);
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
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, hasActiveCohort, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
