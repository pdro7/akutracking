import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useUserRole } from "@/hooks/useUserRole";
import Dashboard from "./pages/Dashboard";
import StudentDetail from "./pages/StudentDetail";
import EditStudent from "./pages/EditStudent";
import Attendance from "./pages/Attendance";
import AttendanceHistory from "./pages/AttendanceHistory";
import Students from "./pages/Students";
import NewStudent from "./pages/NewStudent";
import TrialLeads from "./pages/TrialLeads";
import NewTrialLead from "./pages/NewTrialLead";
import TrialLeadDetail from "./pages/TrialLeadDetail";
import Settings from "./pages/Settings";
import Payments from "./pages/Payments";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import VirtualGroups from "./pages/VirtualGroups";
import VirtualGroupDetail from "./pages/VirtualGroupDetail";

const queryClient = new QueryClient();

// Redirects teachers to /virtual-groups; passes others through
function NoTeacher({ children }: { children: React.ReactNode }) {
  const { data: role, isLoading } = useUserRole();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (role === 'teacher') return <Navigate to="/virtual-groups" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {/* Teacher-accessible routes */}
            <Route path="/virtual-groups" element={<ProtectedRoute><Header /><VirtualGroups /></ProtectedRoute>} />
            <Route path="/virtual-groups/:id" element={<ProtectedRoute><Header /><VirtualGroupDetail /></ProtectedRoute>} />
            {/* Admin/staff-only routes */}
            <Route path="/" element={<ProtectedRoute><NoTeacher><Header /><Dashboard /></NoTeacher></ProtectedRoute>} />
            <Route path="/student/:id" element={<ProtectedRoute><NoTeacher><Header /><StudentDetail /></NoTeacher></ProtectedRoute>} />
            <Route path="/student/:id/edit" element={<ProtectedRoute><NoTeacher><Header /><EditStudent /></NoTeacher></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><NoTeacher><Header /><Attendance /></NoTeacher></ProtectedRoute>} />
            <Route path="/attendance/history" element={<ProtectedRoute><NoTeacher><Header /><AttendanceHistory /></NoTeacher></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><NoTeacher><Header /><Students /></NoTeacher></ProtectedRoute>} />
            <Route path="/students/new" element={<ProtectedRoute><NoTeacher><Header /><NewStudent /></NoTeacher></ProtectedRoute>} />
            <Route path="/trial-leads" element={<ProtectedRoute><NoTeacher><Header /><TrialLeads /></NoTeacher></ProtectedRoute>} />
            <Route path="/trial-leads/new" element={<ProtectedRoute><NoTeacher><Header /><NewTrialLead /></NoTeacher></ProtectedRoute>} />
            <Route path="/trial-leads/:id" element={<ProtectedRoute><NoTeacher><Header /><TrialLeadDetail /></NoTeacher></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><NoTeacher><Header /><Payments /></NoTeacher></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><NoTeacher><Header /><Settings /></NoTeacher></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
