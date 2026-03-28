import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ModulesManager from '@/components/professor/ModulesManager';
import AnnouncementsManager from '@/components/professor/AnnouncementsManager';
import EventsManager from '@/components/professor/EventsManager';
import QuizzesManager from '@/components/professor/QuizzesManager';
import BooksManager from '@/components/professor/BooksManager';
import AttendanceSettingsManager from '@/components/professor/AttendanceSettingsManager';

export default function ProfessorPage() {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <h1 className="section-title mb-6">Gestão de Conteúdo</h1>
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList className="bg-card border flex-wrap">
          <TabsTrigger value="modules">Módulos & Aulas</TabsTrigger>
          <TabsTrigger value="announcements">Avisos</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="quizzes">Questionários</TabsTrigger>
          <TabsTrigger value="books">Livros</TabsTrigger>
          <TabsTrigger value="attendance">Presença</TabsTrigger>
        </TabsList>

        <TabsContent value="modules"><ModulesManager userId={user!.id} /></TabsContent>
        <TabsContent value="announcements"><AnnouncementsManager userId={user!.id} /></TabsContent>
        <TabsContent value="events"><EventsManager userId={user!.id} /></TabsContent>
        <TabsContent value="quizzes"><QuizzesManager userId={user!.id} /></TabsContent>
        <TabsContent value="books"><BooksManager userId={user!.id} /></TabsContent>
        <TabsContent value="attendance"><AttendanceSettingsManager userId={user!.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
