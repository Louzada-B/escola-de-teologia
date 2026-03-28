import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, ProfessorRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import DashboardHome from "./pages/DashboardHome";
import LessonsPage from "./pages/LessonsPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import CalendarPage from "./pages/CalendarPage";
import QuizzesPage from "./pages/QuizzesPage";
import BooksPage from "./pages/BooksPage";
import ProfessorPage from "./pages/ProfessorPage";
import AttendancePage from "./pages/AttendancePage";
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
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<DashboardLayout><DashboardHome /></DashboardLayout>} />
            <Route path="/dashboard/aulas" element={<DashboardLayout><LessonsPage /></DashboardLayout>} />
            <Route path="/dashboard/avisos" element={<DashboardLayout><AnnouncementsPage /></DashboardLayout>} />
            <Route path="/dashboard/calendario" element={<DashboardLayout><CalendarPage /></DashboardLayout>} />
            <Route path="/dashboard/questionarios" element={<DashboardLayout><QuizzesPage /></DashboardLayout>} />
            <Route path="/dashboard/livros" element={<DashboardLayout><BooksPage /></DashboardLayout>} />
            <Route path="/dashboard/presenca" element={<DashboardLayout><AttendancePage /></DashboardLayout>} />
            <Route path="/dashboard/professor" element={
              <ProtectedRoute>
                <ProfessorRoute>
                  <AppLayout><ProfessorPage /></AppLayout>
                </ProfessorRoute>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
