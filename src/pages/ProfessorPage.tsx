import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function ProfessorPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Gestão de Conteúdo</h1>
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList className="bg-card border h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="modules" className="text-xs sm:text-sm">
            Módulos & Aulas
          </TabsTrigger>
          <TabsTrigger value="announcements" className="text-xs sm:text-sm">
            Avisos
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs sm:text-sm">
            Eventos
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="text-xs sm:text-sm">
            Questionários
          </TabsTrigger>
          <TabsTrigger value="books" className="text-xs sm:text-sm">
            Livros
          </TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs sm:text-sm">
            Presença
          </TabsTrigger>
          <TabsTrigger value="cohorts" className="text-xs sm:text-sm">
            Turmas
          </TabsTrigger>
          <TabsTrigger value="testimonials" className="text-xs sm:text-sm">
            Testemunhos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="evaluations" className="text-xs sm:text-sm">
              Avaliações
            </TabsTrigger>
          )}
          <TabsTrigger value="extra-materials" className="text-xs sm:text-sm">
            Materiais Extras
          </TabsTrigger>
          <TabsTrigger value="tcc" className="text-xs sm:text-sm">
            TCC
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs sm:text-sm">
            Importar Dados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules">
          <ModulesManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="events">
          <EventsManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="quizzes">
          <QuizzesManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="books">
          <BooksManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceSettingsManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="cohorts">
          <CohortsManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="testimonials">
          <TestimonialsManager userId={user!.id} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="evaluations">
            <EvaluationsManager />
          </TabsContent>
        )}
        <TabsContent value="extra-materials">
          <ExtraMaterialsManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="tcc">
          <TCCManager userId={user!.id} />
        </TabsContent>
        <TabsContent value="import">
          <ImportDataManager userId={user!.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
