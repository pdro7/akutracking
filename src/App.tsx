import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Header /><Dashboard /></ProtectedRoute>} />
            <Route path="/student/:id" element={<ProtectedRoute><Header /><StudentDetail /></ProtectedRoute>} />
            <Route path="/student/:id/edit" element={<ProtectedRoute><Header /><EditStudent /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Header /><Attendance /></ProtectedRoute>} />
            <Route path="/attendance/history" element={<ProtectedRoute><Header /><AttendanceHistory /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><Header /><Students /></ProtectedRoute>} />
            <Route path="/students/new" element={<ProtectedRoute><Header /><NewStudent /></ProtectedRoute>} />
            <Route path="/trial-leads" element={<ProtectedRoute><Header /><TrialLeads /></ProtectedRoute>} />
            <Route path="/trial-leads/new" element={<ProtectedRoute><Header /><NewTrialLead /></ProtectedRoute>} />
            <Route path="/trial-leads/:id" element={<ProtectedRoute><Header /><TrialLeadDetail /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Header /><Payments /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Header /><Settings /></ProtectedRoute>} />
            <Route path="/virtual-groups" element={<ProtectedRoute><Header /><VirtualGroups /></ProtectedRoute>} />
            <Route path="/virtual-groups/:id" element={<ProtectedRoute><Header /><VirtualGroupDetail /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
