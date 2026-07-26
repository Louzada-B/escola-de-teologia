import { useState } from "react";
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
import { cn } from "@/lib/utils";

interface NavItem {
  value: string;
  label: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Conteúdo",
    items: [
      { value: "modules", label: "Módulos & Aulas" },
      { value: "quizzes", label: "Questionários" },
      { value: "books", label: "Livros" },
      { value: "extra-materials", label: "Materiais Extras" },
    ],
  },
  {
    label: "Alunos",
    items: [
      { value: "students", label: "Alunos", adminOnly: true },
      { value: "attendance", label: "Presença" },
      { value: "cohorts", label: "Turmas" },
      { value: "certificates", label: "Certificados", adminOnly: true },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { value: "announcements", label: "Avisos" },
      { value: "events", label: "Eventos" },
      { value: "testimonials", label: "Testemunhos" },
    ],
  },
  {
    label: "Curso",
    items: [
      { value: "tcc", label: "TCC" },
      { value: "evaluations", label: "Avaliações", adminOnly: true },
      { value: "import", label: "Importar Dados" },
    ],
  },
];

function SectionContent({ value, userId }: { value: string; userId: string }) {
  switch (value) {
    case "modules":      return <ModulesManager userId={userId} />;
    case "announcements":return <AnnouncementsManager userId={userId} />;
    case "events":       return <EventsManager userId={userId} />;
    case "quizzes":      return <QuizzesManager userId={userId} />;
    case "books":        return <BooksManager userId={userId} />;
    case "attendance":   return <AttendanceSettingsManager userId={userId} />;
    case "cohorts":      return <CohortsManager userId={userId} />;
    case "testimonials": return <TestimonialsManager userId={userId} />;
    case "evaluations":  return <EvaluationsManager />;
    case "extra-materials": return <ExtraMaterialsManager userId={userId} />;
    case "tcc":          return <TCCManager userId={userId} />;
    case "import":       return <ImportDataManager userId={userId} />;
    case "students":     return <StudentsManager />;
    case "certificates": return <CertificatesManager />;
    default:             return null;
  }
}

export default function ProfessorPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [active, setActive] = useState("modules");

  const visibleGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(i => !i.adminOnly || isAdmin),
  })).filter(g => g.items.length > 0);

  const allItems = visibleGroups.flatMap(g => g.items);
  const activeLabel = allItems.find(i => i.value === active)?.label ?? "";

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Gestão de Conteúdo</h1>

      <div className="flex gap-6 items-start">

        {/* ── Sidebar desktop ── */}
        <nav className="hidden lg:flex flex-col w-48 shrink-0 bg-card border border-border rounded-xl overflow-hidden sticky top-4">
          {visibleGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="border-t border-border" />}
              <p className="px-4 pt-3 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                {group.label}
              </p>
              {group.items.map(item => (
                <button
                  key={item.value}
                  onClick={() => setActive(item.value)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm font-body transition-colors",
                    active === item.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Select mobile ── */}
        <div className="lg:hidden w-full mb-4">
          <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
            Seção
          </label>
          <select
            value={active}
            onChange={e => setActive(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {visibleGroups.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">
          <SectionContent value={active} userId={user!.id} />
        </div>

      </div>
    </div>
  );
}
