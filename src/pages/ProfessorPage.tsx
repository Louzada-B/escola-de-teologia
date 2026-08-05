import { useAuth } from "@/contexts/AuthContext";
import ModulesManager from "@/components/professor/ModulesManager";
import AnnouncementsManager from "@/components/professor/AnnouncementsManager";
import EventsManager from "@/components/professor/EventsManager";
import QuizzesManager from "@/components/professor/QuizzesManager";
import BooksManager from "@/components/professor/BooksManager";
import AttendanceSettingsManager from "@/components/professor/AttendanceSettingsManager";
import CohortsManager from "@/components/professor/CohortsManager";
import ImportDataManager from "@/components/professor/ImportDataManager";
import TestimonialsManager from "@/components/professor/TestimonialsManager";
import EvaluationsManager from "@/components/professor/EvaluationsManager";
import ExtraMaterialsManager from "@/components/professor/ExtraMaterialsManager";
import TCCManager from "@/components/professor/TCCManager";
import CertificatesManager from "@/components/professor/CertificatesManager";
import StudentsManager from "@/components/professor/StudentsManager";
import TempPasswordsManager from "@/components/professor/TempPasswordsManager";
import CoursesManager from "@/components/professor/CoursesManager";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import ManualModal from "@/components/ManualModal";

interface NavItem { value: string; label: string; adminOnly?: boolean; superAdminOnly?: boolean; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Escola de Teologia",
    items: [
      { value: "courses", label: "Cursos", adminOnly: true },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { value: "modules",         label: "Módulos & Aulas" },
      { value: "quizzes",         label: "Questionários" },
      { value: "books",           label: "Livros" },
      { value: "extra-materials", label: "Materiais Extras" },
    ],
  },
  {
    label: "Alunos",
    items: [
      { value: "students",       label: "Alunos",              adminOnly: true },
      { value: "attendance",     label: "Presença" },
      { value: "cohorts",        label: "Turmas" },
      { value: "certificates",   label: "Certificados",        adminOnly: true },
      { value: "temp-passwords", label: "Senhas Temporárias",  superAdminOnly: true },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { value: "announcements", label: "Avisos" },
      { value: "events",        label: "Eventos" },
      { value: "testimonials",  label: "Testemunhos" },
    ],
  },
  {
    label: "Curso",
    items: [
      { value: "tcc",         label: "TCC" },
      { value: "evaluations", label: "Avaliações",    adminOnly: true },
      { value: "import",      label: "Importar Dados" },
    ],
  },
];

function SectionContent({ value, userId }: { value: string; userId: string }) {
  switch (value) {
    case "modules":          return <ModulesManager userId={userId} />;
    case "announcements":    return <AnnouncementsManager userId={userId} />;
    case "events":           return <EventsManager userId={userId} />;
    case "quizzes":          return <QuizzesManager userId={userId} />;
    case "books":            return <BooksManager userId={userId} />;
    case "attendance":       return <AttendanceSettingsManager userId={userId} />;
    case "cohorts":          return <CohortsManager userId={userId} />;
    case "testimonials":     return <TestimonialsManager userId={userId} />;
    case "evaluations":      return <EvaluationsManager />;
    case "extra-materials":  return <ExtraMaterialsManager userId={userId} />;
    case "tcc":              return <TCCManager userId={userId} />;
    case "import":           return <ImportDataManager userId={userId} />;
    case "students":         return <StudentsManager />;
    case "certificates":     return <CertificatesManager />;
    case "temp-passwords":   return <TempPasswordsManager />;
    case "courses":          return <CoursesManager />;
    default:                 return null;
  }
}

export default function ProfessorPage() {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.is_super_admin === true;
  const isAdmin = profile?.role === "admin" || isSuperAdmin;
  const [active, setActive] = useState("modules");
  const [manualOpen, setManualOpen] = useState(false);

  const visibleGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(i => (!i.adminOnly || isAdmin) && (!i.superAdminOnly || isSuperAdmin)),
  })).filter(g => g.items.length > 0);

  const allItems = visibleGroups.flatMap(g => g.items);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="section-title">Gestão de Conteúdo</h1>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Manual</span>
        </button>
      </div>
      <ManualModal open={manualOpen} onClose={() => setManualOpen(false)} />

      {/* ── Nav desktop: grupos com separadores verticais ── */}
      <div className="hidden md:flex border border-border rounded-xl bg-card mb-6 overflow-hidden">
        {visibleGroups.map((group, gi) => (
          <div
            key={group.label}
            className={cn(
              "flex flex-col py-3 px-4 flex-1",
              gi > 0 && "border-l border-border"
            )}
          >
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
              {group.label}
            </span>
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setActive(item.value)}
                  className={cn(
                    "text-left px-2 py-1.5 rounded-md text-sm font-body transition-colors whitespace-nowrap",
                    active === item.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Select mobile ── */}
      <div className="md:hidden mb-4">
        <select
          value={active}
          onChange={e => setActive(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {visibleGroups.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* ── Conteúdo ── */}
      <SectionContent value={active} userId={user!.id} />
    </div>
  );
}
