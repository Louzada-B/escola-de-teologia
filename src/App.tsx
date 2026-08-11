import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CohortProvider } from "@/contexts/CohortContext";
import { ProtectedRoute, ProfessorRoute, AdminRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import DefinirSenhaPage from "./pages/DefinirSenhaPage";
import DashboardHome from "./pages/DashboardHome";
import LessonsPage from "./pages/LessonsPage";
import ReadingPage from "./pages/ReadingPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import CalendarPage from "./pages/CalendarPage";
import QuizzesPage from "./pages/QuizzesPage";
import BooksPage from "./pages/BooksPage";
import ProfessorPage from "./pages/ProfessorPage";
import AttendancePage from "./pages/AttendancePage";
import ProfilePage from "./pages/ProfilePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import TestimonialsPage from "./pages/TestimonialsPage";
import EvaluationPage from "./pages/EvaluationPage";
import ExtraMaterialsPage from "./pages/ExtraMaterialsPage";
import TCCPage from "./pages/TCCPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const DashboardLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CohortProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/definir-senha" element={<DefinirSenhaPage />} />
              <Route path="/dashboard" element={<DashboardLayout><DashboardHome /></DashboardLayout>} />
              <Route path="/dashboard/aulas" element={<DashboardLayout><LessonsPage /></DashboardLayout>} />
              <Route path="/dashboard/leitura" element={<DashboardLayout><ReadingPage /></DashboardLayout>} />
              <Route path="/dashboard/avisos" element={<DashboardLayout><AnnouncementsPage /></DashboardLayout>} />
              <Route path="/dashboard/calendario" element={<DashboardLayout><CalendarPage /></DashboardLayout>} />
              <Route path="/dashboard/questionarios" element={<DashboardLayout><QuizzesPage /></DashboardLayout>} />
              <Route path="/dashboard/livros" element={<DashboardLayout><BooksPage /></DashboardLayout>} />
              <Route path="/dashboard/presenca" element={<DashboardLayout><AttendancePage /></DashboardLayout>} />
              <Route path="/dashboard/testemunhos" element={<DashboardLayout><TestimonialsPage /></DashboardLayout>} />
              <Route path="/dashboard/avaliacao" element={<DashboardLayout><EvaluationPage /></DashboardLayout>} />
              <Route path="/dashboard/materiais" element={<DashboardLayout><ExtraMaterialsPage /></DashboardLayout>} />
              <Route path="/dashboard/tcc" element={<DashboardLayout><TCCPage /></DashboardLayout>} />
              <Route path="/dashboard/perfil" element={<DashboardLayout><ProfilePage /></DashboardLayout>} />
              <Route path="/dashboard/professor" element={
                <ProtectedRoute>
                  <ProfessorRoute>
                    <AppLayout><ProfessorPage /></AppLayout>
                  </ProfessorRoute>
                </ProtectedRoute>
              } />
              <Route path="/dashboard/analises" element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AppLayout><AnalyticsPage /></AppLayout>
                  </AdminRoute>
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CohortProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
