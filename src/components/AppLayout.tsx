import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
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
  FolderOpen,
  GraduationCap,
  ShieldCheck,
  BookOpenCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import CohortSelector from "@/components/CohortSelector";
import NotificationBell from "@/components/NotificationBell";
import HelpDrawer from "@/components/HelpDrawer";
import { getHelpContent } from "@/lib/helpContent";
import { HelpCircle } from "lucide-react";
import { useCohort } from "@/contexts/CohortContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isImpersonating, impersonatedName, stopImpersonation } = useImpersonation();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpContent = getHelpContent(location.pathname);
  const isProfessor = profile?.role === "professor";
  const isAdmin = profile?.role === "admin";
  const isDev = profile?.email === "brunoellouzada@gmail.com2"
  const isStudent = profile?.role === "aluno";

  const { selectedCohort } = useCohort();
  const studentCohortName = isStudent && selectedCohort ? selectedCohort.name : null;

  const navItems = [
    { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
    { to: "/dashboard/avisos", label: "Avisos", icon: MessageSquare },
    { to: "/dashboard/aulas", label: "Aulas", icon: BookOpen },
    { to: "/dashboard/presenca", label: "Presença", icon: UserCheck },
    { to: "/dashboard/leitura", label: "Leitura", icon: BookOpenCheck },
    { to: "/dashboard/questionarios", label: "Questionários", icon: ClipboardList },
    { to: "/dashboard/calendario", label: "Calendário", icon: CalendarDays },
    { to: "/dashboard/livros", label: "Livros", icon: BookMarked },
    { to: "/dashboard/materiais", label: "Materiais Extras", icon: FolderOpen },
    { to: "/dashboard/testemunhos", label: "Testemunhos", icon: Heart },
    { to: "/dashboard/tcc", label: "TCC", icon: GraduationCap },
    { to: "/dashboard/avaliacao", label: "Avaliação", icon: ClipboardCheck },
    { to: "/dashboard/perfil", label: "Meu Perfil", icon: User },
    ...(isProfessor || isAdmin ? [{ to: "/dashboard/professor", label: "Gestão", icon: Upload }] : []),
    ...(isDev ? [{ to: "/dashboard/analises", label: "Análises", icon: BarChart2 }] : []),
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isImpersonating && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium shrink-0 z-50">
          <span>Você está vendo como <strong>{impersonatedName}</strong></span>
          <button
            type="button"
            onClick={() => stopImpersonation()}
            className="underline font-semibold shrink-0 whitespace-nowrap"
          >
            Voltar a ser admin
          </button>
        </div>
      )}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b bg-card relative z-40">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <span className="font-heading font-semibold text-foreground">Formação Teológica</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground shrink-0"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </header>

      {/* Menu mobile em cascata -- substitui a tela cheia antiga só no mobile;
          desktop continua usando o <aside> de sempre, sem alteração. */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/20 z-30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="lg:hidden fixed right-4 top-16 z-40 flex flex-col items-end gap-1.5 max-h-[calc(100vh-80px)] overflow-y-auto pb-2">
            {navItems.map((item, i) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-sm shadow-md border animate-in fade-in slide-in-from-right-2",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border"
                  )}
                  style={{ animationDelay: `${i * 20}ms`, animationDuration: "180ms" }}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => { setMobileOpen(false); signOut(); }}
              className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-sm shadow-md border bg-card text-destructive border-border animate-in fade-in slide-in-from-right-2"
              style={{ animationDelay: `${navItems.length * 20}ms`, animationDuration: "180ms" }}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Sair</span>
            </button>
          </div>
        </>
      )}

      {/* Sidebar -- desktop apenas; mobile usa o menu em cascata acima */}
      <aside className="hidden lg:flex w-64 bg-sidebar text-sidebar-foreground flex-shrink-0 flex-col border-r border-sidebar-border h-full">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center border",
              profile?.role === "admin"
                ? "bg-purple-500/10 border-purple-400/30"
                : profile?.role === "professor"
                ? "bg-blue-400/10 border-blue-400/30"
                : "bg-amber-400/10 border-amber-400/30"
            )}>
              {profile?.role === "admin"
                ? <ShieldCheck className="w-5 h-5 text-purple-300" />
                : profile?.role === "professor"
                ? <GraduationCap className="w-5 h-5 text-blue-300" />
                : <BookOpen className="w-5 h-5 text-amber-400" />
              }
            </div>
            <div>
              <h1 className="font-heading font-semibold text-sm">Formação Teológica</h1>
              <p className="text-xs text-sidebar-foreground/60">
                {profile?.full_name
                  ? `Bem-vindo(a), ${profile.full_name.split(' ')[0]}!`
                  : "Bem-vindo(a)!"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto sidebar-scroll">
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
        <div className="px-4 pb-3">
          <p
            className="text-[10px] text-sidebar-foreground select-none opacity-0 transition-opacity duration-500 hover:opacity-40 cursor-default"
            title=""
          >
            Desenvolvido por Bruno Louzada
          </p>
        </div>
      </aside>

      {/* Main content + Help drawer */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto h-full">
          <div className="px-4 pt-3 md:px-8 md:pt-4 flex items-center justify-end gap-3">
            {(isProfessor || isAdmin) && <CohortSelector />}
            <NotificationBell />
            {helpContent && (
              <button
                type="button"
                onClick={() => setHelpOpen(h => !h)}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Ajuda"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          {children}
        </main>
        <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={helpContent} />
      </div>
      </div>
    </div>
  );
}
