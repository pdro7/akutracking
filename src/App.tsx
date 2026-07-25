import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useUserRole, useAuthCacheInvalidation } from "@/hooks/useUserRole";
import Dashboard from "./pages/Dashboard";
import StudentDetail from "./pages/StudentDetail";
import EditStudent from "./pages/EditStudent";
import Students from "./pages/Students";
import NewStudent from "./pages/NewStudent";
import TrialLeads from "./pages/TrialLeads";
import NewTrialLead from "./pages/NewTrialLead";
import TrialLeadDetail from "./pages/TrialLeadDetail";
import Leads from "./pages/Leads";
import NewLead from "./pages/NewLead";
import LeadDetail from "./pages/LeadDetail";
import ImportLeads from "./pages/ImportLeads";
import Settings from "./pages/Settings";
import Payments from "./pages/Payments";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import VirtualGroups from "./pages/VirtualGroups";
import VirtualGroupDetail from "./pages/VirtualGroupDetail";
import Conversations from "./pages/Conversations";
import PabloStats from "./pages/PabloStats";
import InstagramConversations from "./pages/InstagramConversations";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TeacherAvailability from "./pages/TeacherAvailability";
import SetPassword from "./pages/SetPassword";
import PublicInterest from "./pages/PublicInterest";
import TokenizedPreferences from "./pages/TokenizedPreferences";
import Schedule from "./pages/Schedule";
import EligibleStudents from "./pages/EligibleStudents";
import TeacherTrials from "./pages/TeacherTrials";

const queryClient = new QueryClient();

// Routes staff/admin through; teachers land on /virtual-groups; anyone else
// (no role assigned) sees a "no access" screen instead of default staff privileges.
function NoTeacher({ children }: { children: React.ReactNode }) {
  const { data: role, isLoading } = useUserRole();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (role === 'teacher') return <Navigate to="/virtual-groups" replace />;
  if (role === 'admin' || role === 'staff') return <>{children}</>;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Sin acceso</h1>
        <p className="text-muted-foreground">
          Tu cuenta no tiene rol asignado. Contacta con un administrador.
        </p>
      </div>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  useAuthCacheInvalidation();
  return <div className="min-h-screen bg-background">{children}</div>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/interes" element={<PublicInterest />} />
            <Route path="/preferencias/:token" element={<TokenizedPreferences />} />
            {/* Teacher-accessible routes */}
            <Route path="/virtual-groups" element={<ProtectedRoute><Header /><VirtualGroups /></ProtectedRoute>} />
            <Route path="/virtual-groups/:id" element={<ProtectedRoute><Header /><VirtualGroupDetail /></ProtectedRoute>} />
            <Route path="/teacher/availability" element={<ProtectedRoute><Header /><TeacherAvailability /></ProtectedRoute>} />
            <Route path="/teacher/trials" element={<ProtectedRoute><Header /><TeacherTrials /></ProtectedRoute>} />
            <Route path="/calendario" element={<ProtectedRoute><Header /><Schedule /></ProtectedRoute>} />
            {/* Admin/staff-only routes */}
            <Route path="/" element={<ProtectedRoute><NoTeacher><Header /><Dashboard /></NoTeacher></ProtectedRoute>} />
            <Route path="/student/:id" element={<ProtectedRoute><NoTeacher><Header /><StudentDetail /></NoTeacher></ProtectedRoute>} />
            <Route path="/student/:id/edit" element={<ProtectedRoute><NoTeacher><Header /><EditStudent /></NoTeacher></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><NoTeacher><Header /><Students /></NoTeacher></ProtectedRoute>} />
            <Route path="/students/new" element={<ProtectedRoute><NoTeacher><Header /><NewStudent /></NoTeacher></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><NoTeacher><Header /><Leads /></NoTeacher></ProtectedRoute>} />
            <Route path="/leads/new" element={<ProtectedRoute><NoTeacher><Header /><NewLead /></NoTeacher></ProtectedRoute>} />
            <Route path="/leads/import" element={<ProtectedRoute><NoTeacher><Header /><ImportLeads /></NoTeacher></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><NoTeacher><Header /><LeadDetail /></NoTeacher></ProtectedRoute>} />
            <Route path="/trial-leads" element={<ProtectedRoute><NoTeacher><Header /><TrialLeads /></NoTeacher></ProtectedRoute>} />
            <Route path="/trial-leads/new" element={<ProtectedRoute><NoTeacher><Header /><NewTrialLead /></NoTeacher></ProtectedRoute>} />
            <Route path="/trial-leads/:id" element={<ProtectedRoute><NoTeacher><Header /><TrialLeadDetail /></NoTeacher></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><NoTeacher><Header /><Payments /></NoTeacher></ProtectedRoute>} />
            <Route path="/conversations" element={<ProtectedRoute><NoTeacher><Header /><Conversations /></NoTeacher></ProtectedRoute>} />
            <Route path="/pablo-stats" element={<ProtectedRoute><NoTeacher><Header /><PabloStats /></NoTeacher></ProtectedRoute>} />
            <Route path="/instagram" element={<ProtectedRoute><NoTeacher><Header /><InstagramConversations /></NoTeacher></ProtectedRoute>} />
            <Route path="/candidatos" element={<ProtectedRoute><NoTeacher><Header /><EligibleStudents /></NoTeacher></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><NoTeacher><Header /><Settings /></NoTeacher></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
