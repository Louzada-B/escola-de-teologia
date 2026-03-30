import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen,
  LayoutDashboard,
  Upload,
  MessageSquare,
  CalendarDays,
  ClipboardList,
  BookMarked,
  LogOut,
  Menu,
  X,
  UserCheck,
  User,
  BarChart2,
  Heart,
  ClipboardCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import CohortSelector from "@/components/CohortSelector";
import { useCohort } from "@/contexts/CohortContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isProfessor = profile?.role === "professor";
  const isAdmin = profile?.role === "admin";
  const isStudent = profile?.role === "aluno";

  const { selectedCohort } = useCohort();
  const studentCohortName = isStudent && selectedCohort ? selectedCohort.name : null;

  const navItems = [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
    { to: "/dashboard/aulas", label: "Aulas", icon: BookOpen },
    { to: "/dashboard/avisos", label: "Avisos", icon: MessageSquare },
    { to: "/dashboard/calendario", label: "Calendário", icon: CalendarDays },
    { to: "/dashboard/questionarios", label: "Questionários", icon: ClipboardList },
    { to: "/dashboard/livros", label: "Livros", icon: BookMarked },
    { to: "/dashboard/presenca", label: "Presença", icon: UserCheck },
    { to: "/dashboard/testemunhos", label: "Testemunhos", icon: Heart },
    { to: "/dashboard/perfil", label: "Meu Perfil", icon: User },
    ...(isProfessor || isAdmin ? [{ to: "/dashboard/professor", label: "Gestão", icon: Upload }] : []),
    ...(isAdmin ? [{ to: "/dashboard/analises", label: "Análises", icon: BarChart2 }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <span className="font-heading font-semibold text-foreground">Escola de Teologia</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 bg-sidebar text-sidebar-foreground flex-shrink-0 flex flex-col border-r border-sidebar-border",
          "lg:flex",
          mobileOpen ? "flex absolute z-50 inset-0 lg:relative" : "hidden",
        )}
      >
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading font-semibold text-sm">Escola de Teologia</h1>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{profile?.role || "aluno"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isStudent && studentCohortName && (
          <div className="px-4 py-2 border-t border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/60">Turma</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate">{studentCohortName}</p>
          </div>
        )}

        <div className="p-4 border-t border-sidebar-border">
          <Link
            to="/dashboard/perfil"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity"
          >
            <Avatar className="w-8 h-8 text-xs">
              <AvatarImage src={(profile as any)?.avatar_url || undefined} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {(profile?.full_name || profile?.email || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-sidebar-foreground truncate">{profile?.full_name || profile?.email}</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {(isProfessor || isAdmin) && (
          <div className="px-4 pt-3 md:px-8 md:pt-4 flex justify-end">
            <CohortSelector />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
