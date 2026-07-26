import { ReactNode } from "react";
import CourseCompletionPage from "@/pages/CourseCompletionPage";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldX } from "lucide-react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, profile, hasActiveCohort, hasCompletedCohort, signOut } = useAuth();

  // Still loading auth OR student cohort check not finished yet
  if (loading || (session && profile?.role === "aluno" && hasActiveCohort === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Block students without active cohort
  if (profile?.role === "aluno" && hasActiveCohort === false) {
    // Curso encerrado (turma desativada) → tela de conclusão
    if (hasCompletedCohort) return <CourseCompletionPage />;

    // Sem turma alguma → tela genérica de aguardo
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Sem acesso!</h1>
          <p className="text-muted-foreground">Você está sem acesso no momento.</p>
          <p className="text-muted-foreground">
            Se você é um aluno de uma turma ativa, aguarde aprovação da coordenação.
          </p>
          <Button onClick={signOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function ProfessorRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Carregando...</div>
      </div>
    );
  }

  if (profile?.role !== "professor" && profile?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Carregando...</div>
      </div>
    );
  }

  if (profile?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
