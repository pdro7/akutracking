import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import StudentDetail from "./pages/StudentDetail";
import Attendance from "./pages/Attendance";
import AttendanceHistory from "./pages/AttendanceHistory";
import Students from "./pages/Students";
import NewStudent from "./pages/NewStudent";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

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
            <Route path="/attendance" element={<ProtectedRoute><Header /><Attendance /></ProtectedRoute>} />
            <Route path="/attendance/history" element={<ProtectedRoute><Header /><AttendanceHistory /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><Header /><Students /></ProtectedRoute>} />
            <Route path="/students/new" element={<ProtectedRoute><Header /><NewStudent /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Header /><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
