import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldX } from "lucide-react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, profile, hasActiveCohort, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-body">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Block students without active cohort (block if not explicitly true)
  if (profile?.role === 'aluno' && hasActiveCohort !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Acesso Encerrado</h1>
          <p className="text-muted-foreground">
            Seu acesso ao portal está encerrado. Entre em contato com a coordenação.
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
